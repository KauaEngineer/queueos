# QueueOS

> Sistema de filas e jobs assíncronos com Node.js + Redis + BullMQ + TypeScript + Prisma + PostgreSQL + dashboard em tempo real.

Sistema completo de processamento assíncrono para desacoplar tarefas pesadas (envio de emails, geração de PDFs, processamento de imagens, notificações) do fluxo principal da aplicação. Inclui dashboard web em tempo real, multi-tenancy, jobs recorrentes (cron), alertas via webhook, exportação CSV, métricas Prometheus e manifestos Kubernetes prontos.

## Stack

| Camada | Tecnologia |
|---|---|
| Runtime | Node.js 20 LTS + TypeScript 6 (ESM) |
| Broker | Redis 7 |
| Filas | BullMQ 5 |
| Persistência | PostgreSQL 16 + Prisma 6 |
| Dashboard | Express + HTML/CSS/JS puro (sem framework) |
| Deploy | Docker multi-stage + docker-compose + Kubernetes |
| Observabilidade | Endpoint `/metrics` formato Prometheus |

## Filas

| Fila | Concorrência | Timeout | Retries | Casos de uso |
|---|---|---|---|---|
| `email-sender` | 10 | 30s | 3 | Welcome, password reset, newsletter |
| `report-gen` | 3 | 120s | 2 | PDFs de relatórios analíticos |
| `image-proc` | 6 | 60s | 3 | Resize, WebP, watermark |
| `notifications` | 15 | 10s | 5 | Push, SMS, webhooks |

## Rodando localmente (modo dev)

```bash
# 1. Subir Redis e Postgres em containers
docker run -d -p 6380:6379 --name queueos-redis redis:7-alpine
docker run -d -p 5433:5432 \
  -e POSTGRES_USER=queueos -e POSTGRES_PASSWORD=queueos -e POSTGRES_DB=queueos \
  --name queueos-pg postgres:16-alpine

# 2. Instalar dependências e configurar
npm install
cp .env.example .env
npx prisma migrate dev
npm run db:seed

# 3. Rodar (em 3 terminais separados)
npm run workers:start    # processadores
npm run dashboard        # http://localhost:3001 (login: admin / dev-secret-trocar-em-prod)
npm run producer:test    # enfileira 4 jobs pra testar
```

## Rodando com Docker Compose

```bash
# Sobe tudo: redis + postgres + migrations + 2 workers + dashboard
docker compose up -d --build

# Acessar:
#   Dashboard: http://localhost:3001
#   Postgres:  localhost:5432
#   Redis:     localhost:6379

# Logs:
docker compose logs -f workers
docker compose logs -f dashboard

# Parar tudo:
docker compose down              # mantém o volume do banco
docker compose down -v           # apaga também o volume
```

## Deploy em Kubernetes

```bash
# 1. Build da imagem e push para seu registry
docker build -t SEU_REGISTRY/queueos:v0.1 .
docker push SEU_REGISTRY/queueos:v0.1

# 2. Ajustar k8s/workers.yaml e k8s/dashboard.yaml com a tag correta
sed -i 's|queueos:latest|SEU_REGISTRY/queueos:v0.1|g' k8s/*.yaml

# 3. Criar secrets reais (não use k8s/secret.yaml em produção)
kubectl create namespace queueos
kubectl create secret generic queueos-secrets -n queueos \
  --from-literal=DATABASE_URL='postgresql://user:senha-forte@postgres:5432/queueos' \
  --from-literal=DASHBOARD_SECRET="$(openssl rand -hex 32)" \
  --from-literal=REDIS_PASSWORD='' \
  --from-literal=ALERT_WEBHOOK_URL=''

# 4. Aplicar manifestos
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/redis.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/workers.yaml
kubectl apply -f k8s/dashboard.yaml

# 5. Acessar dashboard
kubectl -n queueos port-forward svc/queueos-dashboard 3001:80
```

## API

Todas as rotas exceto `/api/health` e `/metrics` exigem HTTP Basic Auth (`admin` + `DASHBOARD_SECRET`).
Suporte a multi-tenant via header `X-Tenant-Id: <id>` (default: `default`).

| Método | Rota | Função |
|---|---|---|
| GET  | `/api/health` | Healthcheck (sem auth) |
| GET  | `/metrics` | Métricas Prometheus (sem auth) |
| GET  | `/api/queues` | Estado das 4 filas |
| GET  | `/api/metrics` | jobs/min, completed, failed, success rate, avg duration |
| GET  | `/api/metrics/history?range=1h\|24h` | Série temporal agregada |
| GET  | `/api/jobs/recent` | Últimos 10 jobs |
| GET  | `/api/workers` | Lista workers + CPU/RAM (mock) |
| GET  | `/api/throughput` | Buckets últimos 60s |
| GET  | `/api/logs/export?queue=X&status=Y` | Download CSV |
| POST | `/api/queues/:name/pause` | Pausa fila |
| POST | `/api/queues/:name/resume` | Retoma fila |
| GET  | `/api/cron` | Lista cron jobs |
| POST | `/api/cron` `{ queue, pattern, payload }` | Cria cron job |
| DELETE | `/api/cron` `{ queue, key }` | Remove cron job |

## Variáveis de ambiente

Ver [.env.example](.env.example).

| Variável | Default | Descrição |
|---|---|---|
| `REDIS_HOST` | `localhost` | Host do Redis |
| `REDIS_PORT` | `6380` | Porta do Redis |
| `REDIS_PASSWORD` | — | Senha (opcional) |
| `REDIS_DB` | `0` | Database number |
| `DATABASE_URL` | — | Connection string Postgres |
| `WORKER_CONCURRENCY` | `10` | Concorrência padrão |
| `MAX_RETRIES` | `3` | Tentativas padrão |
| `JOB_TIMEOUT_MS` | `30000` | Timeout padrão |
| `DASHBOARD_PORT` | `3001` | Porta do dashboard |
| `DASHBOARD_SECRET` | — | Senha do dashboard (HTTP Basic Auth) |
| `ALERT_WEBHOOK_URL` | — | URL pra POST quando ≥3 falhas em 60s |

## Scripts npm

```bash
npm run redis:test        # smoke test da conexão Redis
npm run producer:test     # enfileira 4 jobs de exemplo
npm run workers:start     # sobe os 4 workers
npm run dashboard         # sobe o dashboard
npm run db:seed           # popula com 10 logs fake
npm run prisma:migrate    # roda migrations em dev
npm run prisma:generate   # regera Prisma Client
npm run prisma:studio     # GUI do banco
```

## Estrutura

```
queueos/
├── prisma/
│   ├── schema.prisma         # JobLog, WorkerSnapshot, QueueSnapshot
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── config/
│   │   ├── redis.ts          # singleton Redis (ioredis)
│   │   ├── prisma.ts         # singleton PrismaClient
│   │   └── queues.ts         # 4 filas BullMQ tipadas
│   ├── jobs/types.ts         # interfaces dos jobs (EmailJobData etc.)
│   ├── producers/jobProducer.ts  # enqueueEmail/Report/Image/Notification
│   ├── workers/
│   │   ├── emailWorker.ts    # concorrência 10
│   │   ├── reportWorker.ts   # concorrência 3
│   │   ├── imageWorker.ts    # concorrência 6
│   │   ├── notifWorker.ts    # concorrência 15
│   │   ├── _persist.ts       # grava JobLog ao completar/falhar
│   │   ├── _logger.ts        # logger ANSI colorido
│   │   └── index.ts          # orquestrador com graceful shutdown
│   ├── snapshots/
│   │   └── queueSnapshot.ts  # scheduler 60s -> QueueSnapshot
│   └── dashboard/
│       ├── server.ts         # Express + endpoints
│       ├── _auth.ts          # HTTP Basic Auth
│       ├── _tenant.ts        # X-Tenant-Id middleware
│       ├── _alerts.ts        # webhook em ≥3 failures/60s
│       ├── _prometheus.ts    # exposition format
│       └── public/           # HTML/CSS/JS puro
├── k8s/                      # manifestos Kubernetes
├── Dockerfile                # multi-stage build
├── docker-compose.yml        # stack completo pra dev
└── ROADMAP.md                # 9 sprints documentados
```

## Roadmap (9 sprints, todos concluídos)

1. ✅ Fundação (Node + TS + ESM + git)
2. ✅ Redis + conexão ioredis
3. ✅ 4 filas BullMQ + producer tipado
4. ✅ Workers com `updateProgress`, retry, listeners
5. ✅ Prisma + Postgres + dashboard Express + frontend dark
6. ✅ Auth Basic + pause/resume + alertas webhook
7. ✅ Métricas históricas + export CSV + snapshots 60s
8. ✅ Cron jobs (BullMQ repeat) + multi-tenant via header
9. ✅ Docker + docker-compose + K8s + Prometheus + Grafana

Ver [ROADMAP.md](ROADMAP.md) para detalhes.

## Licença

MIT
