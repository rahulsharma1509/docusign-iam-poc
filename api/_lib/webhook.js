import crypto from 'node:crypto';

function timingSafeEqual(left, right) {
  const leftBuffer = Buffer.from(left || '');
  const rightBuffer = Buffer.from(right || '');
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function header(req, names) {
  for (const name of names) {
    const value = req.headers?.[name] || req.headers?.[name.toLowerCase()];
    if (value) return Array.isArray(value) ? value[0] : value;
  }
  return '';
}

export function verifyWebhookHmac(config, req, rawBody) {
  if (!config.webhookSecret) return { verified: false, skipped: true };

  const signature = header(req, ['x-docusign-signature-1']);
  if (!signature) {
    const error = new Error('Missing DocuSign HMAC signature header.');
    error.statusCode = 401;
    throw error;
  }

  const expected = crypto
    .createHmac('sha256', config.webhookSecret)
    .update(rawBody)
    .digest('base64');

  if (!timingSafeEqual(signature, expected)) {
    const error = new Error('Invalid DocuSign HMAC signature.');
    error.statusCode = 401;
    throw error;
  }

  return { verified: true, skipped: false };
}

function firstXmlMatch(xml, names) {
  for (const name of names) {
    const match = xml.match(new RegExp(`<${name}>([^<]+)</${name}>`, 'i'));
    if (match) return match[1];
  }
  return '';
}

function eventDateFromJson(payload) {
  return payload.eventDateTime
    || payload.generatedDateTime
    || payload.data?.eventDateTime
    || payload.data?.generatedDateTime
    || payload.data?.envelopeSummary?.statusChangedDateTime
    || payload.envelopeSummary?.statusChangedDateTime
    || '';
}

function eventDateFromXml(text) {
  return firstXmlMatch(text, [
    'TimeGenerated',
    'StatusChangedDateTime',
    'StatusDateTime',
    'EventDateTime',
    'eventDateTime'
  ]);
}

export function parseWebhookPayload(rawBody) {
  const text = rawBody.toString('utf8');

  try {
    const payload = JSON.parse(text);
    const envelopeId = payload.data?.envelopeId
      || payload.envelopeId
      || payload.envelopeSummary?.envelopeId
      || payload.data?.envelopeSummary?.envelopeId
      || '';
    const status = payload.data?.envelopeSummary?.status
      || payload.envelopeSummary?.status
      || payload.status
      || payload.event
      || 'event-received';
    const eventType = payload.event || payload.eventType || 'connect-json';
    const eventDateTime = eventDateFromJson(payload);

    return {
      payload,
      envelopeId,
      status,
      eventType,
      eventDateTime,
      idempotencyKey: [envelopeId, eventType, status, eventDateTime].filter(Boolean).join(':')
    };
  } catch {
    const envelopeId = firstXmlMatch(text, ['EnvelopeID', 'EnvelopeId', 'envelopeId']);
    const status = firstXmlMatch(text, ['Status', 'status']) || 'event-received';
    const eventType = firstXmlMatch(text, ['Event', 'event', 'EventType', 'eventType']) || 'connect-xml';
    const eventDateTime = eventDateFromXml(text);

    return {
      payload: text.slice(0, 5000),
      envelopeId,
      status,
      eventType,
      eventDateTime,
      idempotencyKey: [envelopeId, eventType, status, eventDateTime].filter(Boolean).join(':')
    };
  }
}

export function webhookDeliveryId(req) {
  return header(req, [
    'x-docusign-delivery-id',
    'x-docusign-event-id',
    'x-docusign-connect-id',
    'x-request-id'
  ]);
}
