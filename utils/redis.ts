// import {Redis} from "ioredis";
// require("dotenv").config();

// const redisClient = () => {
//     if (process.env.REDIS_URL) {
//         console.log('Redis connected');
//         return process.env.REDIS_URL;
//     }
//     throw new Error('Redis connection failed');
// }

// export const redis = new Redis(redisClient());

import { Redis } from "ioredis";
require("dotenv").config();

const redisClient = () => {
  try {
    if (!process.env.REDIS_URL) {
      throw new Error('REDIS_URL is not defined in environment variables');
    }

    const redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        console.log(`Retrying Redis connection... Attempt ${times}`);
        return delay;
      },
      // Cấu hình TLS cho Upstash
      tls: {
        rejectUnauthorized: false
      },
      // Timeout settings
      connectTimeout: 10000,
      commandTimeout: 5000,
      keepAlive: 10000,
      // Disable auto reconnect để handle manually
      autoResubscribe: false,
      autoResendUnfulfilledCommands: false,
      // Enable ready check
      enableReadyCheck: true,
    });

    redis.on('connect', () => {
      console.log('Redis connected successfully');
    });

    redis.on('error', (error) => {
      console.error('Redis connection error:', error);
    });

    redis.on('ready', () => {
      console.log('Redis client is ready');
    });

    return redis;
  } catch (error) {
    console.error('Redis client error:', error);
    throw error;
  }
};

// Khởi tạo Redis client với error handling
let redis;
try {
  redis = redisClient();
} catch (error) {
  console.error('Failed to initialize Redis client:', error);
}

export { redis };