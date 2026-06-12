import assert from 'node:assert/strict';
import test from 'node:test';

import { enforceRateLimit, resetRateLimitForTests } from '../api/_lib/rateLimit.js';

test('enforceRateLimit rejects requests after the configured limit', () => {
  resetRateLimitForTests();
  const req = {
    headers: { 'x-forwarded-for': '203.0.113.10' },
    socket: {}
  };

  enforceRateLimit(req, { keyPrefix: 'test', limit: 2, windowMs: 60_000 });
  enforceRateLimit(req, { keyPrefix: 'test', limit: 2, windowMs: 60_000 });

  assert.throws(
    () => enforceRateLimit(req, { keyPrefix: 'test', limit: 2, windowMs: 60_000 }),
    (error) => error.statusCode === 429 && error.details.retryAfterSeconds > 0
  );
});
