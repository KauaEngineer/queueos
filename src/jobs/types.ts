/**
 * Nomes das filas — usados como string em todo o sistema.
 * Centralizar evita typo (ex: 'email-sander' não compila).
 */
export const QUEUE_NAMES = {
  EMAIL: 'email-sender',
  REPORT: 'report-gen',
  IMAGE: 'image-proc',
  NOTIFICATION: 'notifications',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// ============================================
// email-sender
// ============================================
export interface EmailJobData {
  to: string;
  subject: string;
  template: 'welcome' | 'password-reset' | 'newsletter' | 'generic';
  data?: Record<string, unknown>;
}

// ============================================
// report-gen
// ============================================
export interface ReportJobData {
  reportType: 'monthly' | 'sales-analytics' | 'user-activity';
  userId: string;
  periodStart: string; // ISO date
  periodEnd: string;
}

// ============================================
// image-proc
// ============================================
export interface ImageJobData {
  operation: 'resize-thumbnail' | 'webp-convert' | 'watermark';
  sourceUrl: string;
  targetWidth?: number;
  targetHeight?: number;
  watermarkText?: string;
}

// ============================================
// notifications
// ============================================
export interface NotificationJobData {
  channel: 'push' | 'sms' | 'webhook';
  recipient: string;
  message: string;
  priority?: 'low' | 'normal' | 'high';
}
