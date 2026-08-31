import { Redis } from "@upstash/redis";

let redisClient: Redis | null = null;

export function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;

  try {
    redisClient = Redis.fromEnv();
    return redisClient;
  } catch (error) {
    console.warn("Upstash Redis not configured or missing env vars:", error);
    return null;
  }
}

// Key prefix to avoid collisions
const PAUSE_KEY_PREFIX = "chat_paused:";


/**
 * Checks if a chat is currently paused for human agent takeover.
 */
export async function isChatPaused(phoneNumber: string): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return false;

  try {
    const paused = await redis.get(`${PAUSE_KEY_PREFIX}${phoneNumber}`);
    return Boolean(paused);
  } catch (error) {
    console.error("Error checking chat pause status in Redis:", error);
    return false;
  }
}

/**
 * Pauses automated bot responses for a specific phone number.
 * @param phoneNumber The recipient's phone number.
 * @param ttlSeconds Duration in seconds to pause the bot (default: 1 hour = 3600 seconds).
 */
export async function pauseChat(
  phoneNumber: string,
  ttlSeconds = 3600
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.set(`${PAUSE_KEY_PREFIX}${phoneNumber}`, "true", {
      ex: ttlSeconds,
    });
  } catch (error) {
    console.error("Error setting chat pause in Redis:", error);
  }
}

/**
 * Resumes bot responses for a specific phone number immediately.
 */
export async function resumeChat(phoneNumber: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.del(`${PAUSE_KEY_PREFIX}${phoneNumber}`);
  } catch (error) {
    console.error("Error clearing chat pause in Redis:", error);
  }
}
