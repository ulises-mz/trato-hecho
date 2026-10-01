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

  // Salas que se usan como máximo: una por integrante del staff. El juego reparte a toda la clase en
  // estas salas (dos equipos por sala) y el tamaño de los equipos se ajusta a la gente que haya:
  // con 26 personas en 5 salas, diez equipos, seis de tres y cuatro de dos.
  salas: 5,

  // Cómo se llama la videollamada en los textos («entrá a la sala 3 en Zoom»).
  videollamada: "Zoom",

  // Nombres de las salas para grupos pequeños, tal cual se crean en la videollamada ({n} = número).
  // Cada equipo se prepara en privado: la agencia en «Sala n» (que es también la mesa de negociación)
  // y el cliente en «Sala n Cliente»; al empezar la negociación el cliente pasa a «Sala n».
  // Con salaCliente en null, los dos equipos comparten «Sala n» desde el principio.
  sala: "Sala {n}",
  salaCliente: "Sala {n} Cliente"
};
