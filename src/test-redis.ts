import { redis } from './config/redis.js';

async function main() {
  console.log('--- Teste de conexão Redis ---');

  await redis.set('queueos:teste', 'Olá Kauan! Sprint 2 funcionando 🎉');
  console.log('[set] chave "queueos:teste" gravada');

  const valor = await redis.get('queueos:teste');
  console.log(`[get] valor lido: "${valor}"`);

  const info = await redis.info('server');
  const versao = info.split('\n').find((l: string) => l.startsWith('redis_version'));
  console.log(`[info] ${versao?.trim()}`);

  await redis.del('queueos:teste');
  console.log('[del] chave de teste removida');

  await redis.quit();
  console.log('--- Conexão encerrada ---');
}

main().catch((err) => {
  console.error('Falhou:', err);
  process.exit(1);
});
