/* Iconos de línea en SVG (sin emojis): se dibujan con el color del texto. Iconos.svg("mic") devuelve
   el marcado; Iconos.svg("mic", "ico-grande") agrega una clase. */
(function () {
  "use strict";
  const TRAZOS = {
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/>',
    calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8.5 7.5h7M8.5 12h2M13.5 12h2M8.5 16h2M13.5 16h2"/>',
    users: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0M14 20a5 5 0 0 1 7-4.4"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    handshake: '<path d="M3 11l4.5-4.5L11 8l3-1.5L18.5 11"/><path d="M7.5 6.5L3 11l4 4 3 3 2.5-2.5M14 7l4.5 4 -3 3"/><path d="M10 15l2.5 2.5M12.5 12.5L15 15"/>',
    exit: '<path d="M13 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h7"/><path d="M16 8l4 4-4 4M10 12h10"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h7"/>',
    speak: '<path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z"/>',
    question: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.1 1-1.1 1.8M12 17h.01"/>',
    swap: '<path d="M7 7h11l-3-3M17 17H6l3 3"/>',
    hush: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>',
    tap: '<path d="M8 13V5a2 2 0 1 1 4 0v7"/><path d="M12 11a2 2 0 1 1 4 0v3a5 5 0 0 1-5 5h-1a5 5 0 0 1-4-2l-2.2-3a1.5 1.5 0 0 1 2.4-1.8L8 14"/>',
    thermometer: '<path d="M10 4a2 2 0 1 1 4 0v9.5a4 4 0 1 1-4 0z"/><path d="M12 9v6"/>',
    note: '<path d="M5 3h10l4 4v14H5z"/><path d="M8 11h8M8 15h6"/>',
    chat: '<path d="M4 4h16v11H9l-5 4z"/><path d="M8 9h8"/>',
    check: '<path d="M5 12l5 5L20 7"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    flag: '<path d="M5 21V4h12l-2 4 2 4H5"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.1 1-1.1 1.8M12 17h.01"/>',
    seat: '<path d="M6 11V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v6"/><path d="M4 11h16v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM7 17v4M17 17v4"/>'
  };
  function svg(nombre, clase) {
    const t = TRAZOS[nombre] || TRAZOS.help;
    return `<svg class="ico ${clase || ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${t}</svg>`;
  }
  window.Iconos = { svg, lista: Object.keys(TRAZOS) };
})();
