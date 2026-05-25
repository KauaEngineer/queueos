import { Worker, type Job } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { QUEUE_NAMES, type NotificationJobData } from '../jobs/types.js';
import { log } from './_logger.js';

const WORKER = 'notifications';

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export const notifWorker = new Worker<NotificationJobData>(
  QUEUE_NAMES.NOTIFICATION,
  async (job: Job<NotificationJobData>) => {
    const { channel, recipient, message, priority } = job.data;
    log(WORKER, 'info', `#${job.id} ${channel.toUpperCase()} -> ${recipient} (prio=${priority ?? 'normal'})`);

    await job.updateProgress(50);
    await sleep(150); // mock: chamar provedor (FCM/Twilio/webhook)

    await job.updateProgress(100);
    return { channel, delivered: true, message };
  },
  {
    connection: redisConnection,
    concurrency: 15,
  },
);

notifWorker.on('completed', (job, result) => {
  log(WORKER, 'ok', `#${job.id} entregue -> ${result.channel}`);
});

notifWorker.on('failed', (job, err) => {
  log(WORKER, 'error', `#${job?.id} falhou (tentativa ${job?.attemptsMade}): ${err.message}`);
});
