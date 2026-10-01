/* La escena de la mesa: un dibujo SVG de la sala de negociación, con la gente sentada por lado,
   quién tiene la palabra, las burbujas con la última oferta y el contrato sobre la mesa.
   Al cerrar, los voceros se dan la mano (trato) o todos se levantan y se van (sin acuerdo).
   Sin dependencias; la animación va por clases CSS (estilos.css, sección «la escena»). */
(function () {
  "use strict";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const iniciales = n => String(n || "").trim().split(/\s+/).slice(0, 2).map(p => p[0] || "").join("").toUpperCase() || "?";
  const ROL = { vocero: "VOCERO", analista: "ANALISTA", ambos: "VOCERO · ANALISTA" };
  // Posiciones de los asientos: dos por lado; la agencia a la izquierda, el cliente a la derecha.
  const ASIENTOS = { agencia: [{ x: 215, y: 262 }, { x: 300, y: 196 }], cliente: [{ x: 685, y: 262 }, { x: 600, y: 196 }] };

  function persona(lado, k, p, opciones) {
    const pos = ASIENTOS[lado][k];
    const libre = !p;
    const clases = ["persona", "lado-" + lado, k === 0 ? "primero" : "segundo", k % 2 ? "par" : "", libre ? "libre-asiento" : "viva", p && opciones.palabra && opciones.palabra.id === p.id ? "hablando" : "", p && p.rol === "analista" ? "analista" : "vocero"].filter(Boolean).join(" ");
    const silla = `<rect class="silla ${libre ? "vacia" : ""}" x="${pos.x - 30}" y="${pos.y - 14}" width="60" height="52" rx="12"></rect>`;
    if (libre) return `<g class="${clases}" data-asiento="${lado}-${k}">${silla}<text class="libre" x="${pos.x}" y="${pos.y + 62}">asiento libre</text></g>`;
    const nombre = p.nombre.length > 16 ? p.nombre.slice(0, 15) + "…" : p.nombre;
    return `<g class="${clases}" data-id="${esc(p.id)}" data-asiento="${lado}-${k}">
  ${silla}
  <circle class="anillo" cx="${pos.x}" cy="${pos.y - 4}" r="46"></circle>
  <path class="cuerpo ${lado}" d="M${pos.x - 30} ${pos.y + 40} v-16 a30 30 0 0 1 60 0 v16 z"></path>
  <text class="iniciales" x="${pos.x}" y="${pos.y + 30}">${esc(iniciales(p.nombre))}</text>
  <circle class="cabeza" cx="${pos.x}" cy="${pos.y - 10}" r="19"></circle>
  <circle class="ojito" cx="${pos.x - 7}" cy="${pos.y - 13}" r="2.2"></circle><circle class="ojito" cx="${pos.x + 7}" cy="${pos.y - 13}" r="2.2"></circle>
  <path class="sonrisa" d="M${pos.x - 7} ${pos.y - 4} q7 7 14 0"></path>
  <g class="mic"><rect x="${pos.x + 18}" y="${pos.y - 34}" width="14" height="22" rx="7" fill="var(--oro)" stroke="var(--borde)" stroke-width="2"></rect><path class="ondas" d="M${pos.x + 38} ${pos.y - 30} q8 7 0 14 M${pos.x + 44} ${pos.y - 35} q13 12 0 24"></path></g>
  ${p.yo ? `<g><rect class="yo-marca" x="${pos.x - 16}" y="${pos.y - 52}" width="32" height="16" rx="8"></rect><text class="yo-txt" x="${pos.x}" y="${pos.y - 40}">VOS</text></g>` : ""}
  <text class="etiqueta-nombre" x="${pos.x}" y="${pos.y + 60}">${esc(nombre)}</text>
  <text class="etiqueta-rol" x="${pos.x}" y="${pos.y + 74}">${ROL[p.rol] || ROL.ambos}</text>
</g>`;
  }
  function burbuja(lado, texto, codigo) {
    const pos = ASIENTOS[lado][0];
    const x = lado === "agencia" ? pos.x + 40 : pos.x - 40, y = pos.y - 96;
    const ancho = Math.max(120, Math.min(260, (texto || codigo || "").length * 8 + 28)), alto = codigo ? 58 : 40;
    const x0 = lado === "agencia" ? x : x - ancho;
    const tx = x0 + ancho / 2;
    const cola = lado === "agencia" ? `M${x0 + 18} ${y + alto} l8 14 l10 -14 z` : `M${x0 + ancho - 36} ${y + alto} l10 14 l8 -14 z`;
    return `<g class="burbuja burbuja-${lado}" data-burbuja="${lado}">
  <rect x="${x0}" y="${y}" width="${ancho}" height="${alto}" rx="12"></rect><path d="${cola}"></path>
  ${codigo ? `<text x="${tx}" y="${y + 22}">${esc(texto)}</text><text class="codigo-b" x="${tx}" y="${y + 46}">${esc(codigo)}</text>` : `<text x="${tx}" y="${y + 26}">${esc(texto)}</text>`}
</g>`;
  }
  /* opciones: { gente: {agencia: [...], cliente: [...]}, palabra: {id, lado} | null,
                 burbujas: {agencia: {texto, codigo}, cliente: {...}}, contrato: "BE?CD",
                 cerrado: null | "trato" | "sin", yo: id, puedoHablar: bool, hablo: bool } */
  function html(o) {
    o = o || {}; const gente = o.gente || { agencia: [], cliente: [] };
    const marcar = l => (gente[l] || []).slice(0, 2).map(p => Object.assign({}, p, { yo: p.id === o.yo }));
    const contrato = (o.contrato || "?????").split("").join(" ");
    const vacio = !o.contrato || o.contrato.includes("?");
    const confeti = Array.from({ length: 18 }, (_, i) => `<rect x="${300 + (i * 37) % 320}" y="100" width="8" height="12" rx="2" fill="${["var(--oro)", "var(--menta)", "var(--orbita)", "var(--volcan)", "var(--cielo)"][i % 5]}" style="animation-delay:${1 + (i % 6) * .12}s"></rect>`).join("");
    const extra = l => (gente[l] || []).length > 2 ? `<text class="libre" x="${l === "agencia" ? 120 : 780}" y="150">+${(gente[l] || []).length - 2} más</text>` : "";
    return `
<svg class="escena ${o.cerrado === "trato" ? "trato" : o.cerrado === "sin" ? "sin" : ""}" id="escena" viewBox="0 105 900 295" role="img" aria-label="La mesa de negociación">
  <ellipse cx="450" cy="340" rx="300" ry="28" fill="var(--sombra-c)" opacity=".18"></ellipse>
  <rect class="madera-2" x="250" y="300" width="22" height="46" rx="4"></rect><rect class="madera-2" x="628" y="300" width="22" height="46" rx="4"></rect>
  <ellipse class="madera" cx="450" cy="262" rx="250" ry="92"></ellipse>
  <ellipse class="felt-borde" cx="450" cy="256" rx="236" ry="82"></ellipse>
  <ellipse class="felt" cx="450" cy="250" rx="226" ry="74"></ellipse>
  <g class="contrato-g"><rect class="contrato" x="392" y="222" width="116" height="66" rx="6" transform="rotate(-4 450 255)"></rect>
    <text x="450" y="244" text-anchor="middle" style="font-size:9px;letter-spacing:.14em;fill:#7b6a4a" transform="rotate(-4 450 255)">CONTRATO</text>
    <text class="contrato-txt ${vacio ? "vacio" : ""}" x="450" y="270" text-anchor="middle" transform="rotate(-4 450 255)">${esc(contrato)}</text>
    <line x1="410" y1="282" x2="490" y2="282" stroke="#b9a988" stroke-width="1.5" transform="rotate(-4 450 255)"></line></g>
  <g class="manos"><path d="M395 286 q22 -14 45 -8" fill="none" stroke="var(--borde)" stroke-width="10" stroke-linecap="round"></path><path d="M395 286 q22 -14 45 -8" fill="none" stroke="var(--orbita)" stroke-width="6" stroke-linecap="round"></path><path d="M505 286 q-22 -14 -45 -8" fill="none" stroke="var(--borde)" stroke-width="10" stroke-linecap="round"></path><path d="M505 286 q-22 -14 -45 -8" fill="none" stroke="var(--volcan)" stroke-width="6" stroke-linecap="round"></path><circle class="mano" cx="441" cy="276" r="11"></circle><circle class="mano" cx="459" cy="276" r="11"></circle><path d="M420 250 l-8 -12 M450 244 l0 -14 M480 250 l8 -12" stroke="var(--oro-2)" stroke-width="4" stroke-linecap="round"></path></g>
  ${persona("agencia", 1, marcar("agencia")[1], o)}${persona("cliente", 1, marcar("cliente")[1], o)}
  ${persona("agencia", 0, marcar("agencia")[0], o)}${persona("cliente", 0, marcar("cliente")[0], o)}
  ${extra("agencia")}${extra("cliente")}
  ${o.burbujas && o.burbujas.agencia ? burbuja("agencia", o.burbujas.agencia.texto, o.burbujas.agencia.codigo) : ""}
  ${o.burbujas && o.burbujas.cliente ? burbuja("cliente", o.burbujas.cliente.texto, o.burbujas.cliente.codigo) : ""}
  <g class="confeti">${confeti}</g>
  <g class="sello-escena trato-si"><rect x="300" y="112" width="300" height="56" rx="12"></rect><text x="450" y="152">¡TRATO HECHO!</text></g>
  <g class="sello-escena trato-no"><rect x="300" y="112" width="300" height="56" rx="12"></rect><text x="450" y="152">SIN ACUERDO</text></g>
  ${o.puedoHablar ? `<g class="palabra-btn ${o.hablo ? "activo" : ""}" id="btn-palabra" role="button" tabindex="0" aria-pressed="${!!o.hablo}"><rect x="360" y="352" width="180" height="34" rx="17"></rect><g fill="none" stroke="var(--borde)" stroke-width="2" stroke-linecap="round"><rect x="378" y="359" width="7" height="11" rx="3.5"></rect><path d="M375 366a6.5 6.5 0 0 0 13 0M381.5 373v4"></path></g><text x="462" y="374">${o.hablo ? "Tenemos la palabra" : "Pedir la palabra"}</text></g>` : ""}
</svg>`;
  }
  /* Marca las burbujas visibles con una animación de entrada: se llama después de pintar. */
  function animarBurbujas(raiz) {
    (raiz || document).querySelectorAll(".escena .burbuja").forEach(b => requestAnimationFrame(() => b.classList.add("visible")));
  }
  /* Inclinación 3D suave con el puntero (solo con mouse). */
  function inclinar(contenedor) {
    if (!contenedor || !matchMedia("(hover: hover) and (prefers-reduced-motion: no-preference)").matches) return;
    contenedor.addEventListener("mousemove", e => {
      const svg = contenedor.querySelector(".escena"); if (!svg) return;
      const r = contenedor.getBoundingClientRect(), dx = (e.clientX - r.left) / r.width - .5, dy = (e.clientY - r.top) / r.height - .5;
      svg.style.transform = `rotateX(${(-dy * 6).toFixed(2)}deg) rotateY(${(dx * 8).toFixed(2)}deg)`;
    });
    contenedor.addEventListener("mouseleave", () => { const svg = contenedor.querySelector(".escena"); if (svg) svg.style.transform = ""; });
  }
  window.Escena = { html, animarBurbujas, inclinar };
})();
