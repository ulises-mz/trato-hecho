# Trato Hecho: web estática + servidor de sincronización en vivo (sin dependencias).
# Sin HEALTHCHECK a propósito: el proxy (Traefik) no enruta un contenedor hasta que Docker lo
# declara sano, y con la comprobación dentro de la imagen el dominio se quedaba en 404.
# El estado del servidor se consulta en /api/salud.
FROM node:24-alpine
WORKDIR /app
COPY . .
ENV PORT=3000 DATOS=/app/datos
EXPOSE 3000
CMD ["node", "servidor/index.js"]
