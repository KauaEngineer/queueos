# ============================================
# QueueOS — Dockerfile multi-stage
# ============================================

# ---- Stage 1: build ----
FROM node:20-alpine AS builder

WORKDIR /app

# Copia manifests primeiro pra aproveitar cache do Docker
COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma

# Instala TODAS as deps (inclui devDeps pra compilar TS)
RUN npm ci

# Gera o Prisma Client
RUN npx prisma generate

# Copia o código e compila
COPY src ./src
RUN npx tsc

# ---- Stage 2: runtime ----
FROM node:20-alpine AS runtime

WORKDIR /app

# tini = init pra lidar com sinais (SIGTERM/SIGINT corretamente)
RUN apk add --no-cache tini

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copia artefatos do builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/dashboard/public ./dist/dashboard/public

# Usuário não-root por segurança
RUN addgroup -S queueos && adduser -S queueos -G queueos && chown -R queueos:queueos /app
USER queueos

ENTRYPOINT ["/sbin/tini", "--"]

# Default: all-in-one (workers + dashboard no mesmo processo) — ideal pra Render free
# docker-compose sobrescreve pra rodar workers e dashboard em containers separados
CMD ["node", "dist/all-in-one.js"]
