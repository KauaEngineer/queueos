import { allQueues } from '../config/queues.js';
import { prisma } from '../config/prisma.js';

/**
 * Formato Prometheus exposition: text/plain com métricas
 * https://prometheus.io/docs/instrumenting/exposition_formats/
 */
export async function buildPrometheusMetrics(): Promise<string> {
  const lines: string[] = [];

  // ------ Job counts por fila (gauges atuais) ------
  lines.push('# HELP queueos_jobs Jobs por fila e estado');
  lines.push('# TYPE queueos_jobs gauge');
  for (const q of allQueues) {
    const c = await q.getJobCounts('wait', 'active', 'completed', 'failed', 'delayed');
    for (const [state, n] of Object.entries(c)) {
      lines.push(`queueos_jobs{queue="${q.name}",state="${state}"} ${n}`);
    }
  }

  // ------ Total persistido por status (counters) ------
  lines.push('# HELP queueos_logs_total Total de jobs persistidos no Postgres');
  lines.push('# TYPE queueos_logs_total counter');
  const completed = await prisma.jobLog.count({ where: { status: 'completed' } });
  const failed = await prisma.jobLog.count({ where: { status: 'failed' } });
  lines.push(`queueos_logs_total{status="completed"} ${completed}`);
  lines.push(`queueos_logs_total{status="failed"} ${failed}`);

  // ------ Duração média (gauge) ------
  lines.push('# HELP queueos_avg_duration_ms Duração média dos jobs em ms');
  lines.push('# TYPE queueos_avg_duration_ms gauge');
  const avg = await prisma.jobLog.aggregate({ _avg: { durationMs: true } });
  lines.push(`queueos_avg_duration_ms ${Math.round(avg._avg.durationMs ?? 0)}`);

  return lines.join('\n') + '\n';
}
