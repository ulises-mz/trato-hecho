/* Servidor de Trato Hecho: sirve la web y da el canal en vivo entre dispositivos.
   Sin dependencias: http y node:sqlite (Node 22.13 o más). Guarda cada sesión como un árbol
   JSON en una tabla y avisa a los conectados por eventos (SSE) cada vez que algo cambia.

   API, todo bajo /api/sesiones/<sesion>:
     GET    /                      el árbol completo
     GET    /eventos               flujo SSE: manda el árbol completo en cada cambio
     POST   /escribir  {ruta, datos, modo}   modo "fusionar" (update) o "fijar" (set; datos null borra)
     DELETE /                      borra la sesión
   Las rutas son como en Firebase: "salas/3/gente/abc". Nombres de sesión: letras, números, guion. */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PUERTO = parseInt(process.env.PORT || "3000", 10);
const RAIZ = path.resolve(__dirname, "..");
const CARPETA_DATOS = process.env.DATOS || path.join(RAIZ, "datos");
const MAX_CUERPO = 64 * 1024;
/* Versión de los archivos estáticos: un hash de todos los .js y .css de la carpeta, calculado al
   arrancar. index.html la recibe en los «?v=__V__» de sus scripts y hojas. Así cada despliegue cambia
   las direcciones y ningún navegador (ni Cloudflare, que alarga la caché de .js y .css a cuatro horas)
   se queda con código viejo: basta una recarga normal. */
// Versión = hash de los .js/.css y de video/ (mp4, vtt, póster): el HTML la pone en ?v= y así un archivo
// nuevo nunca se queda atrapado en la caché del navegador ni en la de Cloudflare.
const VERSION = (() => {
  const h = crypto.createHash("sha1");
  const sumar = (dir, filtro) => { if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).sort()) if (filtro.test(f)) h.update(fs.readFileSync(path.join(dir, f))); };
  sumar(RAIZ, /\.(js|css)$/); sumar(path.join(RAIZ, "video"), /\.(mp4|vtt|jpg)$/);
  return h.digest("hex").slice(0, 10);
})();
const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".pdf": "application/pdf", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8", ".mp4": "video/mp4", ".webm": "video/webm", ".vtt": "text/vtt; charset=utf-8", ".jpg": "image/jpeg", ".srt": "text/plain; charset=utf-8" };

/* ---------- almacenamiento: SQLite si existe node:sqlite, si no un archivo JSON ---------- */
fs.mkdirSync(CARPETA_DATOS, { recursive: true });
let almacen;
try {
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(path.join(CARPETA_DATOS, "trato-hecho.sqlite"));
  db.exec("CREATE TABLE IF NOT EXISTS sesiones (nombre TEXT PRIMARY KEY, arbol TEXT NOT NULL, actualizado INTEGER NOT NULL)");
  const leer = db.prepare("SELECT arbol FROM sesiones WHERE nombre = ?");
  const guardar = db.prepare("INSERT INTO sesiones (nombre, arbol, actualizado) VALUES (?, ?, ?) ON CONFLICT(nombre) DO UPDATE SET arbol = excluded.arbol, actualizado = excluded.actualizado");
  const borrar = db.prepare("DELETE FROM sesiones WHERE nombre = ?");
  almacen = {
    tipo: "sqlite",
    leer: n => { const f = leer.get(n); return f ? JSON.parse(f.arbol) : {}; },
    guardar: (n, a) => guardar.run(n, JSON.stringify(a), Date.now()),
    borrar: n => borrar.run(n)
  };
} catch (e) {
  const archivo = path.join(CARPETA_DATOS, "sesiones.json");
  const todo = fs.existsSync(archivo) ? JSON.parse(fs.readFileSync(archivo, "utf8")) : {};
  const persistir = () => fs.writeFileSync(archivo, JSON.stringify(todo));
  almacen = { tipo: "json", leer: n => todo[n] || {}, guardar: (n, a) => { todo[n] = a; persistir(); }, borrar: n => { delete todo[n]; persistir(); } };
}
console.log("almacenamiento:", almacen.tipo, "en", CARPETA_DATOS);

/* ---------- árbol ---------- */
const partesDe = ruta => String(ruta || "").split("/").filter(Boolean);
function poner(arbol, ruta, valor, fusionar) {
  const partes = partesDe(ruta);
  if (!partes.length) return valor === null ? {} : (fusionar ? Object.assign(arbol, valor) : valor);
  let o = arbol;
  for (let i = 0; i < partes.length - 1; i++) { if (!o[partes[i]] || typeof o[partes[i]] !== "object") o[partes[i]] = {}; o = o[partes[i]]; }
  const k = partes[partes.length - 1];
  if (valor === null) delete o[k];
  else if (fusionar && o[k] && typeof o[k] === "object" && typeof valor === "object" && !Array.isArray(valor)) Object.assign(o[k], valor);
  else o[k] = valor;
  return arbol;
}

/* ---------- eventos ---------- */
const oyentes = new Map(); // sesion -> Set<res>
// Al conectarse, cada cliente recibe el árbol completo ("arbol"); después solo cada cambio ("cambio":
// {ruta, datos, modo}), que aplica localmente. Así 30 celulares con latidos cada 20 s no bajan el árbol entero cada vez.
function avisar(sesion, evento, cuerpo) {
  const linea = `event: ${evento}\ndata: ${JSON.stringify(cuerpo)}\n\n`;
  for (const res of oyentes.get(sesion) || []) { try { res.write(linea); } catch (e) { /* se fue */ } }
}
setInterval(() => { for (const grupo of oyentes.values()) for (const res of grupo) { try { res.write(": latido\n\n"); } catch (e) { /* nada */ } } }, 25000);

/* ---------- utilidades http ---------- */
const json = (res, codigo, cuerpo) => { res.writeHead(codigo, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(JSON.stringify(cuerpo)); };
function leerCuerpo(req) {
  return new Promise((resolver, rechazar) => {
    let datos = ""; req.on("data", t => { datos += t; if (datos.length > MAX_CUERPO) { rechazar(new Error("cuerpo demasiado grande")); req.destroy(); } });
    req.on("end", () => { try { resolver(datos ? JSON.parse(datos) : {}); } catch (e) { rechazar(new Error("JSON inválido")); } });
    req.on("error", rechazar);
  });
}
const sesionValida = s => /^[\w-]{1,40}$/.test(s);

/* ---------- servidor ---------- */
const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const m = url.pathname.match(/^\/api\/sesiones\/([^/]+)(\/eventos|\/escribir)?\/?$/);
  if (m) {
    const sesion = m[1], accion = m[2] || "";
    if (!sesionValida(sesion)) return json(res, 400, { error: "nombre de sesión inválido" });
    if (req.method === "GET" && accion === "/eventos") {
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", "Connection": "keep-alive", "X-Accel-Buffering": "no" });
      res.write(`event: arbol\ndata: ${JSON.stringify(almacen.leer(sesion))}\n\n`);
      if (!oyentes.has(sesion)) oyentes.set(sesion, new Set());
      oyentes.get(sesion).add(res);
      req.on("close", () => { oyentes.get(sesion).delete(res); });
      return;
    }
    if (req.method === "GET" && !accion) return json(res, 200, almacen.leer(sesion));
    if (req.method === "POST" && accion === "/escribir") {
      let cuerpo; try { cuerpo = await leerCuerpo(req); } catch (e) { return json(res, 400, { error: e.message }); }
      if (typeof cuerpo.ruta !== "string") return json(res, 400, { error: "falta la ruta" });
      const arbol = poner(almacen.leer(sesion), cuerpo.ruta, cuerpo.datos === undefined ? null : cuerpo.datos, cuerpo.modo !== "fijar");
      almacen.guardar(sesion, arbol); avisar(sesion, "cambio", { ruta: cuerpo.ruta, datos: cuerpo.datos === undefined ? null : cuerpo.datos, modo: cuerpo.modo === "fijar" ? "fijar" : "fusionar" });
      return json(res, 200, { ok: true });
    }
    if (req.method === "DELETE" && !accion) { almacen.borrar(sesion); avisar(sesion, "arbol", {}); return json(res, 200, { ok: true }); }
    return json(res, 405, { error: "método no permitido" });
  }
  if (url.pathname === "/api/salud") return json(res, 200, { ok: true, version: VERSION, almacenamiento: almacen.tipo, sesiones_conectadas: [...oyentes.entries()].map(([s, g]) => ({ sesion: s, conectados: g.size })) });
  // archivos estáticos, con direcciones limpias (/fichas -> fichas.html)
  let ruta = decodeURIComponent(url.pathname);
  const privada = /^\/(servidor|datos|Dockerfile)(\/|$)/.test(ruta) || /^\/\.|\/\./.test(ruta); // el código del servidor, la base y los archivos ocultos no se sirven
  // Los 404 van con no-store: si no, Cloudflare cachea el 404 cinco minutos y un archivo recién
  // desplegado sigue «sin existir» aunque el contenedor nuevo ya lo sirva.
  const noEncontrado = () => { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }); res.end("No encontrado"); };
  if (ruta.includes("..") || privada) return noEncontrado();
  if (ruta === "/") ruta = "/index.html";
  let archivo = path.join(RAIZ, ruta);
  if (!path.extname(archivo) && fs.existsSync(archivo + ".html")) archivo += ".html";
  if (!fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) return noEncontrado();
  const ext = path.extname(archivo);
  if (ext === ".html") {   // las páginas nunca se guardan y llevan la versión de sus archivos
    const cuerpo = fs.readFileSync(archivo, "utf8").split("__V__").join(VERSION);
    res.writeHead(200, { "Content-Type": TIPOS[ext], "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" });
    return res.end(cuerpo);
  }
  const st = fs.statSync(archivo);
  const cab = { "Content-Type": TIPOS[ext] || "application/octet-stream", "Cache-Control": /\.(js|css|mp4|vtt|jpg)$/.test(archivo) ? "public, max-age=86400" : "public, max-age=3600", "X-Robots-Tag": "noindex, nofollow", "Accept-Ranges": "bytes" };
  // Rangos (Range: bytes=a-b): el <video> de la sala de espera los necesita para arrancar sin bajar todo
  // el archivo y para adelantar; en iPhone, sin 206 el video directamente no se reproduce.
  const rango = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
  if (rango && (rango[1] || rango[2])) {
    const a = rango[1] ? parseInt(rango[1], 10) : Math.max(0, st.size - parseInt(rango[2], 10)), b = rango[1] && rango[2] ? Math.min(parseInt(rango[2], 10), st.size - 1) : st.size - 1;
    if (a >= st.size || a > b) { res.writeHead(416, { "Content-Range": "bytes */" + st.size, "Cache-Control": "no-store" }); return res.end(); }
    res.writeHead(206, Object.assign(cab, { "Content-Range": `bytes ${a}-${b}/${st.size}`, "Content-Length": b - a + 1 }));
    if (req.method === "HEAD") return res.end();
    return fs.createReadStream(archivo, { start: a, end: b }).pipe(res);
  }
  res.writeHead(200, Object.assign(cab, { "Content-Length": st.size }));
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(archivo).pipe(res);
});
servidor.listen(PUERTO, () => console.log("Trato Hecho escuchando en el puerto " + PUERTO));
