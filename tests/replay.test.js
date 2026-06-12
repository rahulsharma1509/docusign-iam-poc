import assert from 'node:assert/strict';
import test from 'node:test';

import { buildReplayWebhookEvent } from '../api/_lib/replay.js';
import { getWebhookDeliveries, recordWebhookEvent, resetStoreForTests } from '../api/_lib/store.js';

test('buildReplayWebhookEvent creates a safe demo webhook event', () => {
  const event = buildReplayWebhookEvent({
    envelopeId: 'env-replay',
    status: 'delivered',
    idempotencyKey: 'demo-key'
  });

  assert.equal(event.envelopeId, 'env-replay');
  assert.equal(event.status, 'delivered');
  assert.equal(event.eventType, 'envelope-delivered');
  assert.equal(event.idempotencyKey, 'demo-key');
  assert.equal(event.source, 'demo-replay');
  assert.equal(event.signature.skipped, true);
});

test('sample replay events flow into the delivery inbox', () => {
  resetStoreForTests();

  const event = buildReplayWebhookEvent({
    envelopeId: 'env-replay',
    status: 'completed',
    idempotencyKey: 'demo-key'
  });

  const first = recordWebhookEvent(event);
  const second = recordWebhookEvent(event);

  assert.equal(first.duplicate, undefined);
  assert.equal(second.duplicate, true);
  assert.equal(getWebhookDeliveries().length, 2);
  assert.equal(getWebhookDeliveries()[0].source, 'demo-replay');
});
