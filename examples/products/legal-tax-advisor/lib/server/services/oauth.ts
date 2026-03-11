import { Redis } from "ioredis";
import { getConfig } from "../config";

let _redis: Redis | null = null;
function getRedis(): Redis {
  if (!_redis) _redis = new Redis(getConfig().REDIS_URL);
  return _redis;
}
const OAUTH_STATE_PREFIX = "oauth:state:";
const OAUTH_STATE_TTL = 600; // 10 minutes

export function generateState(): string {
  return crypto.randomUUID();
}

export async function storeOAuthState(
  state: string,
  payload: { redirectUri?: string }
): Promise<void> {
  await getRedis().setex(`${OAUTH_STATE_PREFIX}${state}`, OAUTH_STATE_TTL, JSON.stringify(payload));
}

export async function getOAuthState(state: string): Promise<{ redirectUri?: string } | null> {
  const raw = await getRedis().get(`${OAUTH_STATE_PREFIX}${state}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { redirectUri?: string };
  } catch {
    return null;
  }
}

export async function deleteOAuthState(state: string): Promise<void> {
  await getRedis().del(`${OAUTH_STATE_PREFIX}${state}`);
}
