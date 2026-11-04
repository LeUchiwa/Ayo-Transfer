/**
 * Rate limiter simple basé sur KV store.
 * Protège contre le brute force sur /admin/auth et autres endpoints sensibles.
 */

type RateLimitConfig = {
  maxAttempts: number;
  windowMs: number;
  blockMs: number;
};

const DEFAULT_CONFIG: RateLimitConfig = {
  maxAttempts: 3,
  windowMs: 15 * 60 * 1000,
  blockMs: 15 * 60 * 1000,
};

export type RateLimitResult = {
  allowed: boolean;
  remainingAttempts?: number;
  retryAfterMs?: number;
};

export async function checkRateLimit(
  kv: { get: (k: string) => Promise<any>; set: (k: string, v: any) => Promise<void> },
  key: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): Promise<RateLimitResult> {
  const now = Date.now();
  const record = await kv.get(key);

  if (!record) {
    await kv.set(key, { attempts: 1, firstAttemptAt: now, lastAttemptAt: now, blockedUntil: null });
    return { allowed: true, remainingAttempts: config.maxAttempts - 1 };
  }

  if (record.blockedUntil && record.blockedUntil > now) {
    return { allowed: false, retryAfterMs: record.blockedUntil - now };
  }

  if (now - record.firstAttemptAt > config.windowMs) {
    await kv.set(key, { attempts: 1, firstAttemptAt: now, lastAttemptAt: now, blockedUntil: null });
    return { allowed: true, remainingAttempts: config.maxAttempts - 1 };
  }

  const newAttempts = (record.attempts || 0) + 1;

  if (newAttempts > config.maxAttempts) {
    const blockedUntil = now + config.blockMs;
    await kv.set(key, { ...record, attempts: newAttempts, lastAttemptAt: now, blockedUntil });
    return { allowed: false, retryAfterMs: config.blockMs };
  }

  await kv.set(key, { ...record, attempts: newAttempts, lastAttemptAt: now });
  return { allowed: true, remainingAttempts: config.maxAttempts - newAttempts };
}

export async function resetRateLimit(
  kv: { set: (k: string, v: any) => Promise<void> },
  key: string
): Promise<void> {
  await kv.set(key, { attempts: 0, firstAttemptAt: null, lastAttemptAt: null, blockedUntil: null });
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
