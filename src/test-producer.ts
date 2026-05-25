import {
  enqueueEmail,
  enqueueReport,
  enqueueImage,
  enqueueNotification,
} from './producers/jobProducer.js';
import { closeAllQueues } from './config/queues.js';

async function main() {
  console.log('--- Teste de Producer: enfileirando 1 job em cada fila ---\n');

  const email = await enqueueEmail({
    to: 'kauan@example.com',
    subject: 'Bem-vindo ao QueueOS!',
    template: 'welcome',
    data: { nome: 'Kauan' },
  });
  console.log(`[email-sender]   job #${email.id}  ->  template=welcome`);

  const report = await enqueueReport({
    reportType: 'monthly',
    userId: 'user-123',
    periodStart: '2026-05-01',
    periodEnd: '2026-05-31',
  });
  console.log(`[report-gen]     job #${report.id}  ->  monthly user-123`);

  const image = await enqueueImage({
    operation: 'resize-thumbnail',
    sourceUrl: 'https://exemplo.com/foto.jpg',
    targetWidth: 200,
    targetHeight: 200,
  });
  console.log(`[image-proc]     job #${image.id}  ->  resize 200x200`);

  const notif = await enqueueNotification({
    channel: 'push',
    recipient: 'device-token-abc',
    message: 'Você tem uma nova mensagem',
    priority: 'high',
  });
  console.log(`[notifications]  job #${notif.id}  ->  push HIGH`);

  console.log('\n✅ 4 jobs enfileirados com sucesso.');
  console.log('Os jobs ainda NÃO foram processados — workers virão no Sprint 4.\n');

  await closeAllQueues();
}

main().catch((err) => {
  console.error('Falhou:', err);
  process.exit(1);
});
