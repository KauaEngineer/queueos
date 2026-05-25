import type { Job } from 'bullmq';
import { prisma } from '../config/prisma.js';
import { log } from './_logger.js';

/**
 * Helpers que persistem o resultado/falha do job no Postgres.
 * Chamados pelos listeners 'completed' e 'failed' de cada worker.
 */

export async function persistCompleted(
  queueName: string,
  job: Job,
  result: unknown,
) {
  try {
    const durationMs = Number(job.finishedOn ?? Date.now()) - Number(job.processedOn ?? Date.now());
    await prisma.jobLog.create({
      data: {
        queueName,
        jobId: String(job.id),
        jobName: job.name,
        status: 'completed',
        durationMs,
        attempts: job.attemptsMade,
        result: result as object,
      },
    });
  } catch (err) {
    log(queueName, 'warn', `persist completed falhou: ${(err as Error).message}`);
  }
}

export async function persistFailed(
  queueName: string,
  job: Job | undefined,
  err: Error,
) {
  if (!job) return;
  try {
    const durationMs = Number(job.finishedOn ?? Date.now()) - Number(job.processedOn ?? Date.now());
    await prisma.jobLog.create({
      data: {
        queueName,
        jobId: String(job.id),
        jobName: job.name,
        status: 'failed',
        durationMs: durationMs > 0 ? durationMs : 0,
        attempts: job.attemptsMade,
        error: err.message,
      },
    });
  } catch (persistErr) {
    log(queueName, 'warn', `persist failed falhou: ${(persistErr as Error).message}`);
  }
}
