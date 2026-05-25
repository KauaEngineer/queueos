/**
 * Dispara alertas via webhook quando taxa de falha cruza um limiar.
 * Conta falhas dos últimos 60s e envia POST se >= ALERT_THRESHOLD.
 */
import { prisma } from '../config/prisma.js';

const ALERT_THRESHOLD = 3; // 3+ falhas em 60s = alerta
const COOLDOWN_MS = 60_000;
let lastAlertAt = 0;

export async function checkAndAlert(): Promise<void> {
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (!webhookUrl) return;

  const oneMinAgo = new Date(Date.now() - 60_000);
  const failed = await prisma.jobLog.count({
    where: { status: 'failed', createdAt: { gte: oneMinAgo } },
  });

  if (failed < ALERT_THRESHOLD) return;
  if (Date.now() - lastAlertAt < COOLDOWN_MS) return; // evita spam

  lastAlertAt = Date.now();

  const payload = {
    level: 'warning',
    source: 'QueueOS',
    message: `${failed} jobs falharam nos últimos 60s (limiar=${ALERT_THRESHOLD})`,
    timestamp: new Date().toISOString(),
  };

  try {
    const r = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    console.log(`[alert] webhook -> ${r.status}`);
  } catch (err) {
    console.error('[alert] falhou:', (err as Error).message);
  }
}
