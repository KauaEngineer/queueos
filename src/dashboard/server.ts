import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

import { allQueues } from '../config/queues.js';
import { prisma } from '../config/prisma.js';
import { QUEUE_NAMES } from '../jobs/types.js';
import { basicAuth } from './_auth.js';
import { checkAndAlert } from './_alerts.js';
import { startSnapshotScheduler } from '../snapshots/queueSnapshot.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.DASHBOARD_PORT ?? 3001);
const SECRET = process.env.DASHBOARD_SECRET ?? 'dev-secret-trocar-em-prod';

app.use(express.json());

// Auth aplicada a tudo, exceto /api/health (pra monitoring poder pingar)
app.use((req, res, next) => {
  if (req.path === '/api/health') return next();
  return basicAuth(SECRET)(req, res, next);
});

app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// GET /api/queues
// Estado de cada fila (waiting/active/completed/failed/delayed/paused)
// ============================================
app.get('/api/queues', async (_req, res) => {
  const stats = await Promise.all(
    allQueues.map(async (q) => {
      const counts = await q.getJobCounts('wait', 'active', 'completed', 'failed', 'delayed', 'paused');
      const isPaused = await q.isPaused();
      return {
        name: q.name,
        waiting: counts.wait ?? 0,
        active: counts.active ?? 0,
        completed: counts.completed ?? 0,
        failed: counts.failed ?? 0,
        delayed: counts.delayed ?? 0,
        paused: isPaused,
      };
    }),
  );
  res.json({ queues: stats, generatedAt: new Date().toISOString() });
});

// ============================================
// GET /api/metrics
// Métricas agregadas para os cards do topo
// ============================================
app.get('/api/metrics', async (_req, res) => {
  const oneMinAgo = new Date(Date.now() - 60_000);

  const [recentCount, totalCompleted, totalFailed, avgDuration] = await Promise.all([
    prisma.jobLog.count({ where: { createdAt: { gte: oneMinAgo } } }),
    prisma.jobLog.count({ where: { status: 'completed' } }),
    prisma.jobLog.count({ where: { status: 'failed' } }),
    prisma.jobLog.aggregate({ _avg: { durationMs: true } }),
  ]);

  const total = totalCompleted + totalFailed;
  const successRate = total === 0 ? 100 : Number(((totalCompleted / total) * 100).toFixed(1));

  res.json({
    jobsPerMin: recentCount,
    completed: totalCompleted,
    failed: totalFailed,
    successRate,
    avgDurationMs: Math.round(avgDuration._avg.durationMs ?? 0),
  });
});

// ============================================
// GET /api/jobs/recent
// Últimos 10 jobs processados
// ============================================
app.get('/api/jobs/recent', async (_req, res) => {
  const jobs = await prisma.jobLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  res.json({ jobs });
});

// ============================================
// GET /api/workers
// Lista estática dos workers (Sprint 7 puxa de WorkerSnapshot real)
// ============================================
app.get('/api/workers', (_req, res) => {
  res.json({
    workers: [
      { name: QUEUE_NAMES.EMAIL, concurrency: 10, cpu: rnd(15, 45), memory: rnd(80, 150) },
      { name: QUEUE_NAMES.REPORT, concurrency: 3, cpu: rnd(20, 60), memory: rnd(120, 220) },
      { name: QUEUE_NAMES.IMAGE, concurrency: 6, cpu: rnd(25, 70), memory: rnd(150, 280) },
      { name: QUEUE_NAMES.NOTIFICATION, concurrency: 15, cpu: rnd(10, 35), memory: rnd(60, 120) },
    ],
  });
});

// ============================================
// GET /api/throughput
// Série histórica dos últimos 60s (1 ponto por segundo)
// ============================================
app.get('/api/throughput', async (_req, res) => {
  const now = Date.now();
  const sixtySecAgo = new Date(now - 60_000);
  const recent = await prisma.jobLog.findMany({
    where: { createdAt: { gte: sixtySecAgo } },
    select: { createdAt: true },
  });

  const buckets = new Array(60).fill(0);
  for (const { createdAt } of recent) {
    const idx = Math.floor((now - createdAt.getTime()) / 1000);
    if (idx >= 0 && idx < 60) buckets[59 - idx]++;
  }

  res.json({ buckets });
});

// ============================================
// GET /api/metrics/history?range=1h|24h
// Série temporal agregada por minuto (1h) ou hora (24h)
// ============================================
app.get('/api/metrics/history', async (req, res) => {
  const range = (req.query.range as string) ?? '1h';
  const hours = range === '24h' ? 24 : 1;
  const since = new Date(Date.now() - hours * 3600 * 1000);

  const logs = await prisma.jobLog.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true, status: true, queueName: true },
    orderBy: { createdAt: 'asc' },
  });

  const bucketMs = hours === 24 ? 3600 * 1000 : 60 * 1000;
  const bucketCount = hours === 24 ? 24 : 60;
  const buckets = Array.from({ length: bucketCount }, () => ({
    completed: 0,
    failed: 0,
    t: 0,
  }));

  const now = Date.now();
  for (const log of logs) {
    const ageMs = now - log.createdAt.getTime();
    const idx = bucketCount - 1 - Math.floor(ageMs / bucketMs);
    if (idx >= 0 && idx < bucketCount) {
      if (log.status === 'completed') buckets[idx].completed++;
      else buckets[idx].failed++;
    }
  }
  for (let i = 0; i < bucketCount; i++) {
    buckets[i].t = now - (bucketCount - 1 - i) * bucketMs;
  }

  res.json({ range, bucketMs, buckets });
});

// ============================================
// GET /api/logs/export?queue=email-sender&status=failed
// Baixa CSV com os logs filtrados
// ============================================
app.get('/api/logs/export', async (req, res) => {
  const queue = req.query.queue as string | undefined;
  const status = req.query.status as 'completed' | 'failed' | undefined;

  const logs = await prisma.jobLog.findMany({
    where: {
      ...(queue ? { queueName: queue } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 10_000,
  });

  const header = 'id,queue_name,job_id,job_name,status,duration_ms,attempts,error,created_at\n';
  const rows = logs
    .map((l) =>
      [
        l.id,
        l.queueName,
        l.jobId,
        l.jobName,
        l.status,
        l.durationMs,
        l.attempts,
        `"${(l.error ?? '').replace(/"/g, '""')}"`,
        l.createdAt.toISOString(),
      ].join(','),
    )
    .join('\n');

  const fname = `queueos-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
  res.send(header + rows);
});

// ============================================
// POST /api/queues/:name/pause - pausa fila
// POST /api/queues/:name/resume - retoma fila
// ============================================
app.post('/api/queues/:name/pause', async (req, res) => {
  const queue = allQueues.find((q) => q.name === req.params.name);
  if (!queue) return res.status(404).json({ error: 'fila não encontrada' });
  await queue.pause();
  res.json({ ok: true, name: queue.name, paused: true });
});

app.post('/api/queues/:name/resume', async (req, res) => {
  const queue = allQueues.find((q) => q.name === req.params.name);
  if (!queue) return res.status(404).json({ error: 'fila não encontrada' });
  await queue.resume();
  res.json({ ok: true, name: queue.name, paused: false });
});

// ============================================
// Healthcheck (sem auth)
// ============================================
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Checa alertas a cada 30s em background
setInterval(() => void checkAndAlert(), 30_000);

// Snapshot das filas a cada 60s pra histórico
startSnapshotScheduler(60_000);

function rnd(min: number, max: number) {
  return Math.round((Math.random() * (max - min) + min) * 10) / 10;
}

app.listen(PORT, () => {
  console.log(`\n🚀 QueueOS Dashboard rodando em http://localhost:${PORT}\n`);
});
