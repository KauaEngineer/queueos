import { allQueues } from '../config/queues.js';
import { prisma } from '../config/prisma.js';

/**
 * Tira snapshot do estado de cada fila e salva no Postgres.
 * Chamado a cada 60s pelo scheduler.
 */
export async function takeQueueSnapshot(): Promise<void> {
  const rows = await Promise.all(
    allQueues.map(async (q) => {
      const c = await q.getJobCounts('wait', 'active', 'completed', 'failed', 'delayed');
      return {
        queueName: q.name,
        waiting: c.wait ?? 0,
        active: c.active ?? 0,
        completed: c.completed ?? 0,
        failed: c.failed ?? 0,
        delayed: c.delayed ?? 0,
      };
    }),
  );

  await prisma.queueSnapshot.createMany({ data: rows });
}

/**
 * Inicia loop que tira snapshot a cada `intervalMs` (default 60s).
 * Retorna função pra parar.
 */
export function startSnapshotScheduler(intervalMs = 60_000): () => void {
  // Tira o primeiro snapshot imediatamente
  void takeQueueSnapshot().catch((e) => console.error('[snapshot] erro:', e.message));

  const handle = setInterval(() => {
    void takeQueueSnapshot().catch((e) => console.error('[snapshot] erro:', e.message));
  }, intervalMs);

  return () => clearInterval(handle);
}
