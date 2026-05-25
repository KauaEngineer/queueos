import { Worker, type Job } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { QUEUE_NAMES, type ImageJobData } from '../jobs/types.js';
import { log } from './_logger.js';
import { persistCompleted, persistFailed } from './_persist.js';

const WORKER = 'image-proc';

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export const imageWorker = new Worker<ImageJobData>(
  QUEUE_NAMES.IMAGE,
  async (job: Job<ImageJobData>) => {
    const { operation, sourceUrl, targetWidth, targetHeight } = job.data;
    log(WORKER, 'info', `#${job.id} ${operation} <- ${sourceUrl}`);

    await job.updateProgress(30);
    await sleep(300); // mock: download

    await job.updateProgress(70);
    await sleep(600); // mock: processar (sharp/imagemagick)
    log(WORKER, 'progress', `#${job.id} processada ${targetWidth ?? '?'}x${targetHeight ?? '?'}`);

    await job.updateProgress(100);
    return {
      operation,
      outputUrl: `https://cdn.fake/images/${job.id}-${operation}.webp`,
      bytes: 24_500,
    };
  },
  {
    connection: redisConnection,
    concurrency: 6,
  },
);

imageWorker.on('completed', (job, result) => {
  log(WORKER, 'ok', `#${job.id} concluído -> ${JSON.stringify(result)}`);
  void persistCompleted(WORKER, job, result);
});

imageWorker.on('failed', (job, err) => {
  log(WORKER, 'error', `#${job?.id} falhou (tentativa ${job?.attemptsMade}): ${err.message}`);
  void persistFailed(WORKER, job, err);
});
