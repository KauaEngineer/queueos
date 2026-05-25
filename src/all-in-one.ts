/**
 * Entrypoint unificado: sobe workers + dashboard no mesmo processo Node.
 * Usado em deploys gratuitos (Render free tier) onde só temos 1 service slot.
 * Em produção real, separar em processos diferentes (ver Dockerfile + docker-compose).
 */
import { execSync } from 'node:child_process';

console.log('🚀 QueueOS — modo all-in-one (workers + dashboard)\n');

// Roda migrations no boot — idempotente, seguro rodar sempre
if (process.env.RUN_MIGRATIONS !== 'false') {
  try {
    console.log('[boot] aplicando migrations...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  } catch (err) {
    console.error('[boot] migration falhou (continuando mesmo assim):', (err as Error).message);
  }
}

// Sobe workers primeiro — eles se registram no Redis e ficam escutando
await import('./workers/index.js');

// Sobe dashboard Express na sequência
await import('./dashboard/server.js');

console.log('\n✅ Workers e dashboard rodando no mesmo processo.');
