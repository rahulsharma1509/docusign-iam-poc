const storeKey = Symbol.for('docusignIamPoc.store');

function getStore() {
  if (!globalThis[storeKey]) {
    globalThis[storeKey] = {
      envelopes: new Map(),
      events: [],
      deliveries: [],
      eventKeys: new Map()
    };
  }
  return globalThis[storeKey];
}

function trimDeliveryLog(store) {
  store.deliveries = store.deliveries.slice(0, 50);
}

function sanitizeSignature(signature = {}) {
  return {
    verified: Boolean(signature.verified),
    skipped: Boolean(signature.skipped)
  };
}

function deliveryFromEvent(event, overrides = {}) {
  return {
    deliveryId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    receivedAt: new Date().toISOString(),
    envelopeId: event.envelopeId || '',
    status: event.status || event.envelopeStatus || 'event-received',
    eventType: event.eventType || 'connect-event',
    eventDateTime: event.eventDateTime || '',
    idempotencyKey: event.idempotencyKey || '',
    signature: sanitizeSignature(event.signature),
    source: event.source || 'docusign-connect',
    userAgent: event.headers?.userAgent || '',
    docusignDeliveryId: event.headers?.deliveryId || '',
    ...overrides
  };
}

function recordDelivery(store, event, overrides = {}) {
  const delivery = deliveryFromEvent(event, overrides);
  store.deliveries.unshift(delivery);
  trimDeliveryLog(store);
  return delivery;
}

export function saveEnvelope(envelope) {
  const store = getStore();
  const existing = store.envelopes.get(envelope.envelopeId) || {};
  const next = {
    ...existing,
    ...envelope,
    updatedAt: new Date().toISOString()
  };
  store.envelopes.set(envelope.envelopeId, next);
  return next;
}

export function getEnvelope(envelopeId) {
  return getStore().envelopes.get(envelopeId) || null;
}

export function recordWebhookEvent(event) {
  const store = getStore();
  const idempotencyKey = event.idempotencyKey || '';
  if (idempotencyKey && store.eventKeys.has(idempotencyKey)) {
    const existingId = store.eventKeys.get(idempotencyKey);
    const existing = store.events.find((item) => item.id === existingId);
    if (existing) {
      const delivery = recordDelivery(store, event, {
        duplicate: true,
        processed: false,
        originalEventId: existing.id
      });
      return { ...existing, duplicate: true, delivery };
    }
  }

  const normalized = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    receivedAt: new Date().toISOString(),
    ...event
  };

  store.events.unshift(normalized);
  store.events = store.events.slice(0, 50);
  const delivery = recordDelivery(store, normalized, {
    duplicate: false,
    processed: true,
    eventId: normalized.id
  });
  if (idempotencyKey) store.eventKeys.set(idempotencyKey, normalized.id);
  const retainedEventIds = new Set(store.events.map((item) => item.id));
  for (const [key, eventId] of store.eventKeys.entries()) {
    if (!retainedEventIds.has(eventId)) store.eventKeys.delete(key);
  }

  if (normalized.envelopeId) {
    saveEnvelope({
      envelopeId: normalized.envelopeId,
      status: normalized.status || normalized.envelopeStatus || 'event-received',
      lastWebhookAt: normalized.receivedAt
    });
  }

  return { ...normalized, delivery };
}

export function getEnvelopeEvents(envelopeId) {
  return getStore().events.filter((event) => event.envelopeId === envelopeId);
}

export function getWebhookDeliveries(limit = 20) {
  return getStore().deliveries.slice(0, limit);
}

export function getWebhookInboxSummary() {
  const deliveries = getStore().deliveries;
  return {
    totalDeliveries: deliveries.length,
    processedDeliveries: deliveries.filter((delivery) => delivery.processed).length,
    duplicateDeliveries: deliveries.filter((delivery) => delivery.duplicate).length,
    verifiedDeliveries: deliveries.filter((delivery) => delivery.signature?.verified).length,
    skippedSignatureDeliveries: deliveries.filter((delivery) => delivery.signature?.skipped).length
  };
}

export function resetStoreForTests() {
  globalThis[storeKey] = {
    envelopes: new Map(),
    events: [],
    deliveries: [],
    eventKeys: new Map()
  };
}
