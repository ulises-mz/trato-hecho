/* Sincronización en vivo de Trato Hecho.
   Expone window.Sync con una API mínima (escribir, fijar, escuchar, borrarTodo) sobre dos
   motores: Firebase Realtime Database (entre dispositivos) o localStorage (pestañas de un
   mismo navegador, para ensayar). Sin configuración, todo es inofensivo: no hace nada. */
window.Sync = (function () {
  "use strict";
  const C = window.CONFIG || {};
  const consulta = new URLSearchParams(location.search);
  const sesion = (consulta.get("sesion") || C.sesion || "clase").replace(/[^\w-]/g, "");
  const pedido = ["local", "servidor", "nada"].includes(consulta.get("sync")) ? consulta.get("sync") : C.firebase;
  let modo = "nada";                 // nada | local | firebase | servidor
  let db = null, conectado = false, mensaje = "Sin tablero en vivo";
  const oyentes = [];                // { ruta, cb, off }
  const avisos = [];                 // callbacks de cambio de estado de conexión
  const raiz = () => "sesiones/" + sesion;

  /* ---- motor local: un árbol JSON en localStorage, compartido entre pestañas ---- */
  const CLAVE = "th.sync." + sesion;
  const leerArbol = () => { try { return JSON.parse(localStorage.getItem(CLAVE) || "{}"); } catch (e) { return {}; } };
  const guardarArbol = a => { try { localStorage.setItem(CLAVE, JSON.stringify(a)); } catch (e) { /* sin almacenamiento */ } };
  const partesDe = ruta => ruta.split("/").filter(Boolean);
  function obtener(arbol, ruta) { return partesDe(ruta).reduce((o, k) => (o && typeof o === "object" && o[k] !== undefined ? o[k] : null), arbol); }
  function poner(arbol, ruta, valor, fusionar) {
    const partes = partesDe(ruta);
    if (!partes.length) return valor === null ? {} : (fusionar ? Object.assign(arbol, valor) : valor);
    let o = arbol;
    for (let i = 0; i < partes.length - 1; i++) { if (!o[partes[i]] || typeof o[partes[i]] !== "object") o[partes[i]] = {}; o = o[partes[i]]; }
    const k = partes[partes.length - 1];
    if (valor === null) delete o[k];
    else if (fusionar && o[k] && typeof o[k] === "object") Object.assign(o[k], valor);
    else o[k] = valor;
    return arbol;
  }
  function notificarLocal() { const a = leerArbol(); oyentes.forEach(o => o.cb(obtener(a, o.ruta))); }

  /* ---- motor servidor: la web la sirve servidor/index.js; REST para escribir y SSE para escuchar ---- */
  let arbolServidor = {};
  const base = () => "/api/sesiones/" + sesion;
  function enviar(ruta, datos, modoEscritura) {
    // optimista: aplica localmente de una vez; el servidor confirma con el árbol completo
    arbolServidor = poner(arbolServidor, ruta, datos, modoEscritura === "fusionar"); notificarServidor();
    return fetch(base() + "/escribir", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ruta, datos, modo: modoEscritura }) })
      .catch(() => fijarEstado(false, "Servidor sin conexión: reintentando…"));
  }
  function notificarServidor() { oyentes.forEach(o => o.cb(obtener(arbolServidor, o.ruta))); }
  function conectarServidor() {
    // El flujo SSE manda el árbol completo al conectar ("arbol") y después solo cada cambio ("cambio").
    const fuente = new EventSource(base() + "/eventos");
    fuente.addEventListener("arbol", e => { try { arbolServidor = JSON.parse(e.data) || {}; } catch (err) { arbolServidor = {}; } fijarEstado(true, "En vivo · sesión «" + sesion + "»"); notificarServidor(); });
    fuente.addEventListener("cambio", e => { try { const c = JSON.parse(e.data); arbolServidor = poner(arbolServidor, c.ruta, c.datos, c.modo !== "fijar"); } catch (err) { return; } if (!conectado) fijarEstado(true, "En vivo · sesión «" + sesion + "»"); notificarServidor(); });
    fuente.onerror = () => { fijarEstado(false, "Servidor sin conexión: reintentando…"); };
    // Si esta copia la sirve un hosting estático (Vercel, GitHub Pages) no hay servidor: se avisa y se sigue sin tablero.
    fetch("/api/salud", { cache: "no-store" }).then(r => r.ok ? r.json() : Promise.reject(new Error("estatico"))).catch(err => {
      if (err && err.message === "estatico" || err instanceof SyntaxError) {
        fuente.close(); modo = "nada";
        fijarEstado(false, "Esta copia es estática (sin servidor): no hay tablero en vivo. Los códigos van por el chat.");
        oyentes.forEach(o => o.cb(null));
      }
    });
  }

  /* ---- API ---- */
  function escribir(ruta, datos) {           // fusiona (update)
    if (modo === "firebase") return db.ref(raiz() + "/" + ruta).update(datos);
    if (modo === "servidor") return enviar(ruta, datos, "fusionar");
    if (modo === "local") { guardarArbol(poner(leerArbol(), ruta, datos, true)); notificarLocal(); }
  }
  function fijar(ruta, valor) {              // reemplaza (set); null borra
    if (modo === "firebase") return db.ref(raiz() + "/" + ruta).set(valor);
    if (modo === "servidor") return enviar(ruta, valor, "fijar");
    if (modo === "local") { guardarArbol(poner(leerArbol(), ruta, valor, false)); notificarLocal(); }
  }
  function escuchar(ruta, cb) {
    const o = { ruta, cb, off: null }; oyentes.push(o); enganchar(o);
    return () => { const i = oyentes.indexOf(o); if (i >= 0) oyentes.splice(i, 1); if (o.off) o.off(); };
  }
  function enganchar(o) {
    if (modo === "firebase") { const ref = db.ref(raiz() + "/" + o.ruta); const h = s => o.cb(s.val()); ref.on("value", h); o.off = () => ref.off("value", h); }
    else if (modo === "servidor") o.cb(obtener(arbolServidor, o.ruta));
    else if (modo === "local") o.cb(obtener(leerArbol(), o.ruta));
    else o.cb(null);
  }
  function borrarTodo() {
    if (modo === "firebase") return db.ref(raiz()).remove();
    if (modo === "servidor") { arbolServidor = {}; notificarServidor(); return fetch(base(), { method: "DELETE" }).catch(() => {}); }
    if (modo === "local") { try { localStorage.removeItem(CLAVE); } catch (e) { /* nada */ } notificarLocal(); }
  }
  function alCambiar(cb) { avisos.push(cb); cb(estado()); }
  const estado = () => ({ modo, sesion, conectado, mensaje });
  function fijarEstado(c, m) { conectado = c; mensaje = m; avisos.forEach(cb => cb(estado())); }

  /* ---- arranque ---- */
  if (pedido === "servidor") {
    modo = "servidor";
    fijarEstado(false, "Conectando con el servidor…");
    conectarServidor();
  } else if (pedido === "local") {
    modo = "local";
    window.addEventListener("storage", e => { if (e.key === CLAVE) notificarLocal(); });
    fijarEstado(true, "Modo local: solo las pestañas de este navegador");
  } else if (pedido && typeof pedido === "object" && pedido.databaseURL) {
    fijarEstado(false, "Conectando con Firebase…");
    const cargar = src => new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("no se pudo cargar " + src)); document.head.appendChild(s); });
    const V = "10.14.1";
    cargar(`https://www.gstatic.com/firebasejs/${V}/firebase-app-compat.js`)
      .then(() => cargar(`https://www.gstatic.com/firebasejs/${V}/firebase-database-compat.js`))
      .then(() => {
        window.firebase.initializeApp(pedido);
        db = window.firebase.database();
        modo = "firebase";
        oyentes.forEach(enganchar);
        db.ref(".info/connected").on("value", s => fijarEstado(!!s.val(), s.val() ? "Firebase conectado · sesión «" + sesion + "»" : "Firebase sin conexión: reintentando…"));
      })
      .catch(err => { modo = "nada"; fijarEstado(false, "Firebase no cargó (" + err.message + "). Los códigos van por el chat."); oyentes.forEach(o => o.cb(null)); });
  }
  return { escribir, fijar, escuchar, borrarTodo, alCambiar, estado, obtener };
})();
