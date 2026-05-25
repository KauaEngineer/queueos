import { Redis, type RedisOptions } from 'ioredis';
import 'dotenv/config';

/**
 * Suporta 2 modos de configuração:
 *  - REDIS_URL (Upstash, Heroku, Render addon, etc) — string completa
 *  - REDIS_HOST + REDIS_PORT + REDIS_PASSWORD + REDIS_DB (dev local)
 */

function buildConnection(): RedisOptions {
  const url = process.env.REDIS_URL;
  if (url) {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: Number(u.port || 6379),
      password: u.password || undefined,
      username: u.username || undefined,
      // Upstash exige TLS (rediss://...)
      tls: u.protocol === 'rediss:' ? {} : undefined,
      maxRetriesPerRequest: null,
    };
  }
  return {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    db: Number(process.env.REDIS_DB ?? 0),
    maxRetriesPerRequest: null,
  };
}

export const redisConnection = buildConnection();

export const redis = new Redis(redisConnection);

redis.on('connect', () => {
  console.log(`[redis] conectado em ${redisConnection.host}:${redisConnection.port}`);
});

redis.on('error', (err: Error) => {
  console.error('[redis] erro:', err.message);
});
