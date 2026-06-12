import crypto from 'node:crypto';

const allowedStatuses = new Set(['sent', 'delivered', 'completed', 'declined', 'voided']);

function clean(value, fallback, maxLength = 120) {
  const normalized = String(value || fallback).trim().replace(/\s+/g, ' ');
  return normalized.slice(0, maxLength);
}

export function buildReplayWebhookEvent(input = {}) {
  const envelopeId = clean(input.envelopeId, `demo-envelope-${crypto.randomUUID().slice(0, 8)}`, 80);
  const statusInput = clean(input.status, 'completed', 40).toLowerCase();
  const status = allowedStatuses.has(statusInput) ? statusInput : 'completed';
  const eventType = clean(input.eventType, `envelope-${status}`, 80);
  const eventDateTime = input.eventDateTime || new Date().toISOString();
  const idempotencyKey = clean(
    input.idempotencyKey,
    `demo-replay:${envelopeId}:${eventType}:${crypto.randomUUID()}`,
    220
  );

  return {
    envelopeId,
    status,
    eventType,
    eventDateTime,
    idempotencyKey,
    source: 'demo-replay',
    payload: {
      event: eventType,
      generatedDateTime: eventDateTime,
      data: {
        envelopeId,
        envelopeSummary: {
          envelopeId,
          status,
          statusChangedDateTime: eventDateTime
        }
      }
    },
    signature: {
      verified: false,
      skipped: true
    },
    headers: {
      userAgent: 'docusign-iam-poc replay simulator',
      deliveryId: idempotencyKey,
      signaturePresent: false
    }
  };
}
