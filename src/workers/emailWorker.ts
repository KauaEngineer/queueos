import { Worker, type Job } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { QUEUE_NAMES, type EmailJobData } from '../jobs/types.js';
import { log } from './_logger.js';

const WORKER = 'email-sender';

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export const emailWorker = new Worker<EmailJobData>(
  QUEUE_NAMES.EMAIL,
  async (job: Job<EmailJobData>) => {
    const { to, subject, template } = job.data;
    log(WORKER, 'info', `processando #${job.id} -> ${template} para ${to}`);

    await job.updateProgress(25);
    await sleep(200); // mock: renderizar template

    await job.updateProgress(60);
    await sleep(400); // mock: enviar via SMTP
    log(WORKER, 'progress', `#${job.id} SMTP simulado -> "${subject}"`);

    await job.updateProgress(100);
    return { sent: true, to, timestamp: Date.now() };
  },
  {
    connection: redisConnection,
    concurrency: 10,
  },
);

emailWorker.on('completed', (job, result) => {
  log(WORKER, 'ok', `#${job.id} concluído -> ${JSON.stringify(result)}`);
});

emailWorker.on('failed', (job, err) => {
  log(WORKER, 'error', `#${job?.id} falhou (tentativa ${job?.attemptsMade}): ${err.message}`);
});
