import { Redis } from "ioredis";
import { getConfig } from "./config";

let _redis: Redis | null = null;
function getRedis(): Redis {
  if (!_redis) _redis = new Redis(getConfig().REDIS_URL);
  return _redis;
}
const CHAT_RATE_PREFIX = "chat:rate:";
const WINDOW_SEC = 60;
const MAX_REQUESTS = 20;

export async function checkChatRateLimit(
  identifier: string
): Promise<{ ok: boolean; message?: string }> {
  const redis = getRedis();
  const key = `${CHAT_RATE_PREFIX}${identifier}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, WINDOW_SEC);
  }
  if (count > MAX_REQUESTS) {
    return { ok: false, message: "Too many requests. Please try again later." };
  }
  return { ok: true };
}
