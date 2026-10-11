import { createHash } from "node:crypto";
import { createClient } from "redis";

const script = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
return {count, ttl}
`;

function client() {
  if (!process.env.REDIS_URL) throw new Error("redis_not_configured");
  if (!globalThis.relayRedis) {
    const redis = createClient({ url: process.env.REDIS_URL, socket: {
      connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 1500),
      reconnectStrategy: (retries) => Math.min(1000, retries * 100),
    } });
    redis.on("error", () => console.error("relay_redis_connection_error"));
    globalThis.relayRedis = redis;
  }
  return globalThis.relayRedis;
}

export async function rateLimit(key, max = Number(process.env.RATE_LIMIT_MAX || 10), windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000)) {
  if (!Number.isInteger(max) || max < 1 || !Number.isInteger(windowMs) || windowMs < 1000) {
    throw new Error("invalid_rate_limit_configuration");
  }
  const redis = client();
  if (!redis.isOpen) await redis.connect();
  const digest = createHash("sha256").update(key).digest("hex");
  const [count, ttl] = await redis.eval(script, {
    keys: [`relay:apply:${digest}`], arguments: [String(windowMs)],
  });
  return { allowed: Number(count) <= max, retryAfter: Math.max(1, Math.ceil(Number(ttl) / 1000)) };
}

export async function checkRateLimitStore() {
  const redis = client();
  if (!redis.isOpen) await redis.connect();
  return (await redis.ping()) === "PONG";
}
