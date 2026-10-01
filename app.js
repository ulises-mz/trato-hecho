/* Trato Hecho: lógica de la web. Sin dependencias. Todo el contenido sale de datos.js;
   la instalación, de config.js; la sincronización en vivo, de sync.js. */
(function () {
  "use strict";
  const D = window.DATOS, C = window.CONFIG || {}, Sync = window.Sync;
  const LADOS = ["agencia", "cliente"];
  const NOMBRE_QUIEN = { A: "la agencia", C: "el cliente", T: "se acabó el tiempo" };
  const ROLES = {
    vocero: { nombre: "Vocero", corto: "habla", titulo: "Usted es el vocero", tareas: [
      "Abra con la posición inicial, tal cual está escrita en la ficha.",
      "Antes de ofrecer nada, pregunte para qué necesita el otro lado lo que pide.",
      "Cada concesión se cambia por algo: «si les damos esto, ¿qué nos pueden dar?».",
      "Nunca diga sus puntos ni su plan B exacto." ] },
    analista: { nombre: "Analista", corto: "lleva la cuenta", titulo: "Usted es el analista", tareas: [
      "Marque en la mesa cada propuesta que se diga, para ver cuánto vale para ustedes.",
      "Vigile el termómetro: nada por debajo del plan B.",
      "Guarde las ofertas en el registro y anote qué le importa al otro lado.",
      "Avísele al vocero por chat privado de Zoom qué conviene pedir." ] },
    ambos: { nombre: "Los dos", corto: "habla y lleva la cuenta", titulo: "Usted hace de vocero y analista", tareas: [
      "Abra con la posición inicial y pregunte para qué necesita el otro lado lo que pide.",
      "Marque en la mesa cada propuesta y vigile el termómetro contra el plan B.",
      "Cambie cada concesión por algo y nunca diga sus puntos." ] }
  };
  const PRESETS_EQUIPO = ["Preguntaron para qué", "Les importa el plazo", "Les importa el pago", "Les importa el soporte", "Les importa el reconocimiento", "Pidieron tiempo"];
  const PRESETS_STAFF = ["Preguntaron para qué", "Ofrecieron un cambio", "Solo hablan de precio", "Alguien mostró su tabla", "Se trabaron", "Casi cierran"];
  /* El laboratorio: la negociación avanza por rondas con una consigna cada una, y el
     equipo va cumpliendo misiones. Las rondas salen del reloj; las misiones, de lo que
     el equipo registra en la mesa. */
  const RONDAS = [
    { hasta: 120, nombre: "Abrir", pista: "Cada vocero dice su posición inicial y hace la primera pregunta: ¿para qué lo necesitan así?" },
    { hasta: 240, nombre: "Descubrir", pista: "Pregunten qué le importa más al otro lado y por qué. Anoten lo que descubran." },
    { hasta: 360, nombre: "Intercambiar", pista: "Cambien lo que les cuesta poco por lo que les importa. Guarden cada oferta que se diga." },
    { hasta: 420, nombre: "Cerrar", pista: "Último tramo: trato hecho si supera su plan B, o sin acuerdo con la última propuesta." }
  ];
  const MISIONES = [
    { id: "preparar", titulo: "Prepararse", pista: "Llenen al menos dos respuestas de la hoja de preparación, en la pestaña Preparación de su ficha.", listo: () => Object.values(leerS("prep." + estado.lado, {})).filter(v => v && v.trim()).length >= 2 },
    { id: "abrir", titulo: "Abrir con su posición", pista: "Marquen su posición inicial en la mesa y guárdenla como «nuestra oferta».", listo: () => estado.registro.some(r => r.tipo === "oferta" && r.de === "nuestra") },
    { id: "escuchar", titulo: "Escuchar su oferta", pista: "Cuando el otro lado proponga algo, márquenlo y guárdenlo como «oferta de ellos».", listo: () => estado.registro.some(r => r.tipo === "oferta" && r.de === "ellos") },
    { id: "descubrir", titulo: "Descubrir un interés", pista: "Anoten algo que le importe al otro lado: un toque en «Les importa…» o una nota libre.", listo: () => estado.registro.some(r => r.tipo === "nota") },
    { id: "valor", titulo: "Superar su plan B", pista: "Lleguen a una propuesta completa que supere su plan B. El termómetro se pone verde.", listo: () => { const l = letrasActuales(); return estado.lado && l.every(Boolean) && puntos(l, estado.lado) >= PLAN_B[estado.lado]; } },
    { id: "cerrar", titulo: "Cerrar", pista: "Trato hecho si las dos partes están de acuerdo; si no, sin acuerdo con la última propuesta.", listo: () => !!estado.cerrado }
  ];
  const LOGROS = [
    { id: "oido", titulo: "Oído fino", texto: "Anotaron dos o más cosas que le importan al otro lado.", listo: () => estado.registro.filter(r => r.tipo === "nota").length >= 2 },
    { id: "intercambio", titulo: "Intercambio", texto: "Cambiaron al menos dos temas respecto a su primera oferta y siguen sobre su plan B.", listo: () => { const primera = estado.registro.find(r => r.tipo === "oferta" && r.de === "nuestra"); const l = letrasActuales(); if (!primera || !l.every(Boolean) || !estado.lado) return false; const cambios = l.filter((x, i) => primera.letras[i] !== x).length; return cambios >= 2 && puntos(l, estado.lado) >= PLAN_B[estado.lado]; } },
    { id: "valor", titulo: "Valor creado", texto: "Cerraron un trato que supera su plan B por 15 o más.", listo: () => !!(estado.cerrado && estado.cerrado.letras && estado.lado && puntos(estado.cerrado.letras, estado.lado) >= PLAN_B[estado.lado] + 15) },
    { id: "firmeza", titulo: "Firmeza", texto: "Se levantaron de la mesa cuando lo que había era peor que su plan B.", listo: () => !!(estado.cerrado && !estado.cerrado.letras && estado.cerrado.ultima && estado.lado && puntos(estado.cerrado.ultima, estado.lado) < PLAN_B[estado.lado]) }
  ];
  const FASES_EQUIPO = [
    { id: "preparacion", nombre: "Preparación", dur: D.tiempos.preparacion },
    { id: "negociacion", nombre: "Negociación", dur: D.tiempos.negociacion }
  ];
  const FASES_ADMIN = [
    { id: "consigna", nombre: "Consigna", dur: D.tiempos.consigna },
    { id: "preparacion", nombre: "Preparación", dur: D.tiempos.preparacion },
    { id: "negociacion", nombre: "Negociación", dur: D.tiempos.negociacion },
    { id: "cierre", nombre: "Cierre de salas", dur: D.tiempos.cierre },
    { id: "debrief", nombre: "Resultados", dur: D.tiempos.debrief }
  ];
  const VISTAS_FACILITADOR = ["resultados", "admin", "staff", "guion"];
  const app = document.getElementById("app");

  /* ---------- utilidades ---------- */
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const memoria = {};
  const almacen = nombre => { try { return window[nombre]; } catch (e) { return null; } };
  const leerDe = (alm, k, def) => { try { if (!alm) return k in memoria ? memoria[k] : def; const v = alm.getItem("th." + k); return v === null ? def : JSON.parse(v); } catch (e) { return def; } };
  const guardarEn = (alm, k, v) => { try { if (!alm) { if (v == null) delete memoria[k]; else memoria[k] = v; return; } if (v == null) alm.removeItem("th." + k); else alm.setItem("th." + k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento: la página sigue funcionando */ } };
  // La identidad del equipo vive por pestaña (sessionStorage): así varias pestañas pueden ser
  // varios equipos al ensayar. Lo del facilitador vive en localStorage.
  const leerS = (k, d) => leerDe(almacen("sessionStorage"), k, d), guardarS = (k, v) => guardarEn(almacen("sessionStorage"), k, v);
  const leer = (k, d) => leerDe(almacen("localStorage"), k, d), guardar = (k, v) => guardarEn(almacen("localStorage"), k, v);
  const mmss = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  const minutos = s => (s % 60 === 0 ? s / 60 + " min" : mmss(s));
  const hace = ts => { if (!ts) return ""; const s = Math.round((Date.now() - ts) / 1000); return s < 5 ? "ahora" : s < 60 ? "hace " + s + " s" : "hace " + Math.floor(s / 60) + " min"; };
  const horaDe = ts => { const d = new Date(ts); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
  const enlaceWeb = () => location.origin + location.pathname;
  let temporizadorToast = null;
  function avisar(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(temporizadorToast);
    temporizadorToast = setTimeout(() => { t.hidden = true; }, 2600);
  }
  function copiar(texto, elemento) {
    const respaldo = () => {
      if (elemento) { const r = document.createRange(); r.selectNodeContents(elemento); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); }
      avisar("No se pudo copiar solo. Seleccione el texto y cópielo.");
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).then(() => avisar("Copiado"), respaldo);
    else respaldo();
  }

  /* ---------- estado ---------- */
  const idPestana = (() => { let v = leerS("id", null); if (!v) { v = Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3); guardarS("id", v); } return v; })();
  const estado = {
    sala: leerS("sala", null),
    lado: leerS("lado", null),
    nombre: leerS("nombre", ""),
    rol: leerS("rol", "ambos"),
    tab: leerS("tab", null),
    entrado: leerS("entrado", null),
    trato: leerS("trato", {}),
    cerrado: leerS("cerrado", null),
    registro: leerS("registro", []),
    avisadas: leerS("avisadas", []),
    chat: leer("chat", ""),
    revelar: leer("revelar", false),
    staffSala: leer("staffSala", 1),
    actas: leer("actas", {})
  };
  const vivo = { salas: {}, reloj: null, conexion: Sync.estado() };
  let rutaActual = "inicio";
  const query = new URLSearchParams(location.search);
  if (query.get("sala") && !estado.sala) { const n = parseInt(query.get("sala"), 10); if (n > 0) { estado.sala = n; guardarS("sala", n); } }
  if (LADOS.includes(query.get("lado")) && !estado.lado) { estado.lado = query.get("lado"); guardarS("lado", estado.lado); }
  const tieneClave = () => !C.claveStaff || leer("staff", null) === String(C.claveStaff);
  const enVivo = () => vivo.conexion.modo !== "nada";

  /* ---------- puntuación ---------- */
  const PLAN_B = { agencia: D.lados.agencia.planB.puntos, cliente: D.lados.cliente.planB.puntos };
  function opcionDe(i, letra) { return D.temas[i].opciones.find(o => o.letra === letra) || null; }
  function puntos(letras, lado) { return letras.reduce((s, l, i) => s + opcionDe(i, l)[lado], 0); }
  function indiceDe(a, c) { return a + c - Math.abs(a - c) / 2; }
  const pesoDe = (i, lado) => Math.max(...D.temas[i].opciones.map(o => o[lado]));

  /* Un cierre es { letras } si hubo trato, o { letras: null, ultima, quien } si no:
     `ultima` son las cinco letras de la última propuesta que hubo sobre la mesa
     (o null) y `quien` es A (agencia), C (cliente) o T (se acabó el tiempo). */
  function evaluar(sala, cierre) {
    const pa = PLAN_B.agencia, pc = PLAN_B.cliente;
    if (!cierre.letras) {
      const r = { sala, letras: null, sin: true, a: pa, c: pc, total: pa + pc, indice: indiceDe(pa, pc), valido: true,
                  perdido: 0, quien: cierre.quien || null, ultima: null, diagnostico: "sin-detalle",
                  motivo: "Sin acuerdo: cada parte se queda con su plan B" };
      if (cierre.ultima) {
        const ua = puntos(cierre.ultima, "agencia"), uc = puntos(cierre.ultima, "cliente"), ui = indiceDe(ua, uc);
        r.ultima = { letras: cierre.ultima, a: ua, c: uc, indice: ui };
        const bienA = ua >= pa, bienC = uc >= pc;
        if (bienA && bienC) {
          r.perdido = Math.max(0, ui - r.indice); r.diagnostico = "perdido";
          r.motivo = (r.quien === "T" ? "Se acabó el tiempo con un buen trato en la mesa" : "Trato perdido") +
            ": la última propuesta daba " + ua + " a la agencia y " + uc + " al cliente (índice " + ui + "), mejor que el plan B de los dos";
        } else {
          const perjudicados = [!bienA ? "a la agencia" : null, !bienC ? "al cliente" : null].filter(Boolean).join(" y ");
          const rechazoCorrecto = (r.quien === "A" && !bienA) || (r.quien === "C" && !bienC);
          r.diagnostico = "correcto";
          r.motivo = (rechazoCorrecto ? "Levantarse fue correcto" : "La última propuesta no servía") +
            ": dejaba " + perjudicados + " por debajo de su plan B" + (r.quien === "T" ? "; se acabó el tiempo" : "");
        }
      } else if (r.quien) {
        r.motivo += r.quien === "T" ? "; se acabó el tiempo" : "; se levantó " + NOMBRE_QUIEN[r.quien];
      }
      return r;
    }
    const a = puntos(cierre.letras, "agencia"), c = puntos(cierre.letras, "cliente");
    const bajoA = a < pa, bajoC = c < pc;
    let motivo = "Trato válido";
    if (bajoA && bajoC) motivo = "No cuenta: las dos partes quedaron por debajo de su plan B";
    else if (bajoA) motivo = "No cuenta: la agencia quedó por debajo de su plan B (" + pa + ")";
    else if (bajoC) motivo = "No cuenta: el cliente quedó por debajo de su plan B (" + pc + ")";
    return { sala, letras: cierre.letras, sin: false, a, c, total: a + c, indice: indiceDe(a, c), valido: !bajoA && !bajoC, perdido: 0, motivo };
  }
  function codigoDe(sala, cierre) {
    if (cierre.letras) return "S" + sala + "-" + cierre.letras.join("");
    let s = "S" + sala + "-SIN";
    if (cierre.ultima) s += "-" + cierre.ultima.join("");
    if (cierre.quien) s += "-" + cierre.quien;
    return s;
  }
  const RE_CODIGO = /\bS\s*(\d{1,2})\s*-\s*(?:SIN(?:\s*-\s*([A-Za-z]{5}))?(?:\s*-\s*([ACT]))?\b|([A-Za-z]{5})\b)/gi;
  function validarLetras(letras) {
    return letras.map((l, i) => (opcionDe(i, l) ? null : "la posición " + (i + 1) + " (" + D.temas[i].nombre + ") no tiene opción " + l)).filter(Boolean);
  }
  function parsearCodigos(texto) {
    const filas = new Map(), errores = [];
    let m;
    RE_CODIGO.lastIndex = 0;
    while ((m = RE_CODIGO.exec(texto)) !== null) {
      const sala = parseInt(m[1], 10);
      if (m[4]) {
        const letras = m[4].toUpperCase().split("");
        const malas = validarLetras(letras);
        if (malas.length) { errores.push("Código " + esc(m[0].trim()) + ": " + malas.join("; ")); continue; }
        filas.set(sala, { letras });
        continue;
      }
      const cierre = { letras: null, ultima: null, quien: m[3] ? m[3].toUpperCase() : null };
      if (m[2]) {
        const letras = m[2].toUpperCase().split("");
        const malas = validarLetras(letras);
        if (malas.length) { errores.push("Código " + esc(m[0].trim()) + ": " + malas.join("; ")); continue; }
        cierre.ultima = letras;
      }
      filas.set(sala, cierre);
    }
    return { filas, errores };
  }
  function ordenar(filas) {
    const lista = [...filas.entries()].map(([sala, cierre]) => evaluar(sala, cierre));
    lista.sort((x, y) => (y.valido - x.valido) || (y.indice - x.indice) || (x.perdido - y.perdido) || (Math.min(y.a, y.c) - Math.min(x.a, x.c)) || (x.sala - y.sala));
    return lista;
  }
  let cacheCombos = null;
  function combos() {
    if (cacheCombos) return cacheCombos;
    const todas = [];
    (function rec(i, acc) { if (i === D.temas.length) { todas.push(acc); return; } for (const o of D.temas[i].opciones) rec(i + 1, acc.concat(o.letra)); })(0, []);
    cacheCombos = todas.map(l => ({ letras: l, a: puntos(l, "agencia"), c: puntos(l, "cliente") }));
    return cacheCombos;
  }
  function mejorTrato() {
    let mejor = null;
    for (const t of combos()) { const idx = indiceDe(t.a, t.c); if (!mejor || idx > mejor.indice) mejor = { ...t, indice: idx }; }
    return mejor;
  }
  function frontera() {
    const puntosUnicos = new Map();
    for (const t of combos()) puntosUnicos.set(t.a + "/" + t.c, t);
    const lista = [...puntosUnicos.values()];
    return lista.filter(p => !lista.some(q => q.a >= p.a && q.c >= p.c && (q.a > p.a || q.c > p.c))).sort((x, y) => x.a - y.a);
  }

  /* ---------- relojes ---------- */
  function pitar(veces) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      for (let k = 0; k < veces; k++) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination); o.frequency.value = 880; g.gain.value = 0.08;
        o.start(ctx.currentTime + k * 0.35); o.stop(ctx.currentTime + k * 0.35 + 0.2);
      }
    } catch (e) { /* sin audio */ }
  }
  /* Un reloj tiene un inicio local (lo arrancó este dispositivo) y, si hay tablero en vivo,
     un inicio remoto que manda: el del administrador. */
  function Reloj(clave, fases, alm) {
    const r = { clave, fases, inicio: leerDe(alm, clave, null), avisada: leerDe(alm, clave + ".fase", -1), remoto: undefined };
    r.inicioEfectivo = () => (r.remoto !== undefined ? r.remoto : r.inicio);
    r.fase = () => {
      const inicio = r.inicioEfectivo(); if (!inicio) return null;
      const transcurrido = (Date.now() - inicio) / 1000;
      if (transcurrido < 0) return { i: -1, nombre: "Empieza en", restante: -transcurrido, transcurrido, alerta: false };
      let t = transcurrido;
      for (let i = 0; i < fases.length; i++) {
        if (t < fases[i].dur) return { i, nombre: fases[i].nombre, restante: fases[i].dur - t, transcurrido, alerta: fases[i].id === "negociacion" && fases[i].dur - t <= 60 };
        t -= fases[i].dur;
      }
      return { i: fases.length, nombre: "Tiempo agotado", restante: 0, transcurrido, alerta: true };
    };
    r.fijar = inicio => { r.inicio = inicio; guardarEn(alm, clave, inicio); r.avisada = inicio ? 0 : -1; guardarEn(alm, clave + ".fase", r.avisada); if (r.alPublicar) r.alPublicar(inicio); tick(); };
    r.alternar = () => { if (r.inicio) r.fijar(null); else { r.fijar(Date.now()); pitar(1); } };
    r.saltar = () => {
      const f = r.fase(); if (!f || f.i >= fases.length) return;
      const siguiente = fases.slice(0, f.i + 1).reduce((s, x) => s + x.dur, 0);
      r.fijar(Date.now() - siguiente * 1000);
    };
    r.avisar = f => { if (f.i !== r.avisada) { if (r.avisada >= 0) pitar(f.i >= fases.length ? 3 : 2); r.avisada = f.i; guardarEn(alm, clave + ".fase", f.i); } };
    return r;
  }
  const RELOJES = { equipo: Reloj("inicio", FASES_EQUIPO, almacen("sessionStorage")), admin: Reloj("admin.inicio", FASES_ADMIN, almacen("localStorage")) };
  RELOJES.admin.alPublicar = inicio => Sync.fijar("config/reloj", { inicio: inicio || null, actualizado: Date.now() });
  let tics = 0;
  function tick() {
    const fe = RELOJES.equipo.fase(), fa = RELOJES.admin.fase();
    if (fe) RELOJES.equipo.avisar(fe);
    if (fa) RELOJES.admin.avisar(fa);
    const mini = document.getElementById("reloj-mini"), f = fe || fa;
    if (!f) mini.hidden = true;
    else { mini.hidden = false; mini.textContent = f.nombre + " " + mmss(f.restante); mini.classList.toggle("alerta", f.alerta); }
    document.querySelectorAll(".reloj").forEach(el => {
      const r = RELOJES[el.dataset.reloj] || RELOJES.equipo, fx = r.fase();
      const fase = el.querySelector(".fase-actual"), tiempo = el.querySelector(".tiempo");
      if (!fx) { fase.textContent = r.remoto !== undefined ? "Esperando al administrador" : "Listo para empezar"; tiempo.textContent = mmss(r.fases[0].dur); el.classList.remove("alerta"); }
      else { fase.textContent = fx.nombre; tiempo.textContent = mmss(fx.restante); el.classList.toggle("alerta", fx.alerta); }
      const btn = el.querySelector("[data-accion='reloj']"); if (btn) { btn.textContent = fx ? "Reiniciar" : "Iniciar"; btn.hidden = r.remoto !== undefined && el.dataset.reloj === "equipo"; }
      const saltar = el.querySelector("[data-accion='saltar']"); if (saltar) saltar.hidden = !fx || fx.i >= r.fases.length;
      const nota = el.querySelector(".reloj-nota"); if (nota) nota.hidden = !(r.remoto !== undefined && el.dataset.reloj === "equipo");
    });
    actualizarCues(fa);
    const ronda = document.getElementById("ronda"); if (ronda) { const h = rondaHTML(); if (ronda.innerHTML !== h) ronda.innerHTML = h; }
    if (++tics % 10 === 0) { pintarVivo(); pintarPresencia(); if (rutaActual === "inicio") pintarLobby(); if (estado.sala && estado.lado && (rutaActual === "equipo" || rutaActual === "mesa") && tics % 40 === 0) { reportar({}); anunciar(); } }
  }
  setInterval(tick, 500);
  const relojHTML = (tipo, clase) => `<div class="reloj ${clase || ""}" data-reloj="${tipo}"><span class="fase-actual">Listo para empezar</span><span class="tiempo">${mmss(RELOJES[tipo].fases[0].dur)}</span><div class="botones"><button class="boton" type="button" data-accion="reloj" data-reloj="${tipo}">Iniciar</button>${tipo === "admin" ? `<button class="boton" type="button" data-accion="saltar" data-reloj="admin" hidden>Siguiente fase</button>` : `<span class="reloj-nota" hidden>Va con el reloj del administrador</span>`}</div></div>`;

  /* ---------- en vivo ---------- */
  function reportar(datos) {
    if (!(estado.sala && estado.lado)) return;
    Sync.escribir("salas/" + estado.sala + "/" + estado.lado, Object.assign({ actualizado: Date.now() }, datos));
  }
  function propuestaActual() { return D.temas.map((t, i) => estado.trato[i] || "?").join(""); }
  /* Presencia: cada pestaña se anuncia en salas/N/gente/<id> con nombre, lado y rol. */
  function anunciar() {
    if (!(estado.sala && estado.lado && estado.nombre)) return;
    Sync.escribir("salas/" + estado.sala + "/gente/" + idPestana, { nombre: estado.nombre, lado: estado.lado, rol: estado.rol, entrado: estado.entrado || Date.now(), actualizado: Date.now() });
  }
  function despedirse(sala) { if (sala) Sync.fijar("salas/" + sala + "/gente/" + idPestana, null); }
  function genteDe(n, lado) {
    const s = (vivo.salas && vivo.salas[n]) || {}, g = s.gente || {};
    return Object.entries(g).map(([id, x]) => Object.assign({ id }, x)).filter(x => x && x.nombre && (!lado || x.lado === lado) && Date.now() - (x.actualizado || 0) < 90000).sort((a, b) => (a.entrado || 0) - (b.entrado || 0));
  }
  const iniciales = nombre => nombre.trim().split(/\s+/).slice(0, 2).map(p => p[0] || "").join("").toUpperCase();
  const ROL_CORTO = { vocero: "V", analista: "A", ambos: "V·A" };
  function asientosHTML(n, lado, minimo) {
    const gente = genteDe(n, lado);
    const asientos = gente.map(x => `<div class="asiento ${lado} ${x.id === idPestana ? "yo" : ""}" title="${esc(x.nombre)} · ${esc((ROLES[x.rol] || ROLES.ambos).nombre)}"><span class="avatar">${esc(iniciales(x.nombre))}<b class="rolb">${esc(ROL_CORTO[x.rol] || "V·A")}</b></span><span class="nombre">${esc(x.nombre)}</span></div>`);
    for (let k = gente.length; k < (minimo || 0); k++) asientos.push(`<div class="asiento vacio"><span class="avatar"></span><span class="nombre">libre</span></div>`);
    return asientos.join("");
  }
  function lobbyHTML() {
    const numeros = new Set(Object.keys(vivo.salas || {}).map(Number).filter(n => n > 0));
    for (let i = 1; i <= (C.salas || 6); i++) numeros.add(i);
    const lista = [...numeros].sort((a, b) => a - b);
    const aviso = enVivo() ? "" : `<p class="nota-pie">Sin tablero en vivo no se ve quién más está en cada sala; la elección funciona igual.</p>`;
    return aviso + `<div class="lobby">${lista.map(n => {
      const total = genteDe(n).length;
      return `<div class="sala-lobby ${estado.sala === n ? "elegida" : ""}" data-sala-lobby="${n}">
  <div class="sala-lobby-cab"><b>Sala ${n}</b><span class="nota-pie">${total ? total + (total === 1 ? " persona" : " personas") : "vacía"}</span></div>
  <div class="lados-lobby">${LADOS.map(l => `<button type="button" class="lado-col ${l}" data-elegir-sala="${n}" data-elegir-lado="${l}" aria-pressed="${estado.sala === n && estado.lado === l}"><span class="lado-col-cab acento-${l}">${esc(D.lados[l].rol)}</span>${asientosHTML(n, l, 2)}</button>`).join("")}</div>
</div>`; }).join("")}</div>`;
  }
  function pintarLobby() { const z = document.getElementById("lobby"); if (z) z.innerHTML = lobbyHTML(); actualizarBotonEntrar(); }
  function actualizarBotonEntrar() {
    const b = document.getElementById("btn-entrar"); if (!b) return;
    const nombre = (document.getElementById("nombre") || {}).value || "";
    b.disabled = !(nombre.trim() && estado.sala && estado.lado);
    b.textContent = estado.sala && estado.lado ? `Entrar a la sala ${estado.sala} como ${D.lados[estado.lado].rol} · ${ROLES[estado.rol].nombre}` : "Elija una sala y un lado";
  }
  function presenciaHTML() {
    if (!(estado.sala && estado.lado)) return "";
    return `<div class="presencia" id="presencia">${LADOS.map(l => `<div class="presencia-lado"><span class="ojo acento-${l}">${esc(D.lados[l].rol)}</span><div class="asientos">${asientosHTML(estado.sala, l, 2) || ""}</div></div>`).join('<span class="presencia-vs">contra</span>')}</div>`;
  }
  function pintarPresencia() { const z = document.getElementById("presencia"); if (z) z.outerHTML = presenciaHTML(); }
  function estadoSala(s) {
    s = s || {};
    const lados = LADOS.map(l => s[l]).filter(Boolean);
    if (s.cierre) return { clave: "cerrado", texto: "Cerrado" };
    if (!lados.length && !s.acta) return { clave: "vacia", texto: "Sin entrar" };
    const p = LADOS.map(l => s[l] && s[l].propuesta);
    if (p[0] && p[1] && p[0] === p[1] && !p[0].includes("?")) return { clave: "coinciden", texto: "Coinciden: a punto de cerrar" };
    if (lados.some(x => x.fase === "mesa") || (s.acta && s.acta.temas && Object.keys(s.acta.temas).length)) return { clave: "mesa", texto: "Negociando" };
    if (!lados.length) return { clave: "vacia", texto: "Sin entrar" };
    return { clave: "ficha", texto: "Leyendo la ficha" };
  }
  const FASE_TEXTO = { ficha: "lee la ficha", mesa: "en la mesa", cerrado: "cerró" };
  function actaDe(n) {
    const remota = enVivo() && vivo.salas && vivo.salas[n] && vivo.salas[n].acta;
    const local = estado.actas[n];
    const a = remota || local || {};
    return { temas: a.temas || {}, notas: Array.isArray(a.notas) ? a.notas : Object.values(a.notas || {}), actualizado: a.actualizado || 0 };
  }
  function vivoHTML() {
    const con = vivo.conexion;
    if (con.modo === "nada") return `<div class="tarjeta suave"><b>Sin tablero en vivo.</b> Los códigos llegan por el chat de Zoom. Para ver las salas en tiempo real, sirva la web con su servidor (<span class="mono">servidor/index.js</span>, Docker o Coolify) o configure Firebase en <span class="mono">config.js</span>; con <span class="mono">?sync=local</span> se ensaya en esta computadora.</div>`;
    const salas = vivo.salas || {};
    const numeros = new Set(Object.keys(salas).map(Number).filter(n => n > 0));
    for (let i = 1; i <= (C.salas || 0); i++) numeros.add(i);
    const lista = [...numeros].sort((a, b) => a - b);
    const conteo = { cerrado: 0, coinciden: 0, mesa: 0, ficha: 0, vacia: 0 };
    const tarjetas = lista.map(n => {
      const s = salas[n] || {}, e = estadoSala(s); conteo[e.clave]++;
      const ultimo = Math.max(0, ...LADOS.map(l => (s[l] && s[l].actualizado) || 0), (s.acta && s.acta.actualizado) || 0);
      const quieta = !s.cierre && ultimo && Date.now() - ultimo > 90000;
      const acta = s.acta ? actaDe(n) : null;
      return `<div class="sala-card ${e.clave} ${quieta ? "quieta" : ""}">
  <div class="sala-cab"><b>Sala ${n}</b><span class="estado ${e.clave === "cerrado" ? "ok" : e.clave === "coinciden" ? "aviso" : "neutro"}">${esc(e.texto)}</span>${quieta ? `<span class="estado aviso">sin actividad ${esc(hace(ultimo))}</span>` : ""}</div>
  ${LADOS.map(l => { const x = s[l]; const nombres = genteDe(n, l).map(p => esc(p.nombre) + " <small>" + esc(ROL_CORTO[p.rol] || "V·A") + "</small>").join(", "); return `<div class="lado-linea"><span class="quien acento-${l}">${esc(D.lados[l].rol)}</span>${nombres ? `<span class="nombres">${nombres}</span>` : ""}${x ? `<span>${esc(FASE_TEXTO[x.fase] || "entró")}${x.prep ? ` · hoja ${x.prep}/3` : ""}${x.ofertas ? ` · ${x.ofertas} ofertas` : ""}${x.mision !== undefined ? ` · misión ${x.mision}/${MISIONES.length}` : ""}${x.logros ? ` · ${x.logros} logros` : ""}</span><code>${esc(x.propuesta || "?????")}</code><span class="hace">${esc(hace(x.actualizado))}</span>` : `<span class="nota-pie">no ha entrado</span>`}</div>`; }).join("")}
  ${acta ? `<div class="acta-linea">Acta del staff: ${Object.keys(acta.temas).length}/${D.temas.length} temas acordados · ${acta.notas.length} apuntes${Object.keys(acta.temas).length ? ` · <code>${esc(D.temas.map((t, i) => acta.temas[i] || "?").join(""))}</code>` : ""}</div>` : ""}
  ${s.cierre ? `<div class="sala-codigo">${esc(s.cierre.codigo)} <span class="nota-pie">registró ${esc(s.cierre.por === "staff" ? "el staff" : s.cierre.por === "agencia" ? "la agencia" : "el cliente")} ${esc(hace(s.cierre.ts))}</span></div>` : ""}
</div>`;
    }).join("");
    return `<div class="vivo-resumen"><span class="estado ${con.conectado ? "ok" : "mal"}">${esc(con.mensaje)}</span><span>${lista.length} salas · ${conteo.cerrado} cerradas · ${conteo.coinciden + conteo.mesa} negociando · ${conteo.ficha} leyendo · ${conteo.vacia} sin entrar</span></div><div class="vivo-grid">${tarjetas}</div>`;
  }
  function pintarVivo() { const z = document.getElementById("vivo"); if (z) z.innerHTML = vivoHTML(); }
  function codigosEnVivo() {
    const salas = vivo.salas || {}, codigos = [], sinCodigo = [];
    Object.keys(salas).map(Number).filter(n => n > 0).sort((a, b) => a - b).forEach(n => {
      const s = salas[n];
      if (s.cierre && s.cierre.codigo) codigos.push(s.cierre.codigo);
      else if (LADOS.some(l => s[l]) || s.acta) { codigos.push("S" + n + "-SIN"); sinCodigo.push(n); }
    });
    return { codigos, sinCodigo };
  }

  /* ---------- textos compartidos (guion, admin y staff) ---------- */
  function mensajes() {
    return {
      ingreso: `Entren aquí con el número de su sala, su lado y su rol, como dice el mensaje del reparto: ${enlaceWeb()} . Si no lo tienen a mano: los dos primeros nombres de la lista de la sala son la AGENCIA y los otros el CLIENTE; en cada pareja, uno es vocero y el otro analista. La tabla de puntos es privada: no se comparte pantalla.`,
      prep30: "Quedan 30 segundos de preparación. Al terminar, empiecen a negociar.",
      faltan3: "Quedan 3 minutos. Si no cierran, cada parte se queda con su plan B.",
      ultimo: "Último minuto. Cierren el trato con el staff de su sala o marquen «sin acuerdo» con la última propuesta que hubo.",
      cierre: "Se cierran las salas. Si su sala no tiene staff, una sola persona pega el código del trato en el chat de la sala principal."
    };
  }
  function cuesAdmin() {
    const t = D.tiempos, M = mensajes();
    const tPrep = t.consigna, tNeg = tPrep + t.preparacion, tCierre = tNeg + t.negociacion, tRes = tCierre + t.cierre, tFin = tRes + t.debrief;
    return [
      { en: 0, titulo: "Consigna", que: "Compartir la pestaña Inicio. Leer el caso en dos frases y las cuatro reglas. Pegar el mensaje de ingreso en el chat.", msg: M.ingreso },
      { en: tPrep - 15, titulo: "Abrir las salas", que: "Zoom: Salas para grupos pequeños, Abrir todas las salas. Dejar de compartir pantalla. El staff entra a su sala y elige su número en la vista Staff." },
      { en: tPrep, titulo: "Preparación", que: "Cada pareja lee su ficha. El staff resuelve dudas de reglas, nunca de estrategia. En el tablero se ve quién no ha entrado." },
      { en: tNeg - 30, titulo: "Aviso: 30 segundos", que: "Transmitir a todas las salas.", msg: M.prep30 },
      { en: tNeg, titulo: "Negociación", que: "El staff lleva el acta de su sala: marca lo acordado y anota qué pasa. Vigilar que nadie muestre la tabla de puntos." },
      { en: tCierre - 180, titulo: "Aviso: 3 minutos", que: "Transmitir a todas las salas.", msg: M.faltan3 },
      { en: tCierre - 60, titulo: "Aviso: último minuto", que: "Transmitir a todas las salas.", msg: M.ultimo },
      { en: tCierre, titulo: "Cerrar las salas", que: "Zoom: Cerrar todas las salas (cuenta regresiva de 60 s). El staff registra el cierre de su sala desde el acta. Transmitir el mensaje de cierre.", msg: M.cierre },
      { en: tRes, titulo: "Resultados", que: "Compartir la pestaña Resultados. Cargar los códigos en vivo (o pegar el chat), Calcular, nombrar la sala ganadora, Revelar los intereses, lanzar las tres preguntas." },
      { en: tFin, titulo: "Fin", que: "Sigue la presentación de los seis puntos de la CEP." }
    ];
  }
  const cuesHTML = () => cuesAdmin().map(c => `<div class="cue" data-en="${c.en}"><span class="cuando">${mmss(c.en)}</span><div><b>${esc(c.titulo)}</b><p>${esc(c.que)}</p>${c.msg ? `<div class="mensaje"><code>${esc(c.msg)}</code><button type="button" class="boton chico" data-copiar="${esc(c.msg)}">Copiar</button></div>` : ""}</div></div>`).join("");
  function actualizarCues(fa) {
    const cues = document.querySelectorAll(".cue"); if (!cues.length) return;
    const t = fa ? fa.transcurrido : null;
    let actual = null;
    cues.forEach(c => { if (t !== null && +c.dataset.en <= t) actual = c; });
    cues.forEach(c => {
      const en = +c.dataset.en; c.classList.remove("pasado", "ahora", "pronto");
      if (t === null) return;
      if (c === actual) c.classList.add("ahora"); else if (en < t) c.classList.add("pasado"); else if (en - t <= 30) c.classList.add("pronto");
    });
  }

  /* ---------- piezas de interfaz ---------- */
  function chipSala() {
    const chip = document.getElementById("chip-sala");
    if (estado.sala && estado.lado) { chip.hidden = false; chip.className = "chip-sala " + estado.lado; chip.textContent = (estado.nombre ? estado.nombre + " · " : "") + "Sala " + estado.sala + " · " + D.lados[estado.lado].rol + (estado.rol !== "ambos" ? " · " + ROLES[estado.rol].nombre : ""); }
    else chip.hidden = true;
    document.querySelectorAll("#nav a[data-fac]").forEach(a => { a.hidden = !tieneClave(); });
  }
  const ladoHTML = l => `<span class="acento-${l}">${esc(D.lados[l].etiqueta)}</span>`;
  const resumenTrato = letras => D.temas.map((t, i) => esc(opcionDe(i, letras[i]).texto)).join(" · ");
  const chipsOpciones = (i, lado, seleccion, nombre) => D.temas[i].opciones.map(o => `<label class="chip"><input type="radio" name="${nombre}-${i}" value="${o.letra}" ${seleccion === o.letra ? "checked" : ""}><span class="letra">${o.letra}</span><span>${esc(o.texto)}</span>${lado ? `<span class="pts">+${o[lado]}</span>` : ""}</label>`).join("");
  function termometroHTML(lado, suma, completos, faltan) {
    const planB = D.lados[lado].planB.puntos;
    const veredicto = !completos ? `<div class="veredicto">Faltan ${faltan} temas por acordar</div>`
      : suma >= planB ? `<div class="veredicto ok">Supera su plan B por ${suma - planB}</div>`
      : `<div class="veredicto mal">Por debajo de su plan B. Mejor levantarse de la mesa.</div>`;
    return `<div class="termometro-cab"><div class="total" id="term-total">${suma}<small>de 100 para ustedes</small></div><span class="nota-pie">plan B: ${planB}</span></div>
<div class="barra-pts"><div class="lleno ${completos && suma < planB ? "mal" : ""}" style="width:${suma}%"></div><div class="marca" style="left:calc(${planB}% - 1px)"></div></div>${veredicto}`;
  }
  function rondaActual() {
    const f = RELOJES.equipo.fase();
    if (!f) return { nombre: "Las rondas arrancan con el reloj", pista: "Mientras tanto, lean su ficha y preparen su apertura.", n: 0 };
    if (f.i < 0) return { nombre: "Empieza en " + mmss(f.restante), pista: "Lean su ficha y preparen su apertura.", n: 0 };
    if (f.i === 0) return { nombre: "Preparación", pista: "Lean su ficha, miren su plan B y llenen la hoja de preparación.", n: 0 };
    if (f.i >= FASES_EQUIPO.length) return { nombre: "Tiempo agotado", pista: "Registren el cierre: trato hecho o sin acuerdo.", n: RONDAS.length };
    const transcurrido = FASES_EQUIPO[1].dur - f.restante;
    const k = RONDAS.findIndex(r => transcurrido < r.hasta);
    const r = RONDAS[k < 0 ? RONDAS.length - 1 : k];
    return { nombre: "Ronda " + ((k < 0 ? RONDAS.length : k + 1)) + " de " + RONDAS.length + " · " + r.nombre, pista: r.pista, n: k < 0 ? RONDAS.length : k + 1 };
  }
  const rondaHTML = () => { const r = rondaActual(); return `<b>${esc(r.nombre)}</b><span>${esc(r.pista)}</span>`; };
  function estadoLaboratorio() {
    const misiones = MISIONES.map(m => ({ ...m, hecha: !!m.listo() }));
    const logros = LOGROS.map(l => ({ ...l, hecho: !!l.listo() }));
    return { misiones, logros, hechas: misiones.filter(m => m.hecha).length, actual: misiones.find(m => !m.hecha) || null };
  }
  function laboratorioHTML() {
    const lab = estadoLaboratorio();
    const porcentaje = Math.round(lab.hechas / MISIONES.length * 100);
    return `<div class="lab-cab"><span class="ojo">Laboratorio</span><span class="lab-progreso">${lab.hechas} de ${MISIONES.length} misiones</span></div>
<div class="barra-pts lab-barra"><div class="lleno" style="width:${porcentaje}%"></div></div>
${lab.actual ? `<div class="mision-actual"><b>Ahora: ${esc(lab.actual.titulo)}</b><p>${esc(lab.actual.pista)}</p></div>` : `<div class="mision-actual completa"><b>Laboratorio completo</b><p>Cumplieron las seis misiones. Lo que queda es contarlo bien en el cierre.</p></div>`}
<ol class="misiones">${lab.misiones.map(m => `<li class="mision ${m.hecha ? "hecha" : ""} ${lab.actual && lab.actual.id === m.id ? "actual" : ""}"><span class="marca-mision" aria-hidden="true"></span><span>${esc(m.titulo)}</span></li>`).join("")}</ol>
${lab.logros.some(l => l.hecho) ? `<div class="logros">${lab.logros.filter(l => l.hecho).map(l => `<span class="logro" title="${esc(l.texto)}">${esc(l.titulo)}</span>`).join("")}</div>` : ""}`;
  }
  function pintarLaboratorio() {
    const z = document.getElementById("laboratorio"); if (z) z.innerHTML = laboratorioHTML();
    const lab = estadoLaboratorio();
    const nuevas = lab.misiones.filter(m => m.hecha && !estado.avisadas.includes(m.id));
    if (nuevas.length) { estado.avisadas = estado.avisadas.concat(nuevas.map(m => m.id)); guardarS("avisadas", estado.avisadas); if (z) avisar("Misión cumplida: " + nuevas[nuevas.length - 1].titulo); }
    reportar({ mision: lab.hechas, logros: lab.logros.filter(l => l.hecho).length });
  }
  function vistaClave(ruta) {
    return `
<section class="seccion tarjeta gate">
  <span class="ojo">Solo facilitadores</span>
  <h2>Esta vista es del equipo que dirige la actividad</h2>
  <p>Para abrirla hace falta la clave del grupo. Si usted es estudiante, vuelva a <a href="#inicio">Inicio</a>.</p>
  <form id="form-clave"><label class="campo" for="clave">Clave<input type="password" id="clave" autocomplete="off"></label><div class="botones"><button type="submit" class="boton primario">Entrar</button></div></form>
  <input type="hidden" id="clave-destino" value="${esc(ruta)}">
</section>`;
  }

  /* ---------- vistas ---------- */
  function vistaInicio() {
    const t = D.tiempos;
    return `
<section class="seccion">
  <span class="ojo">${esc(D.curso)}</span>
  <h1>${esc(D.nombre)}</h1>
  <p class="entrada">${esc(D.lema)}. Dos contra dos, siete minutos, un contrato. Gana la sala donde las dos partes salen mejor.</p>
  <div class="fases">
    <div class="fase"><b>1. Prepararse</b><span>${minutos(t.preparacion)}</span><small>Leer la ficha privada y decidir el mínimo</small></div>
    <div class="fase"><b>2. Negociar</b><span>${minutos(t.negociacion)}</span><small>Cinco temas sobre la mesa</small></div>
    <div class="fase"><b>3. Cerrar</b><span>${minutos(t.cierre)}</span><small>El staff registra el trato</small></div>
    <div class="fase"><b>4. Resultados</b><span>${minutos(t.debrief)}</span><small>Quién creó más valor y por qué</small></div>
  </div>
</section>
<section class="seccion tarjeta" id="entrar">
  <h2>Entrar a la mesa</h2>
  <p>Escriba su nombre, toque el lado que le tocó en su sala y elija su rol en la pareja. Verá llegar a los demás en tiempo real.</p>
  <div class="dos">
    <label class="campo" for="nombre">Mi nombre<input type="text" id="nombre" name="nombre" autocomplete="name" maxlength="40" placeholder="Como aparece en Zoom" value="${esc(estado.nombre)}"></label>
    <div class="campo"><span>Mi rol en la pareja</span>
      <div class="roles">${Object.entries(ROLES).map(([k, r]) => `<button type="button" class="rol-boton" data-rol="${k}" aria-pressed="${estado.rol === k}"><b>${esc(r.nombre)}</b><span>${esc(k === "ambos" ? "estoy solo en mi lado" : r.corto)}</span></button>`).join("")}</div>
    </div>
  </div>
  <div class="campo"><span>Mi sala y mi lado</span><div id="lobby">${lobbyHTML()}</div></div>
  <div class="botones"><button type="button" class="boton primario grande" id="btn-entrar" disabled>Elija una sala y un lado</button><span class="nota-pie">La ficha del otro lado no se muestra. Juegue limpio.</span></div>
</section>
<section class="seccion">
  <h2>${esc(D.contexto.titulo)}</h2>
  ${D.contexto.parrafos.map(p => `<p>${esc(p)}</p>`).join("")}
</section>
<section class="seccion dos">
  <div class="tarjeta"><h3>Las reglas</h3><ol class="reglas">${D.contexto.reglas.map(r => `<li>${esc(r)}</li>`).join("")}</ol></div>
  <div class="tarjeta suave"><h3>${esc(D.puntaje.titulo)}</h3><ul class="lista">${D.puntaje.lineas.map(r => `<li>${esc(r)}</li>`).join("")}</ul></div>
</section>
<section class="seccion">
  <h3>Los cinco temas de la mesa</h3>
  <div class="tabla-envoltorio"><table><thead><tr><th>Tema</th><th>Opciones</th></tr></thead><tbody>
  ${D.temas.map(t => `<tr><td><b>${esc(t.nombre)}</b><br><span class="nota-pie">${esc(t.pregunta)}</span></td><td>${t.opciones.map(o => `<span class="mono">${o.letra}</span> ${esc(o.texto)}`).join("<br>")}</td></tr>`).join("")}
  </tbody></table></div>
  <p class="nota-pie">Facilitadores: <a href="#admin">panel del administrador</a> · <a href="#staff">acta y tablero del staff</a> · <a href="#guion">guion</a> · <a href="#resultados">resultados</a>.</p>
</section>`;
  }

  function vistaEquipo() {
    const l = estado.lado, L = D.lados[l], R = ROLES[estado.rol] || ROLES.ambos;
    const notas = leerS("prep." + l, {});
    const tabs = [["resumen", "Resumen"], ["intereses", "Intereses"], ["puntos", "Puntos"], ["guion", "Guion"], ["prep", "Preparación"]];
    const porDefecto = estado.rol === "vocero" ? "guion" : estado.rol === "analista" ? "puntos" : "resumen";
    const activa = tabs.some(t => t[0] === estado.tab) ? estado.tab : porDefecto;
    const filasTabla = D.temas.map(t => t.opciones.map((o, k) => {
      const max = Math.max(...t.opciones.map(x => x[l]));
      return `<tr class="${k === 0 ? "tema-inicio" : ""}">${k === 0 ? `<td rowspan="${t.opciones.length}"><b>${esc(t.nombre)}</b></td>` : ""}<td><span class="mono">${o.letra}</span> ${esc(o.texto)}</td><td class="num ${o[l] === max ? "max" : ""}">${o[l]}</td></tr>`;
    }).join("")).join("");
    const pesos = D.temas.map((t, i) => ({ i, nombre: t.nombre, peso: pesoDe(i, l) })).sort((a, b) => b.peso - a.peso);
    const defender = pesos.slice(0, 2), cambiar = pesos.slice(-2).reverse();
    return `
<section class="seccion">
  <div class="cabecera">
    <div>
      <span class="ojo">Sala ${estado.sala} · ficha privada · ${esc(R.nombre)}</span>
      <h1 class="titulo-lado ${l}">Ustedes son <em>${esc(L.nombre)}</em></h1>
      <p class="entrada">${esc(L.rol)}. Solo para su lado: no la compartan ni la lean en voz alta.</p>
    </div>
    ${relojHTML("equipo", "")}
  </div>
  ${presenciaHTML()}
  <div class="tabs" role="tablist">${tabs.map(([id, nombre]) => `<button type="button" class="tab" role="tab" data-tab="${id}" aria-selected="${activa === id}">${nombre}</button>`).join("")}</div>
</section>
<section class="seccion panel-tab" data-panel="resumen" ${activa === "resumen" ? "" : "hidden"}>
  <div class="tarjeta trabajo"><span class="ojo">${esc(R.titulo)}</span><ul class="lista">${R.tareas.map(t => `<li>${esc(t)}</li>`).join("")}</ul></div>
  <div class="dos">
    <div class="tarjeta ${l}"><h3>Quiénes son ustedes</h3><p>${esc(L.quienes)}</p></div>
    <div class="tarjeta ${l}"><h3>Su posición inicial</h3><p class="nota-pie">Lo que dicen al sentarse.</p><p class="posicion">${esc(L.posicion)}</p></div>
  </div>
  <div class="tarjeta suave plan-b"><div class="numero">${L.planB.puntos}<small>Plan B</small></div><div><p>${esc(L.planB.texto)}</p><p><b>${esc(L.planB.aviso)}</b></p></div></div>
  <div class="botones"><a class="boton primario grande" href="#mesa">Ir a la mesa</a></div>
</section>
<section class="seccion panel-tab" data-panel="intereses" ${activa === "intereses" ? "" : "hidden"}>
  <div class="tarjeta"><h3>Sus intereses reales</h3><p class="nota-pie">Lo que de verdad les importa, en orden. La otra parte no lo sabe.</p><ol class="intereses">${L.intereses.map(i => `<li><div><b>${esc(i.titulo)}</b>${esc(i.texto)}</div></li>`).join("")}</ol></div>
  <div class="tarjeta"><h3>Consejos</h3><ul class="lista">${L.consejos.map(c => `<li>${esc(c)}</li>`).join("")}</ul></div>
</section>
<section class="seccion panel-tab" data-panel="puntos" ${activa === "puntos" ? "" : "hidden"}>
  <div class="tarjeta"><h3>Su tabla de puntos</h3><p class="nota-pie">Cada opción vale lo que dice aquí para ustedes. El máximo son 100. En verde, la mejor opción de cada tema.</p>
  <div class="tabla-envoltorio"><table><thead><tr><th>Tema</th><th>Opción</th><th class="num">Puntos</th></tr></thead><tbody>${filasTabla}</tbody></table></div></div>
  <div class="tarjeta suave plan-b"><div class="numero">${L.planB.puntos}<small>Plan B</small></div><div><p>${esc(L.planB.texto)}</p><p><b>${esc(L.planB.aviso)}</b></p></div></div>
</section>
<section class="seccion panel-tab" data-panel="guion" ${activa === "guion" ? "" : "hidden"}>
  <div class="tarjeta"><span class="ojo">Al sentarse</span><p class="posicion">${esc(L.posicion)}</p></div>
  <div class="dos">
    <div class="tarjeta"><h3>Preguntas que abren la mesa</h3><ul class="lista"><li>«¿Para qué lo necesitan así?»</li><li>«De todo esto, ¿qué es lo que más les importa?»</li><li>«Si cedemos en eso, ¿qué nos pueden dar a cambio?»</li>${L.consejos.slice(0, 2).map(c => `<li>${esc(c)}</li>`).join("")}</ul></div>
    <div class="tarjeta"><h3>Monedas de cambio</h3><p class="nota-pie">Según cuánto vale cada tema para ustedes.</p><div class="monedas">${defender.map(p => `<div class="moneda defender"><div><b>${esc(p.nombre)}</b><br><span class="nota-pie">defender: aquí están sus puntos</span></div><span class="peso">${p.peso}</span></div>`).join("")}${cambiar.map(p => `<div class="moneda cambiar"><div><b>${esc(p.nombre)}</b><br><span class="nota-pie">ceder a cambio de algo: les cuesta poco</span></div><span class="peso">${p.peso}</span></div>`).join("")}</div></div>
  </div>
  <div class="tarjeta suave"><h3>No decir</h3><ul class="lista"><li>Sus puntos, ni los de ninguna opción.</li><li>El plan B exacto. «Tenemos otra opción» es suficiente.</li><li>Un «sí» antes de preguntar qué dan a cambio.</li></ul></div>
</section>
<section class="seccion panel-tab" data-panel="prep" ${activa === "prep" ? "" : "hidden"}>
  <div class="tarjeta"><h3>Hoja de preparación</h3><p class="nota-pie">Misión 1 del laboratorio: tres respuestas cortas, entre los dos. Se guardan en este dispositivo.</p>
  <div class="tres">${L.preparacion.map(p => `<label class="campo" for="prep-${p.id}">${esc(p.pregunta)}<textarea id="prep-${p.id}" data-prep="${p.id}">${esc(notas[p.id] || "")}</textarea></label>`).join("")}</div></div>
  <div class="botones"><a class="boton primario grande" href="#mesa">Ir a la mesa</a><button type="button" class="boton contorno" id="btn-salir">Cambiar de sala, lado o rol</button></div>
</section>`;
  }

  function registroHTML() {
    if (!estado.registro.length) return `<p class="registro-vacio">Todavía no hay apuntes. Guarde cada oferta que se diga y anote qué le importa al otro lado.</p>`;
    return estado.registro.slice().reverse().map(r => r.tipo === "nota"
      ? `<div class="registro-item nota"><span class="t">${horaDe(r.t)}</span><span>${esc(r.texto)}</span></div>`
      : `<div class="registro-item ${r.de}"><span class="t">${horaDe(r.t)}</span><span><b>${r.de === "nuestra" ? "Nuestra oferta" : "Oferta de ellos"}</b> · <code>${esc(r.letras)}</code></span><span class="pts">${r.puntos} pts</span></div>`).join("");
  }
  function propuestaResumenHTML(lado) {
    return D.temas.map((t, i) => { const o = estado.trato[i] ? opcionDe(i, estado.trato[i]) : null; return `<div class="fila"><span class="tema">${esc(t.nombre)}</span>${o ? `<span class="valor"><b>${esc(o.texto)}</b><span class="pts">+${o[lado]}</span></span>` : `<span class="valor vacio">sin acordar</span>`}</div>`; }).join("");
  }
  function vistaMesa() {
    const l = estado.lado, L = D.lados[l];
    const cerrado = estado.cerrado;
    const clausulas = D.temas.map((t, i) => `
<div class="clausula tarjeta">
  <div class="clausula-cab"><span class="n">0${i + 1}</span><h3>${esc(t.nombre)}</h3><span class="pregunta">${esc(t.pregunta)}</span></div>
  <div class="chips" role="radiogroup" aria-label="${esc(t.nombre)}">${chipsOpciones(i, l, estado.trato[i], "tema")}</div>
</div>`).join("");
    let codigoHTML = "";
    if (cerrado) {
      const explicacion = cerrado.letras
        ? `Ustedes obtienen <b>${puntos(cerrado.letras, l)} puntos</b> con este trato.`
        : `Cada parte se queda con su plan B: ustedes, <b>${L.planB.puntos} puntos</b>.` + (cerrado.ultima ? ` Última propuesta registrada: <span class="mono">${cerrado.ultima.join("")}</span>${cerrado.quien ? " (rechazada: " + esc(NOMBRE_QUIEN[cerrado.quien]) + ")" : ""}.` : "");
      const logrosCierre = estadoLaboratorio().logros.filter(x => x.hecho);
      codigoHTML = `
<section class="seccion tarjeta codigo-caja" id="codigo">
  <span class="sello sellar">${cerrado.letras ? "Trato hecho" : "Sin acuerdo"}</span>
  <div class="codigo" id="codigo-texto">${esc(codigoDe(estado.sala, cerrado))}</div>
  <p>${explicacion}</p>
  <p>${enVivo() ? "El código ya le llegó al administrador. Por si acaso, si su sala no tiene staff" : "Si su sala no tiene staff"}, <b>una sola persona de la sala</b> pega este código en el chat al volver.</p>
  ${logrosCierre.length ? `<div class="logros">${logrosCierre.map(x => `<span class="logro" title="${esc(x.texto)}">${esc(x.titulo)}</span>`).join("")}</div>` : ""}
  <div class="botones"><button type="button" class="boton primario" id="btn-copiar">Copiar código</button><button type="button" class="boton contorno" id="btn-reabrir">${cerrado.letras ? "Cambiar el trato" : "Volver a la mesa"}</button></div>
</section>`;
    }
    const letras = D.temas.map((t, i) => estado.trato[i] || null), completos = letras.every(Boolean);
    const suma = letras.reduce((s, le, i) => s + (le ? opcionDe(i, le)[l] : 0), 0);
    return `
<section class="seccion">
  <div class="cabecera">
    <div>
      <span class="ojo">Sala ${estado.sala} · ${esc(L.etiqueta)}</span>
      <h1>La mesa</h1>
      <p class="entrada">Marquen cada propuesta que se diga para ver cuánto vale para ustedes. Los puntos son solo suyos. El staff de la sala lleva el acta; si no hay, cierran ustedes.</p>
    </div>
    ${relojHTML("equipo", "")}
  </div>
  ${presenciaHTML()}
  <div class="ronda" id="ronda">${rondaHTML()}</div>
</section>
${codigoHTML}
<section class="seccion tarjeta panel-sin" id="panel-sin" hidden>
  <h3>Registrar «sin acuerdo»</h3>
  <p>Cada parte se queda con su plan B. Para evaluar la sala, anoten qué pasó.</p>
  <p><b>Última propuesta que hubo sobre la mesa:</b> <span id="sin-ultima"></span></p>
  <p><b>¿Quién la rechazó?</b></p>
  <div class="botones"><button type="button" class="boton" data-quien="A">La agencia</button><button type="button" class="boton" data-quien="C">El cliente</button><button type="button" class="boton" data-quien="T">Se acabó el tiempo</button><button type="button" class="boton contorno" data-quien="">No sé, o nadie en particular</button></div>
  <div class="botones"><button type="button" class="boton contorno" id="btn-sin-volver">Volver a la mesa</button></div>
</section>
<section class="seccion mesa-grid" ${cerrado ? "hidden" : ""} id="temas">
  <div class="clausulas">${clausulas}</div>
  <aside class="apuntes">
    <div class="tarjeta laboratorio arriba" id="laboratorio">${laboratorioHTML()}</div>
    <div class="tarjeta termometro arriba" id="termometro">${termometroHTML(l, suma, completos, letras.filter(x => !x).length)}</div>
    <div class="tarjeta"><span class="ojo">Propuesta sobre la mesa</span><div class="propuesta-resumen" id="propuesta-resumen">${propuestaResumenHTML(l)}</div>
      <div class="botones" style="margin-top:12px"><button type="button" class="boton chico" data-oferta="nuestra">Guardar como nuestra oferta</button><button type="button" class="boton chico contorno" data-oferta="ellos">Guardar como oferta de ellos</button></div>
      <div class="botones" style="margin-top:12px"><button type="button" class="boton primario" id="btn-cerrar" ${completos ? "" : "disabled"}>Trato hecho</button><button type="button" class="boton peligro" id="btn-sin">Sin acuerdo</button></div>
    </div>
    <div class="tarjeta"><span class="ojo">Apuntes</span>
      <div class="presets" style="margin-top:8px">${PRESETS_EQUIPO.map(p => `<button type="button" class="preset" data-nota="${esc(p)}">${esc(p)}</button>`).join("")}</div>
      <form class="nota-form" id="form-nota" style="margin-top:8px"><input type="text" id="nota-texto" placeholder="Anotar algo que dijeron…" autocomplete="off"><button type="submit" class="boton chico">Anotar</button></form>
      <div class="registro" id="registro" style="margin-top:10px">${registroHTML()}</div>
    </div>
  </aside>
</section>
<div class="calculadora" ${cerrado ? "hidden" : ""}>
  <div><div class="total"><span id="calc-total">${suma}</span><small>de 100</small></div><div class="veredicto" id="calc-veredicto">Plan B: ${L.planB.puntos}</div></div>
  <div class="botones"><button type="button" class="boton peligro chico" id="btn-sin-2">Sin acuerdo</button><button type="button" class="boton primario chico" id="btn-cerrar-2" ${completos ? "" : "disabled"}>Trato hecho</button></div>
</div>`;
  }

  function letrasActuales() { return D.temas.map((t, i) => estado.trato[i] || null); }
  function actualizarCalculadora() {
    const l = estado.lado; if (!l) return 0;
    const letras = letrasActuales(), completos = letras.every(Boolean);
    const suma = letras.reduce((s, le, i) => s + (le ? opcionDe(i, le)[l] : 0), 0);
    const planB = D.lados[l].planB.puntos;
    const term = document.getElementById("termometro"); if (term) term.innerHTML = termometroHTML(l, suma, completos, letras.filter(x => !x).length);
    if (document.getElementById("laboratorio")) pintarLaboratorio();
    const res = document.getElementById("propuesta-resumen"); if (res) res.innerHTML = propuestaResumenHTML(l);
    ["btn-cerrar", "btn-cerrar-2"].forEach(id => { const b = document.getElementById(id); if (b) b.disabled = !completos; });
    const total = document.getElementById("calc-total"), ver = document.getElementById("calc-veredicto");
    if (total) {
      total.textContent = suma;
      if (!completos) { ver.className = "veredicto"; ver.textContent = "Faltan " + letras.filter(x => !x).length + " temas · plan B: " + planB; }
      else if (suma >= planB) { ver.className = "veredicto ok"; ver.textContent = "Supera su plan B por " + (suma - planB); }
      else { ver.className = "veredicto mal"; ver.textContent = "Por debajo de su plan B (" + planB + ")"; }
    }
    return suma;
  }
  function anotar(item) {
    estado.registro.push(item); guardarS("registro", estado.registro);
    const z = document.getElementById("registro"); if (z) z.innerHTML = registroHTML();
    reportar({ ofertas: estado.registro.filter(r => r.tipo === "oferta").length, notas: estado.registro.filter(r => r.tipo === "nota").length });
    pintarLaboratorio();
  }
  function abrirPanelSin() {
    const panel = document.getElementById("panel-sin"), span = document.getElementById("sin-ultima");
    const letras = letrasActuales();
    span.innerHTML = letras.every(Boolean)
      ? `<span class="mono">${letras.join("")}</span> · ${resumenTrato(letras)}`
      : `ninguna completa. Si hubo una, vuelvan a la mesa y márquenla antes de registrar; si no, sigan.`;
    panel.hidden = false; panel.scrollIntoView({ block: "start" });
  }
  function cerrarCon(cierre) {
    estado.cerrado = cierre; guardarS("cerrado", cierre);
    Sync.fijar("salas/" + estado.sala + "/cierre", { codigo: codigoDe(estado.sala, cierre), por: estado.lado, ts: Date.now() });
    reportar({ fase: "cerrado", propuesta: cierre.letras ? cierre.letras.join("") : propuestaActual() });
    render();
  }

  /* ---------- acta del staff ---------- */
  function guardarActa(n, acta) {
    acta.actualizado = Date.now();
    estado.actas[n] = acta; guardar("actas", estado.actas);
    Sync.fijar("salas/" + n + "/acta", acta);
    pintarActa();
  }
  function actaHTML() {
    const n = estado.staffSala, acta = actaDe(n), s = (vivo.salas && vivo.salas[n]) || {};
    const letras = D.temas.map((t, i) => acta.temas[i] || null), completos = letras.every(Boolean);
    const cierre = s.cierre || (estado.actas[n] && estado.actas[n].cierre) || null;
    const clausulas = D.temas.map((t, i) => `
<div class="clausula">
  <div class="clausula-cab"><span class="n">0${i + 1}</span><h3>${esc(t.nombre)}</h3><span class="pregunta">${acta.temas[i] ? "acordado" : "pendiente"}</span></div>
  <div class="chips">${D.temas[i].opciones.map(o => `<button type="button" class="chip" data-acta-tema="${i}" data-letra="${o.letra}" aria-pressed="${acta.temas[i] === o.letra}"><span class="letra">${o.letra}</span><span>${esc(o.texto)}</span></button>`).join("")}</div>
</div>`).join("");
    const notas = acta.notas.slice().reverse().map(x => `<div class="registro-item nota"><span class="t">${horaDe(x.t)}</span><span>${esc(x.texto)}</span></div>`).join("") || `<p class="registro-vacio">Sin apuntes todavía.</p>`;
    return `
<div class="cabecera"><div><span class="ojo">Acta de la sala ${n}</span><h2>${cierre ? "Cerrada: " + esc(cierre.codigo) : completos ? "Los cinco temas acordados" : (5 - letras.filter(Boolean).length) + " temas pendientes"}</h2></div>
  ${cierre ? `<div class="botones"><button type="button" class="boton chico" data-copiar="${esc(cierre.codigo)}">Copiar código</button><button type="button" class="boton chico contorno" id="btn-acta-reabrir">Reabrir</button></div>` : `<div class="botones"><button type="button" class="boton primario" id="btn-acta-cerrar" ${completos ? "" : "disabled"}>Trato hecho</button><button type="button" class="boton peligro" id="btn-acta-sin">Sin acuerdo</button></div>`}
</div>
<div class="tarjeta panel-sin" id="acta-panel-sin" hidden>
  <p><b>Sin acuerdo.</b> Última propuesta sobre la mesa: ${completos ? `<span class="mono">${letras.join("")}</span>` : "ninguna completa (se registra sin propuesta)"}. ¿Quién la rechazó?</p>
  <div class="botones"><button type="button" class="boton" data-acta-quien="A">La agencia</button><button type="button" class="boton" data-acta-quien="C">El cliente</button><button type="button" class="boton" data-acta-quien="T">Se acabó el tiempo</button><button type="button" class="boton contorno" data-acta-quien="">No sé</button></div>
</div>
<div class="mesa-grid">
  <div class="tarjeta clausulas">${clausulas}</div>
  <div class="tarjeta"><span class="ojo">Apuntes de la sala</span>
    <div class="presets" style="margin-top:8px">${PRESETS_STAFF.map(p => `<button type="button" class="preset" data-acta-nota="${esc(p)}">${esc(p)}</button>`).join("")}</div>
    <div class="registro" id="acta-notas" style="margin-top:10px">${notas}</div>
  </div>
</div>`;
  }
  function pintarActa() { const z = document.getElementById("acta"); if (z) z.innerHTML = actaHTML(); }
  function cerrarActa(cierre) {
    const n = estado.staffSala, acta = actaDe(n);
    const codigo = codigoDe(n, cierre);
    acta.cierre = { codigo, por: "staff", ts: Date.now() };
    estado.actas[n] = acta; guardar("actas", estado.actas);
    Sync.fijar("salas/" + n + "/cierre", acta.cierre);
    Sync.fijar("salas/" + n + "/acta", acta);
    pintarActa(); avisar("Sala " + n + " cerrada: " + codigo);
  }

  function graficoSVG(filas) {
    const W = 600, H = 440, mx = 52, my = 18, mb = 50, mr = 22, pw = W - mx - mr, ph = H - my - mb;
    const X = a => mx + a / 100 * pw, Y = c => my + (100 - c) / 100 * ph;
    const pa = PLAN_B.agencia, pc = PLAN_B.cliente;
    const fr = frontera();
    const ticks = [0, 25, 50, 75, 100];
    const grupos = new Map();
    for (const f of filas) { const k = f.a + "/" + f.c; if (!grupos.has(k)) grupos.set(k, { ...f, salas: [] }); grupos.get(k).salas.push(f.sala); }
    const mejor = filas.find(f => f.valido && !f.sin);
    const ultimasSVG = filas.filter(f => f.sin && f.ultima).map(f => {
      const u = f.ultima, tip = "S" + f.sala + " · última propuesta " + u.letras.join("") + " · agencia " + u.a + " · cliente " + u.c + (f.perdido ? " · trato perdido" : " · no servía");
      return `<line class="enlace-ultima" x1="${X(f.a).toFixed(1)}" y1="${Y(f.c).toFixed(1)}" x2="${X(u.a).toFixed(1)}" y2="${Y(u.c).toFixed(1)}"></line><circle class="ultima" cx="${X(u.a).toFixed(1)}" cy="${Y(u.c).toFixed(1)}" r="5" tabindex="0" role="img" aria-label="${esc(tip)}" data-tip="${esc(tip)}"></circle><text class="nota" x="${(X(u.a) + 8).toFixed(1)}" y="${(Y(u.c) + 14).toFixed(1)}">S${f.sala} última</text>`;
    }).join("");
    const puntosSVG = [...grupos.values()].map(g => {
      const clase = "punto" + (!g.valido ? " invalido" : "") + (g.sin ? " sin" : "") + (mejor && g.salas.includes(mejor.sala) ? " mejor" : "");
      const etiqueta = g.salas.map(s => "S" + s).join(", ");
      const detalle = (g.sin ? "Sin acuerdo" : g.letras.join("")) + " · agencia " + g.a + " · cliente " + g.c + " · índice " + g.indice + (g.valido ? "" : " · no cuenta");
      return `<g><circle class="${clase}" cx="${X(g.a).toFixed(1)}" cy="${Y(g.c).toFixed(1)}" r="6" tabindex="0" role="img" aria-label="${esc(etiqueta + ": " + detalle)}" data-tip="${esc(etiqueta + " · " + detalle)}"></circle><text class="etiqueta" x="${(X(g.a) + 9).toFixed(1)}" y="${(Y(g.c) - 8).toFixed(1)}">${esc(etiqueta)}</text></g>`;
    }).join("");
    return `
<svg class="grafico" viewBox="0 0 ${W} ${H}" role="img" aria-label="Puntos de la agencia contra puntos del cliente por sala">
  <rect class="zona-mala" x="${X(0)}" y="${my}" width="${(X(pa) - X(0)).toFixed(1)}" height="${ph}"></rect>
  <rect class="zona-mala" x="${X(0)}" y="${Y(pc).toFixed(1)}" width="${pw}" height="${(Y(0) - Y(pc)).toFixed(1)}"></rect>
  ${ticks.map(t => `<line class="eje" x1="${X(t).toFixed(1)}" y1="${my}" x2="${X(t).toFixed(1)}" y2="${Y(0)}"></line><text x="${X(t).toFixed(1)}" y="${Y(0) + 18}" text-anchor="middle">${t}</text>`).join("")}
  ${ticks.map(t => `<line class="eje" x1="${mx}" y1="${Y(t).toFixed(1)}" x2="${X(100)}" y2="${Y(t).toFixed(1)}"></line><text x="${mx - 8}" y="${(Y(t) + 4).toFixed(1)}" text-anchor="end">${t}</text>`).join("")}
  <polyline class="frontera" points="${fr.map(p => X(p.a).toFixed(1) + "," + Y(p.c).toFixed(1)).join(" ")}"></polyline>
  <line class="guia" x1="${X(pa).toFixed(1)}" y1="${my}" x2="${X(pa).toFixed(1)}" y2="${Y(0)}"></line>
  <text class="nota" x="${(X(pa) + 5).toFixed(1)}" y="${my + 12}">plan B agencia (${pa})</text>
  <line class="guia" x1="${mx}" y1="${Y(pc).toFixed(1)}" x2="${X(100)}" y2="${Y(pc).toFixed(1)}"></line>
  <text class="nota" x="${X(100) - 4}" y="${(Y(pc) - 5).toFixed(1)}" text-anchor="end">plan B cliente (${pc})</text>
  <text class="nota" x="${(X(fr[1].a) + 8).toFixed(1)}" y="${(Y(fr[1].c) + 16).toFixed(1)}">frontera de valor</text>
  ${ultimasSVG}
  ${puntosSVG}
  <text class="titulo-eje" x="${(mx + pw / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle">Puntos de la agencia</text>
  <text class="titulo-eje" transform="translate(14 ${(my + ph / 2).toFixed(1)}) rotate(-90)" text-anchor="middle">Puntos del cliente</text>
</svg>`;
  }

  function tableroHTML(lista, errores) {
    if (!lista.length && !errores.length) return `<p class="nota-pie">Todavía no hay códigos. Cárguelos en vivo, pegue el chat o cargue el ejemplo.</p>`;
    const mejor = lista.find(f => f.valido && !f.sin);
    const optimo = mejorTrato();
    const apuntesStaff = sala => { const a = enVivo() && vivo.salas && vivo.salas[sala] && vivo.salas[sala].acta ? actaDe(sala) : null; return a && a.notas.length ? ` Apuntes del staff: ${a.notas.map(x => esc(x.texto)).join("; ")}.` : ""; };
    const detalle = f => {
      if (!f.sin) return D.temas.map((t, i) => `${esc(t.nombre)}: <b>${esc(opcionDe(i, f.letras[i]).texto)}</b> (${opcionDe(i, f.letras[i]).agencia} / ${opcionDe(i, f.letras[i]).cliente})`).join(" · ") + "." + apuntesStaff(f.sala);
      return esc(f.motivo) + (f.ultima ? ". Última propuesta: " + resumenTrato(f.ultima.letras) : "") + "." + apuntesStaff(f.sala);
    };
    const filasHTML = lista.map((f, k) => {
      const esMejor = mejor && f.sala === mejor.sala;
      let estadoTxt;
      if (esMejor) estadoTxt = `<span class="estado mejor">Mejor negociación</span>`;
      else if (f.sin && f.perdido > 0) estadoTxt = `<span class="estado aviso">Sin acuerdo · trato perdido</span>`;
      else if (f.sin && f.diagnostico === "correcto") estadoTxt = `<span class="estado ok">Sin acuerdo · bien hecho</span>`;
      else if (f.sin) estadoTxt = `<span class="estado neutro">Sin acuerdo</span>`;
      else if (f.valido) estadoTxt = `<span class="estado ok">Trato válido</span>`;
      else estadoTxt = `<span class="estado mal">No cuenta</span>`;
      const trato = f.sin ? `SIN${f.ultima ? `<br><span class="nota-pie">última: ${f.ultima.letras.join("")}</span>` : ""}` : f.letras.join("");
      return `<tr class="${esMejor ? "mejor" : ""} ${f.valido ? "" : "invalido"}"><td class="num">${k + 1}</td><td class="sala"><b>Sala ${f.sala}</b></td><td class="mono">${trato}</td><td class="num">${f.a}</td><td class="num">${f.c}</td><td class="num">${f.total}</td><td class="num"><b>${f.indice}</b></td><td>${estadoTxt}${f.motivo === "Trato válido" ? "" : `<br><span class="nota-pie">${esc(f.motivo)}</span>`}</td></tr>`;
    }).join("");
    return `
${errores.length ? `<div class="errores">${errores.map(e => `<div>${e}</div>`).join("")}</div>` : ""}
${mejor ? `<div class="podio"><span class="ojo">Mejor negociación</span><div class="ganadora">Sala ${mejor.sala}: ${mejor.a} para la agencia, ${mejor.c} para el cliente</div><p>Índice ganar-ganar ${mejor.indice} de ${optimo.indice} posibles (${Math.round(mejor.indice / optimo.indice * 100)} %). ${detalle(mejor)}</p></div>` : `<div class="podio"><span class="ojo">Resultado</span><div class="ganadora">Ningún trato válido. La mejor jugada fue no cerrar.</div></div>`}
<div class="tabla-envoltorio"><table><thead><tr><th class="num">#</th><th>Sala</th><th>Trato</th><th class="num acento-agencia">Agencia</th><th class="num acento-cliente">Cliente</th><th class="num">Total</th><th class="num">Índice</th><th>Estado</th></tr></thead><tbody>${filasHTML}</tbody></table></div>
<div class="tarjeta">
  ${graficoSVG(lista)}
  <div class="leyenda-grafico"><span>trato válido</span><span class="inv">no cuenta</span><span class="sin">sin acuerdo</span><span class="ul">última propuesta de una sala sin acuerdo</span><span class="fr">frontera de valor</span></div>
  <p class="nota-pie">Cada punto es una sala. Cuanto más arriba y a la derecha, más valor creó. La línea punteada es la frontera: tratos en los que ya no se puede mejorar a uno sin empeorar al otro. Las zonas sombreadas quedan por debajo de un plan B. Las salas sin acuerdo caen en el cruce de los dos planes B; el círculo hueco muestra lo que tenían sobre la mesa.</p>
</div>
<details><summary>Detalle de cada sala</summary><ul class="lista">${lista.map(f => `<li><b>Sala ${f.sala}</b> (${f.sin ? "SIN" : f.letras.join("")}): ${detalle(f)}</li>`).join("")}</ul></details>`;
  }

  function revelacionHTML() {
    const optimo = mejorTrato();
    const filas = D.temas.map(t => {
      const maxSuma = Math.max(...t.opciones.map(o => o.agencia + o.cliente));
      return t.opciones.map((o, k) => `<tr class="${k === 0 ? "tema-inicio" : ""} ${o.agencia + o.cliente === maxSuma ? "mejor-suma" : ""}">${k === 0 ? `<td rowspan="${t.opciones.length}"><b>${esc(t.nombre)}</b></td>` : ""}<td><span class="mono">${o.letra}</span> ${esc(o.texto)}</td><td class="num agencia">${o.agencia}</td><td class="num cliente">${o.cliente}</td><td class="num suma">${o.agencia + o.cliente}</td></tr>`).join("");
    }).join("");
    return `
<section class="seccion" id="revelacion">
  <h2>Lo que había debajo de la mesa</h2>
  <p>${esc(D.revelacion.intro)}</p>
  <div class="claves">${D.revelacion.claves.map(c => `<div class="clave"><b>${esc(c.titulo)}</b><p>${esc(c.texto)}</p></div>`).join("")}</div>
  <div class="dos">
    <div class="tarjeta agencia"><h3>${ladoHTML("agencia")}</h3><p class="nota-pie">Plan B: ${PLAN_B.agencia} puntos</p><ol class="intereses">${D.lados.agencia.intereses.map(i => `<li><div><b>${esc(i.titulo)}</b>${esc(i.texto)}</div></li>`).join("")}</ol></div>
    <div class="tarjeta cliente"><h3>${ladoHTML("cliente")}</h3><p class="nota-pie">Plan B: ${PLAN_B.cliente} puntos</p><ol class="intereses">${D.lados.cliente.intereses.map(i => `<li><div><b>${esc(i.titulo)}</b>${esc(i.texto)}</div></li>`).join("")}</ol></div>
  </div>
  <h3>Las dos tablas juntas</h3>
  <p class="nota-pie">Sombreada, la opción de cada tema que más valor suma entre los dos. El mejor trato posible era <span class="mono">${optimo.letras.join("")}</span>: ${optimo.a} para la agencia y ${optimo.c} para el cliente, índice ${optimo.indice}.</p>
  <div class="tabla-envoltorio"><table class="comparativa"><thead><tr><th>Tema</th><th>Opción</th><th class="num agencia">Agencia</th><th class="num cliente">Cliente</th><th class="num">Suma</th></tr></thead><tbody>${filas}</tbody></table></div>
  <div class="tarjeta suave"><h3>Preguntas para el cierre</h3><ol class="pasos">${D.revelacion.debrief.map(p => `<li>${esc(p)}</li>`).join("")}</ol></div>
</section>`;
  }

  function vistaResultados() {
    const selects = D.temas.map((t, i) => `<label class="campo" for="man-${i}">${esc(t.nombre)}<select id="man-${i}" data-manual="${i}">${t.opciones.map(o => `<option value="${o.letra}">${o.letra} · ${esc(o.texto)}</option>`).join("")}</select></label>`).join("");
    const vivoSi = enVivo();
    return `
<section class="seccion">
  <span class="ojo">Facilitadores</span>
  <h1>Resultados</h1>
  <p class="entrada">${vivoSi ? "«Cargar códigos en vivo» trae lo que registró cada sala; las que entraron y no cerraron cuentan como sin acuerdo. También se puede pegar el chat tal cual." : "Pegue el chat de la sala principal tal cual: el tablero encuentra los códigos solo."} Si una sala manda dos códigos, vale el último.</p>
</section>
<section class="seccion tarjeta">
  <label class="campo" for="chat">Códigos de las salas<textarea id="chat" rows="5" placeholder="S1-BEDCD&#10;S2-SIN-CBCBB-T&#10;…">${esc(estado.chat)}</textarea></label>
  <div class="botones">${vivoSi ? `<button type="button" class="boton primario" id="btn-vivo">Cargar códigos en vivo</button>` : ""}<button type="button" class="boton ${vivoSi ? "" : "primario"}" id="btn-calcular">Calcular</button><button type="button" class="boton contorno" id="btn-ejemplo">Cargar ejemplo</button><button type="button" class="boton contorno" id="btn-limpiar">Limpiar</button></div>
  <details><summary>Agregar una sala a mano</summary>
    <div class="entrada-manual">
      <label class="campo" for="man-sala">Sala<input type="number" id="man-sala" min="1" max="30" value="1"></label>
      ${selects}
      <div class="botones"><button type="button" class="boton" id="btn-manual">Agregar trato</button><button type="button" class="boton contorno" id="btn-manual-sin">Sin acuerdo con esta última propuesta</button><button type="button" class="boton contorno" id="btn-manual-sin-nada">Sin acuerdo, sin detalle</button></div>
    </div>
  </details>
</section>
<section class="seccion" id="tablero"></section>
<section class="seccion"><div class="botones"><button type="button" class="boton ${estado.revelar ? "contorno" : "primario"}" id="btn-revelar">${estado.revelar ? "Ocultar la revelación" : "Revelar los intereses"}</button><span class="nota-pie">Hasta que no se pulse, la pantalla compartida no muestra las tablas del otro lado.</span></div></section>
<div id="zona-revelacion">${estado.revelar ? revelacionHTML() : ""}</div>`;
  }

  function vistaAdmin() {
    const t = D.tiempos, total = FASES_ADMIN.reduce((s, f) => s + f.dur, 0);
    return `
<section class="seccion">
  <span class="ojo">Panel del administrador · pestaña privada: no compartirla</span>
  <h1>Admin</h1>
  <p class="entrada">El reloj corre las cinco fases completas (${mmss(total)}) y, con tablero en vivo, manda sobre los relojes de los equipos. Cada aviso se ilumina cuando toca y el botón copia el mensaje para transmitirlo a las salas. Si van tarde o adelantados, «Siguiente fase» salta el reloj.</p>
  ${relojHTML("admin", "grande")}
  <div class="botones"><a class="boton contorno" href="#inicio" target="_blank" rel="noopener">Inicio en otra pestaña, para compartir</a><a class="boton contorno" href="#resultados" target="_blank" rel="noopener">Resultados en otra pestaña</a><a class="boton contorno" href="#staff">Vista del staff</a><a class="boton contorno" href="#guion">Guion completo</a></div>
</section>
<section class="seccion">
  <div class="cabecera"><h2>Las salas, en vivo</h2><div class="botones"><button type="button" class="boton contorno chico" id="btn-probar">Probar conexión</button><button type="button" class="boton peligro chico" id="btn-reiniciar">Reiniciar la sesión</button></div></div>
  <div id="confirmar-reinicio" class="tarjeta suave" hidden><p><b>¿Borrar todo lo registrado en la sesión «${esc(vivo.conexion.sesion)}»?</b> Las salas, las actas, los cierres y el reloj. Sirve para empezar de cero después de un ensayo.</p><div class="botones"><button type="button" class="boton peligro" id="btn-reiniciar-si">Sí, borrar todo</button><button type="button" class="boton contorno" id="btn-reiniciar-no">No</button></div></div>
  <div id="vivo">${vivoHTML()}</div>
</section>
<section class="seccion">
  <h2>Qué toca ahora</h2>
  <div class="cues">${cuesHTML()}</div>
</section>
<section class="seccion dos">
  <div class="tarjeta"><h3>Zoom, en orden</h3><ol class="pasos">
    <li>Antes de empezar: que el profe los haga co-anfitriones, o que sea él quien abra las salas.</li>
    <li>Crear las salas de antemano con nombre «Sala 1» a «Sala ${C.salas || 6}» y activar «Permitir que los participantes elijan sala»: cada quien entra a la sala que le tocó en el mensaje de WhatsApp. Opciones: mover a todos automáticamente; cerrar a los ${minutos(t.preparacion + t.negociacion)}; cuenta regresiva de ${t.cierre} s. Un integrante del staff en cada sala que se pueda.</li>
    <li>Compartir la ventana del navegador con la pestaña Inicio, nunca la pantalla completa (esta pestaña se vería).</li>
    <li>Los avisos van por «Transmitir mensaje a todas las salas», en el panel de salas.</li>
    <li>Al cerrar las salas, cargar los códigos en vivo en Resultados; si alguno falta, pedirlo por el chat.</li>
  </ol></div>
  <div class="tarjeta suave"><h3>Cómo se lee un código</h3><ul class="lista">
    <li><span class="mono">S3-BEDCD</span>: la sala 3 cerró con esas cinco opciones, una letra por tema.</li>
    <li><span class="mono">S4-SIN-EDCAB-C</span>: la sala 4 no cerró; la última propuesta fue EDCAB y la rechazó el cliente (A sería la agencia, T que se acabó el tiempo).</li>
    <li><span class="mono">S8-SIN</span>: no cerró y no registró detalle. Se evalúa con los planes B, sin diagnóstico.</li>
  </ul></div>
</section>`;
  }

  function vistaStaff() {
    const numeros = new Set(Object.keys(vivo.salas || {}).map(Number).filter(n => n > 0));
    for (let i = 1; i <= (C.salas || 8); i++) numeros.add(i);
    const lista = [...numeros].sort((a, b) => a - b);
    return `
<section class="seccion">
  <div class="cabecera">
    <div><span class="ojo">Staff · escribano de la sala</span><h1>Mi sala</h1><p class="entrada">Usted lleva el acta: marca lo que se va acordando, anota qué pasa y registra el cierre. Los estudiantes no ven el acta; ven su propia mesa.</p></div>
    <div class="reloj" data-reloj="admin"><span class="fase-actual">Esperando al administrador</span><span class="tiempo">${mmss(FASES_ADMIN[0].dur)}</span></div>
  </div>
  <div class="salas-chips">${lista.map(n => `<button type="button" class="chip" data-staff-sala="${n}" aria-pressed="${estado.staffSala === n}"><span class="letra">${n}</span><span>Sala ${n}</span></button>`).join("")}</div>
</section>
<section class="seccion" id="acta">${actaHTML()}</section>
<section class="seccion"><h2>Todas las salas</h2><div id="vivo">${vivoHTML()}</div></section>
<section class="seccion"><h2>Qué toca ahora</h2><div class="cues">${cuesHTML()}</div></section>
<section class="seccion tarjeta suave"><h3>Reglas que vigila el staff</h3><ul class="lista">${D.contexto.reglas.map(r => `<li>${esc(r)}</li>`).join("")}</ul><p class="nota-pie">Dudas de reglas sí; de estrategia no. Si una sala pregunta «¿qué nos conviene?», la respuesta es «pregúntenle a la otra parte para qué lo necesita».</p></section>`;
  }

  function vistaGuion() {
    const t = D.tiempos, M = mensajes();
    const inicioNeg = t.consigna + t.preparacion, inicioCierre = inicioNeg + t.negociacion, inicioDebrief = inicioCierre + t.cierre, fin = inicioDebrief + t.debrief;
    const lista = [
      ["Ingreso (chat de la sala principal)", M.ingreso],
      ["Aviso a las salas, minuto " + mmss(inicioNeg - 30), M.prep30],
      ["Aviso a las salas, minuto " + mmss(inicioCierre - 180), M.faltan3],
      ["Aviso a las salas, minuto " + mmss(inicioCierre - 60), M.ultimo],
      ["Al cerrar las salas", M.cierre]
    ];
    return `
<section class="seccion">
  <span class="ojo">Facilitadores · ${mmss(fin)} en total</span>
  <h1>Guion</h1>
  <p class="entrada">Minuto a minuto, qué se dice y quién lo dice. La consigna tiene que caber en un minuto: lo demás lo hace la web. El administrador lleva el reloj y los avisos desde el <a href="#admin">panel Admin</a>; cada integrante del staff lleva el acta de su sala desde <a href="#staff">Staff</a>.</p>
</section>
<section class="seccion dos">
  <div class="tarjeta"><h3>Roles del grupo</h3><ul class="lista">
    <li><b>Administrador.</b> Abre, lee las reglas, pega el enlace, abre y cierra las salas, lleva el reloj y los avisos y maneja el tablero de resultados.</li>
    <li><b>Staff, uno por sala.</b> Entra a su sala de Zoom con la vista Staff en el celular: marca en el acta lo que se va acordando, anota qué pasa (quién preguntó, quién ofreció un cambio) y registra el cierre. Resuelve dudas de reglas, nunca de estrategia.</li>
    <li><b>Revelación.</b> Lee el tablero en voz alta: la ganadora, quién se levantó bien, quién dejó un trato en la mesa, y los apuntes del staff que lo expliquen.</li>
    <li><b>Cierre.</b> Lanza las tres preguntas, conecta con la teoría y da paso a la presentación.</li>
  </ul></div>
  <div class="tarjeta"><h3>Roles en cada pareja</h3><ul class="lista">
    <li><b>Vocero.</b> Habla: abre con la posición, pregunta antes de ofrecer, cambia cada concesión por algo. Su ficha abre en la pestaña Guion.</li>
    <li><b>Analista.</b> Lleva la cuenta: marca cada propuesta en la mesa, vigila el termómetro contra el plan B, guarda las ofertas y anota qué le importa al otro lado. Su ficha abre en Puntos.</li>
    <li>Si alguien queda solo en su lado, elige «Los dos».</li>
  </ul></div>
</section>
<section class="seccion tarjeta">
  <h2>Antes de la clase</h2>
  <ul class="chequeo">
    <li>Pedirle al profe, que es el anfitrión, que haga co-anfitrión al administrador antes de empezar, o que sea él quien abra las salas.</li>
    <li>Publicar en el WhatsApp de la clase, antes de la sesión, quién va en cada sala, de qué lado y con qué rol. Crear las salas de antemano con nombre «Sala 1» a «Sala ${C.salas || 6}» y activar «Permitir que los participantes elijan sala»; un integrante del staff en cada sala que se pueda. Opciones: mover a todos automáticamente, cerrar las salas a los ${minutos(t.preparacion + t.negociacion)} y cuenta regresiva de ${t.cierre} segundos.</li>
    <li>Tener la web abierta en tres pestañas: Admin (privada), Inicio (para compartir) y Resultados (para el cierre). El staff abre Staff con la clave y elige su sala.</li>
    <li>Tener listo el mensaje de ingreso (abajo) y probar que el enlace abre en un celular.</li>
    <li>Compartir la ventana del navegador, no la pantalla completa.</li>
    <li>Tener las fichas en PDF a mano por si la web falla: se mandan por el chat de cada sala.</li>
    <li>Ensayar una vez con reloj y con el tablero en vivo. Lo que no cabe en el tiempo se recorta antes, no en vivo.</li>
  </ul>
</section>
<section class="seccion">
  <h2>Minuto a minuto</h2>
  <div class="linea-tiempo tarjeta">
    <div class="minuto"><span class="cuando">${mmss(0)}</span><div><b>Consigna · ${minutos(t.consigna)}</b><p>Compartir la pestaña Inicio. Leer el caso en dos frases y las cuatro reglas. Pegar el mensaje de ingreso. Abrir las salas.</p>
      <div class="dice">«Van a negociar un contrato real entre una agencia y un cliente, dos contra dos. Cada lado tiene información privada que el otro no conoce. En cada pareja, uno habla y el otro lleva la cuenta. Tienen ${minutos(t.preparacion)} para prepararse y ${minutos(t.negociacion)} para cerrar. Gana la sala donde las dos partes salgan mejor, no la que más exprima al otro. Si no cierran, cada quien se queda con su plan B, y también evaluamos eso. Entren al enlace con su número de sala.»</div></div></div>
    <div class="minuto"><span class="cuando">${mmss(t.consigna)}</span><div><b>Preparación · ${minutos(t.preparacion)}</b><p>Salas abiertas. Cada pareja lee su ficha: el vocero su guion, el analista los puntos; llenan la hoja de preparación. El staff elige su sala en la vista Staff y resuelve dudas de reglas. Aviso a las salas a los 30 segundos del final.</p></div></div>
    <div class="minuto"><span class="cuando">${mmss(inicioNeg)}</span><div><b>Negociación · ${minutos(t.negociacion)}</b><p>Hablan. El analista de cada lado marca las propuestas en su mesa y guarda ofertas; el staff marca en el acta lo acordado y anota qué pasa. Avisos a las salas a los 3 minutos y al último minuto.</p></div></div>
    <div class="minuto"><span class="cuando">${mmss(inicioCierre)}</span><div><b>Cierre · ${minutos(t.cierre)}</b><p>El staff registra el cierre desde el acta: trato hecho con los cinco temas, o sin acuerdo con la última propuesta y quién la rechazó. Cerrar las salas con la cuenta regresiva. Si una sala no tiene staff, una persona pega su código en el chat.</p></div></div>
    <div class="minuto"><span class="cuando">${mmss(inicioDebrief)}</span><div><b>Resultados · ${minutos(t.debrief)}</b><p>Cargar los códigos en vivo (o pegar el chat) y calcular. Nombrar la sala ganadora y leer su trato en voz alta. Si hubo salas sin acuerdo, decir cuáles se levantaron con razón y cuáles dejaron un trato en la mesa; los apuntes del staff cuentan por qué. Pulsar «Revelar los intereses» y contar dos claves: posición contra interés, y dar lo barato para cobrar lo caro. Cerrar con las tres preguntas; recoger dos respuestas en voz.</p>
      <div class="dice">«La sala que ganó no fue la que consiguió el mejor precio. Fue la que preguntó para qué necesitaba el otro lo que pedía.»</div></div></div>
    <div class="minuto"><span class="cuando">${mmss(fin)}</span><div><b>Fin</b><p>De aquí en adelante sigue la presentación: la actividad ya puso en la mesa los seis puntos de la CEP.</p></div></div>
  </div>
</section>
<section class="seccion">
  <h2>Mensajes listos para pegar</h2>
  <div class="mensajes">${lista.map(([tt, m]) => `<div class="mensaje"><div><span class="ojo">${esc(tt)}</span><br><code>${esc(m)}</code></div><button type="button" class="boton chico" data-copiar="${esc(m)}">Copiar</button></div>`).join("")}</div>
  <p class="nota-pie">Los avisos a las salas van por «Transmitir mensaje a todas las salas», en el panel de salas de Zoom. En el panel Admin aparecen en el momento justo.</p>
</section>
<section class="seccion dos">
  <div class="tarjeta"><h3>Qué muestra la actividad de la CEP</h3><ul class="lista">
    <li><b>Concepto y ganar-ganar.</b> El índice premia a la sala donde los dos salen bien.</li>
    <li><b>Importancia.</b> El precio era menos de la mitad del valor en juego.</li>
    <li><b>Perfil del negociador.</b> Las salas que escucharon y preguntaron encontraron los intercambios.</li>
    <li><b>Posición contra interés.</b> «2 semanas» contra «la inauguración en cinco».</li>
    <li><b>Actividades para fomentarla.</b> La hoja de preparación, los roles y el plan B antes de hablar.</li>
    <li><b>Campos de aplicación.</b> Fue cliente y proveedor; la misma lógica sirve con socios y con el equipo.</li>
  </ul></div>
  <div class="tarjeta suave"><h3>Si algo falla</h3><ul class="lista">
    <li><b>El tablero en vivo no conecta.</b> No pasa nada: el staff registra el cierre igual y pega el código en el chat; Resultados lo lee pegado.</li>
    <li><b>La web no abre.</b> Mandar las fichas en PDF por el chat de cada sala. El staff lleva el acta en papel y dice los tratos en voz alta al volver; el administrador los mete a mano en el tablero.</li>
    <li><b>No se pueden abrir salas.</b> Modo pecera: dos parejas negocian en la sala principal con cámara, el resto observa y anota en el chat qué preguntas hicieron. Dura lo mismo.</li>
    <li><b>Van tarde.</b> Preparación de 2 minutos y negociación de 5, con «Siguiente fase» en el panel Admin. El resto igual.</li>
  </ul></div>
</section>`;
  }

  /* ---------- enrutador ---------- */
  const tooltip = document.createElement("div"); tooltip.className = "tooltip"; tooltip.hidden = true; document.body.appendChild(tooltip);
  function render() {
    let ruta = (location.hash || "#inicio").replace(/^#\/?/, "") || "inicio";
    if ((ruta === "equipo" || ruta === "mesa") && !(estado.sala && estado.lado)) { ruta = "inicio"; avisar("Primero elija su sala y su lado."); }
    const vistas = { inicio: vistaInicio, equipo: vistaEquipo, mesa: vistaMesa, resultados: vistaResultados, admin: vistaAdmin, staff: vistaStaff, guion: vistaGuion };
    if (!vistas[ruta]) ruta = "inicio";
    rutaActual = ruta;
    app.innerHTML = VISTAS_FACILITADOR.includes(ruta) && !tieneClave() ? vistaClave(ruta) : vistas[ruta]();
    tooltip.hidden = true;
    document.querySelectorAll("#nav a").forEach(a => a.classList.toggle("activo", a.dataset.ruta === ruta));
    chipSala(); tick();
    if (ruta === "equipo") { if (!estado.entrado) { estado.entrado = Date.now(); guardarS("entrado", estado.entrado); } reportar({ fase: estado.cerrado ? "cerrado" : "ficha", entrado: estado.entrado, propuesta: propuestaActual(), rol: estado.rol }); anunciar(); }
    if (ruta === "inicio") { if (!(leerS("sala", null))) { estado.sala = null; estado.lado = null; } actualizarBotonEntrar(); }
    if (ruta === "mesa") { const suma = actualizarCalculadora(); reportar({ fase: estado.cerrado ? "cerrado" : "mesa", propuesta: propuestaActual(), puntos: suma }); pintarLaboratorio(); }
    if (ruta === "resultados") calcular();
    window.scrollTo({ top: 0 });
  }

  function calcular() {
    const zona = document.getElementById("tablero"); if (!zona) return;
    const { filas, errores } = parsearCodigos(estado.chat);
    zona.innerHTML = tableroHTML(ordenar(filas), errores);
  }
  function agregarCodigo(codigo) {
    estado.chat = (estado.chat ? estado.chat.trimEnd() + "\n" : "") + codigo; guardar("chat", estado.chat);
    document.getElementById("chat").value = estado.chat; calcular(); avisar(codigo + " agregado");
  }

  /* ---------- eventos ---------- */
  app.addEventListener("submit", e => {
    if (e.target.id === "form-clave") {
      e.preventDefault();
      const clave = document.getElementById("clave").value.trim();
      if (clave === String(C.claveStaff)) { guardar("staff", clave); render(); avisar("Bienvenido"); }
      else { avisar("Clave incorrecta."); document.getElementById("clave").select(); }
    }
    if (e.target.id === "form-nota") {
      e.preventDefault();
      const campo = document.getElementById("nota-texto"), texto = campo.value.trim();
      if (!texto) return;
      anotar({ tipo: "nota", t: Date.now(), texto }); campo.value = "";
    }
  });
  app.addEventListener("click", e => {
    const b = e.target.closest("button, a"); if (!b) return;
    if (b.dataset.elegirSala) { estado.sala = parseInt(b.dataset.elegirSala, 10); estado.lado = b.dataset.elegirLado; pintarLobby(); return; }
    if (b.dataset.rol) { estado.rol = b.dataset.rol; document.querySelectorAll(".rol-boton").forEach(x => x.setAttribute("aria-pressed", String(x === b))); actualizarBotonEntrar(); return; }
    if (b.dataset.tab) { estado.tab = b.dataset.tab; guardarS("tab", estado.tab); document.querySelectorAll(".tab").forEach(x => x.setAttribute("aria-selected", String(x === b))); document.querySelectorAll(".panel-tab").forEach(p => { p.hidden = p.dataset.panel !== estado.tab; }); return; }
    if (b.dataset.accion === "reloj") { RELOJES[b.dataset.reloj || "equipo"].alternar(); return; }
    if (b.dataset.accion === "saltar") { RELOJES.admin.saltar(); return; }
    if (b.dataset.copiar) { copiar(b.dataset.copiar, null); return; }
    if (b.dataset.oferta) {
      const letras = letrasActuales(); if (!letras.some(Boolean)) { avisar("Marquen primero la propuesta en la mesa."); return; }
      anotar({ tipo: "oferta", t: Date.now(), de: b.dataset.oferta, letras: propuestaActual(), puntos: letras.reduce((s, le, i) => s + (le ? opcionDe(i, le)[estado.lado] : 0), 0) }); return;
    }
    if (b.dataset.nota) { anotar({ tipo: "nota", t: Date.now(), texto: b.dataset.nota }); return; }
    if (b.dataset.quien !== undefined) {
      const letras = letrasActuales();
      cerrarCon({ letras: null, ultima: letras.every(Boolean) ? letras : null, quien: b.dataset.quien || null }); return;
    }
    if (b.dataset.staffSala) { estado.staffSala = parseInt(b.dataset.staffSala, 10); guardar("staffSala", estado.staffSala); document.querySelectorAll("[data-staff-sala]").forEach(x => x.setAttribute("aria-pressed", String(x === b))); pintarActa(); return; }
    if (b.dataset.actaTema !== undefined) {
      const n = estado.staffSala, acta = actaDe(n), i = b.dataset.actaTema;
      if (acta.temas[i] === b.dataset.letra) delete acta.temas[i]; else acta.temas[i] = b.dataset.letra;
      guardarActa(n, acta); return;
    }
    if (b.dataset.actaNota) { const n = estado.staffSala, acta = actaDe(n); acta.notas.push({ t: Date.now(), texto: b.dataset.actaNota }); guardarActa(n, acta); return; }
    if (b.dataset.actaQuien !== undefined) {
      const acta = actaDe(estado.staffSala), letras = D.temas.map((t, i) => acta.temas[i] || null);
      cerrarActa({ letras: null, ultima: letras.every(Boolean) ? letras : null, quien: b.dataset.actaQuien || null }); return;
    }
    switch (b.id) {
      case "btn-entrar": {
        const nombre = document.getElementById("nombre").value.trim();
        if (!nombre) { avisar("Escriba su nombre."); document.getElementById("nombre").focus(); return; }
        if (!(estado.sala && estado.lado)) { avisar("Toque el lado de su sala en el tablero."); return; }
        const anterior = leerS("sala", null), ladoAnterior = leerS("lado", null);
        if (anterior && (anterior !== estado.sala || ladoAnterior !== estado.lado)) { despedirse(anterior); if (ladoAnterior) Sync.fijar("salas/" + anterior + "/" + ladoAnterior, null); }
        if (anterior !== estado.sala) { estado.trato = {}; estado.cerrado = null; estado.entrado = null; estado.registro = []; estado.avisadas = []; ["trato", "cerrado", "entrado", "registro", "avisadas"].forEach(k => guardarS(k, null)); }
        estado.nombre = nombre; guardarS("nombre", nombre); guardarS("sala", estado.sala); guardarS("lado", estado.lado); guardarS("rol", estado.rol); estado.tab = null; guardarS("tab", null);
        if (!estado.entrado) { estado.entrado = Date.now(); guardarS("entrado", estado.entrado); }
        anunciar(); location.hash = "#equipo"; break;
      }
      case "btn-salir": despedirse(estado.sala); Sync.fijar("salas/" + estado.sala + "/" + estado.lado, null); estado.sala = null; estado.lado = null; estado.trato = {}; estado.cerrado = null; estado.entrado = null; estado.registro = []; estado.avisadas = []; ["sala", "lado", "trato", "cerrado", "entrado", "registro", "tab", "avisadas"].forEach(k => guardarS(k, null)); location.hash = "#inicio"; break;
      case "btn-cerrar": case "btn-cerrar-2": { const letras = letrasActuales(); if (!letras.every(Boolean)) return; cerrarCon({ letras }); break; }
      case "btn-sin": case "btn-sin-2": abrirPanelSin(); break;
      case "btn-sin-volver": document.getElementById("panel-sin").hidden = true; document.getElementById("temas").scrollIntoView({ block: "start" }); break;
      case "btn-reabrir": estado.cerrado = null; guardarS("cerrado", null); Sync.fijar("salas/" + estado.sala + "/cierre", null); render(); break;
      case "btn-copiar": copiar(document.getElementById("codigo-texto").textContent.trim(), document.getElementById("codigo-texto")); break;
      case "btn-acta-cerrar": { const acta = actaDe(estado.staffSala), letras = D.temas.map((t, i) => acta.temas[i] || null); if (!letras.every(Boolean)) return; cerrarActa({ letras }); break; }
      case "btn-acta-sin": document.getElementById("acta-panel-sin").hidden = false; break;
      case "btn-acta-reabrir": { const n = estado.staffSala, acta = actaDe(n); delete acta.cierre; if (estado.actas[n]) delete estado.actas[n].cierre; guardar("actas", estado.actas); Sync.fijar("salas/" + n + "/cierre", null); Sync.fijar("salas/" + n + "/acta", acta); pintarActa(); break; }
      case "btn-calcular": estado.chat = document.getElementById("chat").value; guardar("chat", estado.chat); calcular(); break;
      case "btn-vivo": {
        const { codigos, sinCodigo } = codigosEnVivo();
        if (!codigos.length) { avisar("Ninguna sala ha registrado nada todavía."); return; }
        estado.chat = codigos.join("\n"); guardar("chat", estado.chat); document.getElementById("chat").value = estado.chat; calcular();
        avisar(codigos.length + " salas cargadas" + (sinCodigo.length ? "; sin código, como sin acuerdo: " + sinCodigo.map(n => "S" + n).join(", ") : "")); break;
      }
      case "btn-ejemplo": estado.chat = D.ejemplo.map(x => x.codigo).join("\n"); guardar("chat", estado.chat); document.getElementById("chat").value = estado.chat; calcular(); break;
      case "btn-limpiar": estado.chat = ""; guardar("chat", ""); document.getElementById("chat").value = ""; calcular(); break;
      case "btn-manual": case "btn-manual-sin": case "btn-manual-sin-nada": {
        const sala = parseInt(document.getElementById("man-sala").value, 10); if (!(sala > 0)) { avisar("Falta el número de sala."); return; }
        const letras = D.temas.map((t, i) => document.getElementById("man-" + i).value);
        const cierre = b.id === "btn-manual" ? { letras } : b.id === "btn-manual-sin" ? { letras: null, ultima: letras, quien: null } : { letras: null, ultima: null, quien: null };
        agregarCodigo(codigoDe(sala, cierre)); break;
      }
      case "btn-revelar": estado.revelar = !estado.revelar; guardar("revelar", estado.revelar); render(); if (estado.revelar) document.getElementById("revelacion").scrollIntoView(); break;
      case "btn-probar": {
        if (!enVivo()) { avisar("No hay tablero en vivo configurado."); return; }
        const t0 = Date.now(); let listo = false;
        const quitar = Sync.escuchar("config/prueba", v => { if (v === t0 && !listo) { listo = true; avisar("Conexión OK: ida y vuelta en " + (Date.now() - t0) + " ms"); setTimeout(quitar, 0); } });
        Sync.fijar("config/prueba", t0);
        setTimeout(() => { if (!listo) { avisar("Sin respuesta en 8 s: revise la configuración de Firebase."); quitar(); } }, 8000);
        break;
      }
      case "btn-reiniciar": document.getElementById("confirmar-reinicio").hidden = false; break;
      case "btn-reiniciar-no": document.getElementById("confirmar-reinicio").hidden = true; break;
      case "btn-reiniciar-si": Sync.borrarTodo(); RELOJES.admin.fijar(null); vivo.salas = {}; estado.actas = {}; guardar("actas", null); document.getElementById("confirmar-reinicio").hidden = true; pintarVivo(); avisar("Sesión reiniciada"); break;
    }
  });
  app.addEventListener("change", e => {
    const r = e.target;
    if (r.name && r.name.startsWith("tema-")) { estado.trato[parseInt(r.name.slice(5), 10)] = r.value; guardarS("trato", estado.trato); const suma = actualizarCalculadora(); reportar({ fase: "mesa", propuesta: propuestaActual(), puntos: suma }); }
  });
  let temporizadorPrep = null;
  app.addEventListener("input", e => {
    const t = e.target;
    if (t.dataset.prep) {
      const notas = leerS("prep." + estado.lado, {}); notas[t.dataset.prep] = t.value; guardarS("prep." + estado.lado, notas);
      clearTimeout(temporizadorPrep); temporizadorPrep = setTimeout(() => { reportar({ prep: Object.values(notas).filter(v => v && v.trim()).length }); pintarLaboratorio(); }, 600);
    }
    if (t.id === "chat") { estado.chat = t.value; guardar("chat", estado.chat); }
    if (t.id === "nombre") actualizarBotonEntrar();
  });
  /* tooltip del gráfico */
  const mostrarTip = (el, x, y) => { tooltip.textContent = el.dataset.tip; tooltip.hidden = false; tooltip.style.left = Math.min(x + 12, innerWidth - 250) + "px"; tooltip.style.top = (y + 12) + "px"; };
  const conTip = el => el.closest(".punto, .ultima");
  app.addEventListener("mouseover", e => { const p = conTip(e.target); if (p) mostrarTip(p, e.clientX, e.clientY); });
  app.addEventListener("mousemove", e => { const p = conTip(e.target); if (p) mostrarTip(p, e.clientX, e.clientY); });
  app.addEventListener("mouseout", e => { if (conTip(e.target)) tooltip.hidden = true; });
  app.addEventListener("focusin", e => { const p = conTip(e.target); if (p) { const r = p.getBoundingClientRect(); mostrarTip(p, r.left, r.top); } });
  app.addEventListener("focusout", e => { if (conTip(e.target)) tooltip.hidden = true; });

  /* ---------- en vivo: suscripciones ---------- */
  Sync.alCambiar(c => { vivo.conexion = c; pintarVivo(); });
  Sync.escuchar("config/reloj", v => {
    const inicio = v && v.inicio ? v.inicio : null;
    if (Sync.estado().modo === "nada") { RELOJES.equipo.remoto = undefined; RELOJES.admin.remoto = undefined; }
    else { RELOJES.equipo.remoto = inicio ? inicio + D.tiempos.consigna * 1000 : null; RELOJES.admin.remoto = inicio; }
    vivo.reloj = v; tick();
  });
  Sync.escuchar("salas", v => { vivo.salas = v || {}; pintarVivo(); pintarPresencia(); if (rutaActual === "inicio") pintarLobby(); if (rutaActual === "staff") pintarActa(); });

  window.addEventListener("hashchange", render);
  render();

  /* para puntuar desde la consola o desde pruebas */
  window.TratoHecho = { evaluar, parsearCodigos, ordenar, mejorTrato, frontera, puntos, codigoDe, estadoSala, estadoLaboratorio, rondaActual };
})();
