import { Worker, type Job } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { QUEUE_NAMES, type ReportJobData } from '../jobs/types.js';
import { log } from './_logger.js';

const WORKER = 'report-gen';

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export const reportWorker = new Worker<ReportJobData>(
  QUEUE_NAMES.REPORT,
  async (job: Job<ReportJobData>) => {
    const { reportType, userId, periodStart, periodEnd } = job.data;
    log(WORKER, 'info', `gerando #${job.id} -> ${reportType} (${periodStart}..${periodEnd}) user=${userId}`);

    await job.updateProgress(20);
    await sleep(500); // mock: query DB

    await job.updateProgress(55);
    await sleep(800); // mock: agregar dados

    await job.updateProgress(85);
    await sleep(500); // mock: gerar PDF
    log(WORKER, 'progress', `#${job.id} PDF renderizado`);

    await job.updateProgress(100);
    return { pdfUrl: `https://cdn.fake/reports/${job.id}.pdf`, pages: 12 };
  },
  {
    connection: redisConnection,
    concurrency: 3,
  },
);

reportWorker.on('completed', (job, result) => {
  log(WORKER, 'ok', `#${job.id} concluído -> ${JSON.stringify(result)}`);
});

reportWorker.on('failed', (job, err) => {
  log(WORKER, 'error', `#${job?.id} falhou (tentativa ${job?.attemptsMade}): ${err.message}`);
});
