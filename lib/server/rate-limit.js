import { createHash } from 'node:crypto';
import { Redis } from '@upstash/redis';

let redisInstance;

export class RateLimitError extends Error {
  constructor(retryAfter) {
    super('rate_limited');
    this.retryAfter = retryAfter;
  }
}

export function getRedis() {
  if (redisInstance !== undefined) return redisInstance;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    redisInstance = null;
    return redisInstance;
  }
  redisInstance = new Redis({ url, token });
  return redisInstance;
}

function numberEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function hashIdentifier(value) {
  const salt = process.env.RATE_LIMIT_SALT || 'song2radio-development';
  return createHash('sha256').update(`${salt}|${value}`).digest('hex').slice(0, 32);
}

async function consume(redis, key, limit, ttlSeconds) {
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, ttlSeconds);
  if (count > limit) throw new RateLimitError(ttlSeconds);
}

export async function enforceRateLimits({ redis, installId, ip, includeAlbumIntro }) {
  if (!redis) {
    if (process.env.VERCEL_ENV === 'production') throw new Error('rate_limit_not_configured');
    return;
  }

  const now = new Date();
  const hour = now.toISOString().slice(0, 13);
  const day = now.toISOString().slice(0, 10);
  const installHash = hashIdentifier(installId);
  const ipHash = hashIdentifier(ip || 'unknown');

  await consume(redis, `limit:global:${day}`, numberEnv('GLOBAL_DAILY_LIMIT', 5000), 60 * 60 * 26);
  await consume(redis, `limit:ip:${ipHash}:${hour}`, numberEnv('HOURLY_IP_LIMIT', 40), 60 * 65);
  await consume(redis, `limit:install:${installHash}:${day}`, numberEnv('DAILY_INSTALL_LIMIT', 120), 60 * 60 * 26);
  if (includeAlbumIntro) {
    await consume(redis, `limit:album:${installHash}:${day}`, numberEnv('DAILY_ALBUM_LIMIT', 12), 60 * 60 * 26);
  }
}
