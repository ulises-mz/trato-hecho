/* El tutorial: «¿Cómo se juega?», seis escenas con componentes de la propia web en miniatura,
   animados en bucle, y una línea de «tu trabajo» según el rol. Se abre como ventana encima de
   todo y avanza solo cada 8 s; se puede saltar, ir y volver. Sin dependencias. */
(function () {
  "use strict";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const D = () => window.DATOS;
  function escenas(rol, lado) {
    const L = lado && D().lados[lado]; const planB = L ? L.planB.puntos : 40;
    const t0 = D().temas[0];
    const chips = t0.opciones.slice(0, 3).map((o, k) => `<span class="chip ${k === 1 ? "m-b" : ""}"><span class="letra">${o.letra}</span><span>${esc(o.texto)}</span>${L ? `<span class="pts">+${o[lado]}</span>` : ""}</span>`).join("");
    const trabajo = {
      marcar: { vocero: "Vos hablás; tu analista marca lo que se dice. Si estás solo, marcá vos entre frase y frase.", analista: "Este es tu tablero: cada vez que alguien proponga algo, marcalo. Así ven al instante cuánto vale para ustedes.", ambos: "Marcá cada propuesta que se diga, incluso las de ellos: así ves cuánto vale para ustedes." },
      termometro: { vocero: "Mirá el termómetro de reojo antes de decir que sí: por debajo del plan B, no hay trato.", analista: "Es tu brújula: verde, pueden cerrar; rojo, avisale al vocero que no acepte.", ambos: "Verde, pueden cerrar. Rojo, mejor levantarse: el plan B vale más." },
      ofertas: { vocero: "Cada vez que ofrezcas algo completo, pedile al analista que lo guarde como «nuestra oferta».", analista: "Guardá cada oferta: las suyas y las de ellos. El registro es la memoria de la mesa y cuenta misiones.", ambos: "Guardá cada oferta completa que se diga: la de ustedes y la de ellos." },
      preguntar: { vocero: "Tu pregunta más poderosa: «¿para qué lo necesitan así?». Lo que respondan vale más que cualquier cifra.", analista: "Cuando el otro lado explique por qué quiere algo, anotalo con un toque: «Les importa…».", ambos: "Preguntá para qué, y anotá lo que descubras con un toque." },
      cerrar: { vocero: "Si las dos partes dicen «trato hecho», confirmalo en Cerrar. Si lo que hay es peor que su plan B, levantate: también es negociar bien.", analista: "En Cerrar se confirma el trato con los cinco temas, o se registra «sin acuerdo» con la última propuesta y quién la rechazó.", ambos: "Trato hecho si supera su plan B y las dos partes están de acuerdo; si no, sin acuerdo con la última propuesta." },
      rol: { vocero: "Vos sos el vocero: hablás, preguntás y cambiás cada concesión por algo.", analista: "Vos sos el analista: marcás, vigilás el termómetro, guardás ofertas y le soplás al vocero por chat privado.", ambos: "Hacés las dos cosas: hablá, y entre frase y frase marcá y mirá el termómetro." }
    };
    const T = k => trabajo[k][rol] || trabajo[k].ambos;
    return [
      { titulo: "Marcá lo que se dice", texto: "La mesa tiene cinco temas y cada tema tiene opciones con letra. Cuando alguien propone algo, se toca la opción y la web dice cuánto vale para ustedes. Los puntos son privados: el otro lado tiene otra tabla.", trabajo: T("marcar"),
        demo: `<div class="mini"><div class="mini-clausula"><div class="clausula-cab"><span class="n">01</span><h3>${esc(t0.nombre)}</h3></div><div class="chips">${chips}</div><span class="flota-pts">+${L ? t0.opciones[1][lado] : 26}</span></div></div><span class="mano m-tap">${window.Iconos.svg("tap", "ico-grande")}</span>` },
      { titulo: "Mirá el termómetro", texto: `Suma los puntos de lo marcado. La raya es su plan B (${planB}): la alternativa que tienen si no hay trato. Por debajo de esa raya, el trato no les conviene y no cuenta.`, trabajo: T("termometro"),
        demo: `<div class="mini mini-term"><div class="termometro"><div class="termometro-cab"><div class="total">64<small>de 100 para ustedes</small></div><span class="nota-pie">plan B: ${planB}</span></div><div class="barra-pts"><div class="lleno" style="width:18%"></div><div class="marca" style="left:calc(${planB}% - 2px)"></div></div><div style="position:relative;height:34px;margin-top:14px"><div class="veredicto v-antes">Faltan 2 temas por acordar</div><div class="veredicto ok v-despues">Supera su plan B por ${64 - planB}</div></div></div></div>` },
      { titulo: "Guardá cada oferta", texto: "Cuando ustedes proponen un paquete completo, lo guardan como «nuestra oferta»; cuando lo propone el otro lado, como «oferta de ellos». El registro es la memoria de la mesa y cumple misiones.", trabajo: T("ofertas"),
        demo: `<div class="mini mini-registro"><div class="registro"><div class="registro-item nuestra"><span class="t">17:04</span><span><b>Nuestra oferta</b> · <code>EDCAB</code></span><span class="pts">61 pts</span></div><div class="registro-item ellos"><span class="t">17:06</span><span><b>Oferta de ellos</b> · <code>ABADD</code></span><span class="pts">33 pts</span></div><div class="registro-item nuestra"><span class="t">17:08</span><span><b>Nuestra oferta</b> · <code>BEDCD</code></span><span class="pts">71 pts</span></div></div></div>` },
      { titulo: "Preguntá para qué", texto: "La jugada que gana: antes de ofrecer, preguntar para qué necesita el otro lado lo que pide. Detrás de cada posición hay un interés, y ahí está el valor escondido. Lo que descubran, lo anotan con un toque.", trabajo: T("preguntar"),
        demo: `<div class="mini mini-dialogo"><div class="globo izq">«¿Para qué lo necesitan en 2 semanas?»</div><div class="globo der">«Para tener el menú listo el día de la inauguración…»</div><div class="globo izq">«¿Y si entregamos el menú primero y el resto después?»</div><span class="nota-vuela preset">${window.Iconos.svg("note")} Les importa el plazo</span></div>` },
      { titulo: "Cerrá o levantate", texto: "Cuando las dos partes dicen «trato hecho», se confirma con los cinco temas y sale un código como S3-BEDCD. Si no hay acuerdo, cada parte se queda con su plan B y se registra la última propuesta y quién la rechazó: levantarse también se evalúa.", trabajo: T("cerrar"),
        demo: `<div class="mini mini-cierre"><div class="opcion si"><span class="emoji">${window.Iconos.svg("handshake", "ico-grande")}</span><b>Trato hecho</b><code>S3-BEDCD</code><span class="nota-pie">se dan la mano</span></div><div class="opcion no"><span class="emoji">${window.Iconos.svg("exit", "ico-grande")}</span><b>Sin acuerdo</b><code>S3-SIN-EDCAB-C</code><span class="nota-pie">se levantan de la mesa</span></div></div>` },
      { titulo: "Tu rol en la pareja", texto: "En cada lado uno habla y el otro lleva la cuenta. El vocero abre con la posición, pregunta y cambia cada concesión por algo; el analista marca, vigila el termómetro y guarda las ofertas. Se avisan por el chat privado de Zoom.", trabajo: T("rol"),
        demo: `<div class="mini mini-roles"><div class="rol-card ${rol === "vocero" || rol === "ambos" ? "mio" : ""}"><span class="emoji">${window.Iconos.svg("mic", "ico-grande")}</span><b>Vocero</b><ul><li>Abre con la posición inicial</li><li>Pregunta antes de ofrecer</li><li>Cambia cada concesión por algo</li></ul></div><div class="rol-card ${rol === "analista" || rol === "ambos" ? "mio" : ""}"><span class="emoji">${window.Iconos.svg("calc", "ico-grande")}</span><b>Analista</b><ul><li>Marca cada propuesta</li><li>Vigila el termómetro</li><li>Guarda ofertas y apuntes</li></ul></div></div>` }
    ];
  }
  let actual = 0, lista = [], temporizador = null, alCerrar = null;
  function pintar() {
    const caja = document.getElementById("tutorial"); if (!caja) return;
    const e = lista[actual];
    caja.querySelector(".tuto-escena").innerHTML = `<h3>${esc(e.titulo)}</h3><div class="tuto-demo">${e.demo}</div><p>${esc(e.texto)}</p><div class="tu-trabajo">${esc(e.trabajo)}</div>`;
    caja.querySelector(".tuto-dots").innerHTML = lista.map((x, i) => `<button type="button" data-tuto-ir="${i}" aria-label="Paso ${i + 1}" aria-current="${i === actual}"></button>`).join("");
    caja.querySelector("[data-tuto-ant]").disabled = actual === 0;
    caja.querySelector("[data-tuto-sig]").textContent = actual === lista.length - 1 ? "¡Listo, a jugar!" : "Siguiente";
    caja.querySelector(".tuto-paso").textContent = (actual + 1) + " / " + lista.length;
    programar();
  }
  function programar() { clearTimeout(temporizador); if (actual < lista.length - 1) temporizador = setTimeout(() => { actual++; pintar(); }, 9000); }
  function abrir(rol, lado, cb) {
    cerrar(); lista = escenas(rol || "ambos", lado); actual = 0; alCerrar = cb || null;
    const caja = document.createElement("div"); caja.className = "tutorial"; caja.id = "tutorial"; caja.setAttribute("role", "dialog"); caja.setAttribute("aria-modal", "true"); caja.setAttribute("aria-label", "Cómo se juega");
    caja.innerHTML = `<div class="tuto-caja"><div class="tuto-cab"><div><span class="ojo">¿Cómo se juega?</span><div class="nota-pie tuto-paso"></div></div><button type="button" class="tuto-cerrar" data-tuto-cerrar aria-label="Cerrar">✕</button></div><div class="tuto-escena"></div><div class="tuto-pie"><div class="tuto-dots"></div><div class="botones"><button type="button" class="boton chico fantasma" data-tuto-ant>Anterior</button><button type="button" class="boton chico oro" data-tuto-sig>Siguiente</button></div></div></div>`;
    document.body.appendChild(caja);
    caja.addEventListener("click", ev => {
      const b = ev.target.closest("button"); if (!b) { if (ev.target === caja) cerrar(); return; }
      if (b.dataset.tutoCerrar !== undefined) cerrar();
      else if (b.dataset.tutoAnt !== undefined) { actual = Math.max(0, actual - 1); pintar(); }
      else if (b.dataset.tutoSig !== undefined) { if (actual >= lista.length - 1) cerrar(); else { actual++; pintar(); } }
      else if (b.dataset.tutoIr !== undefined) { actual = parseInt(b.dataset.tutoIr, 10); pintar(); }
    });
    caja.addEventListener("mouseenter", () => clearTimeout(temporizador)); caja.addEventListener("mouseleave", programar);
    document.addEventListener("keydown", teclas);
    pintar();
    caja.querySelector("[data-tuto-sig]").focus();
  }
  function teclas(ev) { if (ev.key === "Escape") cerrar(); else if (ev.key === "ArrowRight") { actual = Math.min(lista.length - 1, actual + 1); pintar(); } else if (ev.key === "ArrowLeft") { actual = Math.max(0, actual - 1); pintar(); } }
  function cerrar() { clearTimeout(temporizador); document.removeEventListener("keydown", teclas); const c = document.getElementById("tutorial"); if (c) c.remove(); if (alCerrar) { const f = alCerrar; alCerrar = null; f(); } }
  window.Tutorial = { abrir, cerrar, abierto: () => !!document.getElementById("tutorial") };
})();
