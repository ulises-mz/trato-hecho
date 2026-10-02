/* Trato Hecho: lógica de la web. Sin dependencias. Todo el contenido sale de datos.js;
   la instalación, de config.js; la sincronización en vivo, de sync.js; la escena de la mesa,
   de escena.js; el tutorial animado, de tutorial.js.
   El juego va por etapas: Entrar → Prepararse → Negociar → Cerrar → Resultado. El reloj
   (el del administrador si hay tablero en vivo, si no el del equipo) decide qué etapa toca y
   la web cambia sola, con una transición; lo que no es de la etapa no se muestra. */
(function () {
  "use strict";
  const D = window.DATOS, C = window.CONFIG || {}, Sync = window.Sync, Escena = window.Escena, Tutorial = window.Tutorial, Iconos = window.Iconos;
  const ico = (n, c) => Iconos.svg(n, c);
  const LADOS = ["agencia", "cliente"];
  const NOMBRE_QUIEN = { A: "la agencia", C: "el cliente", T: "se acabó el tiempo" };
  const ROLES = {
    vocero: { nombre: "Vocero", corto: "habla", icono: "mic", titulo: "Usted es el vocero", tareas: [
      ["speak", "Abra con la posición inicial, tal cual está escrita en la ficha."],
      ["question", "Antes de ofrecer nada, pregunte para qué necesita el otro lado lo que pide."],
      ["swap", "Cada concesión se cambia por algo: «si les damos esto, ¿qué nos pueden dar?»."],
      ["hush", "Nunca diga sus puntos ni su plan B exacto."] ] },
    analista: { nombre: "Analista", corto: "lleva la cuenta", icono: "calc", titulo: "Usted es el analista", tareas: [
      ["tap", "Marque en la mesa cada propuesta que se diga, para ver cuánto vale para ustedes."],
      ["thermometer", "Vigile el termómetro: nada por debajo del plan B."],
      ["note", "Guarde las ofertas en el registro y anote qué le importa al otro lado."],
      ["chat", "Avísele al vocero por chat privado qué conviene pedir."] ] },
    ambos: { nombre: "Los dos", corto: "habla y lleva la cuenta", icono: "users", titulo: "Usted hace de vocero y analista", tareas: [
      ["speak", "Abra con la posición inicial y pregunte para qué necesita el otro lado lo que pide."],
      ["tap", "Marque en la mesa cada propuesta y vigile el termómetro contra el plan B."],
      ["swap", "Cambie cada concesión por algo y nunca diga sus puntos."] ] }
  };
  const PRESETS_EQUIPO = ["Preguntaron para qué", "Les importa el plazo", "Les importa el pago", "Les importa el soporte", "Les importa el reconocimiento", "Pidieron tiempo"];
  const PRESETS_STAFF = ["Preguntaron para qué", "Ofrecieron un cambio", "Solo hablan de precio", "Alguien mostró su tabla", "Se trabaron", "Casi cierran"];
  /* El laboratorio: la negociación avanza por rondas con una consigna cada una, y el equipo
     va cumpliendo misiones. Las rondas salen del reloj; las misiones, de lo que se registra. */
  const RONDAS = [   // cuatro rondas, en cuartos del tiempo de negociación
    { hasta: D.tiempos.negociacion * 0.25, nombre: "Abrir", tono: "calma", pista: "Cada vocero dice su posición inicial y hace la primera pregunta: ¿para qué lo necesitan así?" },
    { hasta: D.tiempos.negociacion * 0.5, nombre: "Descubrir", tono: "calma", pista: "Pregunten qué le importa más al otro lado y por qué. Anoten lo que descubran." },
    { hasta: D.tiempos.negociacion * 0.75, nombre: "Intercambiar", tono: "neutro", pista: "Cambien lo que les cuesta poco por lo que les importa. Guarden cada oferta que se diga." },
    { hasta: D.tiempos.negociacion, nombre: "Cerrar", tono: "presion", pista: "Último tramo: trato hecho si supera su plan B, o sin acuerdo con la última propuesta." }
  ];
  const MISIONES = [
    { id: "preparar", titulo: "Prepararse", pista: "Llenen al menos dos respuestas de la hoja de preparación, en la etapa Prepararse.", listo: () => Object.values(leerS("prep." + estado.lado, {})).filter(v => v && v.trim()).length >= 2 },
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
  const ETAPAS = [
    { id: "entrar", nombre: "Entrar" }, { id: "preparar", nombre: "Prepararse" }, { id: "negociar", nombre: "Negociar" },
    { id: "cerrar", nombre: "Cerrar" }, { id: "resultado", nombre: "Resultado" }
  ];
  const ALIAS = { inicio: "entrar", equipo: "preparar", mesa: "negociar" };
  const VISTAS_FACILITADOR = ["resultados", "admin", "staff", "guion"];
  const app = document.getElementById("app");

  /* ---------- utilidades ---------- */
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const memoria = {};
  const almacen = nombre => { try { return window[nombre]; } catch (e) { return null; } };
  const leerDe = (alm, k, def) => { try { if (!alm) return k in memoria ? memoria[k] : def; const v = alm.getItem("th." + k); return v === null ? def : JSON.parse(v); } catch (e) { return def; } };
  const guardarEn = (alm, k, v) => { try { if (!alm) { if (v == null) delete memoria[k]; else memoria[k] = v; return; } if (v == null) alm.removeItem("th." + k); else alm.setItem("th." + k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento: la página sigue funcionando */ } };
  // La identidad vive por pestaña (sessionStorage): así varias pestañas pueden ser varias
  // personas al ensayar. Lo del facilitador vive en localStorage.
  const leerS = (k, d) => leerDe(almacen("sessionStorage"), k, d), guardarS = (k, v) => guardarEn(almacen("sessionStorage"), k, v);
  const leer = (k, d) => leerDe(almacen("localStorage"), k, d), guardar = (k, v) => guardarEn(almacen("localStorage"), k, v);
  const mmss = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  const minutos = s => (s % 60 === 0 ? s / 60 + " min" : mmss(s));
  const hace = ts => { if (!ts) return ""; const s = Math.round((Date.now() - ts) / 1000); return s < 5 ? "ahora" : s < 60 ? "hace " + s + " s" : "hace " + Math.floor(s / 60) + " min"; };
  const horaDe = ts => { const d = new Date(ts); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
  const enlaceWeb = () => location.origin + location.pathname;
  const iniciales = nombre => String(nombre || "").trim().split(/\s+/).slice(0, 2).map(p => p[0] || "").join("").toUpperCase();
  let temporizadorToast = null;
  function avisar(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(temporizadorToast);
    temporizadorToast = setTimeout(() => { t.hidden = true; }, 2800);
  }
  function copiar(texto, elemento) {
    const respaldo = () => {
      if (elemento) { const r = document.createRange(); r.selectNodeContents(elemento); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); }
      avisar("No se pudo copiar solo. Seleccione el texto y cópielo.");
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).then(() => avisar("Copiado"), respaldo);
    else respaldo();
  }
  /* La transición entre etapas: una tarjeta grande que entra de golpe y se va sola. */
  let temporizadorTransicion = null;
  function transicion(titulo, texto, tono, despues) {
    const t = document.getElementById("transicion");
    t.innerHTML = `<div class="transicion-caja ${tono || ""}"><div class="titulo-juego">${esc(titulo)}</div><p>${esc(texto)}</p></div>`;
    t.hidden = false; t.classList.remove("saliendo");
    pitar(tono === "lava" ? 3 : 2);
    if (despues) setTimeout(despues, 500);
    clearTimeout(temporizadorTransicion);
    temporizadorTransicion = setTimeout(() => { t.classList.add("saliendo"); setTimeout(() => { t.hidden = true; }, 420); }, 2800);
  }

  /* ---------- estado ---------- */
  /* La identidad es por pestaña. Si el navegador duplica la pestaña (o se abre desde un enlace en
     otra pestaña) copia el sessionStorage y dos pestañas tendrían el mismo id: cada una anunciaría
     su asiento y la misma persona aparecería en varias salas. Cada pestaña viva deja un latido en
     localStorage; si al cargar el id ya tiene un latido fresco de otra pestaña, esta recibe un id
     nuevo y arranca sin asiento (conserva el nombre). */
  const idPestana = (() => {
    const nuevoId = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
    const alm = almacen("localStorage");
    const latidoDe = id => { try { return parseInt(alm.getItem("th.pestana." + id) || "0", 10); } catch (e) { return 0; } };
    let v = leerS("id", null);
    const duplicada = !!(v && alm && Date.now() - latidoDe(v) < 6000);
    if (!v || duplicada) { v = nuevoId(); guardarS("id", v); if (duplicada) ["sala", "lado", "entrado", "trato", "cerrado", "registro", "avisadas", "prepVistos", "tutoVisto"].forEach(k => guardarS(k, null)); }
    if (alm) {
      const latir = () => { try { alm.setItem("th.pestana." + v, String(Date.now())); } catch (e) { /* lleno o bloqueado */ } };
      latir(); setInterval(latir, 2000);
      addEventListener("pagehide", () => { try { alm.removeItem("th.pestana." + v); } catch (e) { /* nada */ } });
      try { for (let i = alm.length - 1; i >= 0; i--) { const k = alm.key(i); if (k && k.startsWith("th.pestana.") && k !== "th.pestana." + v && Date.now() - parseInt(alm.getItem(k) || "0", 10) > 60000) alm.removeItem(k); } } catch (e) { /* nada */ }
    }
    return v;
  })();
  const estado = {
    sala: leerS("sala", null),
    lado: leerS("lado", null),
    nombre: leerS("nombre", ""),
    rol: leerS("rol", "ambos"),
    equipo: leerS("equipo", null),
    equipoArmado: leerS("equipoArmado", null),   // en qué armado se eligió el equipo: si cambia, el equipo ya no vale
    expulsionVista: leerS("expulsionVista", null),
    entradoPlataforma: leerS("entradoPlataforma", null),
    entrado: leerS("entrado", null),
    videoVisto: leerS("videoVisto", null),   // terminó (o falló) el video de la pre-sala: habilita «Estoy listo»
    listo: leerS("listo", null),             // marcó «Estoy listo» en la pre-sala
    trato: leerS("trato", {}),
    cerrado: leerS("cerrado", null),
    registro: leerS("registro", []),
    avisadas: leerS("avisadas", []),
    prepVistos: leerS("prepVistos", []),
    faseVista: undefined,
    chat: leer("chat", ""),
    revelar: leer("revelar", false),
    manualResultados: leer("manualResultados", false),
    staffSala: leer("staffSala", 1),
    actas: leer("actas", {})
  };
  const vivo = { salas: {}, jugadores: {}, config: {}, reloj: null, conexion: Sync.estado() };
  let rutaActual = "entrar";
  const query = new URLSearchParams(location.search);
  /* Lo que se toca en el lobby es solo una selección; el asiento real (estado.sala/lado) se fija al
     pulsar «Sentarme». Así nadie aparece sentado por andar tocando salas. */
  const seleccion = { sala: estado.sala, lado: estado.lado };
  if (query.get("sala") && !estado.sala) { const n = parseInt(query.get("sala"), 10); if (n > 0) seleccion.sala = n; }
  if (LADOS.includes(query.get("lado")) && !estado.lado) seleccion.lado = query.get("lado");
  const tieneClave = () => !C.claveStaff || leer("staff", null) === String(C.claveStaff);
  const enVivo = () => vivo.conexion.modo !== "nada";
  const dentro = () => !!(estado.nombre && estado.sala && estado.lado);
  const videollamada = () => C.videollamada || "Zoom";
  /* Salas de la videollamada, tres por mesa: cada equipo se prepara en privado en la suya («Sala 1A» la
     agencia, «Sala 1C» el cliente) y al empezar la negociación los dos pasan a la mesa («Sala 1»). Si un
     equipo no tiene sala propia (plantilla en null), se prepara directamente en la mesa. */
  const nombreSala = n => (C.sala || "Sala {n}").replace("{n}", n);
  const plantillaPrep = lado => lado === "agencia" ? C.salaAgencia : C.salaCliente;
  const nombreSalaPrep = (n, lado) => plantillaPrep(lado) ? plantillaPrep(lado).replace("{n}", n) : nombreSala(n);
  const nombreSalaCliente = n => nombreSalaPrep(n, "cliente");
  const seMueve = lado => !!plantillaPrep(lado);          // ese equipo cambia de sala al empezar la negociación
  const salaPrivada = () => LADOS.some(seMueve);
  const nombresSalas = () => { const lista = []; for (let i = 1; i <= (C.salas || 5); i++) { LADOS.forEach(l => { if (seMueve(l)) lista.push(nombreSalaPrep(i, l)); }); lista.push(nombreSala(i)); } return lista; };
  /* En qué sala de la videollamada debe estar este equipo AHORA: el cliente se prepara aparte y pasa a la
     mesa cuando empieza la negociación. Se muestra como cinta persistente en Prepararse, La mesa y Cerrar. */
  function salaZoomActual() {
    if (!estado.sala) return null;
    const prep = ["espera", "cuenta", "consigna", "preparacion"].includes(faseActual());
    return prep ? nombreSalaPrep(estado.sala, estado.lado) : nombreSala(estado.sala);
  }
  function zoomChipHTML() {
    const s = salaZoomActual(); if (!s) return "";
    const prep = ["espera", "cuenta", "consigna", "preparacion"].includes(faseActual());
    const luego = prep && seMueve(estado.lado) ? ` · a negociar: ${esc(nombreSala(estado.sala))}` : "";
    return `<span class="cinta zoom" title="Sala de ${esc(videollamada())} en la que deben estar ahora">${Iconos.svg("users")} ${esc(videollamada())}: ${esc(s)}${luego}</span>`;
  }
  function pintarZoomChip() { document.querySelectorAll(".cinta.zoom").forEach(z => { const h = zoomChipHTML(); if (h && z.outerHTML !== h) z.outerHTML = h; }); }
  /* Cómo se crean las salas de la videollamada y quién va a cuál. Lo ven Admin, Staff y Guion: el staff
     ayuda a crearlas al inicio de la clase. */
  function zoomSalasHTML() {
    const vc = esc(videollamada()), nombres = nombresSalas();
    return `<div class="panel zoom-salas"><span class="ojo">${vc}</span><h3>Crear las salas, entre todo el staff</h3>
<ol class="pasos">
  <li>El anfitrión (el profe, o quien tenga el control de la reunión) hace <b>coanfitriones</b> al administrador y al staff.</li>
  <li>Abrir <b>Salas para grupos pequeños</b> → crear <b>${nombres.length} salas</b> con «Permitir que los participantes elijan sala».</li>
  <li>Renombrarlas <b>exactamente así</b> (uno dicta, otro escribe; la web usa estos nombres):<div class="salas-nombres">${nombres.map(x => `<span class="chip" aria-pressed="false"><span>${esc(x)}</span></span>`).join("")}</div></li>
  <li>En <b>Opciones</b>: «Permitir que los participantes elijan sala» y «Permitir que los participantes regresen a la sesión principal» marcadas; <b>sin</b> cierre automático por tiempo; cuenta regresiva al cerrar: 60 segundos.</li>
  <li><b>Abrir todas las salas</b> cuando el administrador lo indique (minuto 0:45 de la guía). Cada quien entra a la sala que le dice la web; la lista «Quién va a cada sala» de Admin sirve para revisar y mover a quien se equivoque.</li>
</ol>
<p class="nota-pie">${salaPrivada() ? `Por mesa: ${LADOS.filter(seMueve).map(l => `«${esc(nombreSalaPrep("n", l))}» para que se prepare ${l === "agencia" ? "la agencia" : "el cliente"}`).join(", ")} y «${esc(nombreSala("n"))}», la mesa, a la que pasan al empezar la negociación. La web se lo dice a cada equipo en el momento justo; el staff solo refuerza.` : `Los dos equipos de cada mesa comparten «${esc(nombreSala("n"))}».`}</p></div>`;
  }
  function indicacionSala(n, lado) {
    const vc = videollamada(), otro = otroLado(lado);
    if (seMueve(lado)) return `Entrá a «${nombreSalaPrep(n, lado)}» en ${vc}: ahí se preparan en privado. Cuando empiece la negociación, pasan a «${nombreSala(n)}», la mesa.`;
    if (seMueve(otro)) return `Entrá a «${nombreSala(n)}» en ${vc}: ahí se preparan y ahí mismo se negocia; el otro equipo llega cuando empiece la negociación.`;
    return `Entrá a «${nombreSala(n)}» en ${vc}. Ahí van a estar su equipo y el equipo rival.`;
  }
  const juego = () => (vivo.config && vivo.config.juego) || null;
  const juegoIniciado = () => !!(juego() && juego().iniciado);
  const salasActivas = () => (juego() && juego().salas) || C.salas || 5;
  const armado = () => (vivo.config && vivo.config.armado) || null;   // el plan de equipos, fijado por el admin con la gente que entró

  /* ---------- puntuación ---------- */
  const PLAN_B = { agencia: D.lados.agencia.planB.puntos, cliente: D.lados.cliente.planB.puntos };
  function opcionDe(i, letra) { return D.temas[i].opciones.find(o => o.letra === letra) || null; }
  function puntos(letras, lado) { return letras.reduce((s, l, i) => s + opcionDe(i, l)[lado], 0); }
  function indiceDe(a, c) { return a + c - Math.abs(a - c) / 2; }
  const pesoDe = (i, lado) => Math.max(...D.temas[i].opciones.map(o => o[lado]));
  const otroLado = l => (l === "agencia" ? "cliente" : "agencia");
  /* Un cierre es { letras } si hubo trato, o { letras: null, ultima, quien } si no. */
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
    while ((m = RE_CODIGO.exec(texto || "")) !== null) {
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
        o.connect(g); g.connect(ctx.destination); o.frequency.value = 880; g.gain.value = 0.07;
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
      if (transcurrido < 0) return { i: -1, id: "cuenta", nombre: "Empieza en", restante: -transcurrido, transcurrido, alerta: false };
      let t = transcurrido;
      for (let i = 0; i < fases.length; i++) {
        if (t < fases[i].dur) return { i, id: fases[i].id, nombre: fases[i].nombre, restante: fases[i].dur - t, transcurrido, alerta: fases[i].id === "negociacion" && fases[i].dur - t <= 60 };
        t -= fases[i].dur;
      }
      return { i: fases.length, id: "fin", nombre: "Tiempo agotado", restante: 0, transcurrido, alerta: true };
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
  /* Qué fase va: la del administrador si hay tablero en vivo; si no, la del equipo.
     espera (sin reloj) · cuenta (empieza en…) · consigna · preparacion · negociacion · cierre · debrief · fin */
  function faseActual() {
    if (RELOJES.admin.remoto !== undefined) { const fa = RELOJES.admin.fase(); return fa ? fa.id : "espera"; }
    const fe = RELOJES.equipo.fase(); return fe ? fe.id : "espera";
  }
  function faseInfo() { return (RELOJES.admin.remoto !== undefined ? RELOJES.admin.fase() : RELOJES.equipo.fase()) || null; }
  /* ---------- etapas ---------- */
  function etapaSugerida() {
    if (!dentro()) return "entrar";
    const f = faseActual();
    if (estado.cerrado) return (f === "debrief" || f === "fin" || revelado()) ? "resultado" : "cerrar";
    if (f === "negociacion") return "negociar";
    if (f === "cierre") return "cerrar";
    if (f === "debrief" || f === "fin") return "resultado";
    if (f === "espera" && RELOJES.admin.remoto !== undefined) return "entrar";   // sentados, esperando a que el administrador abra
    return "preparar";
  }
  function bloqueada(id) {
    if (id === "entrar") return false;
    if (!dentro()) return true;
    const f = faseActual();
    if (id === "preparar") return f === "espera" && RELOJES.admin.remoto !== undefined;
    if (id === "negociar" || id === "cerrar") return f === "consigna" || f === "preparacion" || f === "cuenta" || (f === "espera" && RELOJES.admin.remoto !== undefined);
    if (id === "resultado") return !(estado.cerrado || f === "debrief" || f === "fin");
    return false;
  }
  function motivoBloqueo(id) {
    if (!dentro()) return "Primero escriba su nombre y elija su sala y su lado.";
    const fi = faseInfo();
    if (id === "preparar") return "El administrador abre la preparación cuando todos hayan entrado. Esperá en esta pantalla: cambia sola.";
    if (id === "negociar" || id === "cerrar") return fi ? "La mesa se abre cuando termine la preparación (" + mmss(fi.restante) + ")." : "La mesa se abre cuando el administrador arranque el reloj.";
    if (id === "resultado") return "El resultado se ve después de cerrar el trato o cuando se acabe el tiempo.";
    return "Todavía no.";
  }
  const TRANSICIONES = {
    consigna: ["¡Empezamos!", "Lean su ficha mientras el administrador da la consigna.", "menta"],
    preparacion: ["¡A prepararse!", "Lean su ficha, miren su plan B y preparen la apertura.", "menta"],
    negociacion: ["¡A negociar!", minutos(D.tiempos.negociacion) + "utos. Marquen lo que se diga y pregunten para qué.", ""],
    cierre: ["Último minuto", "Cierren el trato o registren «sin acuerdo» con la última propuesta.", "lava"],
    debrief: ["Se acabó", "Esperen la revelación del administrador para ver su resultado.", "menta"],
    fin: ["Se acabó el tiempo", "Registren el cierre: trato hecho o sin acuerdo.", "lava"]
  };
  function vigilarEtapa() {
    const f = faseActual();
    if (f === estado.faseVista) return;
    const anterior = estado.faseVista; estado.faseVista = f;
    if (anterior === undefined) return;                       // al cargar la página no hay transición
    if (!ETAPAS.some(e => e.id === rutaActual) || !dentro()) return;
    const sug = etapaSugerida(), t = TRANSICIONES[f];
    if (!t) return;
    let texto = t[1];
    if (salaPrivada() && estado.sala) {
      if (f === "preparacion") texto += ` Ustedes se preparan en privado en «${nombreSalaPrep(estado.sala, estado.lado)}».`;
      if (f === "negociacion") texto += seMueve(estado.lado) ? ` Pasen ya a «${nombreSala(estado.sala)}» en ${videollamada()}: la mesa.` : ` El otro equipo llega ahora a «${nombreSala(estado.sala)}».`;
    }
    if (sug !== rutaActual && !bloqueada(sug)) transicion(t[0], texto, t[2], () => { location.hash = "#" + sug; });
    else transicion(t[0], texto, t[2]);
  }
  let tics = 0;
  function tick() {
    const fe = RELOJES.equipo.fase(), fa = RELOJES.admin.fase();
    if (fe) RELOJES.equipo.avisar(fe);
    if (fa) RELOJES.admin.avisar(fa);
    const mini = document.getElementById("reloj-mini"), f = faseInfo();
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
    if (rutaActual === "resultados" && tics % 10 === 0) calcular();
    if (rutaActual === "admin" && tics % 2 === 0) { const a = document.getElementById("arranque"); if (a) { const h = arranqueHTML(); if (a.innerHTML !== h) a.innerHTML = h; } }
    const ronda = document.getElementById("ronda"); if (ronda) { const h = rondaHudHTML(); if (ronda.innerHTML !== h) ronda.innerHTML = h; }
    // presión: viñeta que late cuando queda poco tiempo de negociación (solo en vistas de estudiante)
    const estudiante = ETAPAS.some(e => e.id === rutaActual);
    document.body.classList.toggle("presion", estudiante && !!f && f.id === "negociacion" && f.restante <= 60 && !estado.cerrado);
    document.body.classList.toggle("presion-suave", estudiante && !!f && f.id === "negociacion" && f.restante > 60 && f.restante <= 150 && !estado.cerrado);
    vigilarEtapa(); vigilarAvisos();
    if (tics % 4 === 0) { pintarEscena(); pintarEtapas(); pintarVerificacion(); pintarZoomChip(); pintarEtapasStaff(); pintarQuienDonde(); }
    if (rutaActual === "entrar" && dentro() && !bloqueada("preparar") && document.querySelector(".espera-linea")) render();
    if (rutaActual === "entrar") { engancharVideo(); if (tics % 4 === 0) pintarListos(); }
    if (++tics % 10 === 0) { pintarVivo(); pintarPresencia(); pintarConectados(); if (rutaActual === "entrar") pintarLobby(); if (estado.nombre && tics % 30 === 0) { anunciar(); if (dentro() && (rutaActual === "preparar" || rutaActual === "negociar" || rutaActual === "cerrar")) reportar({}); } }
  }
  setInterval(tick, 500);
  const relojHTML = (tipo, clase) => `<div class="reloj ${clase || ""}" data-reloj="${tipo}"><span class="fase-actual">Listo para empezar</span><span class="tiempo">${mmss(RELOJES[tipo].fases[0].dur)}</span><div class="botones"><button class="boton chico" type="button" data-accion="reloj" data-reloj="${tipo}">Iniciar</button>${tipo === "admin" ? `<button class="boton chico" type="button" data-accion="saltar" data-reloj="admin" hidden>Siguiente fase</button>` : `<span class="reloj-nota" hidden>Va con el reloj del administrador</span>`}</div></div>`;

  /* ---------- en vivo ---------- */
  function reportar(datos) {
    if (!(estado.sala && estado.lado)) return;
    Sync.escribir("salas/" + estado.sala + "/" + estado.lado, Object.assign({ actualizado: Date.now() }, datos));
  }
  function propuestaActual() { return D.temas.map((t, i) => estado.trato[i] || "?").join(""); }
  /* Presencia en dos niveles: jugadores/<id> (quién está en la plataforma, con o sin sala) y
     salas/N/gente/<id> (quién está sentado en cada sala). */
  function equipoVigente() {
    const a = armado();
    if (estado.equipo && (!a || String(estado.equipoArmado) !== String(a.abierto))) { estado.equipo = null; guardarS("equipo", null); }
    return estado.equipo || null;
  }
  function anunciar() {
    if (!estado.nombre || VISTAS_FACILITADOR.includes(rutaActual)) return;   // el facilitador no ocupa asiento ni cuenta como jugador
    equipoVigente();
    Sync.escribir("jugadores/" + idPestana, { nombre: estado.nombre, equipo: estado.equipo || null, sala: estado.sala || null, lado: estado.lado || null, rol: estado.rol, etapa: rutaActual, listo: estado.listo || null, visto: estado.videoVisto || null, entrado: estado.entradoPlataforma || Date.now(), actualizado: Date.now() });
    if (estado.sala && estado.lado) Sync.escribir("salas/" + estado.sala + "/gente/" + idPestana, { nombre: estado.nombre, lado: estado.lado, rol: estado.rol, entrado: estado.entrado || Date.now(), actualizado: Date.now() });
    limpiarAsientos();
  }
  /* Una persona ocupa un solo asiento: cualquier asiento con este id que no sea el actual se borra
     (quedan de versiones anteriores, de otra pestaña con la misma identidad o de un cambio de sala). */
  function limpiarAsientos() {
    Object.entries(vivo.salas || {}).forEach(([n, s]) => {
      if (s && s.gente && s.gente[idPestana] && !(estado.sala && estado.lado && String(n) === String(estado.sala))) Sync.fijar("salas/" + n + "/gente/" + idPestana, null);
    });
  }
  function despedirse(sala) { if (sala) Sync.fijar("salas/" + sala + "/gente/" + idPestana, null); }
  /* Al cerrar la pestaña, la despedida sale con sendBeacon (una petición que sobrevive al cierre):
     el administrador ve desaparecer a la persona al instante en vez de esperar a que caduque. */
  function despedidaInmediata() {
    if (!estado.nombre || Sync.estado().modo !== "servidor" || !navigator.sendBeacon) return;
    const url = "/api/sesiones/" + Sync.estado().sesion + "/escribir";
    const mandar = (ruta) => navigator.sendBeacon(url, new Blob([JSON.stringify({ ruta, datos: null, modo: "fijar" })], { type: "application/json" }));
    mandar("jugadores/" + idPestana);
    if (estado.sala) mandar("salas/" + estado.sala + "/gente/" + idPestana);
  }
  /* El administrador saca a todos (o a una persona): la pestaña vuelve a la pantalla del nombre, limpia. */
  function expulsar(motivo) {
    ["nombre", "entradoPlataforma", "sala", "lado", "equipo", "equipoArmado", "entrado", "trato", "cerrado", "registro", "avisadas", "prepVistos", "tutoVisto", "inicio", "inicio.fase", "videoVisto", "listo", "avisosVistos"].forEach(k => guardarS(k, null));
    Object.assign(estado, { nombre: "", entradoPlataforma: null, sala: null, lado: null, equipo: null, entrado: null, trato: {}, cerrado: null, registro: [], avisadas: [], prepVistos: [], videoVisto: null, listo: null });
    RELOJES.equipo.inicio = null; seleccion.sala = null; seleccion.lado = null; firmaEscena = "";
    if (Tutorial.abierto()) Tutorial.cerrar();
    if (location.hash !== "#entrar") location.hash = "#entrar"; else render();
    avisar(motivo);
  }
  const token = () => Math.random().toString(36).slice(2, 10);
  function sacarATodos() {
    const id = token();
    Sync.fijar("config/expulsion", { id, ts: Date.now() });
    return id;
  }
  function sacar(idJugador) {
    Sync.fijar("jugadores/" + idJugador + "/expulsado", token());
    setTimeout(() => { Sync.fijar("jugadores/" + idJugador, null); Object.entries(vivo.salas || {}).forEach(([n, x]) => { if (x && x.gente && x.gente[idJugador]) Sync.fijar("salas/" + n + "/gente/" + idJugador, null); }); }, 2500);
  }
  const activo = x => x && x.nombre && Date.now() - (x.actualizado || 0) < 60000;
  function jugadoresActivos() {
    return Object.entries(vivo.jugadores || {}).map(([id, x]) => Object.assign({ id }, x)).filter(activo).sort((a, b) => (a.entrado || 0) - (b.entrado || 0));
  }
  function genteDe(n, lado) {
    const s = (vivo.salas && vivo.salas[n]) || {}, g = s.gente || {};
    return Object.entries(g).map(([id, x]) => Object.assign({ id }, x)).filter(x => activo(x) && (!lado || x.lado === lado)).sort((a, b) => (a.entrado || 0) - (b.entrado || 0));
  }
  const ROL_CORTO = { vocero: "V", analista: "A", ambos: "V·A" };
  function asientosHTML(n, lado, minimo) {
    const gente = genteDe(n, lado);
    const asientos = gente.map(x => `<div class="asiento ${lado} ${x.id === idPestana ? "yo" : ""}" title="${esc(x.nombre)} · ${esc((ROLES[x.rol] || ROLES.ambos).nombre)}"><span class="avatar">${esc(iniciales(x.nombre))}<b class="rolb">${esc(ROL_CORTO[x.rol] || "V·A")}</b></span><span class="nombre">${esc(x.nombre)}</span></div>`);
    for (let k = gente.length; k < (minimo || 0); k++) asientos.push(`<div class="asiento vacio"><span class="avatar"></span><span class="nombre">libre</span></div>`);
    return asientos.join("");
  }
  function lobbyHTML() {
    const numeros = new Set(Object.keys(vivo.salas || {}).map(Number).filter(n => n > 0));
    for (let i = 1; i <= salasActivas(); i++) numeros.add(i);
    const lista = [...numeros].sort((a, b) => a - b);
    const aviso = enVivo() ? "" : `<p class="nota-pie">Sin tablero en vivo no se ve quién más está en cada sala; la elección funciona igual.</p>`;
    return aviso + `<div class="lobby">${lista.map(n => {
      const total = genteDe(n).length;
      return `<div class="sala-lobby ${seleccion.sala === n ? "elegida" : ""}" data-sala-lobby="${n}">
  <div class="sala-lobby-cab"><b>Sala ${n}</b><span class="cinta gris" style="font-size:.8rem">${total ? total + (total === 1 ? " persona" : " personas") : "vacía"}</span></div>
  <div class="lados-lobby">${LADOS.map(l => `<button type="button" class="lado-col ${l}" data-elegir-sala="${n}" data-elegir-lado="${l}" aria-pressed="${seleccion.sala === n && seleccion.lado === l}"><span class="lado-col-cab acento-${l}">${esc(D.lados[l].rol)} · ${esc(D.lados[l].nombre)}</span>${asientosHTML(n, l, 2)}</button>`).join("")}</div>
</div>`; }).join("")}</div>`;
  }
  function pintarLobby() { const z = document.getElementById("lobby"); if (z) z.innerHTML = lobbyHTML(); actualizarBotonEntrar(); pintarHub(); }
  function pintarHub() { const z = document.getElementById("hub-equipos"); if (z) { const h = hubHTML(false); if (z.innerHTML !== h) z.innerHTML = h; } }
  function actualizarBotonEntrar() {
    const b = document.getElementById("btn-entrar"); if (!b) return;
    b.disabled = !(estado.nombre && seleccion.sala && seleccion.lado);
    b.textContent = seleccion.sala && seleccion.lado ? `Sentarme en la sala ${seleccion.sala} · ${D.lados[seleccion.lado].rol} · ${ROLES[estado.rol].nombre}` : "Elija una sala y un lado";
  }
  /* ---------- pre-sala: video de introducción y «Estoy listo» ----------
     Cada persona ve el video al entrar. Al terminar (o si no carga) se habilita «Estoy listo»; el
     administrador ve cuántos marcaron y abre el armado cuando estén todos. */
  const VERSION_WEB = (() => { const t = document.querySelector('script[src*="app.js"]'); const m = t && /[?&]v=([^&]+)/.exec(t.getAttribute("src") || ""); return m ? m[1] : ""; })();
  const conVersion = ruta => VERSION_WEB ? ruta + "?v=" + VERSION_WEB : ruta;
  function videoIntroHTML() {
    return `<div class="video-intro"><video id="video-intro" controls playsinline preload="metadata" poster="${conVersion("video/intro-poster.jpg")}"><source src="${conVersion("video/intro.mp4")}" type="video/mp4"><track kind="subtitles" srclang="es" label="Español" src="${conVersion("video/intro.vtt")}" default>Tu navegador no reproduce el video.</video></div>`;
  }
  const listosDe = j => j.filter(x => x.listo).length;
  function listosTexto() {
    const j = jugadoresActivos(), k = listosDe(j);
    if (!j.length) return "Esperando al administrador…";
    if (j.length >= 2 && k >= j.length) return `Todos listos (${k}). El administrador abre el armado de equipos en un momento.`;
    return `${k} de ${j.length} ${j.length === 1 ? "listo" : "listos"}. Esperando al resto…`;
  }
  function notaListo() {
    if (estado.listo) return "Ya marcaste que estás listo. Cuando estén todos, el administrador abre los equipos.";
    if (estado.videoVisto) return "Ya podés marcar que estás listo.";
    return "El botón se habilita al terminar el video.";
  }
  function pintarListos() {
    const z = document.getElementById("listos"); if (z) { const h = `<span class="reloj-arena" aria-hidden="true"></span><p>${listosTexto()}</p>`; if (z.innerHTML !== h) z.innerHTML = h; }
    const n = document.getElementById("listo-nota"); if (n && n.textContent !== notaListo()) n.textContent = notaListo();
    const b = document.getElementById("btn-listo"); if (b && estado.videoVisto && b.disabled) b.disabled = false;
  }
  function habilitarListo(motivo) {
    if (estado.videoVisto) return;
    estado.videoVisto = Date.now(); guardarS("videoVisto", estado.videoVisto);
    pintarListos(); if (motivo) avisar(motivo);
  }
  let videoEnganchado = null;
  function engancharVideo() {
    const v = document.getElementById("video-intro"); if (!v || v === videoEnganchado) return; videoEnganchado = v;
    v.addEventListener("ended", () => habilitarListo("Fin del video: ya podés marcar «Estoy listo»."));
    // Si el video no carga (red, códec), no se bloquea a nadie: el botón se habilita igual.
    const falla = () => habilitarListo("El video no se pudo reproducir; marcá «Estoy listo» igual.");
    v.addEventListener("error", falla); v.querySelectorAll("source").forEach(x => x.addEventListener("error", falla));
    if (!estado.videoVisto && !estado.listo) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }   // tras pulsar «Entrar» el navegador suele permitirlo; si no, quedan los controles
  }
  function conectadosHTML() {
    if (!enVivo()) return "";
    const j = jugadoresActivos(), sinSala = j.filter(x => !x.sala).length;
    return `<span class="punto" aria-hidden="true"></span><span>${j.length} ${j.length === 1 ? "persona conectada" : "personas conectadas"}${sinSala && j.length !== sinSala ? ` · ${sinSala} sin sala` : ""}</span><span class="caras">${j.slice(0, 8).map(x => `<span class="avatar ${x.lado || ""}" title="${esc(x.nombre)}">${esc(iniciales(x.nombre))}</span>`).join("")}${j.length > 8 ? `<span class="avatar">+${j.length - 8}</span>` : ""}</span>`;
  }
  function pintarConectados() { const z = document.getElementById("conectados"); if (z) { const h = conectadosHTML(); if (z.innerHTML !== h) z.innerHTML = h; z.hidden = !h; } }
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
    if (lados.every(x => x.fase === "sentado")) return { clave: "ficha", texto: "Sentados, esperando" };
    return { clave: "ficha", texto: "Preparándose" };
  }
  const FASE_TEXTO = { sentado: "sentado, esperando", ficha: "se prepara", mesa: "en la mesa", cerrado: "cerró" };
  /* ---------- verificación: las dos propuestas de una sala, tema por tema ----------
     «Trato hecho» solo se habilita cuando las dos propuestas son idénticas y completas, y el staff ve
     lo mismo en su pantalla: ya no lleva acta, verifica. Sin tablero en vivo no hay con qué comparar
     y se confía en los equipos. */
  function verificacionDe(n) {
    const s = (vivo.salas && vivo.salas[n]) || {};
    const letrasDe = l => { const p = s[l] && s[l].propuesta; return D.temas.map((t, i) => (p && p[i] && p[i] !== "?") ? p[i] : null); };
    const L = { agencia: letrasDe("agencia"), cliente: letrasDe("cliente") };
    const filas = D.temas.map((t, i) => ({ tema: t.nombre, agencia: L.agencia[i], cliente: L.cliente[i], igual: !!(L.agencia[i] && L.cliente[i] && L.agencia[i] === L.cliente[i]) }));
    const iguales = filas.filter(f => f.igual).length;
    return { filas, iguales, sinPropuesta: LADOS.filter(l => L[l].every(x => !x)), difieren: filas.filter(f => f.agencia && f.cliente && !f.igual).map(f => f.tema), pendientes: filas.filter(f => !f.agencia || !f.cliente).map(f => f.tema), coinciden: iguales === D.temas.length, cierre: s.cierre || null };
  }
  function veredictoDe(v) {
    if (v.cierre) return v.cierre.codigo.includes("SIN") ? { clase: "mal", texto: "Cerrada sin acuerdo" } : { clase: "ok", texto: "Cerrada: trato hecho" };
    if (v.sinPropuesta.length === 2) return { clase: "neutro", texto: "Todavía no hay propuestas sobre la mesa" };
    if (v.sinPropuesta.length === 1) return { clase: "neutro", texto: "Falta la propuesta de " + D.lados[v.sinPropuesta[0]].nombre };
    if (v.coinciden) return { clase: "ok", texto: "Coinciden en los cinco temas: pueden cerrar" };
    const partes = []; if (v.difieren.length) partes.push("difieren en " + v.difieren.join(", ")); if (v.pendientes.length) partes.push("sin marcar: " + v.pendientes.join(", "));
    return { clase: "aviso", texto: `Coinciden ${v.iguales} de ${D.temas.length} · ${partes.join(" · ")}` };
  }
  function verificacionHTML(n, miLado) {
    const v = verificacionDe(n), ver = veredictoDe(v);
    const col = l => `<span class="col-lado acento-${l}">${esc(D.lados[l].nombre)}${miLado === l ? " · ustedes" : ""}</span>`;
    return `<div class="verificacion ${ver.clase}"><div class="verif-cab"><span class="estado ${ver.clase}">${esc(ver.texto)}</span></div>
<div class="verif-tabla"><div class="verif-fila cab"><span></span>${col("agencia")}${col("cliente")}<span></span></div>${v.filas.map(f => `<div class="verif-fila ${f.igual ? "igual" : (f.agencia && f.cliente ? "distinta" : "pendiente")}"><span class="tema">${esc(f.tema)}</span><span class="letra-v agencia">${f.agencia || "–"}</span><span class="letra-v cliente">${f.cliente || "–"}</span><span class="marca">${f.igual ? Iconos.svg("check") : (f.agencia && f.cliente ? "≠" : "")}</span></div>`).join("")}</div></div>`;
  }
  const puedeCerrarAhora = () => !enVivo() || verificacionDe(estado.sala).coinciden;
  function notaCerrar() {
    if (!letrasActuales().every(Boolean)) return "Para «trato hecho» hacen falta los cinco temas marcados.";
    if (!puedeCerrarAhora()) return "Las propuestas de los dos equipos no coinciden todavía: revisen con el otro equipo los temas marcados en rojo, o registren «sin acuerdo».";
    return "Las dos propuestas coinciden. Si las dos partes dicen «trato hecho», confírmenlo.";
  }
  function pintarVerificacion() {
    if (!enVivo()) return;
    const z = document.getElementById("verificacion"); if (z && estado.sala) { const h = verificacionHTML(estado.sala, estado.lado); const c = z.querySelector(".verificacion"); if (c && c.outerHTML !== h) c.outerHTML = h; }
    if (estado.sala && !estado.cerrado) {
      const ok = letrasActuales().every(Boolean) && puedeCerrarAhora();
      ["btn-cerrar", "btn-cerrar-2"].forEach(id => { const b = document.getElementById(id); if (b) b.disabled = !ok; });
      const nota = document.getElementById("nota-cerrar"); if (nota) { const t = notaCerrar(); if (nota.textContent !== t) nota.textContent = t; }
    }
    const st = document.getElementById("verif-staff"); if (st) { const h = verificacionHTML(estado.staffSala, null); const c = st.querySelector(".verificacion"); if (c && c.outerHTML !== h) c.outerHTML = h; const q = document.getElementById("staff-ahora"); if (q) { const h2 = staffAhoraHTML(); if (q.innerHTML !== h2) q.innerHTML = h2; } }
  }
  /* ---------- guía del staff: las etapas y las dos empresas ----------
     El staff es neutral: ve el caso completo (los dos lados) para resolver dudas de reglas, con la
     tabla de puntos aparte y marcada como privada. */
  function etapaStaffActual() {
    const f = faseActual();
    if (["preparacion", "negociacion", "cierre"].includes(f)) return f;
    if (f === "debrief" || f === "fin") return "resultados";
    if (juegoIniciado()) return "lado";
    if (armado()) return "equipos";
    return "entrar";
  }
  function etapasStaffHTML() {
    const t = D.tiempos, vc = esc(videollamada()), S = esc(nombreSala("n")), actual = etapaStaffActual();
    const etapas = [
      { id: "entrar", titulo: "Entrar", dura: "mientras llegan", equipos: "Cada persona escribe su nombre, ve el video de introducción (2 min) y marca «Estoy listo». El administrador ve cuántos están listos.", staff: `Crear las salas de ${vc} con el anfitrión (nombres exactos, abajo). En la web, nada.` },
      { id: "equipos", titulo: "Equipos", dura: "1 a 2 min", equipos: "El administrador abre el hub y cada quien se une a un equipo de dos o tres (el tamaño sale de cuánta gente hay).", staff: "Nada en la web. Estar en la sala principal." },
      { id: "lado", titulo: "Lado y sala", dura: "al iniciar", equipos: `«Iniciar juego» asigna a cada equipo agencia o cliente y una mesa. Cada pantalla dice a qué sala de ${vc} entrar${salaPrivada() ? `: cada equipo a su sala de preparación («${esc(nombreSalaPrep("n", "agencia"))}», «${esc(nombreSalaPrep("n", "cliente"))}»)` : ""}. Vocero habla, analista lleva la cuenta.`, staff: `Abrir las salas cuando lo diga el administrador y confirmar que cada equipo esté en la suya (la tabla de arriba dice quién va a cuál).` },
      { id: "preparacion", titulo: "Preparación", dura: minutos(t.preparacion) + "utos", equipos: "Ficha privada por pasos: quiénes son, su posición, lo que de verdad les importa, su tabla de puntos y su plan B, la hoja de preparación y el rol. Solo ven su lado.", staff: "Asomarse a las dos salas. Dudas de reglas sí; de estrategia, nunca. Nadie comparte pantalla ni lee puntos." },
      { id: "negociacion", titulo: "Negociación", dura: minutos(t.negociacion) + "utos", equipos: "La mesa: marcan cada propuesta que se diga (una letra por tema), el termómetro muestra solo sus puntos contra su plan B, piden la palabra. Avisos automáticos a los 3 minutos y en el último minuto.", staff: `Los dos equipos pasan a «${S}»; quedarse ahí. Mirar que las dos propuestas coincidan (verde) o difieran (rojo). No intervenir en el contenido.` },
      { id: "cierre", titulo: "Cierre", dura: minutos(t.cierre) + "uto", equipos: "«Trato hecho» solo se habilita si las dos propuestas son idénticas; si no, «Sin acuerdo» con la última propuesta y quién la rechazó. La web lo registra sola.", staff: "Verificar que la sala quede cerrada (el veredicto de arriba lo dice). Después, a la sala principal." },
      { id: "resultados", titulo: "Resultados", dura: minutos(t.debrief) + "utos", equipos: "El tablero rankea solo con los cierres; el administrador revela los intereses y cada equipo ve los puntos de los dos lados, su índice y su puesto.", staff: "Sala principal. Dos del staff hacen la revelación y el cierre de la exposición." }
    ];
    return `<div class="etapas-staff">${etapas.map((e, i) => `<div class="etapa-staff ${e.id === actual ? "actual" : ""}"><span class="n">${i + 1}</span><div><div class="etapa-cab"><b>${esc(e.titulo)}</b><span class="nota-pie">${esc(e.dura)}</span>${e.id === actual ? `<span class="estado ok">ahora</span>` : ""}</div><p><span class="quien">Los equipos:</span> ${esc(e.equipos)}</p><p><span class="quien">El staff:</span> ${esc(e.staff)}</p></div></div>`).join("")}</div>`;
  }
  function pintarEtapasStaff() { const z = document.getElementById("etapas-staff"); if (z) { const h = etapasStaffHTML(); if (z.innerHTML !== h) z.innerHTML = h; } }
  function empresasStaffHTML() {
    const lado = l => { const L = D.lados[l]; return `<div class="panel ${l}"><span class="cinta ${l}">${esc(L.etiqueta)}</span><h3 style="margin-top:8px">Quiénes son</h3><p>${esc(L.quienes)}</p><h3>Su posición de entrada</h3><p class="posicion">${esc(L.posicion)}</p><h3>Lo que de verdad les importa</h3><ol class="intereses">${L.intereses.map(i => `<li><div><b>${esc(i.titulo)}</b>${esc(i.texto)}</div></li>`).join("")}</ol><h3>Su plan B</h3><p>${esc(L.planB.texto)}</p></div>`; };
    const temas = `<div class="panel"><h3>Los cinco temas y sus opciones</h3><p class="nota-pie">Esto lo conocen los dos lados: cada opción tiene una letra y el trato es una letra por tema (${D.temas.map(() => "·").join("")} cinco letras).</p><table class="tabla-staff"><thead><tr><th>Tema</th><th>Opciones</th></tr></thead><tbody>${D.temas.map(t => `<tr><td><b>${esc(t.nombre)}</b><br><span class="nota-pie">${esc(t.pregunta)}</span></td><td>${t.opciones.map(o => `<span class="chip" aria-pressed="false"><span class="letra">${esc(o.letra)}</span><span>${esc(o.texto)}</span></span>`).join(" ")}</td></tr>`).join("")}</tbody></table></div>`;
    const optimo = mejorTrato();
    const puntos = `<details class="consultar"><summary>Tabla de puntos y plan B · privado: no se le dice a ningún equipo</summary><p class="nota-pie" style="margin:8px 0">Cada lado solo conoce su propia columna. Ustedes la ven completa para entender el juego y el tablero final, no para orientar a nadie.</p><table class="tabla-staff"><thead><tr><th>Tema</th><th>Opción</th><th class="acento-agencia">Agencia</th><th class="acento-cliente">Cliente</th></tr></thead><tbody>${D.temas.map(t => t.opciones.map((o, k) => `<tr>${k === 0 ? `<td rowspan="${t.opciones.length}"><b>${esc(t.nombre)}</b></td>` : ""}<td><span class="mono">${esc(o.letra)}</span> ${esc(o.texto)}</td><td class="acento-agencia">${o.agencia}</td><td class="acento-cliente">${o.cliente}</td></tr>`).join("")).join("")}<tr><td colspan="2"><b>Plan B</b> (lo que le queda a cada lado si no hay trato)</td><td class="acento-agencia"><b>${PLAN_B.agencia}</b></td><td class="acento-cliente"><b>${PLAN_B.cliente}</b></td></tr></tbody></table><div class="panel suave" style="margin-top:10px"><h3>${esc(D.puntaje.titulo)}</h3><ul class="lista">${D.puntaje.lineas.map(x => `<li>${esc(x)}</li>`).join("")}</ul><p class="nota-pie">El mejor trato posible es <span class="mono">${esc(optimo.letras.join(""))}</span>: ${optimo.a} para la agencia y ${optimo.c} para el cliente, índice ${optimo.indice}.</p></div></details>`;
    return `<div class="panel suave"><span class="ojo">El caso</span><h3>${esc(D.contexto.titulo)}</h3>${D.contexto.parrafos.map(p => `<p>${esc(p)}</p>`).join("")}<p class="nota-pie">Los equipos solo conocen su propio lado. Ustedes ven los dos para resolver dudas de reglas; no cuenten lo del otro lado ni los puntos.</p></div><div class="dos" style="margin-top:12px">${lado("agencia")}${lado("cliente")}</div><div style="margin-top:12px">${temas}</div><div style="margin-top:12px">${puntos}</div>`;
  }
  /* Quién de esta mesa debe estar en qué sala de la videollamada ahora y a cuál pasa después. */
  function quienDondeHTML() {
    const n = estado.staffSala, f = faseActual(), vc = esc(videollamada());
    const prep = ["espera", "cuenta", "consigna", "preparacion"].includes(f), terminado = f === "debrief" || f === "fin";
    const filas = LADOS.flatMap(l => genteDe(n, l).map(p => {
      const ahora = terminado ? "Sala principal" : prep ? nombreSalaPrep(n, l) : nombreSala(n);
      const despues = terminado ? "" : prep ? (seMueve(l) ? `pasa a «${nombreSala(n)}» al empezar la negociación` : "se queda ahí para negociar") : "al cerrar las salas, a la principal";
      return `<tr><td><b>${esc(p.nombre)}</b> <small>${esc((ROLES[p.rol] || ROLES.ambos).nombre)}</small></td><td class="acento-${l}">${esc(D.lados[l].nombre)}</td><td><span class="cinta zoom">${esc(ahora)}</span></td><td class="nota-pie">${esc(despues)}</td></tr>`;
    }));
    const staffAhora = terminado ? "Sala principal" : prep ? LADOS.filter(seMueve).map(l => nombreSalaPrep(n, l)).join(" y ") || nombreSala(n) : nombreSala(n);
    return `<span class="ojo">Quién va a qué sala de ${vc} · mesa ${n}</span><table class="tabla-staff"><thead><tr><th>Quién</th><th>Equipo</th><th>Ahora</th><th>Después</th></tr></thead><tbody>${filas.join("") || `<tr><td colspan="4" class="nota-pie">Todavía nadie tiene asiento en esta mesa: aparecen cuando el administrador inicia el juego.</td></tr>`}<tr><td><b>Usted</b> <small>staff</small></td><td>—</td><td><span class="cinta zoom">${esc(staffAhora)}</span></td><td class="nota-pie">${terminado ? "" : prep ? `a «${esc(nombreSala(n))}» al empezar la negociación` : "al cerrar las salas, a la principal"}</td></tr></tbody></table>`;
  }
  function pintarQuienDonde() { const z = document.getElementById("quien-donde"); if (z) { const h = quienDondeHTML(); if (z.innerHTML !== h) z.innerHTML = h; } }
  function staffAhoraHTML() {
    const f = faseActual(), vc = videollamada(), n = estado.staffSala, S = nombreSala(n);
    const prep = LADOS.filter(seMueve).map(l => `«${nombreSalaPrep(n, l)}»`), ambas = prep.length ? prep.join(" y ") : `«${S}»`;
    const donde = {   // en qué sala de la videollamada debe estar el staff ahora
      espera: "Sala principal: ayude a crear las salas (pasos abajo)", cuenta: prep.length ? `${ambas}: confirme que cada equipo esté en la suya` : `«${S}»`, consigna: prep.length ? `${ambas}: confirme que cada equipo esté en la suya` : `«${S}»`,
      preparacion: prep.length ? `${ambas}, asómese a las dos` : `«${S}»`, negociacion: `«${S}»`, cierre: `«${S}» hasta que quede cerrada`, debrief: "Sala principal", fin: "Sala principal"
    };
    const pasos = {
      espera: ["Elija arriba el número de su mesa: todo lo que ve aquí es de esa mesa.", "Ayude a crear las salas de " + vc + " con los nombres exactos (pasos abajo). Cuando se abran, entre a las suyas."],
      cuenta: [prep.length ? `Entre a ${ambas} y confirme que cada equipo esté en la suya; la tabla de abajo dice quién va a cuál.` : `Entre a «${S}». Los equipos están recibiendo su sala y su lado.`],
      consigna: [prep.length ? `Entre a ${ambas} y confirme que cada equipo esté en la suya; la tabla de abajo dice quién va a cuál.` : `Confirme que en «${S}» estén los dos equipos.`],
      preparacion: ["Los equipos leen su ficha privada. Dudas de reglas sí; de estrategia, nunca.", "Nadie comparte pantalla ni lee sus puntos en voz alta.", prep.length ? `Asómese a las dos salas (${ambas}). Al empezar la negociación los dos equipos pasan solos a «${S}»: la web se lo dice.` : `Los dos equipos están en «${S}».`],
      negociacion: [`Quédese en «${S}». Mire las dos propuestas: verde donde coinciden, rojo donde no. No intervenga en el contenido.`, "Si preguntan «¿qué nos conviene?»: «pregúntenle a la otra parte para qué lo necesita».", "Los avisos de tiempo salen solos en todas las pantallas."],
      cierre: ["«Trato hecho» solo se habilita si las dos propuestas son idénticas. Si no coinciden, que revisen los temas en rojo o registren «Sin acuerdo».", `Siga en «${S}» hasta que la sala quede cerrada; después, a la sala principal.`],
      debrief: ["Sala cerrada o fuera de tiempo. Vuelva a la sala principal para los resultados."],
      fin: ["Vuelva a la sala principal para los resultados."]
    };
    return `<div class="cabecera" style="margin-bottom:6px"><span class="ojo">Qué hace el staff ahora</span><span class="cinta zoom">${Iconos.svg("users")} ${esc(vc)} ahora: ${esc(donde[f] || donde.espera)}</span></div><ul class="lista">${(pasos[f] || pasos.espera).map(p => `<li>${esc(p)}</li>`).join("")}</ul>`;
  }
  function actaDe(n) {
    const remota = enVivo() && vivo.salas && vivo.salas[n] && vivo.salas[n].acta;
    const local = estado.actas[n];
    const a = remota || local || {};
    return { temas: a.temas || {}, notas: Array.isArray(a.notas) ? a.notas : Object.values(a.notas || {}), actualizado: a.actualizado || 0 };
  }
  /* ---------- equipos ----------
     Las salas son fijas (C.salas, una por staff) y el tamaño de los equipos se ajusta a la gente:
     con P personas se usan min(C.salas, P/4) salas, dos equipos por sala, y cada equipo tiene
     floor(P/T) o floor(P/T)+1 personas. Con 26 en 5 salas: diez equipos, seis de tres y cuatro de dos. */
  const equiposDe = lista => { const m = {}; lista.forEach(j => { if (j.equipo > 0) (m[j.equipo] = m[j.equipo] || []).push(j); }); return m; };
  const salasPara = P => Math.max(1, Math.min(C.salas || 5, Math.floor(P / 4)));
  function planPara(P) {
    const salas = salasPara(P), T = salas * 2, base = Math.floor(P / T), extra = P % T;
    return { P, salas, T, base, extra, max: P ? base + (extra ? 1 : 0) : 2 };   // extra equipos tienen base+1
  }
  function planTexto(plan) {
    if (plan.P < 4) return `Somos ${plan.P}. Con menos de cuatro personas no hay dos equipos completos: el juego igual los acomoda al iniciar.`;
    const grandes = plan.extra, chicos = plan.T - plan.extra;
    const tam = grandes && chicos ? `${grandes} de ${plan.base + 1} y ${chicos} de ${plan.base}` : grandes ? `todos de ${plan.base + 1}` : `todos de ${plan.base}`;
    return `Somos ${plan.P}: ${plan.T} equipos en ${plan.salas} ${plan.salas === 1 ? "sala" : "salas"}, ${tam}.`;
  }
  function hubHTML(soloLectura) {
    const activos = jugadoresActivos(), equipos = equiposDe(activos), plan = armado() || planPara(activos.length);
    const ocupados = Object.keys(equipos).map(Number);
    const cupo = Math.max(plan.T, ocupados.length ? Math.max(...ocupados) : 0);
    const maxEquipo = Math.max(2, plan.max);
    const sueltos = activos.filter(j => !(j.equipo > 0));
    const armados = ocupados.filter(n => equipos[n].length).length;
    const tarjetas = [];
    for (let n = 1; n <= cupo; n++) {
      const m = (equipos[n] || []).slice().sort((a, b) => (a.entrado || 0) - (b.entrado || 0));
      const mio = estado.equipo === n;
      const asientos = m.map(x => `<div class="asiento ${x.id === idPestana ? "yo" : ""}"><span class="avatar">${esc(iniciales(x.nombre))}</span><span class="nombre">${esc(x.nombre)}</span></div>`);
      const cupoSlot = n <= plan.T ? plan.base + (n <= plan.extra ? 1 : 0) : maxEquipo;   // los primeros «extra» equipos son de base+1
      for (let k = m.length; k < Math.max(cupoSlot, Math.min(maxEquipo, m.length)); k++) asientos.push(`<div class="asiento vacio"><span class="avatar"></span><span class="nombre">libre</span></div>`);
      const asig = vivo.config && vivo.config.equipos && vivo.config.equipos[n];
      let accion = "";
      if (!soloLectura && !juegoIniciado()) accion = mio ? `<button type="button" class="boton chico fantasma" data-salir-equipo="${n}">Salir del equipo</button>` : m.length < cupoSlot ? `<button type="button" class="boton chico ${m.length ? "oro" : ""}" data-unirme-equipo="${n}">${m.length ? "Unirme" : "Abrir este equipo"}</button>` : `<span class="nota-pie">completo</span>`;
      tarjetas.push(`<div class="equipo-slot ${mio ? "mio" : ""} ${m.length ? "" : "vacio"} ${m.length >= cupoSlot ? "lleno" : ""}" data-equipo="${n}">
  <div class="equipo-cab"><b>Equipo ${n}</b>${asig ? `<span class="cinta ${asig.lado}" style="font-size:.75rem">Sala ${asig.sala} · ${esc(D.lados[asig.lado].rol)}</span>` : `<span class="cinta gris" style="font-size:.75rem">${m.length}/${cupoSlot}</span>`}</div>
  <div class="asientos-equipo">${asientos.join("")}</div>
  ${accion ? `<div class="botones">${accion}</div>` : ""}
</div>`);
    }
    const aviso = armado() && activos.length !== armado().P ? ` Ahora somos ${activos.length}: el administrador puede recalcular, o acomodar a quien falte al iniciar.` : "";
    return `<div class="vivo-resumen"><span class="conectados">${conectadosHTML()}</span><span>${armados} ${armados === 1 ? "equipo armado" : "equipos armados"} · ${sueltos.length} sin equipo</span></div><p class="nota-pie">${esc(planTexto(plan) + aviso)}</p><div class="equipos-hub">${tarjetas.join("")}</div>`;
  }
  /* Reparte a la gente en exactamente T equipos del tamaño que toca, respetando lo que armaron:
     los equipos que se pasan del tamaño sueltan a quien entró de último; los que faltan se abren
     y se llenan con los sueltos. Devuelve { equipos: {n: [jugadores]}, numeros: [n…] } y escribe
     los cambios de equipo. */
  function repartirEquipos(activos) {
    const plan = planPara(activos.length), equipos = equiposDe(activos);
    for (const n in equipos) equipos[n].sort((a, b) => (a.entrado || 0) - (b.entrado || 0));
    let numeros = Object.keys(equipos).map(Number).filter(n => equipos[n].length).sort((a, b) => a - b);
    const sueltos = activos.filter(j => !(j.equipo > 0)).sort((a, b) => (a.entrado || 0) - (b.entrado || 0));
    // sobran equipos: se disuelven los más chicos (y de número más alto) hacia los sueltos
    while (numeros.length > plan.T) {
      const n = numeros.slice().sort((a, b) => equipos[a].length - equipos[b].length || b - a)[0];
      sueltos.push(...equipos[n]); delete equipos[n]; numeros = numeros.filter(x => x !== n);
    }
    // faltan equipos: se abren con los números libres más bajos
    for (let n = 1; numeros.length < plan.T; n++) if (!equipos[n] || !equipos[n].length) { equipos[n] = []; numeros.push(n); }
    numeros.sort((a, b) => a - b);
    // tamaños objetivo: los equipos más grandes se quedan con base+1
    const orden = numeros.slice().sort((a, b) => equipos[b].length - equipos[a].length || a - b);
    const objetivo = {}; orden.forEach((n, i) => { objetivo[n] = plan.base + (i < plan.extra ? 1 : 0); });
    numeros.forEach(n => { while (equipos[n].length > objetivo[n]) sueltos.unshift(equipos[n].pop()); });
    numeros.forEach(n => { while (equipos[n].length < objetivo[n] && sueltos.length) equipos[n].push(sueltos.shift()); });
    numeros.forEach(n => equipos[n].forEach(j => { if (j.equipo !== n) { j.equipo = n; Sync.fijar("jugadores/" + j.id + "/equipo", n); } }));
    return { equipos, numeros, plan };
  }
  /* Antes de iniciar: solo acomoda a los sueltos sin tocar los equipos armados (los deja de extra
     donde haya espacio o abre equipos nuevos). Con el juego iniciado, mete a quien llegó tarde al
     equipo más chico, que ya tiene sala. */
  function acomodar() {
    const activos = jugadoresActivos(), equipos = equiposDe(activos), plan = planPara(activos.length);
    const sueltos = activos.filter(j => !(j.equipo > 0)).sort((a, b) => (a.entrado || 0) - (b.entrado || 0));
    if (!sueltos.length) return 0;
    const poner = (j, n) => { equipos[n] = equipos[n] || []; equipos[n].push(j); Sync.fijar("jugadores/" + j.id + "/equipo", n); const asig = vivo.config && vivo.config.equipos && vivo.config.equipos[n]; if (juegoIniciado() && asig) Sync.fijar("jugadores/" + j.id + "/asignacion", { sala: asig.sala, lado: asig.lado, rol: "analista", equipo: n, ts: Date.now() }); };
    let k = 0;
    if (juegoIniciado()) {
      const conSala = Object.keys((vivo.config && vivo.config.equipos) || {}).map(Number);
      while (k < sueltos.length && conSala.length) { const n = conSala.sort((a, b) => (equipos[a] || []).length - (equipos[b] || []).length || a - b)[0]; poner(sueltos[k++], n); }
      return k;
    }
    const maxEquipo = Math.max(2, plan.max);
    for (let n = 1; k < sueltos.length; n++) {
      if (n > plan.T + 50) break;
      const tam = (equipos[n] || []).length;
      if (tam === 0 && n > plan.T) continue;
      if (tam === 1) poner(sueltos[k++], n);
      else if (tam === 0 && k + 1 < sueltos.length) { poner(sueltos[k++], n); poner(sueltos[k++], n); }
    }
    while (k < sueltos.length) {
      const destino = Object.keys(equipos).map(Number).filter(n => equipos[n].length && equipos[n].length < maxEquipo).sort((a, b) => equipos[a].length - equipos[b].length || a - b)[0];
      if (!destino) break;
      poner(sueltos[k++], destino);
    }
    return k;
  }
  /* Inicia el juego: reparte a todos en T equipos del tamaño que toca, asigna sala y lado por pares
     de equipos y arranca el reloj del administrador. */
  function iniciarJuego() {
    const activos = jugadoresActivos();
    if (activos.length < 2) { avisar("Hacen falta al menos dos personas para empezar."); return false; }
    const { equipos, numeros, plan } = repartirEquipos(activos);
    const ts = Date.now();
    numeros.forEach((n, i) => {
      const sala = Math.floor(i / 2) + 1, lado = LADOS[i % 2];
      Sync.fijar("config/equipos/" + n, { sala, lado, ts });
      equipos[n].forEach((m, k) => Sync.fijar("jugadores/" + m.id + "/asignacion", { sala, lado, rol: k === 0 ? "vocero" : "analista", equipo: n, ts }));
    });
    Sync.fijar("config/juego", { iniciado: ts, salas: plan.salas });
    if (!RELOJES.admin.inicio) RELOJES.admin.fijar(ts);
    return true;
  }
  function abrirArmado() {
    const P = jugadoresActivos().length;
    if (P < 2) { avisar("Hacen falta al menos dos personas."); return false; }
    Sync.fijar("config/armado", Object.assign({ abierto: Date.now() }, planPara(P)));
    jugadoresActivos().forEach(j => { if (j.equipo) Sync.fijar("jugadores/" + j.id + "/equipo", null); });
    return true;
  }
  function equiposAdminHTML() {
    if (!enVivo()) return `<div class="panel suave">Sin tablero en vivo no se ve quién está conectado ni se pueden armar equipos.</div>`;
    const activos = jugadoresActivos(), equipos = equiposDe(activos), cfg = (vivo.config && vivo.config.equipos) || {};
    let porSala = "";
    if (juegoIniciado()) {
      const salas = {};
      Object.keys(cfg).forEach(n => { const a = cfg[n]; salas[a.sala] = salas[a.sala] || {}; salas[a.sala][a.lado] = { equipo: n, gente: (equipos[n] || []).map(x => x.nombre) }; });
      porSala = `<h3 style="margin-top:14px">Quién va a cada sala de ${esc(videollamada())}</h3><p class="nota-pie">Esta es la lista para mover a cada persona a su sala en la videollamada.</p><div class="vivo-grid" style="margin-top:8px">${Object.keys(salas).sort((a, b) => a - b).map(n => `<div class="sala-card"><div class="sala-cab"><b>Mesa ${n} · «${esc(nombreSala(n))}»</b>${salaPrivada() ? `<span class="estado neutro">preparación: ${LADOS.filter(seMueve).map(l => `${D.lados[l].rol.toLowerCase()} en «${esc(nombreSalaPrep(n, l))}»`).join(", ")}</span>` : ""}</div>${LADOS.map(l => { const x = salas[n][l]; return `<div class="lado-linea"><span class="quien acento-${l}">${esc(D.lados[l].rol)}</span><span class="nombres">${x ? esc(x.gente.join(", ")) + ` <small>equipo ${esc(x.equipo)}</small>` : "<span class='nota-pie'>sin equipo</span>"}</span></div>`; }).join("")}</div>`).join("")}</div>`;
    }
    const lista = `<div class="jugadores" style="margin-top:10px">${armado() ? "" : `<p class="nota-pie" style="flex-basis:100%">Pre-sala: todavía no hay equipos. Se arman cuando abrás el armado, con el tamaño que dé la cantidad de gente.</p>`}${activos.map(x => `<span class="jugador ${x.equipo > 0 ? "" : "sin-sala"}"><span class="avatar ${x.lado || ""}">${esc(iniciales(x.nombre))}</span>${!armado() && x.listo ? `<span class="listo-marca" title="Ya marcó que está listo">${Iconos.svg("check")}</span>` : ""}${esc(x.nombre)}<small>${x.sala ? `S${x.sala}` : x.equipo > 0 ? `eq. ${x.equipo}` : "sin equipo"} · ${esc(hace(x.actualizado))}</small><button type="button" class="tuto-cerrar" style="width:24px;height:24px;font-size:.7rem;box-shadow:none" data-sacar="${esc(x.id)}" data-nombre="${esc(x.nombre)}" aria-label="Sacar a ${esc(x.nombre)}" title="Sacar">✕</button></span>`).join("") || `<span class="nota-pie">Nadie conectado.</span>`}</div>`;
    return lista + (armado() ? hubHTML(true) + porSala : "");
  }
  function vivoHTML() {
    const con = vivo.conexion;
    if (con.modo === "nada") return `<div class="panel suave"><b>Sin tablero en vivo.</b> Los códigos llegan por el chat de la videollamada. Para ver las salas en tiempo real, sirva la web con su servidor (<span class="mono">servidor/index.js</span>, Docker o Coolify) o configure Firebase en <span class="mono">config.js</span>; con <span class="mono">?sync=local</span> se ensaya en esta computadora.</div>`;
    const salas = vivo.salas || {};
    const numeros = new Set(Object.keys(salas).map(Number).filter(n => n > 0));
    for (let i = 1; i <= (juegoIniciado() ? salasActivas() : (C.salas || 0)); i++) numeros.add(i);
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
    return `<div class="vivo-resumen"><span class="estado ${con.conectado ? "ok" : "mal"}">${esc(con.mensaje)}</span><span>${lista.length} salas · ${conteo.cerrado} cerradas · ${conteo.coinciden + conteo.mesa} negociando · ${conteo.ficha} preparándose · ${conteo.vacia} sin entrar</span></div><div class="vivo-grid">${tarjetas}</div>`;
  }
  function pintarVivo() { const z = document.getElementById("vivo"); if (z) z.innerHTML = vivoHTML(); const j = document.getElementById("jugadores"); if (j) { const h = equiposAdminHTML(); if (j.innerHTML !== h) j.innerHTML = h; } const a = document.getElementById("arranque"); if (a) { const h = arranqueHTML(); if (a.innerHTML !== h) a.innerHTML = h; } }
  function codigosEnVivo(incluirAbiertas) {
    const salas = vivo.salas || {}, codigos = [], sinCodigo = [], abiertas = [];
    Object.keys(salas).map(Number).filter(n => n > 0).sort((a, b) => a - b).forEach(n => {
      const s = salas[n];
      if (s.cierre && s.cierre.codigo) codigos.push(s.cierre.codigo);
      else if (LADOS.some(l => s[l]) || s.acta) { abiertas.push(n); if (incluirAbiertas) { codigos.push("S" + n + "-SIN"); sinCodigo.push(n); } }
    });
    return { codigos, sinCodigo, abiertas };
  }
  const tiempoAgotado = () => ["debrief", "fin"].includes(faseActual());
  function resumenVivoHTML() {
    const { codigos, abiertas } = codigosEnVivo(false), fin = tiempoAgotado();
    return `<div class="cabecera"><div><span class="ojo">Tablero en vivo</span><h2>${codigos.length} ${codigos.length === 1 ? "sala cerrada" : "salas cerradas"} · ${abiertas.length} ${abiertas.length === 1 ? "sigue" : "siguen"} en la mesa</h2><p class="nota-pie">${fin ? "Se acabó el tiempo: las salas que no registraron cierre cuentan como sin acuerdo." : "Cada sala aparece aquí al registrar su cierre, desde su pantalla de Cerrar o desde el acta del staff. Al acabarse el tiempo, las que no cerraron cuentan como sin acuerdo."}</p></div>${estado.manualResultados ? `<span class="estado aviso">Usando los códigos pegados</span>` : `<span class="estado ok">Automático</span>`}</div>`;
  }
  const revelado = () => !!(enVivo() ? (vivo.config.revelar && vivo.config.revelar.on) : estado.revelar);

  /* ---------- textos compartidos (guion, admin y staff) ---------- */
  function mensajes() {
    return {
      ingreso: `Entren aquí, escriban su nombre y vean el video: ${enlaceWeb()} . Al terminar, marquen «Estoy listo». Cuando estén todos, arman equipo y el juego le dice a cada equipo su lado y la sala de ${videollamada()} a la que entrar. La tabla de puntos es privada: no se comparte pantalla.`,
      prep30: "Quedan 30 segundos de preparación. Al terminar, la web los pasa a la mesa.",
      faltan3: "Quedan 3 minutos. Si no cierran, cada parte se queda con su plan B.",
      ultimo: "Último minuto. Cierren el trato en la etapa Cerrar, o marquen «sin acuerdo» con la última propuesta que hubo.",
      cierre: "Se cierran las salas. Si todavía no registraron el cierre en la web, háganlo ahora en Cerrar: trato hecho o sin acuerdo. Con eso basta."
    };
  }
  function cuesAdmin() {
    const t = D.tiempos, M = mensajes();
    const tPrep = t.consigna, tNeg = tPrep + t.preparacion, tCierre = tNeg + t.negociacion, tRes = tCierre + t.cierre, tFin = tRes + t.debrief;
    return [
      { en: 0, titulo: "Consigna", que: "Pegar el mensaje de ingreso en el chat. Cada persona entra con su nombre, ve el video de introducción y marca «Estoy listo»; arriba se ve cuántos están listos. Con todos listos, «Abrir el armado de equipos» y acomodar a los que falten. Con todos en equipos, «Iniciar juego» reparte lados y salas y arranca este reloj. Leer el caso en dos frases y las cuatro reglas (el video ya las contó).", msg: M.ingreso },
      { en: tPrep - 15, titulo: "Abrir las salas", que: videollamada() + ": abrir las salas para grupos pequeños (" + nombresSalas().length + " en total: " + nombresSalas().slice(0, 3).map(x => "«" + x + "»").join(", ") + "…" + (salaPrivada() ? "; cada equipo se prepara en la suya y los dos pasan a la mesa al empezar la negociación" : "") + "), con «permitir que los participantes elijan sala»: cada quien entra a la sala que le dice la web; la lista «Quién va a cada sala» de este panel sirve para revisar y mover a quien se equivoque. Dejar de compartir pantalla. El staff entra a su sala y elige su número en la vista Staff." },
      { en: tPrep, titulo: "Preparación", que: "La web pasa a cada pareja a Prepararse: leen su ficha por pasos y llenan la hoja. El staff resuelve dudas de reglas, nunca de estrategia. En el tablero se ve quién no ha entrado." },
      { en: tNeg - 30, titulo: "Aviso: 30 segundos", que: "Sale solo, con sonido, en la pantalla de cada equipo. Decirlo por " + videollamada() + " solo si alguna sala no tiene la web abierta.", msg: M.prep30 },
      { en: tNeg, titulo: "Negociación", que: "La web abre la mesa en todas las salas. El staff vigila en su pantalla que las propuestas de los dos equipos coincidan, sin meterse en el contenido. Vigilar que nadie muestre la tabla de puntos." },
      { en: tCierre - 180, titulo: "Aviso: 3 minutos", que: "Sale solo en la pantalla de cada equipo.", msg: M.faltan3 },
      { en: tCierre - 60, titulo: "Aviso: último minuto", que: "Sale solo en la pantalla de cada equipo.", msg: M.ultimo },
      { en: tCierre, titulo: "Cerrar las salas", que: videollamada() + ": cerrar las salas (cuenta regresiva de 60 s). La web pasa a los equipos a Cerrar y les muestra sola el aviso de cierre. «Trato hecho» solo se habilita si las dos propuestas coinciden; el staff lo verifica en su pantalla.", msg: M.cierre },
      { en: tRes, titulo: "Resultados", que: "Compartir la pestaña Resultados: ya tiene el ranking con los cierres que registró cada sala; las que no cerraron cuentan como sin acuerdo. Nombrar la sala ganadora, Revelar los intereses (cada equipo ve su resultado en su pantalla) y lanzar las tres preguntas." },
      { en: tFin, titulo: "Fin", que: "Sigue la presentación de los seis puntos de la CEP." }
    ];
  }
  /* ---------- avisos automáticos en la sala ----------
     Los avisos de la guía («Quedan 30 segundos de preparación», «Quedan 3 minutos», «Último minuto»,
     «Se cierran las salas») salen solos en la pantalla de cada equipo (y del staff) cuando el reloj
     del administrador llega a su momento, con sonido. Cada uno se muestra una vez por arranque del
     reloj; quien recarga dentro de los 45 s siguientes lo ve igual, después ya no (no se repiten
     avisos viejos). */
  function avisosSala() {
    const t = D.tiempos, M = mensajes(), tNeg = t.consigna + t.preparacion, tCierre = tNeg + t.negociacion;
    return [
      { id: "prep30", en: tNeg - 30, titulo: "Quedan 30 segundos", texto: M.prep30, tono: "oro" },
      { id: "faltan3", en: tCierre - 180, titulo: "Quedan 3 minutos", texto: M.faltan3, tono: "oro" },
      { id: "ultimo", en: tCierre - 60, titulo: "Último minuto", texto: M.ultimo, tono: "lava" },
      { id: "cierre", en: tCierre + 3, titulo: "Se cierran las salas", texto: M.cierre, tono: "lava" }   // 3 s después de la tarjeta de cambio de etapa, para no encimarse
    ];
  }
  let temporizadorAviso = null;
  function mostrarAvisoSala(a) {
    const z = document.getElementById("aviso-sala"); if (!z) return;
    const hud = document.querySelector(".hud"); z.style.top = ((hud ? hud.offsetHeight : 60) + 10) + "px";
    z.className = "aviso-sala " + (a.tono || "");
    const extra = a.id === "prep30" && estado.sala && seMueve(estado.lado) ? ` Ustedes pasan entonces a «${nombreSala(estado.sala)}» en ${videollamada()}.` : "";
    z.innerHTML = `${Iconos.svg(a.tono === "lava" ? "flag" : "clock")}<div><b>${esc(a.titulo)}</b><p>${esc(a.texto + extra)}</p></div><span class="cerrar-aviso">Cerrar</span>`;
    z.hidden = false; pitar(a.tono === "lava" ? 3 : 2);
    clearTimeout(temporizadorAviso); temporizadorAviso = setTimeout(ocultarAvisoSala, 14000);
  }
  function ocultarAvisoSala() { const z = document.getElementById("aviso-sala"); if (!z || z.hidden) return; z.classList.add("saliendo"); setTimeout(() => { z.hidden = true; z.classList.remove("saliendo"); }, 360); }
  function vigilarAvisos() {
    if (["admin", "resultados", "guion"].includes(rutaActual)) return;   // estudiantes (con nombre) y la vista del staff
    if (rutaActual !== "staff" && !estado.nombre) return;
    let transcurrido = null, inicio = null;
    if (RELOJES.admin.remoto !== undefined) { const fa = RELOJES.admin.fase(); if (fa) { transcurrido = fa.transcurrido; inicio = RELOJES.admin.remoto; } }
    else { const fe = RELOJES.equipo.fase(); if (fe) { transcurrido = fe.transcurrido + D.tiempos.consigna; inicio = RELOJES.equipo.inicio; } }
    if (transcurrido === null) return;
    let vistos = leerS("avisosVistos", null); if (!vistos || vistos.inicio !== inicio) vistos = { inicio, ids: [] };
    for (const a of avisosSala()) {
      if (vistos.ids.includes(a.id) || transcurrido < a.en || transcurrido > a.en + 45) continue;
      vistos.ids.push(a.id); guardarS("avisosVistos", vistos); mostrarAvisoSala(a); break;
    }
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
  function pintarHUD() {
    const chip = document.getElementById("chip-sala");
    if (estado.nombre) {
      chip.hidden = false; chip.className = "hud-chip " + (estado.lado || "");
      chip.textContent = estado.nombre + (estado.sala && estado.lado ? " · Sala " + estado.sala + " · " + D.lados[estado.lado].rol + (estado.rol !== "ambos" ? " · " + ROLES[estado.rol].nombre : "") : "");
    } else chip.hidden = true;
    document.querySelectorAll("#nav a[data-fac]").forEach(a => { a.hidden = !tieneClave(); });
    document.querySelectorAll("#nav a").forEach(a => a.classList.toggle("activo", a.dataset.ruta === rutaActual));
    document.getElementById("hud-ayuda").hidden = VISTAS_FACILITADOR.includes(rutaActual);
    pintarEtapas();
  }
  function pintarEtapas() {
    const z = document.getElementById("hud-etapas"); if (!z) return;
    if (VISTAS_FACILITADOR.includes(rutaActual)) { z.hidden = true; return; }
    z.hidden = false;
    const actualI = ETAPAS.findIndex(e => e.id === rutaActual);
    const h = ETAPAS.map((e, i) => {
      const bloq = bloqueada(e.id), hecha = i < actualI && !bloq;
      return `<a href="#${e.id}" class="etapa-nodo ${i === actualI ? "actual" : ""} ${hecha ? "hecha" : ""} ${bloq ? "bloqueada" : ""}" data-etapa="${e.id}" ${bloq ? 'aria-disabled="true"' : ""} ${i === actualI ? 'aria-current="step"' : ""}><span class="num"><span>${i + 1}</span></span><span class="etiqueta">${esc(e.nombre)}</span></a>`;
    }).join("");
    if (z.innerHTML !== h) z.innerHTML = h;
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
<div class="barra-pts"><div class="lleno ${completos && suma < planB ? "mal" : ""}" style="width:${suma}%"></div><div class="marca" style="left:calc(${planB}% - 2px)"></div></div>${veredicto}`;
  }
  function rondaActual() {
    const f = faseInfo();
    if (!f) return { nombre: "Mesa libre", pista: "Sin reloj: el reloj de la mesa arranca cuando alguien lo inicia. Mientras tanto, ensayen.", n: 0, tono: "calma", restante: null };
    if (f.id === "cuenta") return { nombre: "Empieza en " + mmss(f.restante), pista: "Lean su ficha y preparen su apertura.", n: 0, tono: "calma", restante: f.restante };
    if (f.id === "consigna" || f.id === "preparacion") return { nombre: "Preparación", pista: "Lean su ficha, miren su plan B y llenen la hoja de preparación.", n: 0, tono: "calma", restante: f.restante };
    if (f.id === "cierre") return { nombre: "Cierre", pista: "Registren el cierre: trato hecho o sin acuerdo con la última propuesta.", n: RONDAS.length, tono: "presion", restante: f.restante };
    if (f.id === "debrief" || f.id === "fin") return { nombre: "Tiempo agotado", pista: "Registren el cierre si no lo hicieron y esperen los resultados.", n: RONDAS.length, tono: "presion", restante: 0 };
    const transcurrido = D.tiempos.negociacion - f.restante;
    const k = RONDAS.findIndex(r => transcurrido < r.hasta);
    const r = RONDAS[k < 0 ? RONDAS.length - 1 : k];
    return { nombre: "Ronda " + (k < 0 ? RONDAS.length : k + 1) + " de " + RONDAS.length + " · " + r.nombre, pista: r.pista, n: k < 0 ? RONDAS.length : k + 1, tono: r.tono, restante: f.restante, hastaRonda: r.hasta - transcurrido };
  }
  const rondaHudHTML = () => { const r = rondaActual(); const alerta = r.restante !== null && r.restante <= 60 && r.n > 0; return `<span class="nivel ${r.tono}">${esc(r.nombre)}</span><span class="pista">${esc(r.pista)}</span><span class="tiempo-ronda ${alerta ? "alerta" : ""}">${r.restante === null ? "" : mmss(r.restante)}</span>`; };
  function estadoLaboratorio() {
    const misiones = MISIONES.map(m => ({ ...m, hecha: !!m.listo() }));
    const logros = LOGROS.map(l => ({ ...l, hecho: !!l.listo() }));
    return { misiones, logros, hechas: misiones.filter(m => m.hecha).length, actual: misiones.find(m => !m.hecha) || null };
  }
  function laboratorioHTML() {
    const lab = estadoLaboratorio();
    const porcentaje = Math.round(lab.hechas / MISIONES.length * 100);
    return `<div class="lab-cab"><span class="ojo">Misiones</span><span class="lab-progreso">${lab.hechas} de ${MISIONES.length}</span></div>
<div class="barra-pts lab-barra"><div class="lleno" style="width:${porcentaje}%"></div></div>
${lab.actual ? `<div class="mision-actual"><b>Ahora: ${esc(lab.actual.titulo)}</b><p>${esc(lab.actual.pista)}</p></div>` : `<div class="mision-actual completa"><b>Misiones completas</b><p>Cumplieron las seis. Lo que queda es contarlo bien en el cierre.</p></div>`}
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
  /* La escena de la mesa: quién está sentado, quién tiene la palabra, la última oferta de cada
     lado como burbuja, el contrato con la propuesta marcada y el cierre. */
  function datosEscena() {
    const s = (vivo.salas || {})[estado.sala] || {};
    const gente = { agencia: genteDe(estado.sala, "agencia"), cliente: genteDe(estado.sala, "cliente") };
    if (!gente[estado.lado].some(p => p.id === idPestana)) gente[estado.lado] = [{ id: idPestana, nombre: estado.nombre, rol: estado.rol }].concat(gente[estado.lado]);
    const palabra = s.palabra && s.palabra.id && Date.now() - (s.palabra.ts || 0) < 180000 ? s.palabra : null;
    const burbujas = {};
    LADOS.forEach(l => { const o = s[l] && s[l].oferta; if (o && o.letras && Date.now() - (o.ts || 0) < 14000) burbujas[l] = { texto: l === estado.lado ? "Nuestra oferta" : "Su oferta", codigo: o.letras }; });
    return { gente, palabra, burbujas, contrato: estado.cerrado && estado.cerrado.letras ? estado.cerrado.letras.join("") : propuestaActual(), cerrado: estado.cerrado ? (estado.cerrado.letras ? "trato" : "sin") : null, yo: idPestana, puedoHablar: enVivo() && !estado.cerrado, hablo: !!(palabra && palabra.id === idPestana) };
  }
  let firmaEscena = "";
  function pintarEscena() {
    const z = document.getElementById("escena-caja"); if (!z || !dentro()) return;
    const h = Escena.html(datosEscena());
    if (h === firmaEscena) return;
    firmaEscena = h; z.innerHTML = h; Escena.animarBurbujas(z);
  }
  function vistaClave(ruta) {
    return `
<section class="pantalla">
  <div class="panel gate">
  <span class="ojo">Solo facilitadores</span>
  <h2>Esta vista es del equipo que dirige la actividad</h2>
  <p>Para abrirla hace falta la clave del grupo. Si usted es estudiante, vuelva a <a href="#entrar">Entrar</a>.</p>
  <form id="form-clave"><label class="campo" for="clave">Clave<input type="password" id="clave" autocomplete="off"></label><div class="botones" style="margin-top:10px"><button type="submit" class="boton oro">Entrar</button></div></form>
  <input type="hidden" id="clave-destino" value="${esc(ruta)}">
  </div>
</section>`;
  }

  /* ---------- etapa 1: entrar (nombre, luego sala y lado) ---------- */
  const logoSVG = `<svg viewBox="0 0 160 160" aria-hidden="true"><rect x="8" y="8" width="144" height="144" rx="36" fill="var(--oro)" stroke="var(--borde)" stroke-width="6"/><path d="M38 92 l22 -24 l20 12 l20 -12 l22 24" fill="none" stroke="var(--borde)" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><circle cx="60" cy="104" r="17" fill="var(--orbita)" stroke="var(--borde)" stroke-width="6"/><circle cx="100" cy="104" r="17" fill="var(--volcan)" stroke="var(--borde)" stroke-width="6"/><path d="M52 54 q28 -30 56 0" fill="none" stroke="var(--borde)" stroke-width="6" stroke-linecap="round" stroke-dasharray="2 12"/></svg>`;
  function vistaEntrar() {
    const t = D.tiempos;
    const fasesHTML = `<div class="fases">
    <div class="fase"><b>1. Prepararse</b><span>${minutos(t.preparacion)}</span><small>Leer la ficha privada y decidir el mínimo</small></div>
    <div class="fase"><b>2. Negociar</b><span>${minutos(t.negociacion)}</span><small>Cinco temas sobre la mesa</small></div>
    <div class="fase"><b>3. Cerrar</b><span>${minutos(t.cierre)}</span><small>Trato hecho, o levantarse</small></div>
    <div class="fase"><b>4. Resultado</b><span>${minutos(t.debrief)}</span><small>Quién creó más valor y por qué</small></div>
  </div>`;
    const caso = `
<section class="seccion">
  <h2>${esc(D.contexto.titulo)}</h2>
  ${D.contexto.parrafos.map(p => `<p>${esc(p)}</p>`).join("")}
</section>
<section class="seccion dos">
  <div class="panel"><h3>Las reglas</h3><ol class="reglas">${D.contexto.reglas.map(r => `<li>${esc(r)}</li>`).join("")}</ol></div>
  <div class="panel suave"><h3>${esc(D.puntaje.titulo)}</h3><ul class="lista">${D.puntaje.lineas.map(r => `<li>${esc(r)}</li>`).join("")}</ul></div>
</section>
<p class="nota-pie">Facilitadores: <a href="#admin">administrador</a> · <a href="#staff">staff</a> · <a href="#guion">guion</a> · <a href="#resultados">resultados</a>.</p>`;
    if (!estado.nombre) {
      return `
<section class="pantalla intro">
  <div class="intro-logo">${logoSVG}<div class="titulo-juego">Trato Hecho</div><p class="intro-lema">${esc(D.lema)}. Dos contra dos, ${minutos(t.negociacion)}utos, un contrato. Gana la sala donde las dos partes salen mejor.</p></div>
  <form class="intro-form" id="form-nombre" autocomplete="off">
    <label class="campo" for="nombre">¿Cómo te llamás?<input type="text" id="nombre" name="nombre" autocomplete="name" maxlength="40" placeholder="Tu nombre, como aparece en ${esc(videollamada())}" required></label>
    <button type="submit" class="boton oro grande">Entrar al juego</button>
  </form>
  <span class="conectados" id="conectados" ${enVivo() ? "" : "hidden"}>${conectadosHTML()}</span>
  <div class="botones"><button type="button" class="boton fantasma" data-tutorial>¿Cómo se juega?</button></div>
  ${fasesHTML}
</section>${caso}`;
    }
    const yaDentro = estado.sala && estado.lado && leerS("sala", null);
    const cabecera = `
  <div class="ficha-identidad">
    <span class="avatar ${estado.lado || ""}" style="width:64px;height:64px;font-size:1.3rem">${esc(iniciales(estado.nombre))}</span>
    <h1>Hola, ${esc(estado.nombre.split(/\s+/)[0])}</h1>
    <span class="conectados" id="conectados" ${enVivo() ? "" : "hidden"}>${conectadosHTML()}</span>
    <div class="botones"><button type="button" class="boton chico fantasma" id="btn-cambiar-nombre">Cambiar mi nombre</button><button type="button" class="boton chico fantasma" data-tutorial>¿Cómo se juega?</button></div>
  </div>`;
    if (enVivo()) {
      if (yaDentro) {
        return `
<section class="pantalla">
  ${cabecera}
  <div class="panel menta"><span class="ojo">Tu lugar en el juego</span><h2>Sala ${estado.sala} · ${esc(D.lados[estado.lado].rol)} · ${esc(D.lados[estado.lado].nombre)}</h2>
    <p style="margin-top:6px"><b>${esc(indicacionSala(estado.sala, estado.lado))}</b> Tu rol en el equipo: ${esc(ROLES[estado.rol].nombre)}.</p>
    ${bloqueada("preparar") ? `<div class="espera-linea"><span class="reloj-arena" aria-hidden="true"></span><p>El administrador abre la preparación en un momento. La pantalla cambia sola.</p></div>` : `<div class="botones" style="margin-top:12px"><a class="boton oro grande" href="#preparar">Ir a prepararme</a></div>`}
  </div>
  ${presenciaHTML()}
</section>${caso}`;
      }
      if (juegoIniciado()) {
        return `
<section class="pantalla">
  ${cabecera}
  <div class="panel oro"><span class="ojo">El juego ya empezó</span><h2>Esperá un momento</h2><p>El administrador te va a ubicar en un equipo que ya tiene sala. Cuando lo haga, esta pantalla te dice a qué sala de ${esc(videollamada())} entrar.</p><div class="espera-linea"><span class="reloj-arena" aria-hidden="true"></span><p>Esperando al administrador…</p></div></div>
</section>${caso}`;
      }
      if (!armado()) {
        return `
<section class="pantalla">
  ${cabecera}
  <div class="panel menta pre-sala"><span class="ojo">Pre-sala</span><h2>Ya estás dentro</h2>
    <p>Mientras entran todos, mirá el video: cuenta el caso y cómo se juega. Al terminar se habilita <b>«Estoy listo»</b>; cuando todos estén listos, el administrador abre el armado de equipos y elegís con quién jugar.</p>
    ${videoIntroHTML()}
    <div class="botones listo-fila">${estado.listo ? `<span class="boton menta grande" aria-disabled="true">${Iconos.svg("check")} Listo</span>` : `<button type="button" class="boton menta grande" id="btn-listo" ${estado.videoVisto ? "" : "disabled"}>${Iconos.svg("check")} Estoy listo</button>`}<span class="nota-pie" id="listo-nota">${notaListo()}</span></div>
    <div class="espera-linea" id="listos"><span class="reloj-arena" aria-hidden="true"></span><p>${listosTexto()}</p></div>
  </div>
</section>${caso}`;
      }
      return `
<section class="pantalla">
  ${cabecera}
  <div class="panel" id="hub">
    <h2>Armá tu equipo</h2>
    <p>Tocá «Unirme» en un equipo con alguien, o abrí uno nuevo y esperá a que alguien se una. Cada equipo muestra cuántos lugares tiene. Cuando estén todos acomodados, el administrador inicia el juego y a cada equipo le toca un lado y una sala de ${esc(videollamada())}.</p>
    <div id="hub-equipos" style="margin-top:12px">${hubHTML(false)}</div>
  </div>
</section>${caso}`;
    }
    // sin tablero en vivo: elección manual de sala y lado
    return `
<section class="pantalla">
  ${cabecera}
  ${yaDentro ? `<div class="panel menta"><span class="ojo">Ya estás sentado</span><h2>Sala ${estado.sala} · ${esc(D.lados[estado.lado].rol)} · ${esc(ROLES[estado.rol].nombre)}</h2><div class="botones"><a class="boton oro grande" href="#preparar">Ir a prepararme</a><button type="button" class="boton fantasma" id="btn-salir">Cambiar de sala, lado o rol</button></div></div>` : ""}
  <div class="panel" id="entrar">
    <h2>${yaDentro ? "Cambiar de lugar" : "Sentate en tu sala"}</h2>
    <p>Tocá el lado que te tocó en tu sala de ${esc(videollamada())} y elegí tu rol en la pareja.</p>
    <div class="campo" style="margin-top:12px"><span>Mi rol en la pareja</span>
      <div class="roles">${Object.entries(ROLES).map(([k, r]) => `<button type="button" class="rol-boton" data-rol="${k}" aria-pressed="${estado.rol === k}"><b>${ico(r.icono)} ${esc(r.nombre)}</b><span>${esc(k === "ambos" ? "estoy solo en mi lado" : r.corto)}</span></button>`).join("")}</div>
    </div>
    <div class="campo" style="margin-top:14px"><span>Mi sala y mi lado</span><div id="lobby">${lobbyHTML()}</div></div>
    <div class="botones" style="margin-top:14px"><button type="button" class="boton oro grande" id="btn-entrar" disabled>Elija una sala y un lado</button><span class="nota-pie">La ficha del otro lado no se muestra. Juego limpio.</span></div>
  </div>
</section>${caso}`;
  }

  /* ---------- etapa 2: prepararse (la ficha por pasos) ---------- */
  function pasosPrep() {
    const l = estado.lado, L = D.lados[l], R = ROLES[estado.rol] || ROLES.ambos;
    const notas = leerS("prep." + l, {});
    const filasTabla = D.temas.map(t => t.opciones.map((o, k) => {
      const max = Math.max(...t.opciones.map(x => x[l]));
      return `<tr class="${k === 0 ? "tema-inicio" : ""}">${k === 0 ? `<td rowspan="${t.opciones.length}"><b>${esc(t.nombre)}</b></td>` : ""}<td><span class="mono">${o.letra}</span> ${esc(o.texto)}</td><td class="num ${o[l] === max ? "max" : ""}">${o[l]}</td></tr>`;
    }).join("")).join("");
    const pesos = D.temas.map((t, i) => ({ i, nombre: t.nombre, peso: pesoDe(i, l) })).sort((a, b) => b.peso - a.peso);
    const defender = pesos.slice(0, 2), cambiar = pesos.slice(-2).reverse();
    const respuestas = Object.values(notas).filter(v => v && v.trim()).length;
    return [
      { id: "caso", titulo: "El caso y las reglas", estado: "leer", html: `<p>${esc(D.contexto.parrafos[0])}</p><p>${esc(D.contexto.parrafos[1])}</p><div class="panel suave plano"><h3>Las reglas</h3><ol class="reglas">${D.contexto.reglas.map(r => `<li>${esc(r)}</li>`).join("")}</ol></div>` },
      { id: "quienes", titulo: "Quiénes son ustedes y con qué llegan", estado: "leer", html: `<div class="dos"><div class="panel ${l} plano"><h3>Quiénes son</h3><p>${esc(L.quienes)}</p></div><div class="panel ${l} plano"><h3>Su posición inicial</h3><p class="nota-pie">Lo que dicen al sentarse, tal cual.</p><p class="posicion">${esc(L.posicion)}</p></div></div>` },
      { id: "intereses", titulo: "Lo que de verdad les importa", estado: "leer", html: `<p class="nota-pie">En orden. La otra parte no lo sabe: detrás de cada posición hay un interés, y ahí está el valor.</p><ol class="intereses">${L.intereses.map(i => `<li><div><b>${esc(i.titulo)}</b>${esc(i.texto)}</div></li>`).join("")}</ol><div class="panel suave plano"><h3>Consejos</h3><ul class="lista">${L.consejos.map(c => `<li>${esc(c)}</li>`).join("")}</ul></div>` },
      { id: "puntos", titulo: "Su tabla de puntos y su plan B", estado: "leer", html: `<div class="panel suave plano plan-b"><div class="numero">${L.planB.puntos}<small>Plan B</small></div><div><p>${esc(L.planB.texto)}</p><p><b>${esc(L.planB.aviso)}</b></p></div></div><p class="nota-pie">Cada opción vale lo que dice aquí para ustedes. El máximo son 100. En verde, la mejor opción de cada tema.</p><div class="tabla-envoltorio"><table><thead><tr><th>Tema</th><th>Opción</th><th class="num">Puntos</th></tr></thead><tbody>${filasTabla}</tbody></table></div><div class="dos"><div><h3>Qué defender</h3><div class="monedas">${defender.map(p => `<div class="moneda defender"><div><b>${esc(p.nombre)}</b><br><span class="nota-pie">aquí están sus puntos</span></div><span class="peso">${p.peso}</span></div>`).join("")}</div></div><div><h3>Qué cambiar por algo</h3><div class="monedas">${cambiar.map(p => `<div class="moneda cambiar"><div><b>${esc(p.nombre)}</b><br><span class="nota-pie">les cuesta poco: cóbrenlo</span></div><span class="peso">${p.peso}</span></div>`).join("")}</div></div></div>` },
      { id: "hoja", titulo: "Hoja de preparación", estado: respuestas + "/3 respuestas", hecha: respuestas >= 2, html: `<p class="nota-pie">Tres respuestas cortas, entre los dos. Con dos ya cumplen la primera misión. Se guardan en este dispositivo.</p><div class="hoja">${L.preparacion.map(p => `<label class="campo" for="prep-${p.id}">${esc(p.pregunta)}<textarea id="prep-${p.id}" data-prep="${p.id}">${esc(notas[p.id] || "")}</textarea></label>`).join("")}</div>` },
      { id: "rol", titulo: "Su rol en la mesa: " + R.nombre, estado: "ver", html: `<div class="panel plano trabajo"><span class="ojo">${esc(R.titulo)}</span><ul class="tareas-rol">${R.tareas.map(([ic, t]) => `<li><span class="icono">${ico(ic)}</span><span>${esc(t)}</span></li>`).join("")}</ul></div><div class="dos"><div class="panel suave plano"><h3>Preguntas que abren la mesa</h3><ul class="lista"><li>«¿Para qué lo necesitan así?»</li><li>«De todo esto, ¿qué es lo que más les importa?»</li><li>«Si cedemos en eso, ¿qué nos pueden dar a cambio?»</li></ul></div><div class="panel suave plano"><h3>No decir</h3><ul class="lista"><li>Sus puntos, ni los de ninguna opción.</li><li>El plan B exacto. «Tenemos otra opción» es suficiente.</li><li>Un «sí» antes de preguntar qué dan a cambio.</li></ul></div></div><div class="botones"><button type="button" class="boton oro" data-tutorial>Ver cómo se juega, animado</button></div>` }
    ];
  }
  function vistaPreparar() {
    const l = estado.lado, L = D.lados[l], R = ROLES[estado.rol] || ROLES.ambos;
    const pasos = pasosPrep();
    const vistos = estado.prepVistos;
    const listos = pasos.filter(p => p.hecha || (p.estado !== "leer" && p.estado !== "ver" ? false : vistos.includes(p.id))).length;
    const abierto = pasos.find(p => !(p.hecha || vistos.includes(p.id))) || pasos[0];
    const bloq = bloqueada("negociar");
    return `
<section class="pantalla">
  <div class="pantalla-cab">
    <div class="textos">
      <span class="cinta ${l}">Sala ${estado.sala} · ficha privada · ${ico(R.icono)} ${esc(R.nombre)}</span>${zoomChipHTML()}
      <h1 class="titulo-lado ${l}">Ustedes son <em>${esc(L.nombre)}</em></h1>
      <p class="entrada">${esc(L.rol)}. Solo para su lado: no la compartan ni la lean en voz alta. Recorran los seis pasos; la mesa se abre cuando termine la preparación.</p>
    </div>
    ${relojHTML("equipo", "")}
  </div>
  ${presenciaHTML()}
  <div class="progreso-prep"><span>Preparación</span><div class="barra-pts"><div class="lleno" style="width:${Math.round(listos / pasos.length * 100)}%"></div></div><span id="prep-conteo">${listos} de ${pasos.length}</span></div>
  <div class="pasos-prep">${pasos.map((p, i) => `<details class="paso ${p.hecha || vistos.includes(p.id) ? "lista" : ""}" data-paso="${p.id}" ${p.id === abierto.id ? "open" : ""}><summary><span class="paso-num">${i + 1}</span><span>${esc(p.titulo)}</span><span class="paso-estado">${p.hecha ? "lista" : esc(p.estado)}</span></summary><div class="paso-cuerpo">${p.html}</div></details>`).join("")}</div>
  <div class="botones"><a class="boton oro grande ${bloq ? "bloqueado" : ""}" href="#negociar" data-etapa="negociar" ${bloq ? 'aria-disabled="true"' : ""}>${bloq ? ico("lock") + " La mesa se abre al terminar la preparación" : "Ir a la mesa"}</a><button type="button" class="boton fantasma" id="btn-salir">Cambiar de sala, lado o rol</button></div>
</section>`;
  }

  /* ---------- etapa 3: negociar (la mesa) ---------- */
  function registroHTML() {
    if (!estado.registro.length) return `<p class="registro-vacio">Todavía no hay apuntes. Guarden cada oferta que se diga y anoten qué le importa al otro lado.</p>`;
    return estado.registro.slice().reverse().map(r => r.tipo === "nota"
      ? `<div class="registro-item nota"><span class="t">${horaDe(r.t)}</span><span>${esc(r.texto)}</span></div>`
      : `<div class="registro-item ${r.de}"><span class="t">${horaDe(r.t)}</span><span><b>${r.de === "nuestra" ? "Nuestra oferta" : "Oferta de ellos"}</b> · <code>${esc(r.letras)}</code></span><span class="pts">${r.puntos} pts</span></div>`).join("");
  }
  function propuestaResumenHTML(lado) {
    return D.temas.map((t, i) => { const o = estado.trato[i] ? opcionDe(i, estado.trato[i]) : null; return `<div class="fila"><span class="tema">${esc(t.nombre)}</span>${o ? `<span class="valor"><b>${esc(o.texto)}</b><span class="pts">+${o[lado]}</span></span>` : `<span class="valor vacio">sin acordar</span>`}</div>`; }).join("");
  }
  function consultarHTML() {
    const l = estado.lado, L = D.lados[l], notas = leerS("prep." + l, {});
    const pesos = D.temas.map((t, i) => ({ i, nombre: t.nombre, peso: pesoDe(i, l) })).sort((a, b) => b.peso - a.peso);
    return `<details class="consultar"><summary><span>${ico("book")} Consultar mi ficha</span><span class="nota-pie">intereses · guion · plan B · mi hoja</span></summary><div class="consultar-cuerpo">
  <div><span class="ojo">Lo que nos importa</span><ol class="intereses" style="margin-top:8px">${L.intereses.map(i => `<li><div><b>${esc(i.titulo)}</b></div></li>`).join("")}</ol></div>
  <div><span class="ojo">Qué decir</span><ul class="lista" style="margin-top:8px"><li>«¿Para qué lo necesitan así?»</li><li>«Si cedemos en eso, ¿qué nos pueden dar a cambio?»</li>${L.consejos.slice(0, 2).map(c => `<li>${esc(c)}</li>`).join("")}</ul></div>
  <div><span class="ojo">Defender / cambiar</span><div class="monedas" style="margin-top:8px">${pesos.slice(0, 2).map(p => `<div class="moneda defender"><b>${esc(p.nombre)}</b><span class="peso">${p.peso}</span></div>`).join("")}${pesos.slice(-2).reverse().map(p => `<div class="moneda cambiar"><b>${esc(p.nombre)}</b><span class="peso">${p.peso}</span></div>`).join("")}</div></div>
  <div class="plan-b"><div class="numero">${L.planB.puntos}<small>Plan B</small></div><p class="nota-pie">${esc(L.planB.texto)}</p></div>
  ${Object.values(notas).some(v => v && v.trim()) ? `<div><span class="ojo">Nuestra hoja</span><ul class="lista" style="margin-top:8px">${L.preparacion.filter(p => notas[p.id] && notas[p.id].trim()).map(p => `<li><b>${esc(p.pregunta)}</b> ${esc(notas[p.id])}</li>`).join("")}</ul></div>` : ""}
</div></details>`;
  }
  function vistaNegociar() {
    const l = estado.lado, L = D.lados[l];
    const clausulas = D.temas.map((t, i) => `
<div class="clausula panel">
  <div class="clausula-cab"><span class="n">0${i + 1}</span><h3>${esc(t.nombre)}</h3><span class="pregunta">${esc(t.pregunta)}</span></div>
  <div class="chips" role="radiogroup" aria-label="${esc(t.nombre)}">${chipsOpciones(i, l, estado.trato[i], "tema")}</div>
</div>`).join("");
    const letras = letrasActuales(), completos = letras.every(Boolean);
    const suma = letras.reduce((s, le, i) => s + (le ? opcionDe(i, le)[l] : 0), 0);
    const cerrado = !!estado.cerrado;
    return `
<section class="pantalla">
  <div class="pantalla-cab">
    <div class="textos"><span class="cinta ${l}">Sala ${estado.sala} · ${esc(L.etiqueta)}</span>${zoomChipHTML()}<h1>La mesa</h1><p class="entrada">Marquen cada propuesta que se diga para ver cuánto vale para ustedes. Los puntos son solo suyos. Cuando haya trato, o cuando decidan levantarse, pasan a Cerrar.</p></div>
    ${relojHTML("equipo", "")}
  </div>
  <div class="mesa-escena" id="escena-caja"></div>
  <div class="ronda-hud ${rondaActual().restante !== null && rondaActual().restante <= 60 ? "alerta" : ""}" id="ronda">${rondaHudHTML()}</div>
  ${cerrado ? `<div class="panel menta"><b>Esta mesa ya cerró</b> (${esc(codigoDe(estado.sala, estado.cerrado))}). <a href="#cerrar">Ver el cierre</a> o <button type="button" class="boton chico fantasma" id="btn-reabrir">reabrir la mesa</button>.</div>` : ""}
</section>
<section class="seccion mesa-grid" id="temas">
  <div class="clausulas">${clausulas}</div>
  <aside class="apuntes">
    <div class="panel termometro arriba" id="termometro">${termometroHTML(l, suma, completos, letras.filter(x => !x).length)}</div>
    <div class="panel"><span class="ojo">Propuesta sobre la mesa</span><div class="propuesta-resumen" id="propuesta-resumen" style="margin-top:8px">${propuestaResumenHTML(l)}</div>
      <div class="botones" style="margin-top:12px"><button type="button" class="boton chico menta" data-oferta="nuestra">Guardar como nuestra oferta</button><button type="button" class="boton chico" data-oferta="ellos">Guardar como oferta de ellos</button></div>
      <div class="botones" style="margin-top:12px"><a class="boton oro" href="#cerrar">Cerrar la negociación →</a></div>
    </div>
    <div class="panel laboratorio" id="laboratorio">${laboratorioHTML()}</div>
    <div class="panel"><span class="ojo">Apuntes</span>
      <div class="presets" style="margin-top:8px">${PRESETS_EQUIPO.map(p => `<button type="button" class="preset" data-nota="${esc(p)}">${esc(p)}</button>`).join("")}</div>
      <form class="nota-form" id="form-nota" style="margin-top:8px"><input type="text" id="nota-texto" placeholder="Anotar algo que dijeron…" autocomplete="off"><button type="submit" class="boton chico">Anotar</button></form>
      <div class="registro" id="registro" style="margin-top:10px">${registroHTML()}</div>
    </div>
    ${consultarHTML()}
  </aside>
</section>
<div class="calculadora">
  <div><div class="total"><span id="calc-total">${suma}</span><small>de 100</small></div><div class="veredicto" id="calc-veredicto">Plan B: ${L.planB.puntos}</div></div>
  <div class="botones"><a class="boton oro chico" href="#cerrar">Cerrar →</a></div>
</div>`;
  }

  /* ---------- etapa 4: cerrar ---------- */
  function vistaCerrar() {
    const l = estado.lado, L = D.lados[l], cerrado = estado.cerrado;
    const letras = letrasActuales(), completos = letras.every(Boolean);
    const suma = letras.reduce((s, le, i) => s + (le ? opcionDe(i, le)[l] : 0), 0);
    if (cerrado) {
      const explicacion = cerrado.letras
        ? `Ustedes obtienen <b>${puntos(cerrado.letras, l)} puntos</b> con este trato${puntos(cerrado.letras, l) >= L.planB.puntos ? ", por encima de su plan B (" + L.planB.puntos + ")" : ": <b>por debajo de su plan B (" + L.planB.puntos + ")</b>, así que no cuenta"}.`
        : `Cada parte se queda con su plan B: ustedes, <b>${L.planB.puntos} puntos</b>.` + (cerrado.ultima ? ` Última propuesta registrada: <span class="mono">${cerrado.ultima.join("")}</span>${cerrado.quien ? " (rechazada: " + esc(NOMBRE_QUIEN[cerrado.quien]) + ")" : ""}.` : "");
      const logrosCierre = estadoLaboratorio().logros.filter(x => x.hecho);
      return `
<section class="pantalla">
  <div class="pantalla-cab"><div class="textos"><span class="cinta ${l}">Sala ${estado.sala} · ${esc(L.etiqueta)}</span><h1>${cerrado.letras ? "¡Trato hecho!" : "Sin acuerdo"}</h1></div>${relojHTML("equipo", "")}</div>
  <div class="mesa-escena" id="escena-caja"></div>
  <div class="panel codigo-caja" id="codigo">
    <span class="sello sellar ${cerrado.letras ? "" : "lava"}">${cerrado.letras ? "Trato hecho" : "Sin acuerdo"}</span>
    <p>${explicacion}</p>
    ${enVivo() ? `<p><b>Quedó registrado.</b> El administrador ya lo tiene en su tablero; no hay que copiar ni dictar nada.</p><p class="nota-pie">Código de respaldo, solo si el tablero falla: <span class="mono" id="codigo-texto">${esc(codigoDe(estado.sala, cerrado))}</span></p>` : `<div class="codigo" id="codigo-texto">${esc(codigoDe(estado.sala, cerrado))}</div><p>Si su sala no tiene staff, <b>una sola persona de la sala</b> pega este código en el chat al volver.</p>`}
    ${logrosCierre.length ? `<div class="logros">${logrosCierre.map(x => `<span class="logro" title="${esc(x.texto)}">${esc(x.titulo)}</span>`).join("")}</div>` : ""}
    <div class="botones">${enVivo() ? "" : `<button type="button" class="boton oro" id="btn-copiar">Copiar código</button>`}<a class="boton menta" href="#resultado">Ver mi resultado</a><button type="button" class="boton fantasma" id="btn-reabrir">${cerrado.letras ? "Cambiar el trato" : "Volver a la mesa"}</button></div>
  </div>
</section>`;
    }
    return `
<section class="pantalla">
  <div class="pantalla-cab"><div class="textos"><span class="cinta ${l}">Sala ${estado.sala} · ${esc(L.etiqueta)}</span>${zoomChipHTML()}<h1>Cerrar</h1><p class="entrada">Esto es lo que hay sobre la mesa. Si las dos partes dicen «trato hecho», confírmenlo aquí. Si lo que hay es peor que su plan B, levántense: también es negociar bien.</p></div>${relojHTML("equipo", "")}</div>
  <div class="mesa-escena" id="escena-caja"></div>
  <div class="dos">
    <div class="panel"><span class="ojo">Propuesta final</span><div class="cierre-resumen" style="margin-top:8px">${D.temas.map((t, i) => { const o = letras[i] ? opcionDe(i, letras[i]) : null; return `<div class="cierre-fila"><div><span class="nota-pie">${esc(t.nombre)}</span><br>${o ? `<b>${esc(o.texto)}</b>` : `<span class="nota-pie">sin acordar</span>`}</div>${o ? `<span class="pts">+${o[l]}</span>` : ""}</div>`; }).join("")}</div>
      <div class="botones" style="margin-top:12px"><a class="boton fantasma chico" href="#negociar">← Cambiar algo en la mesa</a></div></div>
    <div class="panel termometro" id="termometro">${termometroHTML(l, suma, completos, letras.filter(x => !x).length)}
      <div class="botones" style="margin-top:14px"><button type="button" class="boton menta grande" id="btn-cerrar" ${completos && puedeCerrarAhora() ? "" : "disabled"}>${ico("handshake")} Trato hecho</button><button type="button" class="boton lava" id="btn-sin">${ico("exit")} Sin acuerdo</button></div>
      <p class="nota-pie" id="nota-cerrar" style="margin-top:8px">${esc(notaCerrar())}</p>
    </div>
  </div>
  ${enVivo() ? `<div class="panel" id="verificacion"><span class="ojo">Verificación con el otro equipo</span>${verificacionHTML(estado.sala, l)}<p class="nota-pie" style="margin-top:8px">«Trato hecho» se habilita cuando las dos propuestas son idénticas. El staff de la sala ve esta misma comparación.</p></div>` : ""}
  <div class="panel panel-sin lava" id="panel-sin" hidden>
    <h3>Registrar «sin acuerdo»</h3>
    <p>Cada parte se queda con su plan B. Para evaluar la sala, anoten qué pasó.</p>
    <p><b>Última propuesta que hubo sobre la mesa:</b> <span id="sin-ultima"></span></p>
    <p><b>¿Quién la rechazó?</b></p>
    <div class="botones"><button type="button" class="boton" data-quien="A">La agencia</button><button type="button" class="boton" data-quien="C">El cliente</button><button type="button" class="boton" data-quien="T">Se acabó el tiempo</button><button type="button" class="boton fantasma" data-quien="">No sé, o nadie en particular</button></div>
    <div class="botones"><button type="button" class="boton fantasma chico" id="btn-sin-volver">Cancelar</button></div>
  </div>
</section>`;
  }

  /* ---------- etapa 5: resultado ---------- */
  function vistaResultado() {
    const l = estado.lado, L = D.lados[l], o = otroLado(l), cerrado = estado.cerrado, f = faseActual();
    if (!cerrado) {
      return `
<section class="pantalla">
  <div class="pantalla-cab"><div class="textos"><span class="cinta ${l}">Sala ${estado.sala}</span><h1>Resultado</h1></div>${relojHTML("equipo", "")}</div>
  <div class="panel lava"><h2>Todavía no registraron el cierre</h2><p>${f === "debrief" || f === "fin" ? "Se acabó el tiempo. Si no hubo trato, registren «sin acuerdo» con la última propuesta que hubo sobre la mesa; si lo hubo, confírmenlo." : "Cuando haya trato, o cuando decidan levantarse, regístrenlo en Cerrar."}</p><div class="botones" style="margin-top:12px"><a class="boton oro grande" href="#cerrar">Ir a Cerrar</a></div></div>
</section>`;
    }
    const ev = evaluar(estado.sala, cerrado);
    const codigos = enVivo() ? (vivo.config.codigos || "") : estado.chat;
    const ranking = codigos ? ordenar(parsearCodigos(codigos).filas) : [];
    const puesto = ranking.findIndex(r => r.sala === estado.sala);
    const optimo = mejorTrato();
    const propio = `<div class="panel codigo-caja"><span class="sello ${cerrado.letras ? "" : "lava"}">${cerrado.letras ? "Trato hecho" : "Sin acuerdo"}</span><div class="codigo">${esc(codigoDe(estado.sala, cerrado))}</div><p>${cerrado.letras ? `Para ustedes vale <b>${puntos(cerrado.letras, l)}</b> de 100 (plan B: ${L.planB.puntos}).` : `Ustedes se quedan con su plan B: <b>${L.planB.puntos}</b>.`}</p></div>`;
    if (!revelado()) {
      return `
<section class="pantalla">
  <div class="pantalla-cab"><div class="textos"><span class="cinta ${l}">Sala ${estado.sala} · ${esc(L.etiqueta)}</span><h1>Resultado</h1></div>${relojHTML("equipo", "")}</div>
  ${propio}
  <div class="panel espera"><div class="reloj-arena" aria-hidden="true"></div><h2>Esperando la revelación</h2><p>Cuando el administrador revele los intereses, aquí aparecen los puntos de la otra parte, el índice de su sala y su puesto. Mientras tanto, conversen:</p><ol class="pasos" style="text-align:left">${D.revelacion.debrief.map(p => `<li>${esc(p)}</li>`).join("")}</ol></div>
</section>`;
    }
    const estadoTxt = ev.sin ? (ev.perdido > 0 ? `<span class="estado aviso">Sin acuerdo · trato perdido</span>` : ev.diagnostico === "correcto" ? `<span class="estado ok">Sin acuerdo · bien hecho</span>` : `<span class="estado neutro">Sin acuerdo</span>`) : ev.valido ? `<span class="estado ok">Trato válido</span>` : `<span class="estado mal">No cuenta</span>`;
    return `
<section class="pantalla">
  <div class="pantalla-cab"><div class="textos"><span class="cinta ${l}">Sala ${estado.sala} · ${esc(L.etiqueta)}</span><h1>Su resultado</h1></div>${puesto >= 0 ? `<div class="ficha-identidad"><span class="puesto">${puesto + 1}º</span><span class="nota-pie">de ${ranking.length} salas</span></div>` : ""}</div>
  <div class="panel">
    <div class="marcador"><div class="lado-m agencia"><span class="ojo">Agencia</span><b>${ev.a}</b><span class="nota-pie">plan B ${PLAN_B.agencia}</span></div><span class="vs">contra</span><div class="lado-m cliente"><span class="ojo">Cliente</span><b>${ev.c}</b><span class="nota-pie">plan B ${PLAN_B.cliente}</span></div></div>
    <div class="indice-grande" style="margin-top:12px">${ev.indice}</div><p style="text-align:center"><span class="ojo">índice ganar-ganar</span> · de ${optimo.indice} posibles · ${estadoTxt}</p>
    <p style="text-align:center;margin-top:8px">${esc(ev.motivo)}${ev.sin && ev.ultima ? `. Última propuesta: ${resumenTrato(ev.ultima.letras)}` : ""}</p>
    ${!ev.sin ? `<div class="cierre-resumen" style="margin-top:12px">${D.temas.map((t, i) => { const op = opcionDe(i, cerrado.letras[i]); return `<div class="cierre-fila"><div><span class="nota-pie">${esc(t.nombre)}</span><br><b>${esc(op.texto)}</b></div><span class="pts"><span class="acento-agencia">${op.agencia}</span> / <span class="acento-cliente">${op.cliente}</span></span></div>`; }).join("")}</div>` : ""}
  </div>
  <div class="dos">
    <div class="panel ${o}"><h3>Lo que había del otro lado</h3><p class="nota-pie">${esc(D.lados[o].etiqueta)} · plan B ${PLAN_B[o]}</p><ol class="intereses">${D.lados[o].intereses.map(i => `<li><div><b>${esc(i.titulo)}</b>${esc(i.texto)}</div></li>`).join("")}</ol></div>
    <div class="panel"><h3>El mejor trato posible</h3><p>Era <span class="mono">${optimo.letras.join("")}</span>: ${optimo.a} para la agencia y ${optimo.c} para el cliente, índice ${optimo.indice}.</p><p class="nota-pie" style="margin-top:8px">${esc(resumenTrato(optimo.letras))}</p></div>
  </div>
  <div class="claves">${D.revelacion.claves.map(c => `<div class="clave"><b>${esc(c.titulo)}</b><p>${esc(c.texto)}</p></div>`).join("")}</div>
  <div class="panel suave"><h3>Para conversar</h3><ol class="pasos">${D.revelacion.debrief.map(p => `<li>${esc(p)}</li>`).join("")}</ol></div>
</section>`;
  }

  /* ---------- la mesa: cálculo, registro y cierre ---------- */
  function letrasActuales() { return D.temas.map((t, i) => estado.trato[i] || null); }
  function actualizarCalculadora() {
    const l = estado.lado; if (!l) return 0;
    const letras = letrasActuales(), completos = letras.every(Boolean);
    const suma = letras.reduce((s, le, i) => s + (le ? opcionDe(i, le)[l] : 0), 0);
    const planB = D.lados[l].planB.puntos;
    const term = document.getElementById("termometro"); if (term && rutaActual === "negociar") term.innerHTML = termometroHTML(l, suma, completos, letras.filter(x => !x).length);
    if (document.getElementById("laboratorio")) pintarLaboratorio();
    const res = document.getElementById("propuesta-resumen"); if (res) res.innerHTML = propuestaResumenHTML(l);
    ["btn-cerrar", "btn-cerrar-2"].forEach(id => { const b = document.getElementById(id); if (b) b.disabled = !(completos && puedeCerrarAhora()); });
    const total = document.getElementById("calc-total"), ver = document.getElementById("calc-veredicto");
    if (total) {
      total.textContent = suma;
      if (!completos) { ver.className = "veredicto"; ver.textContent = "Faltan " + letras.filter(x => !x).length + " temas · plan B: " + planB; }
      else if (suma >= planB) { ver.className = "veredicto ok"; ver.textContent = "Supera su plan B por " + (suma - planB); }
      else { ver.className = "veredicto mal"; ver.textContent = "Por debajo de su plan B (" + planB + ")"; }
    }
    pintarEscena();
    return suma;
  }
  function anotar(item) {
    estado.registro.push(item); guardarS("registro", estado.registro);
    const z = document.getElementById("registro"); if (z) z.innerHTML = registroHTML();
    const datos = { ofertas: estado.registro.filter(r => r.tipo === "oferta").length, notas: estado.registro.filter(r => r.tipo === "nota").length };
    if (item.tipo === "oferta" && item.de === "nuestra") datos.oferta = { letras: item.letras, ts: Date.now() };   // burbuja en la escena de todos
    reportar(datos);
    pintarLaboratorio(); pintarEscena();
  }
  function abrirPanelSin() {
    const panel = document.getElementById("panel-sin"), span = document.getElementById("sin-ultima");
    const letras = letrasActuales();
    span.innerHTML = letras.every(Boolean)
      ? `<span class="mono">${letras.join("")}</span> · ${resumenTrato(letras)}`
      : `ninguna completa. Si hubo una, vuelvan a la mesa y márquenla antes de registrar; si no, sigan.`;
    panel.hidden = false; panel.scrollIntoView({ block: "start", behavior: "smooth" });
  }
  function cerrarCon(cierre) {
    estado.cerrado = cierre; guardarS("cerrado", cierre);
    Sync.fijar("salas/" + estado.sala + "/cierre", { codigo: codigoDe(estado.sala, cierre), por: estado.lado, ts: Date.now() });
    Sync.fijar("salas/" + estado.sala + "/palabra", null);
    reportar({ fase: "cerrado", propuesta: cierre.letras ? cierre.letras.join("") : propuestaActual() });
    firmaEscena = ""; pitar(cierre.letras ? 2 : 1);
    if (location.hash !== "#cerrar") location.hash = "#cerrar"; else render();
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
    const gente = LADOS.map(l => `<span class="acento-${l}"><b>${esc(D.lados[l].rol)}:</b> ${genteDe(n, l).map(p => esc(p.nombre)).join(", ") || "nadie"}</span>`).join(" · ");
    return `
<div class="cabecera"><div><span class="ojo">Acta de la sala ${n}</span><h2>${cierre ? "Cerrada: " + esc(cierre.codigo) : completos ? "Los cinco temas acordados" : (5 - letras.filter(Boolean).length) + " temas pendientes"}</h2><p class="nota-pie">${gente}</p></div>
  ${cierre ? `<div class="botones"><button type="button" class="boton chico" data-copiar="${esc(cierre.codigo)}">Copiar código</button><button type="button" class="boton chico fantasma" id="btn-acta-reabrir">Reabrir</button></div>` : `<div class="botones"><button type="button" class="boton menta" id="btn-acta-cerrar" ${completos ? "" : "disabled"}>${ico("handshake")} Trato hecho</button><button type="button" class="boton lava" id="btn-acta-sin">${ico("exit")} Sin acuerdo</button></div>`}
</div>
<div class="panel panel-sin lava" id="acta-panel-sin" hidden>
  <p><b>Sin acuerdo.</b> Última propuesta sobre la mesa: ${completos ? `<span class="mono">${letras.join("")}</span>` : "ninguna completa (se registra sin propuesta)"}. ¿Quién la rechazó?</p>
  <div class="botones"><button type="button" class="boton" data-acta-quien="A">La agencia</button><button type="button" class="boton" data-acta-quien="C">El cliente</button><button type="button" class="boton" data-acta-quien="T">Se acabó el tiempo</button><button type="button" class="boton fantasma" data-acta-quien="">No sé</button></div>
</div>
<div class="mesa-grid">
  <div class="panel clausulas">${clausulas}</div>
  <div class="panel"><span class="ojo">Apuntes de la sala</span>
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

  /* ---------- resultados (facilitador): gráfico, tablero, revelación ---------- */
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
    if (!lista.length && !errores.length) return `<p class="nota-pie">${enVivo() && !estado.manualResultados ? "Todavía ninguna sala ha registrado su cierre. Aparecen aquí solas, en cuanto cierren." : "Todavía no hay códigos. Pegue el chat o cargue el ejemplo."}</p>`;
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
${mejor ? `<div class="podio"><span class="cinta">Mejor negociación</span><div class="ganadora">Sala ${mejor.sala}: ${mejor.a} para la agencia, ${mejor.c} para el cliente</div><p>Índice ganar-ganar ${mejor.indice} de ${optimo.indice} posibles (${Math.round(mejor.indice / optimo.indice * 100)} %). ${detalle(mejor)}</p></div>` : `<div class="podio"><span class="ojo">Resultado</span><div class="ganadora">Ningún trato válido. La mejor jugada fue no cerrar.</div></div>`}
<div class="tabla-envoltorio"><table><thead><tr><th class="num">#</th><th>Sala</th><th>Trato</th><th class="num acento-agencia">Agencia</th><th class="num acento-cliente">Cliente</th><th class="num">Total</th><th class="num">Índice</th><th>Estado</th></tr></thead><tbody>${filasHTML}</tbody></table></div>
<div class="panel">
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
    <div class="panel agencia"><h3>${ladoHTML("agencia")}</h3><p class="nota-pie">Plan B: ${PLAN_B.agencia} puntos</p><ol class="intereses">${D.lados.agencia.intereses.map(i => `<li><div><b>${esc(i.titulo)}</b>${esc(i.texto)}</div></li>`).join("")}</ol></div>
    <div class="panel cliente"><h3>${ladoHTML("cliente")}</h3><p class="nota-pie">Plan B: ${PLAN_B.cliente} puntos</p><ol class="intereses">${D.lados.cliente.intereses.map(i => `<li><div><b>${esc(i.titulo)}</b>${esc(i.texto)}</div></li>`).join("")}</ol></div>
  </div>
  <h3>Las dos tablas juntas</h3>
  <p class="nota-pie">Sombreada, la opción de cada tema que más valor suma entre los dos. El mejor trato posible era <span class="mono">${optimo.letras.join("")}</span>: ${optimo.a} para la agencia y ${optimo.c} para el cliente, índice ${optimo.indice}.</p>
  <div class="tabla-envoltorio"><table class="comparativa"><thead><tr><th>Tema</th><th>Opción</th><th class="num agencia">Agencia</th><th class="num cliente">Cliente</th><th class="num">Suma</th></tr></thead><tbody>${filas}</tbody></table></div>
  <div class="panel suave"><h3>Preguntas para el cierre</h3><ol class="pasos">${D.revelacion.debrief.map(p => `<li>${esc(p)}</li>`).join("")}</ol></div>
</section>`;
  }
  function vistaResultados() {
    const selects = D.temas.map((t, i) => `<label class="campo" for="man-${i}">${esc(t.nombre)}<select id="man-${i}" data-manual="${i}">${t.opciones.map(o => `<option value="${o.letra}">${o.letra} · ${esc(o.texto)}</option>`).join("")}</select></label>`).join("");
    const vivoSi = enVivo(), rev = revelado(), manual = !!estado.manualResultados;
    return `
<section class="seccion">
  <span class="ojo">Facilitadores</span>
  <h1>Resultados</h1>
  <p class="entrada">${vivoSi ? "Se llena solo: cada sala aparece cuando registra su cierre, trato hecho o sin acuerdo, desde su pantalla de Cerrar o desde el acta del staff. Nadie tiene que dictar códigos. Al revelar, cada equipo ve su resultado en su propia pantalla." : "Pegue el chat de la sala principal tal cual: el tablero encuentra los códigos solo."} Si una sala registra dos cierres, vale el último.</p>
</section>
${vivoSi ? `<section class="seccion"><div class="panel ${manual ? "suave" : "menta"}" id="resumen-vivo">${resumenVivoHTML()}</div></section>` : ""}
<section class="seccion" id="tablero"></section>
<section class="seccion"><div class="botones"><button type="button" class="boton ${rev ? "fantasma" : "menta grande"}" id="btn-revelar">${rev ? "Ocultar la revelación" : "Revelar los intereses"}</button><span class="nota-pie">Hasta que no se pulse, ni la pantalla compartida ni las pantallas de los equipos muestran las tablas del otro lado.</span></div></section>
<div id="zona-revelacion">${rev ? revelacionHTML() : ""}</div>
<section class="seccion"><details class="consultar" ${manual || !vivoSi ? "open" : ""}><summary><span>Respaldo: códigos pegados o a mano</span><span class="nota-pie">${vivoSi ? "solo si el tablero en vivo falla" : "pegue aquí el chat"}</span></summary><div class="consultar-cuerpo">
  ${vivoSi ? `<label class="campo" for="chk-manual" style="display:flex;gap:10px;align-items:center;font-weight:700"><input type="checkbox" id="chk-manual" ${manual ? "checked" : ""} style="width:auto;margin:0">Usar lo pegado aquí en vez del tablero en vivo</label>` : ""}
  <label class="campo" for="chat">Códigos de las salas<textarea id="chat" rows="5" placeholder="S1-BEDCD&#10;S2-SIN-CBCBB-T&#10;…">${esc(estado.chat)}</textarea></label>
  <div class="botones"><button type="button" class="boton oro" id="btn-calcular">Calcular</button><button type="button" class="boton fantasma" id="btn-ejemplo">Cargar ejemplo</button><button type="button" class="boton fantasma" id="btn-limpiar">Limpiar</button></div>
  <details><summary>Agregar una sala a mano</summary>
    <div class="entrada-manual">
      <label class="campo" for="man-sala">Sala<input type="number" id="man-sala" min="1" max="30" value="1"></label>
      ${selects}
      <div class="botones"><button type="button" class="boton chico" id="btn-manual">Agregar trato</button><button type="button" class="boton chico fantasma" id="btn-manual-sin">Sin acuerdo con esta última propuesta</button><button type="button" class="boton chico fantasma" id="btn-manual-sin-nada">Sin acuerdo, sin detalle</button></div>
    </div>
  </details>
</div></details></section>`;
  }

  /* ---------- admin, staff y guion ---------- */
  function arranqueHTML() {
    const fa = RELOJES.admin.fase(), j = enVivo() ? jugadoresActivos() : [], equipos = armado() || juegoIniciado() ? equiposDe(j) : {}, armados = Object.keys(equipos).length, sueltos = j.filter(x => !(x.equipo > 0)).length;
    const conteo = enVivo() ? `<span class="conectados"><span class="punto" aria-hidden="true"></span>${j.length} ${j.length === 1 ? "persona conectada" : "personas conectadas"}${armado() || juegoIniciado() ? ` · ${armados} ${armados === 1 ? "equipo" : "equipos"} · ${sueltos} sin equipo` : ""}</span>` : `<span class="nota-pie">Sin tablero en vivo no se ve quién está conectado.</span>`;
    if (juegoIniciado() || fa) {
      const final = fa && (fa.id === "debrief" || fa.id === "fin");
      return `<div class="cabecera"><div><span class="ojo">En marcha</span><h2>${fa ? esc(fa.nombre) + " · " + mmss(fa.restante) : "Juego iniciado"}</h2><p class="nota-pie">${final ? "Se acabó el tiempo. Resultados ya tiene el ranking. Cuando lo hayan comentado, revelá los intereses: cada equipo ve en su pantalla los puntos del otro lado, su índice y su puesto." : salasActivas() + " salas. Las pantallas de los equipos van con este reloj: «Siguiente fase» salta, «Reiniciar» lo detiene. Si alguien entra tarde, «Acomodar a los que faltan» lo mete de tercero en un equipo con sala."}</p></div><div class="ficha-identidad">${conteo}<div class="botones">${final ? `<button type="button" class="boton ${revelado() ? "fantasma" : "menta grande"}" id="btn-revelar">${revelado() ? "Ocultar la revelación" : "Revelar los intereses a los equipos"}</button><a class="boton fantasma chico" href="#resultados">Ver Resultados</a>` : ""}${sueltos ? `<button type="button" class="boton chico oro" id="btn-acomodar">Acomodar a los que faltan (${sueltos})</button>` : ""}</div></div></div>`;
    }
    if (!armado()) {
      const listos = listosDe(j), todos = j.length >= 2 && listos >= j.length;
      return `<div class="cabecera ${todos ? "todos-listos" : ""}"><div><span class="ojo">Pre-sala</span><h2>${todos ? "Todos listos" : "Esperando a que entren todos"}</h2><p class="nota-pie">Cada persona escribe su nombre, ve el video de introducción y marca «Estoy listo» al terminar. ${todos ? "Ya marcaron todos: este botón" : "Cuando estén todos, este botón"} fija el plan con la gente que hay (${esc(planTexto(planPara(j.length)))}) y les abre el hub para armar equipos de ese tamaño.</p></div><div class="ficha-identidad">${conteo}${enVivo() ? `<span class="conectados listos-chip ${todos ? "ok" : ""}">${Iconos.svg("check")}<span>${listos} de ${j.length} ${j.length === 1 ? "listo" : "listos"}</span></span>` : ""}<button type="button" class="boton oro grande" id="btn-abrir-armado" ${j.length >= 2 ? "" : "disabled"}>Abrir el armado de equipos</button></div>`;
    }
    const cambio = armado().P !== j.length ? `<p class="nota-pie" style="color:var(--aviso)">El plan se fijó con ${armado().P} y ahora hay ${j.length}. «Recalcular» rehace el plan con los que hay; si no, al iniciar se acomoda a quien sobre o falte.</p>` : "";
    return `<div class="cabecera"><div><span class="ojo">Armando equipos</span><h2>Iniciar el juego</h2><p class="nota-pie">${esc(planTexto(armado()))} Este botón completa el reparto (los equipos armados se respetan; quien sobra o falta se acomoda), le asigna a cada equipo un lado y una sala, se lo muestra en su pantalla con la sala de ${esc(videollamada())} a la que debe entrar, y arranca el reloj completo.</p>${cambio}</div><div class="ficha-identidad">${conteo}<div class="botones">${armado().P !== j.length ? `<button type="button" class="boton fantasma chico" id="btn-abrir-armado">Recalcular con ${j.length}</button>` : ""}${sueltos ? `<button type="button" class="boton fantasma" id="btn-acomodar">Acomodar a los que faltan (${sueltos})</button>` : ""}<button type="button" class="boton oro grande" id="btn-iniciar-juego" ${j.length >= 2 ? "" : "disabled"}>Iniciar juego</button></div></div></div>`;
  }
  function vistaAdmin() {
    const t = D.tiempos, total = FASES_ADMIN.reduce((s, f) => s + f.dur, 0);
    return `
<section class="seccion"><div class="panel oro" id="arranque">${arranqueHTML()}</div></section>
<section class="seccion">
  <span class="ojo">Panel del administrador · pestaña privada: no compartirla</span>
  <h1>Admin</h1>
  <p class="entrada">El reloj corre las cinco fases completas (${mmss(total)}) y, con tablero en vivo, manda sobre las pantallas de los equipos: la web los pasa sola de Prepararse a Negociar, a Cerrar y a Resultado. Cada aviso se ilumina cuando toca y el botón copia el mensaje para transmitirlo a las salas. Si van tarde o adelantados, «Siguiente fase» salta el reloj.</p>
  ${relojHTML("admin", "grande")}
  <div class="botones"><a class="boton fantasma" href="#entrar" target="_blank" rel="noopener">Entrar en otra pestaña, para compartir</a><a class="boton fantasma" href="#resultados" target="_blank" rel="noopener">Resultados en otra pestaña</a><a class="boton fantasma" href="#staff">Vista del staff</a><a class="boton fantasma" href="#guion">Guion completo</a></div>
</section>
<section class="seccion">
  <div class="cabecera"><h2>Conectados y equipos</h2><div class="botones"><button type="button" class="boton lava chico" id="btn-sacar-todos">Sacar a todos</button></div></div>
  <div id="confirmar-sacar" class="panel lava" hidden><p><b>¿Sacar a todos ahora?</b> Cada pestaña vuelve a la pantalla del nombre al instante. No borra actas ni cierres; para empezar de cero, «Reiniciar la sesión».</p><div class="botones" style="margin-top:10px"><button type="button" class="boton lava" id="btn-sacar-si">Sí, sacar a todos</button><button type="button" class="boton fantasma" id="btn-sacar-no">No</button></div></div>
  <div id="jugadores">${equiposAdminHTML()}</div>
</section>
<section class="seccion">
  <div class="cabecera"><h2>Las salas, en vivo</h2><div class="botones"><button type="button" class="boton fantasma chico" id="btn-probar">Probar conexión</button><button type="button" class="boton lava chico" id="btn-reiniciar">Reiniciar la sesión</button></div></div>
  <div id="confirmar-reinicio" class="panel lava" hidden><p><b>¿Borrar todo lo registrado en la sesión «${esc(vivo.conexion.sesion)}»?</b> Las salas, las actas, los cierres, el reparto y el reloj. Sirve para empezar de cero después de un ensayo.</p><div class="botones" style="margin-top:10px"><button type="button" class="boton lava" id="btn-reiniciar-si">Sí, borrar todo</button><button type="button" class="boton fantasma" id="btn-reiniciar-no">No</button></div></div>
  <div id="vivo">${vivoHTML()}</div>
</section>
<section class="seccion">
  <h2>Qué toca ahora</h2>
  <div class="cues">${cuesHTML()}</div>
</section>
<section class="seccion">${zoomSalasHTML()}</section>
<section class="seccion dos">
  <div class="panel"><h3>${esc(videollamada())}, en orden</h3><ol class="pasos">
    <li>Antes de empezar: que el profe haga coanfitriones al administrador y al staff, o que sea él quien abra las salas.</li>
    <li>Crear de antemano las ${nombresSalas().length} salas para grupos pequeños (${nombresSalas().slice(0, 3).map(x => `«${esc(x)}»`).join(", ")}, …: la lista completa está abajo) con «Permitir que los participantes elijan sala». Cuando todos estén en equipos, «Iniciar juego» reparte lados y salas y cada quien ve en su pantalla a qué sala entrar; en «Quién va a cada sala» queda la lista por si alguien se equivoca. Un integrante del staff en cada sala.</li>
    <li>Compartir la ventana del navegador con la pantalla de Entrar, nunca la pantalla completa (esta pestaña se vería).</li>
    <li>Los avisos van por «Transmitir mensaje a todas las salas», en el panel de salas.</li>
    <li>Al cerrar las salas, Resultados ya tiene los cierres; las salas que no cerraron cuentan como sin acuerdo. Al revelar, cada equipo ve su resultado.</li>
  </ol></div>
  <div class="panel suave"><h3>Cómo se lee un código</h3><ul class="lista">
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
    <div><span class="ojo">Staff · verificador de la sala</span><h1>Mi sala</h1><p class="entrada">Usted no negocia: verifica. Aquí ve las dos propuestas de su sala en vivo, tema por tema; la web solo habilita «Trato hecho» cuando coinciden. Resuelva dudas de reglas, nunca de estrategia.</p><div class="botones" style="margin-top:8px"><a class="boton fantasma chico" id="enlace-video-staff" href="#staff-video" hidden>Ver el video del staff (2 min)</a></div></div>
    <div class="reloj" data-reloj="admin"><span class="fase-actual">Esperando al administrador</span><span class="tiempo">${mmss(FASES_ADMIN[0].dur)}</span></div>
  </div>
  <div class="salas-chips">${lista.map(n => `<button type="button" class="chip" data-staff-sala="${n}" aria-pressed="${estado.staffSala === n}"><span class="letra">${n}</span><span>Sala ${n}</span></button>`).join("")}</div>
</section>
<section class="seccion" id="verif-staff">
  <div class="cabecera"><div><span class="ojo">Sala ${estado.staffSala}</span><h2>Las dos propuestas, en vivo</h2><p class="nota-pie">${LADOS.map(l => `<span class="acento-${l}"><b>${esc(D.lados[l].nombre)}:</b> ${genteDe(estado.staffSala, l).map(p => esc(p.nombre)).join(", ") || "nadie todavía"}</span>`).join(" · ")}</p></div></div>
  ${verificacionHTML(estado.staffSala, null)}
  <div class="panel suave" id="staff-ahora" style="margin-top:12px">${staffAhoraHTML()}</div>
  <div class="panel" id="quien-donde" style="margin-top:12px">${quienDondeHTML()}</div>
</section>
<section class="seccion" id="staff-video" hidden><div class="cabecera"><div><span class="ojo">Dos minutos</span><h2>El video del staff</h2><p class="nota-pie">El caso, dónde entrar y qué hacer en cada etapa: véanlo antes de la clase.</p></div></div><div class="video-intro" id="staff-video-caja"></div></section>
<section class="seccion" id="zoom-salas">${zoomSalasHTML()}</section>
<section class="seccion"><div class="cabecera"><div><span class="ojo">Para entender el juego</span><h2>Las etapas, en orden</h2><p class="nota-pie">Lo que ven los equipos en cada una y lo que hace el staff. La actual está marcada.</p></div></div><div id="etapas-staff">${etapasStaffHTML()}</div></section>
<section class="seccion"><div class="cabecera"><div><span class="ojo">Para resolver dudas</span><h2>Las dos empresas</h2></div></div>${empresasStaffHTML()}</section>
<section class="seccion"><h2>Todas las salas</h2><div id="vivo">${vivoHTML()}</div></section>
<section class="seccion"><h2>Qué toca ahora</h2><div class="cues">${cuesHTML()}</div></section>
<section class="seccion panel suave"><h3>Reglas que vigila el staff</h3><ul class="lista">${D.contexto.reglas.map(r => `<li>${esc(r)}</li>`).join("")}</ul><p class="nota-pie">Dudas de reglas sí; de estrategia no. Si una sala pregunta «¿qué nos conviene?», la respuesta es «pregúntenle a la otra parte para qué lo necesita».</p></section>`;
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
  <p class="entrada">Minuto a minuto, qué se dice y quién lo dice. La consigna tiene que caber en un minuto: lo demás lo hace la web, que lleva a cada equipo por etapas con el reloj del administrador. El administrador lleva el reloj y los avisos desde el <a href="#admin">panel Admin</a>; cada integrante del staff lleva el acta de su sala desde <a href="#staff">Staff</a>.</p>
</section>
<section class="seccion dos">
  <div class="panel"><h3>Roles del grupo</h3><ul class="lista">
    <li><b>Administrador.</b> Abre, lee las reglas, pega el enlace, abre el armado de equipos e inicia el juego, abre las salas en ${esc(videollamada())}, lleva el reloj y los avisos y maneja el tablero de resultados.</li>
    <li><b>Staff, uno por sala.</b> Entra a su sala de la videollamada con la vista Staff en el celular: marca en el acta lo que se va acordando, anota qué pasa (quién preguntó, quién ofreció un cambio) y registra el cierre. Resuelve dudas de reglas, nunca de estrategia.</li>
    <li><b>Revelación.</b> Lee el tablero en voz alta: la ganadora, quién se levantó bien, quién dejó un trato en la mesa, y los apuntes del staff que lo expliquen.</li>
    <li><b>Cierre.</b> Lanza las tres preguntas, conecta con la teoría y da paso a la presentación.</li>
  </ul></div>
  <div class="panel"><h3>Roles en cada pareja</h3><ul class="lista">
    <li><b>Vocero.</b> Habla: abre con la posición, pregunta antes de ofrecer, cambia cada concesión por algo.</li>
    <li><b>Analista.</b> Lleva la cuenta: marca cada propuesta en la mesa, vigila el termómetro contra el plan B, guarda las ofertas y anota qué le importa al otro lado.</li>
    <li>Si alguien queda solo en su lado, elige «Los dos».</li>
  </ul></div>
</section>
<section class="seccion panel">
  <h2>Antes de la clase</h2>
  <ul class="chequeo">
    <li>Pedirle al profe, que es el anfitrión, que haga co-anfitrión al administrador antes de empezar, o que sea él quien abra las salas.</li>
    <li>Crear las ${nombresSalas().length} salas en ${esc(videollamada())} (${nombresSalas().slice(0, 3).map(x => `«${esc(x)}»`).join(", ")}, …: lista completa abajo) con «Permitir que los participantes elijan sala». Los equipos se arman en la web y «Iniciar juego» reparte lados y salas: cada quien entra a la que le dice su pantalla. Un integrante del staff en cada sala.</li>
    <li>Tener la web abierta en tres pestañas: Admin (privada), Entrar (para compartir) y Resultados (para el cierre). El staff abre Staff con la clave y elige su sala.</li>
    <li>Tener listo el mensaje de ingreso (abajo) y probar que el enlace abre en un celular.</li>
    <li>Compartir la ventana del navegador, no la pantalla completa.</li>
    <li>Tener las fichas en PDF a mano por si la web falla: se mandan por el chat de cada sala.</li>
    <li>Ensayar una vez con reloj y con el tablero en vivo. Lo que no cabe en el tiempo se recorta antes, no en vivo.</li>
  </ul>
</section>
<section class="seccion">${zoomSalasHTML()}</section>
<section class="seccion">
  <h2>Minuto a minuto</h2>
  <div class="linea-tiempo panel">
    <div class="minuto"><span class="cuando">${mmss(0)}</span><div><b>Consigna · ${minutos(t.consigna)}</b><p>Compartir la pantalla de Entrar. Leer el caso en dos frases y las cuatro reglas. Pegar el mensaje de ingreso. Abrir el armado de equipos cuando estén todos, iniciar el juego, abrir las salas.</p>
      <div class="dice">«Van a negociar un contrato real entre una agencia y un cliente, dos contra dos. Cada lado tiene información privada que el otro no conoce. En cada pareja, uno habla y el otro lleva la cuenta. Tienen ${minutos(t.preparacion)} para prepararse y ${minutos(t.negociacion)} para cerrar. Gana la sala donde las dos partes salgan mejor, no la que más exprima al otro. Si no cierran, cada quien se queda con su plan B, y también evaluamos eso. Entren al enlace y escriban su nombre.»</div></div></div>
    <div class="minuto"><span class="cuando">${mmss(t.consigna)}</span><div><b>Preparación · ${minutos(t.preparacion)}</b><p>Salas abiertas. La web pone a cada pareja en Prepararse: seis pasos con el caso, quiénes son, sus intereses, su tabla y plan B, la hoja de preparación y su rol, con el tutorial animado. El staff elige su sala en la vista Staff y resuelve dudas de reglas. Aviso a las salas a los 30 segundos del final.</p></div></div>
    <div class="minuto"><span class="cuando">${mmss(inicioNeg)}</span><div><b>Negociación · ${minutos(t.negociacion)}</b><p>La web abre la mesa: la escena con los cuatro sentados, las rondas, los temas y el termómetro. El analista de cada lado marca las propuestas y guarda ofertas; el staff marca en el acta lo acordado y anota qué pasa. Avisos a las salas a los 3 minutos y al último minuto.</p></div></div>
    <div class="minuto"><span class="cuando">${mmss(inicioCierre)}</span><div><b>Cierre · ${minutos(t.cierre)}</b><p>La web pasa a los equipos a Cerrar: trato hecho con los cinco temas (se dan la mano), o sin acuerdo con la última propuesta y quién la rechazó (se levantan de la mesa). El staff registra el cierre desde el acta. Cerrar las salas con la cuenta regresiva.</p></div></div>
    <div class="minuto"><span class="cuando">${mmss(inicioDebrief)}</span><div><b>Resultados · ${minutos(t.debrief)}</b><p>Resultados ya tiene el ranking con lo que registró cada sala. Nombrar la sala ganadora y leer su trato en voz alta. Si hubo salas sin acuerdo, decir cuáles se levantaron con razón y cuáles dejaron un trato en la mesa; los apuntes del staff cuentan por qué. Pulsar «Revelar los intereses»: cada equipo ve en su pantalla los puntos del otro lado, su índice y su puesto. Cerrar con las tres preguntas; recoger dos respuestas en voz.</p>
      <div class="dice">«La sala que ganó no fue la que consiguió el mejor precio. Fue la que preguntó para qué necesitaba el otro lo que pedía.»</div></div></div>
    <div class="minuto"><span class="cuando">${mmss(fin)}</span><div><b>Fin</b><p>De aquí en adelante sigue la presentación: la actividad ya puso en la mesa los seis puntos de la CEP.</p></div></div>
  </div>
</section>
<section class="seccion">
  <h2>Mensajes listos para pegar</h2>
  <div class="mensajes">${lista.map(([tt, m]) => `<div class="mensaje"><div><span class="ojo">${esc(tt)}</span><br><code>${esc(m)}</code></div><button type="button" class="boton chico" data-copiar="${esc(m)}">Copiar</button></div>`).join("")}</div>
  <p class="nota-pie">Los avisos a las salas van por «Transmitir mensaje a todas las salas», en el panel de salas de ${esc(videollamada())}. En el panel Admin aparecen en el momento justo.</p>
</section>
<section class="seccion dos">
  <div class="panel"><h3>Qué muestra la actividad de la CEP</h3><ul class="lista">
    <li><b>Concepto y ganar-ganar.</b> El índice premia a la sala donde los dos salen bien.</li>
    <li><b>Importancia.</b> El precio era menos de la mitad del valor en juego.</li>
    <li><b>Perfil del negociador.</b> Las salas que escucharon y preguntaron encontraron los intercambios.</li>
    <li><b>Posición contra interés.</b> «2 semanas» contra «la inauguración en cinco».</li>
    <li><b>Actividades para fomentarla.</b> La hoja de preparación, los roles y el plan B antes de hablar.</li>
    <li><b>Campos de aplicación.</b> Fue cliente y proveedor; la misma lógica sirve con socios y con el equipo.</li>
  </ul></div>
  <div class="panel suave"><h3>Si algo falla</h3><ul class="lista">
    <li><b>El tablero en vivo no conecta.</b> No pasa nada: cada equipo lleva su propio reloj desde Prepararse y ve su código al cerrar; una persona por sala lo pega en el chat y Resultados lo lee pegado (respaldo).</li>
    <li><b>La web no abre.</b> Mandar las fichas en PDF por el chat de cada sala. El staff lleva el acta en papel y dice los tratos en voz alta al volver; el administrador los mete a mano en el tablero.</li>
    <li><b>No se pueden abrir salas.</b> Modo pecera: dos parejas negocian en la sala principal con cámara, el resto observa y anota en el chat qué preguntas hicieron. Dura lo mismo.</li>
    <li><b>Van tarde.</b> Preparación de 2 minutos y negociación de 5, con «Siguiente fase» en el panel Admin. El resto igual.</li>
  </ul></div>
</section>`;
  }

  /* ---------- enrutador ---------- */
  const tooltip = document.createElement("div"); tooltip.className = "tooltip"; tooltip.hidden = true; document.body.appendChild(tooltip);
  function render() {
    let ruta = (location.hash || "#entrar").replace(/^#\/?/, "") || "entrar";
    ruta = ALIAS[ruta] || ruta;
    const vistas = { entrar: vistaEntrar, preparar: vistaPreparar, negociar: vistaNegociar, cerrar: vistaCerrar, resultado: vistaResultado, resultados: vistaResultados, admin: vistaAdmin, staff: vistaStaff, guion: vistaGuion };
    if (!vistas[ruta]) ruta = "entrar";
    if (ETAPAS.some(e => e.id === ruta) && bloqueada(ruta)) { avisar(motivoBloqueo(ruta)); ruta = etapaSugerida(); if (bloqueada(ruta)) ruta = "entrar"; }
    if ("#" + ruta !== location.hash) history.replaceState(null, "", "#" + ruta);
    rutaActual = ruta; firmaEscena = "";
    if (ruta === "entrar") { seleccion.sala = estado.sala; seleccion.lado = estado.lado; }
    if (Tutorial.abierto()) Tutorial.cerrar();
    app.innerHTML = VISTAS_FACILITADOR.includes(ruta) && !tieneClave() ? vistaClave(ruta) : vistas[ruta]();
    tooltip.hidden = true;
    pintarHUD(); tick();
    if (VISTAS_FACILITADOR.includes(ruta) && estado.nombre && enVivo()) { Sync.fijar("jugadores/" + idPestana, null); if (estado.sala) despedirse(estado.sala); }   // el facilitador deja su asiento
    if (ruta === "entrar") { actualizarBotonEntrar(); const n = document.getElementById("nombre"); if (n && !estado.nombre) n.focus(); }
    if (ruta === "preparar") {
      if (!estado.entrado) { estado.entrado = Date.now(); guardarS("entrado", estado.entrado); }
      reportar({ fase: estado.cerrado ? "cerrado" : "ficha", entrado: estado.entrado, propuesta: propuestaActual(), rol: estado.rol }); anunciar();
      if (!leerS("tutoVisto", false)) { guardarS("tutoVisto", true); setTimeout(() => Tutorial.abrir(estado.rol, estado.lado, () => marcarPaso("rol")), 400); }
    }
    if (ruta === "negociar") {
      if (RELOJES.admin.remoto === undefined && !RELOJES.equipo.inicio) RELOJES.equipo.fijar(Date.now() - D.tiempos.preparacion * 1000);   // sin administrador: la mesa arranca su propio reloj
      const suma = actualizarCalculadora(); reportar({ fase: estado.cerrado ? "cerrado" : "mesa", propuesta: propuestaActual(), puntos: suma }); pintarLaboratorio(); pintarEscena(); Escena.inclinar(document.getElementById("escena-caja")); anunciar();
    }
    if (ruta === "cerrar") { pintarEscena(); Escena.inclinar(document.getElementById("escena-caja")); if (estado.cerrado) reportar({ fase: "cerrado" }); }
    if (ruta === "resultados") calcular();
    window.scrollTo({ top: 0 });
  }
  function marcarPaso(id) {
    if (!estado.prepVistos.includes(id)) { estado.prepVistos.push(id); guardarS("prepVistos", estado.prepVistos); }
    const d = document.querySelector(`.paso[data-paso="${id}"]`); if (d) d.classList.add("lista");
    const conteo = document.getElementById("prep-conteo"); if (conteo) { const pasos = pasosPrep(); const listos = pasos.filter(p => p.hecha || estado.prepVistos.includes(p.id)).length; conteo.textContent = listos + " de " + pasos.length; const barra = document.querySelector(".progreso-prep .lleno"); if (barra) barra.style.width = Math.round(listos / pasos.length * 100) + "%"; }
  }
  let codigosPublicados = null;
  function calcular() {
    const zona = document.getElementById("tablero"); if (!zona) return;
    if (enVivo() && !estado.manualResultados) {
      estado.chat = codigosEnVivo(tiempoAgotado()).codigos.join("\n"); guardar("chat", estado.chat);
      const ta = document.getElementById("chat"); if (ta && document.activeElement !== ta) ta.value = estado.chat;
    }
    const { filas, errores } = parsearCodigos(estado.chat);
    const h = tableroHTML(ordenar(filas), errores); if (zona.innerHTML !== h) zona.innerHTML = h;
    const r = document.getElementById("resumen-vivo"); if (r) { const rh = resumenVivoHTML(); if (r.innerHTML !== rh) r.innerHTML = rh; }
    publicarCodigos(estado.chat);
  }
  /* El ranking que ven los equipos (su puesto) sale de config/codigos: lo publica Resultados al calcular y
     también «Revelar» desde Admin, para que no dependa de tener abierta la pestaña Resultados. */
  function publicarCodigos(codigos) {
    if (!(enVivo() && tieneClave()) || codigos === codigosPublicados) return;
    codigosPublicados = codigos; Sync.fijar("config/codigos", codigos || "");
  }
  function agregarCodigo(codigo) {
    estado.chat = (estado.chat ? estado.chat.trimEnd() + "\n" : "") + codigo; guardar("chat", estado.chat);
    document.getElementById("chat").value = estado.chat; calcular(); avisar(codigo + " agregado");
  }
  function sentarse(sala, lado, rol) {
    const anterior = leerS("sala", null), ladoAnterior = leerS("lado", null);
    if (anterior && (anterior !== sala || ladoAnterior !== lado)) { despedirse(anterior); if (ladoAnterior) Sync.fijar("salas/" + anterior + "/" + ladoAnterior, null); }
    if (anterior !== sala) { estado.trato = {}; estado.cerrado = null; estado.entrado = null; estado.registro = []; estado.avisadas = []; ["trato", "cerrado", "entrado", "registro", "avisadas"].forEach(k => guardarS(k, null)); }
    estado.sala = sala; estado.lado = lado; if (rol) estado.rol = rol;
    guardarS("sala", sala); guardarS("lado", lado); guardarS("rol", estado.rol);
    if (!estado.entrado) { estado.entrado = Date.now(); guardarS("entrado", estado.entrado); }
    anunciar(); reportar({ fase: "sentado", entrado: estado.entrado, rol: estado.rol, propuesta: propuestaActual() });
    if (bloqueada("preparar")) { if (location.hash !== "#entrar") location.hash = "#entrar"; else render(); if (!enVivo()) avisar("Listo. Esperá a que el administrador abra la preparación."); }
    else if (location.hash !== "#preparar") location.hash = "#preparar"; else render();
  }
  function salirDeSala() {
    despedirse(estado.sala); if (estado.sala && estado.lado) Sync.fijar("salas/" + estado.sala + "/" + estado.lado, null);
    estado.sala = null; estado.lado = null; estado.trato = {}; estado.cerrado = null; estado.entrado = null; estado.registro = []; estado.avisadas = [];
    ["sala", "lado", "trato", "cerrado", "entrado", "registro", "avisadas"].forEach(k => guardarS(k, null));
    seleccion.sala = null; seleccion.lado = null;
    anunciar(); location.hash = "#entrar"; render();
  }

  /* ---------- eventos ---------- */
  app.addEventListener("submit", e => {
    if (e.target.id === "form-nombre") {
      e.preventDefault();
      const nombre = document.getElementById("nombre").value.trim();
      if (!nombre) { avisar("Escribí tu nombre."); return; }
      estado.nombre = nombre; guardarS("nombre", nombre);
      if (!estado.entradoPlataforma) { estado.entradoPlataforma = Date.now(); guardarS("entradoPlataforma", estado.entradoPlataforma); }
      anunciar(); render(); avisar("¡Bienvenido, " + nombre.split(/\s+/)[0] + "!");
    }
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
  document.addEventListener("click", e => {
    const b = e.target.closest("button, a, [role='button']"); if (!b) return;
    if (b.dataset.tutorial !== undefined) { Tutorial.abrir(estado.rol, estado.lado, () => { if (rutaActual === "preparar") marcarPaso("rol"); }); return; }
    if (b.dataset.etapa && b.getAttribute("aria-disabled") === "true") { e.preventDefault(); avisar(motivoBloqueo(b.dataset.etapa)); return; }
    if (!app.contains(b)) return;
    if (b.dataset.sacar) { sacar(b.dataset.sacar); avisar("Sacando a " + (b.dataset.nombre || "la persona") + "…"); return; }
    if (b.dataset.unirmeEquipo) { if (!armado()) { avisar("Todavía no se abrió el armado de equipos."); return; } estado.equipo = parseInt(b.dataset.unirmeEquipo, 10); guardarS("equipo", estado.equipo); estado.equipoArmado = armado().abierto; guardarS("equipoArmado", estado.equipoArmado); anunciar(); pintarHub(); return; }
    if (b.dataset.salirEquipo) { estado.equipo = null; guardarS("equipo", null); Sync.fijar("jugadores/" + idPestana + "/equipo", null); anunciar(); pintarHub(); return; }
    if (b.dataset.elegirSala) { seleccion.sala = parseInt(b.dataset.elegirSala, 10); seleccion.lado = b.dataset.elegirLado; pintarLobby(); return; }
    if (b.dataset.rol && !b.id) { estado.rol = b.dataset.rol; document.querySelectorAll(".rol-boton").forEach(x => x.setAttribute("aria-pressed", String(x === b))); actualizarBotonEntrar(); return; }
    if (b.dataset.tab) { document.querySelectorAll(".tab").forEach(x => x.setAttribute("aria-selected", String(x === b))); document.querySelectorAll(".panel-tab").forEach(p => { p.hidden = p.dataset.panel !== b.dataset.tab; }); return; }
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
    if (b.dataset.staffSala) { estado.staffSala = parseInt(b.dataset.staffSala, 10); guardar("staffSala", estado.staffSala); render(); return; }
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
      case "btn-palabra": {
        const s = (vivo.salas || {})[estado.sala] || {}, mia = s.palabra && s.palabra.id === idPestana;
        Sync.fijar("salas/" + estado.sala + "/palabra", mia ? null : { id: idPestana, lado: estado.lado, nombre: estado.nombre, ts: Date.now() }); break;
      }
      case "btn-asignacion": sentarse(parseInt(b.dataset.sala, 10), b.dataset.lado, b.dataset.rol || "ambos"); break;
      case "btn-arrancar": if (!RELOJES.admin.inicio) { RELOJES.admin.alternar(); avisar("Reloj en marcha: los equipos pasan a Prepararse."); } break;
      case "btn-entrar": {
        if (!estado.nombre) { avisar("Escribí tu nombre primero."); return; }
        if (!(seleccion.sala && seleccion.lado)) { avisar("Tocá el lado de tu sala en el tablero."); return; }
        sentarse(seleccion.sala, seleccion.lado, estado.rol); break;
      }
      case "btn-listo": { estado.listo = Date.now(); guardarS("listo", estado.listo); anunciar(); render(); avisar("Listo. Cuando estén todos, el administrador abre los equipos."); break; }
      case "btn-cambiar-nombre": { if (estado.sala) despedirse(estado.sala); Sync.fijar("jugadores/" + idPestana, null); estado.nombre = ""; guardarS("nombre", null); render(); break; }
      case "btn-salir": salirDeSala(); break;
      case "btn-cerrar": case "btn-cerrar-2": { const letras = letrasActuales(); if (!letras.every(Boolean)) return; if (!puedeCerrarAhora()) { avisar("Las propuestas de los dos equipos no coinciden todavía."); pintarVerificacion(); return; } cerrarCon({ letras }); break; }
      case "btn-sin": case "btn-sin-2": abrirPanelSin(); break;
      case "btn-sin-volver": document.getElementById("panel-sin").hidden = true; break;
      case "btn-reabrir": estado.cerrado = null; guardarS("cerrado", null); Sync.fijar("salas/" + estado.sala + "/cierre", null); firmaEscena = ""; if (location.hash !== "#negociar") location.hash = "#negociar"; else render(); break;
      case "btn-copiar": copiar(document.getElementById("codigo-texto").textContent.trim(), document.getElementById("codigo-texto")); break;
      case "btn-acta-cerrar": { const acta = actaDe(estado.staffSala), letras = D.temas.map((t, i) => acta.temas[i] || null); if (!letras.every(Boolean)) return; cerrarActa({ letras }); break; }
      case "btn-acta-sin": document.getElementById("acta-panel-sin").hidden = false; break;
      case "btn-acta-reabrir": { const n = estado.staffSala, acta = actaDe(n); delete acta.cierre; if (estado.actas[n]) delete estado.actas[n].cierre; guardar("actas", estado.actas); Sync.fijar("salas/" + n + "/cierre", null); Sync.fijar("salas/" + n + "/acta", acta); pintarActa(); break; }
      case "btn-calcular": estado.chat = document.getElementById("chat").value; guardar("chat", estado.chat); if (enVivo() && !estado.manualResultados && estado.chat.trim()) { estado.manualResultados = true; guardar("manualResultados", true); render(); return; } calcular(); break;
      case "btn-ejemplo": estado.chat = D.ejemplo.map(x => x.codigo).join("\n"); guardar("chat", estado.chat); if (enVivo()) { estado.manualResultados = true; guardar("manualResultados", true); } render(); break;
      case "btn-limpiar": estado.chat = ""; guardar("chat", ""); if (enVivo()) { estado.manualResultados = false; guardar("manualResultados", false); } render(); break;
      case "btn-manual": case "btn-manual-sin": case "btn-manual-sin-nada": {
        const sala = parseInt(document.getElementById("man-sala").value, 10); if (!(sala > 0)) { avisar("Falta el número de sala."); return; }
        const letras = D.temas.map((t, i) => document.getElementById("man-" + i).value);
        const cierre = b.id === "btn-manual" ? { letras } : b.id === "btn-manual-sin" ? { letras: null, ultima: letras, quien: null } : { letras: null, ultima: null, quien: null };
        if (enVivo() && !estado.manualResultados) { estado.manualResultados = true; guardar("manualResultados", true); }
        agregarCodigo(codigoDe(sala, cierre)); break;
      }
      case "btn-revelar": { const nuevo = !revelado(); estado.revelar = nuevo; guardar("revelar", nuevo); if (enVivo()) { if (nuevo && !estado.manualResultados) publicarCodigos(codigosEnVivo(tiempoAgotado()).codigos.join("\n")); Sync.fijar("config/revelar", { on: nuevo, ts: Date.now() }); } render(); if (nuevo) { const r = document.getElementById("revelacion"); if (r) r.scrollIntoView(); } break; }
      case "btn-probar": {
        if (!enVivo()) { avisar("No hay tablero en vivo configurado."); return; }
        const t0 = Date.now(); let listo = false;
        const quitar = Sync.escuchar("config/prueba", v => { if (v === t0 && !listo) { listo = true; avisar("Conexión OK: ida y vuelta en " + (Date.now() - t0) + " ms"); setTimeout(quitar, 0); } });
        Sync.fijar("config/prueba", t0);
        setTimeout(() => { if (!listo) { avisar("Sin respuesta en 8 s: revise la conexión con el servidor."); quitar(); } }, 8000);
        break;
      }
      case "btn-abrir-armado": if (abrirArmado()) avisar("Hub de equipos abierto para todos."); break;
      case "btn-acomodar": { const k = acomodar(); avisar(k ? k + (k === 1 ? " persona acomodada" : " personas acomodadas") : "No hay a quién acomodar o no queda espacio."); break; }
      case "btn-iniciar-juego": if (iniciarJuego()) avisar("Juego iniciado: cada equipo ve su sala y su lado."); break;
      case "btn-reiniciar": document.getElementById("confirmar-reinicio").hidden = false; break;
      case "btn-reiniciar-no": document.getElementById("confirmar-reinicio").hidden = true; break;
      case "btn-reiniciar-si": { const id = sacarATodos(); setTimeout(() => { Sync.borrarTodo(); Sync.fijar("config/expulsion", { id, ts: Date.now() }); }, 900); RELOJES.admin.fijar(null); vivo.salas = {}; vivo.jugadores = {}; vivo.config = {}; estado.actas = {}; guardar("actas", null); estado.revelar = false; guardar("revelar", false); estado.manualResultados = false; guardar("manualResultados", false); estado.chat = ""; guardar("chat", ""); codigosPublicados = null; estado.equipo = null; guardarS("equipo", null); document.getElementById("confirmar-reinicio").hidden = true; pintarVivo(); avisar("Sesión reiniciada: todos vuelven a la pantalla del nombre"); break; }
      case "btn-sacar-todos": document.getElementById("confirmar-sacar").hidden = false; break;
      case "btn-sacar-no": document.getElementById("confirmar-sacar").hidden = true; break;
      case "btn-sacar-si": sacarATodos(); document.getElementById("confirmar-sacar").hidden = true; avisar("Todos fuera: vuelven a la pantalla del nombre."); break;
    }
  });
  app.addEventListener("change", e => {
    const r = e.target;
    if (r.id === "chk-manual") { estado.manualResultados = r.checked; guardar("manualResultados", r.checked); render(); return; }
    if (r.name && r.name.startsWith("tema-")) { estado.trato[parseInt(r.name.slice(5), 10)] = r.value; guardarS("trato", estado.trato); const suma = actualizarCalculadora(); reportar({ fase: "mesa", propuesta: propuestaActual(), puntos: suma }); }
  });
  app.addEventListener("toggle", e => { const d = e.target; if (d.classList && d.classList.contains("paso") && d.open && d.dataset.paso !== "hoja") marcarPaso(d.dataset.paso); }, true);
  let temporizadorPrep = null;
  app.addEventListener("input", e => {
    const t = e.target;
    if (t.dataset.prep) {
      const notas = leerS("prep." + estado.lado, {}); notas[t.dataset.prep] = t.value; guardarS("prep." + estado.lado, notas);
      clearTimeout(temporizadorPrep); temporizadorPrep = setTimeout(() => { const n = Object.values(notas).filter(v => v && v.trim()).length; reportar({ prep: n }); if (n >= 2) marcarPaso("hoja"); const est = document.querySelector('.paso[data-paso="hoja"] .paso-estado'); if (est) est.textContent = n >= 2 ? "lista" : n + "/3 respuestas"; }, 500);
    }
    if (t.id === "chat") { estado.chat = t.value; guardar("chat", estado.chat); if (enVivo() && !estado.manualResultados) { estado.manualResultados = true; guardar("manualResultados", true); const c = document.getElementById("chk-manual"); if (c) c.checked = true; } }
  });
  document.addEventListener("keydown", e => { const b = e.target.closest && e.target.closest("[role='button']"); if (b && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); b.click(); } });
  /* tooltip del gráfico */
  const mostrarTip = (el, x, y) => { tooltip.textContent = el.dataset.tip; tooltip.hidden = false; tooltip.style.left = Math.min(x + 12, innerWidth - 250) + "px"; tooltip.style.top = (y + 12) + "px"; };
  const conTip = el => el.closest && el.closest(".punto, .ultima");
  app.addEventListener("mouseover", e => { const p = conTip(e.target); if (p) mostrarTip(p, e.clientX, e.clientY); });
  app.addEventListener("mousemove", e => { const p = conTip(e.target); if (p) mostrarTip(p, e.clientX, e.clientY); });
  app.addEventListener("mouseout", e => { if (conTip(e.target)) tooltip.hidden = true; });
  app.addEventListener("focusin", e => { const p = conTip(e.target); if (p) { const r = p.getBoundingClientRect(); mostrarTip(p, r.left, r.top); } });
  app.addEventListener("focusout", e => { if (conTip(e.target)) tooltip.hidden = true; });

  /* ---------- en vivo: suscripciones ---------- */
  Sync.alCambiar(c => { vivo.conexion = c; pintarVivo(); pintarConectados(); });
  Sync.escuchar("config", v => {
    v = v || {}; vivo.config = v;
    const inicio = v.reloj && v.reloj.inicio ? v.reloj.inicio : null;
    if (Sync.estado().modo === "nada") { RELOJES.equipo.remoto = undefined; RELOJES.admin.remoto = undefined; }
    else { RELOJES.equipo.remoto = inicio ? inicio + D.tiempos.consigna * 1000 : null; RELOJES.admin.remoto = inicio; }
    vivo.reloj = v.reloj || null; tick();
    const ex = v.expulsion && v.expulsion.id;
    if (ex && ex !== estado.expulsionVista) {
      const primeraVez = estado.expulsionVista === null && !estado.nombre;   // una pestaña recién abierta solo toma nota
      estado.expulsionVista = ex; guardarS("expulsionVista", ex);
      if (!primeraVez && !VISTAS_FACILITADOR.includes(rutaActual)) expulsar("El administrador reinició la actividad. Volvé a escribir tu nombre cuando te lo indique.");
    }
    if (rutaActual === "resultado" || rutaActual === "resultados" || rutaActual === "admin") { const rev = revelado(); if (rev !== (app.dataset.revelado === "1")) { app.dataset.revelado = rev ? "1" : "0"; if (rutaActual === "admin") pintarVivo(); else render(); } }
    if (rutaActual === "entrar") { const firmaArmado = armado() ? String(armado().abierto) : ""; if (app.dataset.armado !== firmaArmado) { app.dataset.armado = firmaArmado; if (estado.nombre) render(); } }
  });
  Sync.escuchar("salas", v => { vivo.salas = v || {}; limpiarAsientos(); pintarVivo(); pintarPresencia(); pintarEscena(); pintarVerificacion(); pintarQuienDonde(); if (rutaActual === "entrar") pintarLobby(); if (rutaActual === "staff") pintarActa(); if (rutaActual === "resultados") calcular(); });
  let asignacionVista = null;
  Sync.escuchar("jugadores", v => {
    vivo.jugadores = v || {}; pintarConectados(); if (rutaActual === "admin") pintarVivo(); if (rutaActual === "entrar") { pintarHub(); pintarListos(); }
    const yo = vivo.jugadores[idPestana];
    if (yo && yo.expulsado && yo.expulsado !== estado.expulsionVista && !VISTAS_FACILITADOR.includes(rutaActual)) { estado.expulsionVista = yo.expulsado; guardarS("expulsionVista", yo.expulsado); expulsar("El administrador te sacó de la actividad."); return; }
    const mia = vivo.jugadores[idPestana] && vivo.jugadores[idPestana].asignacion;
    const firma = mia ? mia.sala + "/" + mia.lado + "/" + mia.ts : null;
    if (firma && firma !== asignacionVista && (mia.sala !== estado.sala || mia.lado !== estado.lado || (mia.rol && mia.rol !== estado.rol))) {
      asignacionVista = firma;
      if (mia.equipo) { estado.equipo = mia.equipo; guardarS("equipo", mia.equipo); }
      if (!VISTAS_FACILITADOR.includes(rutaActual)) {
        sentarse(mia.sala, mia.lado, mia.rol || "ambos");
        transicion("Sala " + mia.sala + " · " + D.lados[mia.lado].rol, indicacionSala(mia.sala, mia.lado) + " Ustedes son " + D.lados[mia.lado].nombre + "; tu rol: " + (ROLES[mia.rol] || ROLES.ambos).nombre + ".", "menta");
      }
    } else if (firma) asignacionVista = firma;
  });
  if (estado.nombre) anunciar();
  window.addEventListener("hashchange", render);
  // El video del staff es opcional: el enlace aparece solo si el servidor lo tiene.
  let videoStaffExiste = null;
  function mostrarVideoStaff() {
    const a = document.getElementById("enlace-video-staff"), sec = document.getElementById("staff-video"), caja = document.getElementById("staff-video-caja");
    if (!a || !sec) return;
    const pintar = () => {
      a.hidden = !videoStaffExiste; sec.hidden = !videoStaffExiste;
      if (videoStaffExiste && caja && !caja.firstChild) caja.innerHTML = `<video id="video-staff" controls playsinline preload="metadata" poster="${conVersion("video/staff-poster.jpg")}"><source src="${conVersion("video/staff.mp4")}" type="video/mp4"><track kind="subtitles" srclang="es" label="Español" src="${conVersion("video/staff.vtt")}" default>Tu navegador no reproduce el video.</video>`;
    };
    if (videoStaffExiste !== null) { pintar(); return; }
    fetch("video/staff.mp4", { method: "HEAD" }).then(r => { videoStaffExiste = r.ok; pintar(); }).catch(() => { videoStaffExiste = false; });
  }
  setInterval(mostrarVideoStaff, 1000); mostrarVideoStaff();
  document.getElementById("aviso-sala").addEventListener("click", ocultarAvisoSala);
  window.addEventListener("pagehide", despedidaInmediata);
  render();

  /* para puntuar desde la consola o desde pruebas */
  window.TratoHecho = { evaluar, parsearCodigos, ordenar, mejorTrato, frontera, puntos, codigoDe, estadoSala, estadoLaboratorio, rondaActual, faseActual, etapaSugerida, bloqueada, acomodar, iniciarJuego };
})();
