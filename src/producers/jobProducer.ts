import {
  emailQueue,
  reportQueue,
  imageQueue,
  notificationQueue,
} from '../config/queues.js';
import type {
  EmailJobData,
  ReportJobData,
  ImageJobData,
  NotificationJobData,
} from '../jobs/types.js';

type EnqueueOpts = {
  delay?: number;
  priority?: number;
  tenantId?: string;
  repeat?: { pattern: string }; // cron pattern, ex: "0 9 * * *"
  jobId?: string;
};

/** Acopla tenantId em job.data se vier nas opts. */
function withTenant<T extends object>(data: T, tenantId?: string): T & { tenantId?: string } {
  return tenantId ? { ...data, tenantId } : (data as T & { tenantId?: string });
}

function pickOpts(opts?: EnqueueOpts) {
  if (!opts) return undefined;
  const { tenantId: _t, ...rest } = opts;
  return rest;
}

export async function enqueueEmail(data: EmailJobData, opts?: EnqueueOpts) {
  return emailQueue.add('send-email', withTenant(data, opts?.tenantId), pickOpts(opts));
}

export async function enqueueReport(data: ReportJobData, opts?: EnqueueOpts) {
  return reportQueue.add('generate-report', withTenant(data, opts?.tenantId), pickOpts(opts));
}

export async function enqueueImage(data: ImageJobData, opts?: EnqueueOpts) {
  return imageQueue.add('process-image', withTenant(data, opts?.tenantId), pickOpts(opts));
}

export async function enqueueNotification(data: NotificationJobData, opts?: EnqueueOpts) {
  const priority =
    opts?.priority ?? (data.priority === 'high' ? 1 : data.priority === 'low' ? 10 : 5);
  return notificationQueue.add(
    'send-notification',
    withTenant(data, opts?.tenantId),
    { ...pickOpts(opts), priority },
  );
}
