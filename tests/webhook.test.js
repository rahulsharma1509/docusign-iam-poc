import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import { getEnvelope, getEnvelopeEvents, recordWebhookEvent, resetStoreForTests } from '../api/_lib/store.js';
import { parseWebhookPayload, verifyWebhookHmac, webhookDeliveryId } from '../api/_lib/webhook.js';

test('verifyWebhookHmac accepts valid DocuSign HMAC signatures', () => {
  const rawBody = Buffer.from(JSON.stringify({ event: 'envelope-completed' }));
  const secret = 'test-secret';
  const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');

  const result = verifyWebhookHmac(
    { webhookSecret: secret },
    { headers: { 'x-docusign-signature-1': signature } },
    rawBody
  );

  assert.deepEqual(result, { verified: true, skipped: false });
});

test('verifyWebhookHmac rejects invalid signatures', () => {
  assert.throws(
    () => verifyWebhookHmac(
      { webhookSecret: 'test-secret' },
      { headers: { 'x-docusign-signature-1': 'bad-signature' } },
      Buffer.from('{}')
    ),
    (error) => error.statusCode === 401
  );
});

test('parseWebhookPayload extracts JSON envelope metadata and idempotency key', () => {
  const parsed = parseWebhookPayload(Buffer.from(JSON.stringify({
    event: 'envelope-completed',
    data: {
      envelopeId: 'env-123',
      envelopeSummary: {
        status: 'completed',
        statusChangedDateTime: '2026-06-13T10:00:00Z'
      }
    }
  })));

  assert.equal(parsed.envelopeId, 'env-123');
  assert.equal(parsed.status, 'completed');
  assert.equal(parsed.eventType, 'envelope-completed');
  assert.equal(parsed.idempotencyKey, 'env-123:envelope-completed:completed:2026-06-13T10:00:00Z');
});

test('parseWebhookPayload extracts XML envelope metadata', () => {
  const parsed = parseWebhookPayload(Buffer.from(`
    <DocuSignEnvelopeInformation>
      <EnvelopeStatus>
        <EnvelopeID>env-xml</EnvelopeID>
        <Status>Delivered</Status>
        <StatusChangedDateTime>2026-06-13T10:00:00Z</StatusChangedDateTime>
      </EnvelopeStatus>
    </DocuSignEnvelopeInformation>
  `));

  assert.equal(parsed.envelopeId, 'env-xml');
  assert.equal(parsed.status, 'Delivered');
  assert.equal(parsed.eventType, 'connect-xml');
});

test('recordWebhookEvent is idempotent for duplicate event keys', () => {
  resetStoreForTests();

  const first = recordWebhookEvent({
    envelopeId: 'env-dup',
    status: 'completed',
    eventType: 'envelope-completed',
    idempotencyKey: 'delivery-1'
  });

  const second = recordWebhookEvent({
    envelopeId: 'env-dup',
    status: 'completed',
    eventType: 'envelope-completed',
    idempotencyKey: 'delivery-1'
  });

  assert.equal(second.id, first.id);
  assert.equal(second.duplicate, true);
  assert.equal(getEnvelopeEvents('env-dup').length, 1);
  assert.equal(getEnvelope('env-dup').status, 'completed');
});

test('webhookDeliveryId reads DocuSign delivery headers', () => {
  assert.equal(
    webhookDeliveryId({ headers: { 'x-docusign-delivery-id': 'delivery-123' } }),
    'delivery-123'
  );
});
