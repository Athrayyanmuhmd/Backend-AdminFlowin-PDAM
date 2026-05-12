// @ts-nocheck
import { configDotenv } from 'dotenv';

configDotenv();

// ─────────────────────────────────────────────────────────────
// Upstash Redis REST client (preferred — works with UPSTASH_REDIS_REST_URL)
// ─────────────────────────────────────────────────────────────
let upstashClient: any = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  try {
    const { Redis } = await import('@upstash/redis');
    upstashClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    console.log('✅ Upstash Redis connected (REST API)');
  } catch (e: any) {
    console.error('❌ Upstash Redis init failed:', e.message);
    upstashClient = null;
  }
}

// ─────────────────────────────────────────────────────────────
// ioredis fallback (used when only REDIS_URL is set)
// ─────────────────────────────────────────────────────────────
import { Redis as IoRedis } from 'ioredis';

let ioredisClient: IoRedis | null = null;

if (!upstashClient && process.env.REDIS_URL) {
  try {
    let retryCount = 0;
    const MAX_RETRIES = 2;

    ioredisClient = new IoRedis(process.env.REDIS_URL, {
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

    ioredisClient.on('connect', () => console.log('✅ Redis (ioredis) connected'));
    ioredisClient.on('error', (err: Error) => {
      if (retryCount <= MAX_RETRIES) console.error('❌ Redis error:', err.message);
    });
    ioredisClient.on('end', () => {
      console.warn('⚠️  Redis disabled (unreachable). Caching off — server tetap jalan.');
      ioredisClient = null;
    });
  } catch (e: any) {
    console.error('❌ ioredis init failed:', e.message);
    ioredisClient = null;
  }
} else if (!upstashClient) {
  console.warn('⚠️  Redis tidak terkonfigurasi. Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN atau REDIS_URL.');
}

// ─────────────────────────────────────────────────────────────
// Helpers: parse value dari Upstash (bisa berupa string atau object)
// ─────────────────────────────────────────────────────────────
function parseUpstash(value: any): any {
  if (value == null) return null;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return value; }
  }
  return value;
}

// ─────────────────────────────────────────────────────────────
// STRING CACHE — get / set / del
// ─────────────────────────────────────────────────────────────
export async function getCache(key: string): Promise<any | null> {
  try {
    if (upstashClient) {
      const value = await upstashClient.get(key);
      if (value != null) {
        console.log(`📦 Cache HIT: ${key}`);
        return parseUpstash(value);
      }
      console.log(`❌ Cache MISS: ${key}`);
      return null;
    }
    if (ioredisClient) {
      const value = await ioredisClient.get(key);
      if (value) {
        console.log(`📦 Cache HIT: ${key}`);
        return JSON.parse(value);
      }
      console.log(`❌ Cache MISS: ${key}`);
      return null;
    }
    return null;
  } catch (error: any) {
    console.error('Redis GET error:', error.message);
    return null;
  }
}

export async function setCache(key: string, value: any, ttl = 300): Promise<boolean> {
  try {
    if (upstashClient) {
      await upstashClient.set(key, JSON.stringify(value), { ex: ttl });
      console.log(`💾 Cache SET: ${key} (TTL: ${ttl}s)`);
      return true;
    }
    if (ioredisClient) {
      await ioredisClient.setex(key, ttl, JSON.stringify(value));
      console.log(`💾 Cache SET: ${key} (TTL: ${ttl}s)`);
      return true;
    }
    return false;
  } catch (error: any) {
    console.error('Redis SET error:', error.message);
    return false;
  }
}

export async function deleteCache(key: string): Promise<boolean> {
  try {
    if (upstashClient) {
      await upstashClient.del(key);
      console.log(`🗑️  Cache DELETED: ${key}`);
      return true;
    }
    if (ioredisClient) {
      await ioredisClient.del(key);
      return true;
    }
    return false;
  } catch (error: any) {
    console.error('Redis DEL error:', error.message);
    return false;
  }
}

export async function deleteCacheByPattern(pattern: string): Promise<boolean> {
  try {
    if (upstashClient) {
      // Upstash scan mengembalikan cursor sebagai string (mis. "0"); `cursor !== 0` salah → loop tak pernah selesai.
      let cursor: string | number = 0;
      let deleted = 0;
      let guard = 0;
      const MAX_SCANS = 5000;
      do {
        if (++guard > MAX_SCANS) {
          console.error(`Redis SCAN pattern "${pattern}" exceeded ${MAX_SCANS} iterations — aborting`);
          break;
        }
        const result = await upstashClient.scan(cursor, { match: pattern, count: 100 });
        cursor = result[0];
        const keys = result[1] as string[];
        if (keys.length > 0) {
          await upstashClient.del(...keys);
          deleted += keys.length;
        }
      } while (String(cursor) !== '0');
      if (deleted > 0) console.log(`🗑️  Cache DELETED (pattern): ${pattern} (${deleted} keys)`);
      return true;
    }
    if (ioredisClient) {
      const keys = await ioredisClient.keys(pattern);
      if (keys.length > 0) await ioredisClient.del(...keys);
      return true;
    }
    return false;
  } catch (error: any) {
    console.error('Redis DEL pattern error:', error.message);
    return false;
  }
}

export async function clearCache(): Promise<boolean> {
  try {
    if (upstashClient) {
      await upstashClient.flushdb();
      console.log('🗑️  All cache CLEARED');
      return true;
    }
    if (ioredisClient) {
      await ioredisClient.flushdb();
      return true;
    }
    return false;
  } catch (error: any) {
    console.error('Redis FLUSHDB error:', error.message);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// HASH OPERATIONS — untuk membaca data monitoring Ahmad
// Format kunci: usage:{meteranId}:{YYYY-MM}:daily
// ─────────────────────────────────────────────────────────────

/** Baca semua field dari Redis Hash (hgetall) */
export async function hgetallCache(key: string): Promise<Record<string, string> | null> {
  try {
    if (upstashClient) {
      const result = await upstashClient.hgetall(key);
      return result && Object.keys(result).length > 0 ? result : null;
    }
    if (ioredisClient) {
      const result = await ioredisClient.hgetall(key);
      return result && Object.keys(result).length > 0 ? result : null;
    }
    return null;
  } catch (error: any) {
    console.error('Redis HGETALL error:', error.message);
    return null;
  }
}

/** Baca satu field dari Redis Hash (hget) */
export async function hgetCache(key: string, field: string): Promise<string | null> {
  try {
    if (upstashClient) {
      const result = await upstashClient.hget(key, field);
      return result != null ? String(result) : null;
    }
    if (ioredisClient) {
      return await ioredisClient.hget(key, field);
    }
    return null;
  } catch (error: any) {
    console.error('Redis HGET error:', error.message);
    return null;
  }
}

/** Baca string sederhana (get tanpa JSON.parse untuk nilai angka) */
export async function getRawCache(key: string): Promise<string | null> {
  try {
    if (upstashClient) {
      const value = await upstashClient.get(key);
      return value != null ? String(value) : null;
    }
    if (ioredisClient) {
      return await ioredisClient.get(key);
    }
    return null;
  } catch (error: any) {
    console.error('Redis GET raw error:', error.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// STATUS
// ─────────────────────────────────────────────────────────────
export function isRedisConnected(): boolean {
  if (upstashClient) return true;
  return !!(ioredisClient && ioredisClient.status === 'ready');
}

export function getRedisClient(): any {
  return upstashClient ?? ioredisClient ?? null;
}

process.on('SIGTERM', async () => {
  if (ioredisClient) {
    console.log('Closing ioredis connection...');
    await ioredisClient.quit();
  }
});

export default {
  getCache,
  setCache,
  deleteCache,
  deleteCacheByPattern,
  clearCache,
  hgetallCache,
  hgetCache,
  getRawCache,
  isRedisConnected,
  getRedisClient,
};
