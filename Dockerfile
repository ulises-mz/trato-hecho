# Trato Hecho: web estática + servidor de sincronización en vivo (sin dependencias).
FROM node:24-alpine
WORKDIR /app
COPY . .
ENV PORT=3000 DATOS=/app/datos
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/api/salud || exit 1
CMD ["node", "servidor/index.js"]
