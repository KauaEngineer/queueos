import { prisma } from '../src/config/prisma.js';

const QUEUES = ['email-sender', 'report-gen', 'image-proc', 'notifications'] as const;
const JOB_NAMES: Record<(typeof QUEUES)[number], string> = {
  'email-sender': 'send-email',
  'report-gen': 'generate-report',
  'image-proc': 'process-image',
  notifications: 'send-notification',
};

async function main() {
  console.log('🌱 Limpando tabelas...');
  await prisma.jobLog.deleteMany();
  await prisma.queueSnapshot.deleteMany();
  await prisma.workerSnapshot.deleteMany();

  console.log('🌱 Inserindo 10 JobLogs fake...');
  const logs = Array.from({ length: 10 }).map((_, i) => {
    const queue = QUEUES[i % QUEUES.length]!;
    const failed = i === 7; // 1 falha pra testar
    return {
      queueName: queue,
      jobId: String(1000 + i),
      jobName: JOB_NAMES[queue],
      status: failed ? ('failed' as const) : ('completed' as const),
      durationMs: 200 + Math.floor(Math.random() * 1800),
      attempts: failed ? 3 : 1,
      result: failed ? undefined : { ok: true, seeded: true },
      error: failed ? 'mock: SMTP timeout' : undefined,
      createdAt: new Date(Date.now() - i * 60_000),
    };
  });
  await prisma.jobLog.createMany({ data: logs });

  console.log('🌱 Inserindo 1 QueueSnapshot por fila...');
  await prisma.queueSnapshot.createMany({
    data: QUEUES.map((q) => ({
      queueName: q,
      waiting: 0,
      active: 0,
      completed: 10,
      failed: 1,
      delayed: 0,
    })),
  });

  const total = await prisma.jobLog.count();
  console.log(`✅ Seed pronto. ${total} job_logs no banco.`);
}

main()
  .catch((err) => {
    console.error('Seed falhou:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
