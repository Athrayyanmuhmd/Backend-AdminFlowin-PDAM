import { Redis } from 'ioredis';
import { configDotenv } from 'dotenv';

configDotenv();

let redisClient: Redis | null = null;

function createRedisClient(): Redis | null {
  try {
    if (!process.env.REDIS_URL) {
      console.warn('⚠️  REDIS_URL not configured. Caching disabled.');
      return null;
    }

    let retryCount = 0;
    const MAX_RETRIES = 2;

    const redis = new Redis(process.env.REDIS_URL, {
      tls: process.env.REDIS_URL.startsWith('rediss://')
        ? { rejectUnauthorized: false }
        : undefined,
      maxRetriesPerRequest: 1,
      retryStrategy: (times: number) => {
        retryCount = times;
        if (times > MAX_RETRIES) return null;
        return Math.min(times * 500, 1000);
      },
      reconnectOnError: (err: Error) => err.message.includes('READONLY'),
      enableOfflineQueue: false,
      connectTimeout: 5000,
      commandTimeout: 3000,
    });

    redis.on('connect', () => console.log('✅ Redis connected successfully'));
    redis.on('ready', () => console.log('🚀 Redis client ready'));
    redis.on('error', (err: Error) => {
      if (retryCount <= MAX_RETRIES) console.error('❌ Redis error:', err.message);
    });
    redis.on('close', () => {
      if (retryCount <= MAX_RETRIES) console.warn('⚠️  Redis connection closed');
    });
    redis.on('reconnecting', () => {
      if (retryCount <= MAX_RETRIES) console.log('🔄 Reconnecting to Redis...');
    });
    redis.on('end', () => {
      console.warn('⚠️  Redis disabled (unreachable). Caching off — server tetap jalan.');
      redisClient = null;
    });

    return redis;
  } catch (error: any) {
    console.error('❌ Failed to create Redis client:', error.message);
    return null;
  }
}

redisClient = createRedisClient();

export async function getCache(key: string): Promise<any | null> {
  if (!redisClient) return null;
  try {
    const value = await redisClient.get(key);
    if (value) {
      console.log(`📦 Cache HIT: ${key}`);
      return JSON.parse(value);
    }
    console.log(`❌ Cache MISS: ${key}`);
    return null;
  } catch (error: any) {
    console.error('Redis GET error:', error.message);
    return null;
  }
}

export async function setCache(key: string, value: any, ttl = 300): Promise<boolean> {
  if (!redisClient) return false;
  try {
    await redisClient.setex(key, ttl, JSON.stringify(value));
    console.log(`💾 Cache SET: ${key} (TTL: ${ttl}s)`);
    return true;
  } catch (error: any) {
    console.error('Redis SET error:', error.message);
    return false;
  }
}

export async function deleteCache(key: string): Promise<boolean> {
  if (!redisClient) return false;
  try {
    await redisClient.del(key);
    console.log(`🗑️  Cache DELETED: ${key}`);
    return true;
  } catch (error: any) {
    console.error('Redis DEL error:', error.message);
    return false;
  }
}

export async function deleteCacheByPattern(pattern: string): Promise<boolean> {
  if (!redisClient) return false;
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(...keys);
      console.log(`🗑️  Cache DELETED (pattern): ${pattern} (${keys.length} keys)`);
    }
    return true;
  } catch (error: any) {
    console.error('Redis DEL pattern error:', error.message);
    return false;
  }
}

export async function clearCache(): Promise<boolean> {
  if (!redisClient) return false;
  try {
    await redisClient.flushdb();
    console.log('🗑️  All cache CLEARED');
    return true;
  } catch (error: any) {
    console.error('Redis FLUSHDB error:', error.message);
    return false;
  }
}

export function isRedisConnected(): boolean {
  return !!(redisClient && redisClient.status === 'ready');
}

export function getRedisClient(): Redis | null {
  return redisClient;
}

process.on('SIGTERM', async () => {
  if (redisClient) {
    console.log('Closing Redis connection...');
    await redisClient.quit();
  }
});

export default {
  getCache,
  setCache,
  deleteCache,
  deleteCacheByPattern,
  clearCache,
  isRedisConnected,
  getRedisClient,
};
