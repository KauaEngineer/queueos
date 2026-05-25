import { Redis } from 'ioredis';
import 'dotenv/config';

const host = process.env.REDIS_HOST ?? 'localhost';
const port = Number(process.env.REDIS_PORT ?? 6379);
const password = process.env.REDIS_PASSWORD || undefined;
const db = Number(process.env.REDIS_DB ?? 0);

export const redisConnection = {
  host,
  port,
  password,
  db,
  maxRetriesPerRequest: null,
};

export const redis = new Redis(redisConnection);

redis.on('connect', () => {
  console.log(`[redis] conectado em ${host}:${port} (db=${db})`);
});

redis.on('error', (err: Error) => {
  console.error('[redis] erro:', err.message);
});
