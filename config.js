// Configuración de la instalación. Es el único archivo que hay que tocar para
// desplegar: lo demás sale de datos.js.
window.CONFIG = {
  // Tablero en vivo (lobby, Admin y Staff ven cómo avanza cada sala). Cuatro opciones:
  //   "servidor" → la web está servida por servidor/index.js (Docker, Coolify): canal en vivo propio, sin nada que configurar.
  //   null       → sin tablero en vivo. Los códigos viajan por el chat de la videollamada. Siempre funciona.
  //   "local"    → modo de ensayo en UNA computadora: las pestañas de un mismo navegador se ven entre sí.
  //   { ... }    → Firebase Realtime Database: tablero en vivo entre dispositivos sin servidor propio.
  //                Pasos en README.md. Se pega aquí el objeto firebaseConfig tal cual lo da la consola.
  firebase: "servidor",

  // Nombre de la sesión en la base. Usar otro ("ensayo") para practicar sin mezclar datos.
  sesion: "clase",

  // Clave que abre las vistas Admin y Staff. Cambiarla antes de la clase.
  claveStaff: "grupo4",

  // Cuántas salas muestra el tablero en vivo aunque todavía no haya entrado nadie, y cuántos
  // equipos (dos por sala) ofrece el hub para armarse. Con 26 estudiantes: 6 salas, 12 equipos.
  salas: 6,

  // Cómo se llama la videollamada en los textos («entrá a la sala 3 en Teams»).
  videollamada: "Teams"
};
