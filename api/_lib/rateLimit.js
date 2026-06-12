const rateLimitKey = Symbol.for('docusignIamPoc.rateLimit');

function getBuckets() {
  if (!globalThis[rateLimitKey]) globalThis[rateLimitKey] = new Map();
  return globalThis[rateLimitKey];
}

function clientIp(req) {
  const forwardedFor = req.headers?.['x-forwarded-for'];
  if (forwardedFor) return String(forwardedFor).split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

export function enforceRateLimit(req, options = {}) {
  const key = `${options.keyPrefix || 'route'}:${clientIp(req)}`;
  const limit = options.limit || 20;
  const windowMs = options.windowMs || 60_000;
  const now = Date.now();
  const buckets = getBuckets();
  const bucket = buckets.get(key) || { count: 0, resetAt: now + windowMs };

  if (bucket.resetAt <= now) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }

  bucket.count += 1;
  buckets.set(key, bucket);

  if (bucket.count > limit) {
    const error = new Error('Too many requests. Try again shortly.');
    error.statusCode = 429;
    error.details = {
      limit,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000)
    };
    throw error;
  }
}

export function resetRateLimitForTests() {
  globalThis[rateLimitKey] = new Map();
}
