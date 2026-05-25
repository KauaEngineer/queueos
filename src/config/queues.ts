import { Queue, type QueueOptions } from 'bullmq';
import { redisConnection } from './redis.js';
import { QUEUE_NAMES } from '../jobs/types.js';
import type {
  EmailJobData,
  ReportJobData,
  ImageJobData,
  NotificationJobData,
} from '../jobs/types.js';

/**
 * Opções padrão de retry e housekeeping aplicadas a TODOS os jobs.
 * Cada fila pode sobrescrever depois se precisar.
 */
const baseJobOptions: QueueOptions['defaultJobOptions'] = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: { count: 1000, age: 24 * 3600 }, // mantém últimos 1000 ou 24h
  removeOnFail: { count: 5000, age: 7 * 24 * 3600 }, // failed: 5k ou 7 dias
};

/**
 * Fábrica de filas tipada — garante que cada Queue<T> só aceita o tipo certo.
 */
function makeQueue<T>(name: string, overrides?: QueueOptions['defaultJobOptions']) {
  return new Queue<T>(name, {
    connection: redisConnection,
    defaultJobOptions: { ...baseJobOptions, ...overrides },
  });
}

export const emailQueue = makeQueue<EmailJobData>(QUEUE_NAMES.EMAIL);

export const reportQueue = makeQueue<ReportJobData>(QUEUE_NAMES.REPORT, {
  attempts: 2,
});

export const imageQueue = makeQueue<ImageJobData>(QUEUE_NAMES.IMAGE);

export const notificationQueue = makeQueue<NotificationJobData>(QUEUE_NAMES.NOTIFICATION, {
  attempts: 5,
});

export const allQueues = [emailQueue, reportQueue, imageQueue, notificationQueue];

/**
 * Fecha todas as conexões — útil em scripts CLI pra processo encerrar.
 */
export async function closeAllQueues() {
  await Promise.all(allQueues.map((q) => q.close()));
}
