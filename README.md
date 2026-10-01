# Trato Hecho

Simulador de negociación para la exposición de la CEP **Negociación** del Grupo 4
(Desarrollo de Emprendedores, TEC, II semestre 2026). Es una web estática: se
despliega en cualquier hosting de archivos (Vercel, GitHub Pages, Netlify) y no
se cae por carga. El tablero en vivo lo da un servidor propio sin dependencias
(`servidor/`), con la base dentro del contenedor.

**En producción:** <https://tratohecho.siriusx.net> (Coolify, desde el repo
público [`ulises-mz/trato-hecho`](https://github.com/ulises-mz/trato-hecho),
con tablero en vivo). **Copia estática de respaldo:**
<https://trato-hecho-nine.vercel.app> (Vercel, desde la carpeta
`tareas/exposicion-negociacion/trato-hecho` del hub, sin tablero en vivo; la
carpeta raíz está fijada en la configuración del proyecto).

## La actividad en una frase

Equipo contra equipo en cada sala de Zoom: una **agencia digital** le vende un paquete
(sitio web, logo, redes) a una **cafetería** que abre pronto. Cinco temas sobre la
mesa, tabla de puntos privada por lado, plan B que marca el mínimo, y un índice
ganar-ganar que decide qué sala negoció mejor.

| Fase | Dura | Qué pasa |
|---|---:|---|
| Consigna | 1 min | Se lee el caso y las cuatro reglas; «Iniciar juego» reparte lados y salas a los equipos ya armados |
| Preparación | 4 min | Cada lado lee su ficha privada por pasos y llena la hoja de preparación, cada equipo en su propia sala de Zoom: la agencia en «Sala n» (que es también la mesa) y el cliente en «Sala n Cliente»; la web le dice a cada uno a cuál entrar |
| Negociación | 10 min | El cliente pasa a «Sala n» (la web se lo dice en la transición y en el aviso de 30 s). Hablan y marcan las opciones en la mesa; el termómetro muestra solo sus puntos |
| Cierre | 1 min | Cada equipo registra el cierre en la web: «trato hecho» solo se habilita si las propuestas de los dos equipos coinciden; si no, «sin acuerdo». El código (`S3-BEDCD`) es solo respaldo |
| Resultados | 4 min | El tablero se llena solo, rankea, grafica y revela los intereses de los dos lados |

**20 minutos en total.** El guion minuto a minuto, los mensajes para pegar en el chat
y el plan por si algo falla están dentro de la web, en `#guion`. El administrador
lleva la sesión desde `#admin`: un reloj con las cinco fases y los avisos que se
iluminan cuando toca transmitirlos a las salas, con botón de copiar.

## Códigos de trato

| Código | Significa |
|---|---|
| `S3-BEDCD` | La sala 3 cerró con esas cinco opciones, una letra por tema |
| `S4-SIN-EDCAB-C` | La sala 4 no cerró; la última propuesta fue `EDCAB` y la rechazó el cliente (`A` la agencia, `T` se acabó el tiempo) |
| `S8-SIN` | No cerró y no registró detalle |

La web los genera; el tablero los lee del chat pegado tal cual, con espacios o
minúsculas, y toma el último de cada sala.

## Cómo se decide la mejor negociación

- Cada lado suma los puntos de las opciones acordadas (máximo 100).
- **Índice ganar-ganar** = puntos de las dos partes − ½ de la diferencia entre
  ellas. 70 y 70 dan 140; 95 y 45 dan 115.
- Un trato que deja a una parte por debajo de su plan B **no cuenta**.
- Sin acuerdo = cada parte se queda con su plan B (45 la agencia, 40 el cliente),
  índice 82,5. Para evaluar *cómo* no cerraron, al registrarlo se anota la última
  propuesta que hubo sobre la mesa y quién la rechazó:
  - si esa propuesta superaba el plan B de los dos, es un **trato perdido** (se
    muestra cuánto valor dejaron: índice de la propuesta − 82,5) y la sala queda
    detrás de las que se levantaron con razón;
  - si dejaba a alguien por debajo de su plan B, **levantarse fue correcto**;
  - sin detalle, se evalúa solo con los planes B.

El mejor trato posible es `BEDCD` (71 / 73, índice 143). Las salas que solo
regatean el precio se quedan cerca de 113; las que preguntan «¿para qué lo
necesita?» y cambian lo barato por lo caro pasan de 130.

## Las etapas

La web lleva a cada estudiante por cinco etapas; el reloj del administrador
(o el del propio equipo, si no hay tablero en vivo) decide cuál toca y la
pantalla cambia sola, con una transición. Lo que no es de la etapa no se
muestra; las etapas anteriores se pueden consultar y las siguientes están con
candado.

| Etapa | Qué hay |
|---|---|
| **Entrar** | Login con el nombre (desde ahí cuenta como conectado), pre-sala con el video de introducción (al terminarlo se habilita «Estoy listo»; el administrador ve el conteo en vivo y cuántos están listos) hasta que abre el armado, y el hub de equipos con el plan fijado con esa cantidad. Las salas son fijas (`config.salas`, una por staff) y el tamaño de los equipos se ajusta a la gente: con P personas, min(salas, P/4) salas, dos equipos por sala, de ⌊P/T⌋ o ⌊P/T⌋+1 personas. Cuando están todos, «Iniciar juego» respeta los equipos armados, acomoda a quien sobra o falta, asigna a cada par de equipos una sala y los lados, sienta a cada persona y le muestra a qué sala de Zoom entrar; arranca el reloj. Sin tablero en vivo queda la elección manual de sala y lado |
| **Prepararse** | La ficha privada en seis pasos: el caso y las reglas, quiénes son y su posición, lo que les importa, la tabla de puntos y el plan B, la hoja de preparación y su rol. La primera vez se abre el tutorial animado |
| **Negociar** | La escena de la sala (`escena.js`): los cuatro sentados con nombre y rol, quién tiene la palabra, la última oferta de cada lado como burbuja y el contrato con lo marcado. Debajo, la ronda, los cinco temas, el termómetro, la propuesta, las misiones, los apuntes y «Consultar mi ficha» |
| **Cerrar** | La propuesta final contra el plan B y la comparación con la propuesta del otro equipo, tema por tema. «Trato hecho» solo se habilita cuando las dos coinciden, y hace que los voceros se den la mano; «Sin acuerdo» los levanta de la mesa. Sale el código de la sala |
| **Resultado** | Antes de la revelación, el propio cierre y las preguntas para conversar; cuando el administrador revela, los puntos de los dos lados, el índice, el puesto entre las salas, lo que había del otro lado y las claves |

## Roles y tablero en vivo

| Rol | Vista | Qué hace |
|---|---|---|
| Estudiantes | Inicio, Mi ficha, Mesa | Escriben su nombre y entran desde el **lobby**: las salas con sus asientos de agencia y cliente, donde se ve llegar a los demás en tiempo real (avatar con iniciales y rol). La ficha es un dossier por pestañas (Resumen, Intereses, Puntos, Guion, Preparación) con la franja de quién está en cada lado; la mesa funciona como apuntes: termómetro de puntos contra el plan B, propuesta sobre la mesa, registro de ofertas (nuestras y de ellos) y notas rápidas |
| Vocero / Analista | Mi ficha | En cada pareja uno habla y el otro lleva la cuenta. El vocero abre en la pestaña Guion (qué decir, qué preguntar, qué defender y qué cambiar); el analista abre en Puntos. Quien está solo elige «Los dos» |
| Administrador | `#admin` | Reloj de las cinco fases que manda sobre los relojes de los equipos, avisos que se iluminan cuando toca y que la web muestra sola, con sonido, en la pantalla de cada equipo (30 segundos de preparación, 3 minutos, último minuto, cierre de salas), tablero de salas en vivo, reinicio de sesión |
| Staff | `#staff` | Verificador de su sala: elige la sala y ve las dos propuestas en vivo, tema por tema (verde donde coinciden, rojo donde no), con el veredicto arriba y qué hacer en cada fase. No lleva acta (queda como respaldo opcional): la web solo habilita «Trato hecho» cuando las dos propuestas coinciden. Recibe los mismos avisos automáticos que los equipos. Debajo, todas las salas en vivo |
| Resultados | `#resultados` | Carga los códigos en vivo o el chat pegado, rankea, grafica, revela y muestra los apuntes del staff de cada sala |

Admin, Staff, Resultados y Guion piden la **clave** de `config.js`
(`claveStaff`, de fábrica `grupo4`: cambiarla). Los enlaces a esas vistas
aparecen en la barra solo después de entrar con la clave.

El **tablero en vivo** muestra, por sala, quién entró, en qué fase va cada
lado (ficha, mesa, cerró), la propuesta que cada lado tiene marcada (`BE?CD`),
si las dos propuestas ya coinciden, el código del cierre y cuánto hace que no
hay actividad. Necesita un canal compartido entre dispositivos. Cuatro modos,
en `config.js`:

| `firebase:` | Qué pasa |
|---|---|
| `"servidor"` | **El de producción.** La web la sirve `servidor/index.js` (Docker, Coolify): canal en vivo propio con base incluida, sin cuentas ni claves que configurar |
| `null` | Sin tablero en vivo. Cada equipo lleva su reloj y los códigos viajan por el chat. Siempre funciona |
| `"local"` | Ensayo en una computadora: las pestañas de un mismo navegador se ven entre sí. También con `?sync=local` en la dirección |
| `{ … }` | Firebase Realtime Database: tablero en vivo entre dispositivos sin servidor propio (alternativa, no hace falta con el servidor) |

Si la copia está en un hosting estático (Vercel, GitHub Pages) con
`"servidor"`, la web lo detecta al arrancar (`/api/salud` no responde) y sigue
sin tablero en vivo, avisándolo en Admin.

### El servidor propio (Docker / Coolify)

[`servidor/index.js`](servidor/index.js) no tiene dependencias: `http` y
`node:sqlite` de Node 22+. Sirve los archivos de esta carpeta con direcciones
limpias (`/fichas` → `fichas.html`) y expone el canal en vivo:

```
GET    /api/salud                             estado y conexiones abiertas
GET    /api/sesiones/<sesion>                 el árbol completo de la sesión
GET    /api/sesiones/<sesion>/eventos         SSE: «arbol» al conectar, después un «cambio» por escritura
POST   /api/sesiones/<sesion>/escribir        { ruta, datos, modo }   modo: fusionar (update) o fijar (set; datos null borra)
DELETE /api/sesiones/<sesion>                 borra la sesión (lo que hace «Reiniciar la sesión» en Admin)
```

Cada sesión se guarda como un árbol JSON en una tabla de SQLite
(`datos/trato-hecho.sqlite`; si `node:sqlite` no existe, cae a
`datos/sesiones.json`). Es la misma estructura que con Firebase (abajo), así
que `app.js` no distingue el motor. Las escrituras son optimistas: la pestaña
aplica el cambio de una vez y el servidor lo confirma a todas las demás.

Lo que hay que saber para la clase:

- **La base vive dentro del contenedor.** Volver a desplegar la crea de cero
  (igual que «Reiniciar la sesión»). No desplegar durante la actividad.
- No hay autenticación en la API, a propósito: es una actividad de 20 minutos
  con una clave de facilitador en la web. Cuando pase la clase, apagar el
  sitio o reiniciar la sesión.
- `datos/`, `servidor/` y los archivos ocultos no se sirven.
- **Caché.** Cloudflare alarga a cuatro horas la caché de `.js` y `.css` en el
  navegador, así que el servidor calcula al arrancar una versión (hash de todos
  los `.js` y `.css`, de `video/` y del servidor) y la mete en los `?v=__V__` de `index.html`; las páginas
  van con `no-store` y `app.js` lee la versión de su propia etiqueta `<script>` para
  pedir el video con ella. Después de un despliegue basta una recarga normal. Los
  404 también van con `no-store`, porque el borde los guardaba cinco minutos.
- **Video.** `video/intro.mp4` se sirve con `Accept-Ranges`, `Content-Length`,
  `Content-Encoding: identity` y `Cache-Control: private, no-transform`, y responde
  `206` a los `Range`: sin eso Safari en iPhone no lo reproduce. El detalle importa:
  el proxy de Coolify (Traefik) comprime las respuestas y les quita el largo, y
  Cloudflare guardaba el video sin largo conocido y contestaba `200` a los `Range`
  aunque el origen dijera `206`. Con `private` el video no pasa por la caché del
  borde (cada petición llega al contenedor, 12,5 MB por persona) y con `identity`
  Traefik no lo comprime. El `.vtt` y el póster sí se cachean. Pesa 12,5 MB y Cloudflare lo guarda en el borde, así que treinta
  personas a la vez no le pegan al contenedor.

Correr local con tablero en vivo:

```bash
node servidor/index.js            # http://127.0.0.1:3000/  (PORT y DATOS son variables opcionales)
docker build -t trato-hecho . && docker run -p 3000:3000 trato-hecho
```

### Configurar Firebase (alternativa sin servidor; una vez, cinco minutos)

1. Entrar a <https://console.firebase.google.com> con una cuenta de Google y
   **Agregar proyecto** (nombre libre; Analytics se puede apagar).
2. En el menú **Compilación → Realtime Database → Crear base de datos**.
   Ubicación: Estados Unidos. Modo: **de prueba** (abre lectura y escritura
   30 días; para la clase basta). Si prefiere reglas explícitas, pegar las de
   [`firebase-rules.json`](firebase-rules.json) en la pestaña **Reglas**.
3. En **Configuración del proyecto** (el engranaje) → **Tus apps → Web** (icono
   `</>`), registrar la app y copiar el objeto `firebaseConfig`.
4. Pegarlo en `config.js` como valor de `firebase:` y publicar. Tiene que
   incluir `databaseURL`; si no aparece, se copia de la pantalla de la base
   (`https://<proyecto>-default-rtdb.firebaseio.com`).
5. Abrir `#admin`, pulsar **Probar conexión**: debe decir «Conexión OK».

Esas claves son públicas por diseño (van en la web); lo que protege la base
son las reglas. Cuando pase la clase, cerrar la base cambiando las reglas a
`false` o borrando el proyecto. Si Firebase no carga, la web sigue funcionando
sin tablero en vivo.

### Qué guarda la base

El mismo árbol en los dos motores (en el servidor, bajo la fila de la sesión):

```
sesiones/<sesion>/config/reloj         inicio del reloj del administrador
sesiones/<sesion>/salas/<n>/agencia    { entrado, fase, propuesta, puntos, prep, actualizado }
sesiones/<sesion>/salas/<n>/cliente    igual
sesiones/<sesion>/salas/<n>/cierre     { codigo, por, ts }        por: agencia, cliente o staff
sesiones/<sesion>/salas/<n>/acta       { temas, notas, actualizado } respaldo opcional del staff
sesiones/<sesion>/salas/<n>/gente/<id> { nombre, lado, rol, entrado, actualizado } quién está (por pestaña)
```

Los nombres que escriben los estudiantes viven solo en la base de la sesión
(o en el navegador, en modo local) y se borran con «Reiniciar la sesión».

`sesion` sale de `config.js` (o de `?sesion=ensayo` en la dirección): así un
ensayo no se mezcla con la clase. **Reiniciar la sesión** en Admin borra todo
lo de esa sesión.

## Archivos

```
index.html      el cascarón: HUD con las etapas, reloj y ayuda
estilos.css     la hoja de estilo: papel e índigo, oro, menta y lava; solo versión clara; animaciones
iconos.js       iconos de línea en SVG (sin emojis)
fuentes.css     las fuentes empaquetadas (fuentes/*.woff2): sin depender de Google en clase
app.js          lógica: etapas, relojes, lobby y reparto, calculadora, códigos, tablero, gráfico, en vivo
escena.js       la escena SVG de la mesa: asientos, palabra, burbujas, apretón de manos, levantarse
tutorial.js     el tutorial animado «¿Cómo se juega?» con componentes en miniatura
datos.js        EL CASO: textos, opciones, puntos, plan B, tiempos. Cambiar aquí
config.js       LA INSTALACIÓN: motor en vivo (servidor, local o Firebase), nombre de sesión, clave, salas y nombres de las salas de la videollamada
sync.js         canal en vivo: servidor propio (REST + SSE), Firebase o localStorage
servidor/       el servidor: sirve la web y guarda las sesiones en SQLite (sin dependencias)
video/          el video de introducción de la pre-sala: intro.mp4, intro.vtt (subtítulos) e intro-poster.jpg
Dockerfile      imagen para Coolify o cualquier Docker: node:24-alpine, puerto 3000
firebase-rules.json  reglas de la base si se usa Firebase
fichas.html     versión imprimible de las fichas (fichas.html?lado=agencia)
fichas/         las fichas en PDF, por si la web no abre en clase
puntuar.py      el mismo cálculo desde la terminal, para revisar o rehacer el ranking
herramientas/   script que regenera los PDF y las capturas (necesita Playwright)
vercel.json     cabeceras noindex; no hay build
```

Todo el contenido sale de `datos.js`. Para cambiar un precio, un punto o un
consejo se edita ahí y la web, los PDF y `puntuar.py` cambian juntos. El objeto
es JSON válido a propósito.

## Correr y desplegar

Local:

```bash
node servidor/index.js           # con tablero en vivo: http://127.0.0.1:3000/
python3 -m http.server 8765      # solo la web estática (sin tablero): http://127.0.0.1:8765/?sync=local para ensayar
```

**Producción (Coolify):** el sitio se construye con el `Dockerfile` de esta
carpeta desde el repositorio público `ulises-mz/trato-hecho`, que es una copia
de esta carpeta (el hub es privado y el conector de Coolify solo despliega
repositorios públicos). Puerto 3000, dominio `https://tratohecho.siriusx.net`.
El nombre tiene que estar publicado en Cloudflare como los demás sitios de
siriusx.net (los subdominios desconocidos devuelven un 404 vacío antes de
llegar al proxy del servidor). Para publicar un cambio: copiar la carpeta al
repo público, commitear y volver a desplegar desde Coolify o pedirlo en la
sesión.

**Copia estática (Vercel):** el proyecto `trato-hecho` de Vercel sigue ligado
al repositorio del hub con esta carpeta como raíz, sin build. Sirve como
respaldo si el servidor no responde: la web funciona igual, pero sin tablero
en vivo (los códigos van por el chat).

## El laboratorio guiado

La mesa se juega como un laboratorio:

- **Rondas** que salen del reloj del administrador: Abrir (0–2 min), Descubrir
  (2–4), Intercambiar (4–6) y Cerrar (6–7), cada una con su consigna visible.
- **Seis misiones** con barra de progreso y aviso al cumplirlas: prepararse,
  abrir con su posición, escuchar su oferta, descubrir un interés, superar su
  plan B y cerrar. Se cumplen solas con lo que el equipo registra.
- **Logros**: oído fino (dos apuntes), intercambio (cambiar dos temas y seguir
  sobre el plan B), valor creado (cerrar 15 o más sobre el plan B) y firmeza
  (levantarse cuando lo que había era peor que el plan B). Aparecen en el
  cierre y el tablero del admin los cuenta.

## El video

`video/intro.mp4` (1:52, 1280×720) es el video de introducción que cada persona
ve en la **pre-sala** al entrar con su nombre: el caso, de qué trata el juego y
cómo va a ser la sesión, con voz en off expresiva (ElevenLabs), efectos y
subtítulos (`video/intro.vtt`). Al terminarlo se habilita «Estoy listo»; si el
video no carga, el botón se habilita igual para no trabar a nadie. El
administrador ve «N de M listos» y abre el armado cuando estén todos. Se
regenera con `../video/intro-pipeline.py` (en el hub) y se copian aquí
`intro.mp4`, `intro.vtt` e `intro-poster.jpg`; este repo es el único que
versiona el `.mp4` (el hub ignora los `.mp4`).

[`../video/como-jugar.mp4`](../video/como-jugar.mp4) (1:57) explica cómo jugar
según el rol, pero **muestra la interfaz anterior** (pestañas Mi ficha y Mesa):
hay que regrabarlo o retirarlo; su pipeline (`../video/pipeline.py`) sigue sirviendo.

Sin tablero en vivo no hace falta backend: los códigos viajan por el chat de la
videollamada y el tablero (`#resultados`) recibe el chat pegado tal cual. Con el
servidor (o Firebase), «Cargar códigos en vivo» trae lo que registró cada sala y
cuenta como sin acuerdo a las que entraron y no cerraron. Siempre se pueden
agregar salas a mano.

## Puntuar desde la terminal

```bash
python3 puntuar.py S1-BEDCD S2-SIN-CBCBB-T S3-CBCBB
python3 puntuar.py < chat.txt
python3 puntuar.py --optimo
```

## Regenerar los PDF y las capturas

`herramientas/capturas.js` usa los selectores de la interfaz anterior; las
capturas del README del hub se tomaron con la prueba de punta a punta
(`prueba-v2.js` en el cuaderno de la sesión). Hay que actualizar el script.

```bash
cd herramientas && npm i playwright && npx playwright install chromium && cd ..
python3 -m http.server 8765 &
node herramientas/capturas.js
```
