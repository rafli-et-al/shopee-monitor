FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

FROM node:20-alpine AS server-builder
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install
COPY server/ ./
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache python3 make g++ sqlite

COPY server/package*.json ./
RUN npm install --only=production

COPY --from=server-builder /app/server/dist ./dist
COPY --from=client-builder /app/client/dist ./public

RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "dist/index.js"]
