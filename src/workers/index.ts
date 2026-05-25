import { emailWorker } from './emailWorker.js';
import { reportWorker } from './reportWorker.js';
import { imageWorker } from './imageWorker.js';
import { notifWorker } from './notifWorker.js';
import { log } from './_logger.js';

const workers = [
  { name: 'email-sender', w: emailWorker, conc: 10 },
  { name: 'report-gen', w: reportWorker, conc: 3 },
  { name: 'image-proc', w: imageWorker, conc: 6 },
  { name: 'notifications', w: notifWorker, conc: 15 },
];

console.log('\n╔══════════════════════════════════════════╗');
console.log('║       QueueOS — Workers iniciando         ║');
console.log('╚══════════════════════════════════════════╝');
for (const { name, conc } of workers) {
  log(name, 'ok', `worker pronto (concorrência ${conc})`);
}
console.log('\n>>> Aguardando jobs. Ctrl+C pra encerrar.\n');

async function shutdown(signal: string) {
  console.log(`\n[shutdown] sinal ${signal} recebido, fechando workers...`);
  await Promise.all(workers.map(({ w }) => w.close()));
  console.log('[shutdown] todos os workers encerrados. Bye!');
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
