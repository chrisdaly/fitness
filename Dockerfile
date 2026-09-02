FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY index.html server.js favicon.svg ./
RUN mkdir -p /data
VOLUME ["/data"]
ENV PORT=8080
ENV DB_PATH=/data/fitness.db
EXPOSE 8080
CMD ["node", "server.js"]
