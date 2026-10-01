# Trato Hecho: web estática + servidor de sincronización en vivo (sin dependencias).
#
# EL HEALTHCHECK VUELVE, Y NO ES OPCIONAL. El 2026-10-01 se quitó creyendo que el proxy no
# enrutaba el contenedor hasta que Docker lo declarara sano, y que por eso el dominio daba 404.
# Las dos cosas eran falsas, y quitarlo rompió TODOS los despliegues:
#
#   · Traefik enruta por la etiqueta Host, no por la salud de Docker. El 404 venía de otra
#     parte, antes del servidor: al nombre le falta su registro DNS en Cloudflare.
#
#   · Coolify, al actualizar sin cortar el servicio, le pregunta la salud al contenedor nuevo con
#     «docker inspect --format='{{json .State.Health.Status}}'». Sin HEALTHCHECK esa plantilla
#     revienta —«map has no entry for key Health»—, Coolify lo lee como salud fallida y revierte
#     al contenedor viejo. Resultado medido: cada despliegue quedaba en «failed» y el contenedor
#     en pie seguía siendo el primero, con sus etiquetas viejas.
#
# wget viene en busybox, así que no hace falta instalar nada.
FROM node:24-alpine
WORKDIR /app
COPY . .
ENV PORT=3000 DATOS=/app/datos
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/salud >/dev/null 2>&1 || exit 1
CMD ["node", "servidor/index.js"]
