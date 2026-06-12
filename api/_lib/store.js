const storeKey = Symbol.for('docusignIamPoc.store');

function getStore() {
  if (!globalThis[storeKey]) {
    globalThis[storeKey] = {
      envelopes: new Map(),
      events: [],
      eventKeys: new Map()
    };
  }
  return globalThis[storeKey];
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
    if (existing) return { ...existing, duplicate: true };
  }

  const normalized = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    receivedAt: new Date().toISOString(),
    ...event
  };

  store.events.unshift(normalized);
  store.events = store.events.slice(0, 50);
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

  return normalized;
}

export function getEnvelopeEvents(envelopeId) {
  return getStore().events.filter((event) => event.envelopeId === envelopeId);
}

export function resetStoreForTests() {
  globalThis[storeKey] = {
    envelopes: new Map(),
    events: [],
    eventKeys: new Map()
  };
}
