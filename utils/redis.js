/**
 * Redis Client Configuration
 *
 * Purpose: Provides Redis caching layer for improved performance
 * Use cases:
 * - Dashboard statistics caching (5 minutes TTL)
 * - Customer list caching (2 minutes TTL)
 * - Tariff data caching (1 hour TTL)
 * - Meter readings caching (30 seconds TTL)
 *
 * Uses Upstash Redis for serverless compatibility
 */

import Redis from 'ioredis';
import { configDotenv } from 'dotenv';

configDotenv();

let redisClient = null;

/**
 * Initialize Redis connection
 * Supports both Upstash Redis (cloud) and local Redis
 */
function createRedisClient() {
  try {
    // Check if Redis URL is configured
    if (!process.env.REDIS_URL) {
      console.warn('⚠️  REDIS_URL not configured. Caching disabled.');
      return null;
    }

    // Upstash Redis configuration
    const redis = new Redis(process.env.REDIS_URL, {
      // Upstash requires TLS
      tls: process.env.REDIS_URL.startsWith('rediss://') ? {
        rejectUnauthorized: false
      } : undefined,

      // Connection settings
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => {
        // Max 3 retries, then give up (return null = no retry)
        if (times >= 3) {
          console.warn('⚠️  Redis: max retries reached, disabling cache.');
          return null;
        }
        return Math.min(times * 500, 2000);
      },

      // Reconnect settings
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          return true;
        }
        return false;
      },

      // Disable offline queue (fail fast)
      enableOfflineQueue: false,

      // Timeout settings
      connectTimeout: 10000,
      commandTimeout: 5000,
    });

    // Connection event handlers
    redis.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });

    redis.on('ready', () => {
      console.log('🚀 Redis client ready');
    });

    redis.on('error', (err) => {
      console.error('❌ Redis error:', err.message);
    });

    redis.on('close', () => {
      console.warn('⚠️  Redis connection closed');
    });

    redis.on('reconnecting', () => {
      console.log('🔄 Reconnecting to Redis...');
    });

    return redis;

  } catch (error) {
    console.error('❌ Failed to create Redis client:', error.message);
    return null;
  }
}

// Initialize Redis client (singleton pattern)
redisClient = createRedisClient();

/**
 * Get value from cache
 * @param {string} key - Cache key
 * @returns {Promise<any|null>} - Cached value or null
 */
export async function getCache(key) {
  if (!redisClient) return null;

  try {
    const value = await redisClient.get(key);
    if (value) {
      console.log(`📦 Cache HIT: ${key}`);
      return JSON.parse(value);
    }
    console.log(`❌ Cache MISS: ${key}`);
    return null;
  } catch (error) {
    console.error('Redis GET error:', error.message);
    return null;
  }
}

/**
 * Set value in cache with TTL
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttl - Time to live in seconds (default: 300 = 5 minutes)
 */
export async function setCache(key, value, ttl = 300) {
  if (!redisClient) return false;

  try {
    await redisClient.setex(key, ttl, JSON.stringify(value));
    console.log(`💾 Cache SET: ${key} (TTL: ${ttl}s)`);
    return true;
  } catch (error) {
    console.error('Redis SET error:', error.message);
    return false;
  }
}

/**
 * Delete cache by key
 * @param {string} key - Cache key
 */
export async function deleteCache(key) {
  if (!redisClient) return false;

  try {
    await redisClient.del(key);
    console.log(`🗑️  Cache DELETED: ${key}`);
    return true;
  } catch (error) {
    console.error('Redis DEL error:', error.message);
    return false;
  }
}

/**
 * Delete cache by pattern (e.g., "customer:*")
 * @param {string} pattern - Key pattern
 */
export async function deleteCacheByPattern(pattern) {
  if (!redisClient) return false;

  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(...keys);
      console.log(`🗑️  Cache DELETED (pattern): ${pattern} (${keys.length} keys)`);
    }
    return true;
  } catch (error) {
    console.error('Redis DEL pattern error:', error.message);
    return false;
  }
}

/**
 * Clear all cache
 */
export async function clearCache() {
  if (!redisClient) return false;

  try {
    await redisClient.flushdb();
    console.log('🗑️  All cache CLEARED');
    return true;
  } catch (error) {
    console.error('Redis FLUSHDB error:', error.message);
    return false;
  }
}

/**
 * Check if Redis is connected
 */
export function isRedisConnected() {
  return redisClient && redisClient.status === 'ready';
}

/**
 * Get Redis client (for advanced usage)
 */
export function getRedisClient() {
  return redisClient;
}

// Graceful shutdown
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
  getRedisClient
};
