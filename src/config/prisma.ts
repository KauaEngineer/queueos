import { PrismaClient } from '@prisma/client';

/**
 * Singleton do PrismaClient — evita criar várias conexões.
 * Em dev com hot-reload, isso seria pior; aqui ESM já cacheia.
 */
export const prisma = new PrismaClient({
  log: ['warn', 'error'],
});
