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

/** Adiciona um job na fila de emails. */
export async function enqueueEmail(data: EmailJobData, opts?: { delay?: number; priority?: number }) {
  return emailQueue.add('send-email', data, opts);
}

/** Adiciona um job na fila de relatórios. */
export async function enqueueReport(data: ReportJobData, opts?: { delay?: number; priority?: number }) {
  return reportQueue.add('generate-report', data, opts);
}

/** Adiciona um job na fila de processamento de imagens. */
export async function enqueueImage(data: ImageJobData, opts?: { delay?: number; priority?: number }) {
  return imageQueue.add('process-image', data, opts);
}

/** Adiciona um job na fila de notificações. */
export async function enqueueNotification(
  data: NotificationJobData,
  opts?: { delay?: number; priority?: number },
) {
  // Prioridade automática conforme campo "priority" do payload
  const priority =
    opts?.priority ??
    (data.priority === 'high' ? 1 : data.priority === 'low' ? 10 : 5);
  return notificationQueue.add('send-notification', data, { ...opts, priority });
}
