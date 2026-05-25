# QueueOS — Roadmap de Implementação

> Sistema de filas e jobs assíncronos com Node.js + Redis + BullMQ + TypeScript + Prisma + PostgreSQL + Dashboard em tempo real.

Cada sprint termina com um **commit** e o sistema **rodando**. Não pulamos sprints — cada um depende do anterior.

---

## Sprint 1 — Fundação do projeto

**Objetivo:** ter um projeto Node + TypeScript rodando e versionado.

- [ ] `npm init -y` — cria `package.json`
- [ ] Instalar TypeScript: `npm i -D typescript @types/node tsx`
- [ ] Criar `tsconfig.json` com `strict: true`, `target: ES2022`, `module: NodeNext`
- [ ] Criar estrutura de pastas: `src/config`, `src/workers`, `src/producers`, `src/jobs`, `src/dashboard`
- [ ] Criar `.gitignore` (node_modules, dist, .env, *.log)
- [ ] Criar `.env.example` com placeholders das variáveis
- [ ] `git init` + primeiro commit "chore: scaffold inicial"
- [ ] Criar repo no GitHub e fazer push

---

## Sprint 2 — Redis + conexão básica

**Objetivo:** Redis rodando localmente e Node se conectando.

- [ ] Subir Redis via Docker: `docker run -d -p 6379:6379 --name queueos-redis redis:7-alpine`
- [ ] Instalar ioredis: `npm i ioredis`
- [ ] Criar `src/config/redis.ts` lendo `REDIS_HOST/PORT/PASSWORD/DB` do `.env`
- [ ] Instalar dotenv: `npm i dotenv` + carregar no topo do entrypoint
- [ ] Criar `src/test-redis.ts` que faz `SET/GET` pra validar conexão
- [ ] Adicionar script `"redis:test": "tsx src/test-redis.ts"` no `package.json`
- [ ] Commit "feat: conexão Redis"

---

## Sprint 3 — Filas BullMQ + Producer

**Objetivo:** conseguir jogar jobs em 4 filas diferentes.

- [ ] Instalar BullMQ: `npm i bullmq`
- [ ] Criar `src/jobs/types.ts` com interfaces tipadas (`EmailJobData`, `ReportJobData`, `ImageJobData`, `NotificationJobData`)
- [ ] Criar `src/config/queues.ts` instanciando as 4 filas: `email-sender`, `report-gen`, `image-proc`, `notifications`
- [ ] Configurar opções por fila: `defaultJobOptions` com `attempts`, `backoff: { type: 'exponential', delay: 2000 }`, `removeOnComplete: 1000`
- [ ] Criar `src/producers/jobProducer.ts` exportando funções `enqueueEmail()`, `enqueueReport()`, `enqueueImage()`, `enqueueNotification()`
- [ ] Criar `src/test-producer.ts` que enfileira 1 job de cada tipo
- [ ] Validar no Redis: `docker exec -it queueos-redis redis-cli KEYS "bull:*"`
- [ ] Commit "feat: filas BullMQ e producer"

---

## Sprint 4 — Workers (consumidores)

**Objetivo:** processos consumindo as filas e processando jobs.

- [ ] Criar `src/workers/emailWorker.ts` — concorrência 10, timeout 30s, mock do envio (apenas `console.log`)
- [ ] Criar `src/workers/reportWorker.ts` — concorrência 3, timeout 120s
- [ ] Criar `src/workers/imageWorker.ts` — concorrência 6, timeout 60s
- [ ] Criar `src/workers/notifWorker.ts` — concorrência 15, timeout 10s, 5 retries
- [ ] Cada worker chama `job.updateProgress()` em pontos-chave (25/60/100)
- [ ] Cada worker escuta eventos `completed`/`failed` e loga
- [ ] Criar `src/workers/index.ts` que sobe todos juntos
- [ ] Script `"workers:start": "tsx src/workers/index.ts"`
- [ ] Testar: rodar workers + producer e ver jobs processando
- [ ] Commit "feat: workers das 4 filas"

---

## Sprint 5 — Prisma + PostgreSQL + Dashboard

**Objetivo:** persistir resultado/logs no Postgres E ter dashboard web em tempo real.

### 5.1 Banco de dados
- [ ] Subir Postgres via Docker: `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=queueos -e POSTGRES_DB=queueos --name queueos-pg postgres:16`
- [ ] Instalar Prisma: `npm i -D prisma && npm i @prisma/client`
- [ ] `npx prisma init` — gera `prisma/schema.prisma`
- [ ] Definir modelos: `JobLog` (id, queueName, jobId, status, duration, result, error, createdAt), `WorkerSnapshot` (id, name, cpu, memory, currentJobId, timestamp)
- [ ] `npx prisma migrate dev --name init`
- [ ] Criar `prisma/seed.ts` com 10 logs fake e configurar no `package.json`
- [ ] Workers chamam `prisma.jobLog.create()` ao finalizar
- [ ] Commit "feat: persistência com Prisma"

### 5.2 Dashboard
- [ ] Instalar Express: `npm i express && npm i -D @types/express`
- [ ] Criar `src/dashboard/server.ts` na porta `DASHBOARD_PORT` (3001)
- [ ] Servir `src/dashboard/public/` como estático
- [ ] Endpoints internos: `/api/metrics`, `/api/queues`, `/api/workers`, `/api/jobs/recent`
- [ ] Criar `public/index.html` + `style.css` + `app.js` (sem framework)
- [ ] Componentes: cards de métricas, throughput chart SVG, donut chart, workers grid, jobs table, logs panel
- [ ] Polling a cada 2s pros endpoints
- [ ] Script `"dashboard": "tsx src/dashboard/server.ts"`
- [ ] Commit "feat: dashboard de monitoramento"

---

## Sprint 6 — Segurança + Alertas

**Objetivo:** dashboard protegido e avisos quando algo falhar.

- [ ] Autenticação básica no dashboard (HTTP Basic ou JWT simples, usando `DASHBOARD_SECRET`)
- [ ] Rate limiting por fila: configurar `limiter: { max, duration }` no BullMQ
- [ ] Endpoint `POST /api/queues/:name/pause` e `POST /api/queues/:name/resume`
- [ ] Alertas via webhook: ao detectar X failures em Y minutos, fazer POST pra URL configurável
- [ ] Variável `ALERT_WEBHOOK_URL` no `.env`
- [ ] Botão "pausar fila" no dashboard chamando os endpoints
- [ ] Commit "feat: auth + rate limit + alertas"

---

## Sprint 7 — Métricas históricas + Exportação

**Objetivo:** ver evolução ao longo do tempo, não só "agora".

- [ ] Job recorrente que tira snapshot do estado das filas a cada 1 minuto (salva em `QueueSnapshot` no Postgres)
- [ ] Endpoint `GET /api/metrics/history?range=24h` retornando série temporal
- [ ] Gráfico no dashboard de "jobs/min últimas 24h"
- [ ] Endpoint `GET /api/logs/export?format=csv&queue=email-sender` que baixa CSV
- [ ] Botão "Exportar logs" no dashboard
- [ ] Commit "feat: métricas históricas e export"

---

## Sprint 8 — Cron jobs + Multi-tenant

**Objetivo:** agendar jobs recorrentes e suportar múltiplos clientes.

- [ ] Usar `queue.add(name, data, { repeat: { pattern: '0 9 * * *' } })` do BullMQ
- [ ] UI no dashboard pra criar/listar/deletar jobs agendados
- [ ] Adicionar `tenantId` em `JobLog` e nas filas (prefixo nas chaves Redis: `tenant:{id}:queue:{name}`)
- [ ] Endpoint `POST /api/tenants` e middleware que extrai `tenantId` do header
- [ ] Filtro de tenant no dashboard
- [ ] Commit "feat: cron jobs e multi-tenancy"

---

## Sprint 9 — Deploy Kubernetes + Prometheus

**Objetivo:** rodar em produção de verdade com observabilidade profissional.

- [ ] `Dockerfile` multi-stage (build + runtime alpine)
- [ ] `docker-compose.yml` com app + redis + postgres pra dev
- [ ] Manifestos K8s: `deployment.yaml` (api), `deployment.yaml` (workers), `service.yaml`, `configmap.yaml`, `secret.yaml`
- [ ] HPA (Horizontal Pod Autoscaler) baseado em tamanho da fila (custom metric)
- [ ] Endpoint `/metrics` formato Prometheus (gauge de waiting/active/completed/failed por fila)
- [ ] `grafana-dashboard.json` exemplo
- [ ] README.md com instruções de deploy
- [ ] Commit "feat: deploy k8s + prometheus"

---

## Definição de "pronto" por sprint

Um sprint só fecha quando:
1. Código commitado e pushed
2. Sistema sobe sem erro (`npm run workers:start` + `npm run dashboard`)
3. Você consegue **explicar com suas palavras** o que aquele sprint adiciona

---

## Stack-resumo

- **Node.js 20 LTS** — runtime
- **TypeScript 5.x** — tipagem
- **Redis 7.x** — broker das filas
- **BullMQ 4.x** — biblioteca de filas
- **Prisma + PostgreSQL 16** — persistência
- **Express** — servidor do dashboard
- **Docker** — Redis e Postgres locais
