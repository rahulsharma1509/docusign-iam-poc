import crypto from 'node:crypto';
import { getConfig } from '../_lib/config.js';
import { handleOptions, methodNotAllowed, readRawBody, sendError, sendJson } from '../_lib/http.js';
import { recordWebhookEvent } from '../_lib/store.js';

function timingSafeEqual(left, right) {
  const leftBuffer = Buffer.from(left || '');
  const rightBuffer = Buffer.from(right || '');
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function verifyHmac(config, req, rawBody) {
  if (!config.webhookSecret) return { verified: false, skipped: true };

  const signature = req.headers['x-docusign-signature-1'];
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

function parseWebhookPayload(rawBody) {
  const text = rawBody.toString('utf8');

  try {
    const payload = JSON.parse(text);
    return {
      payload,
      envelopeId: payload.data?.envelopeId
        || payload.envelopeId
        || payload.envelopeSummary?.envelopeId
        || payload.data?.envelopeSummary?.envelopeId
        || '',
      status: payload.data?.envelopeSummary?.status
        || payload.envelopeSummary?.status
        || payload.status
        || payload.event
        || 'event-received',
      eventType: payload.event || payload.eventType || 'connect-json'
    };
  } catch {
    return {
      payload: text.slice(0, 5000),
      envelopeId: firstXmlMatch(text, ['EnvelopeID', 'EnvelopeId', 'envelopeId']),
      status: firstXmlMatch(text, ['Status', 'status']) || 'event-received',
      eventType: 'connect-xml'
    };
  }
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  try {
    const config = getConfig(req);
    const rawBody = await readRawBody(req);
    const verification = verifyHmac(config, req, rawBody);
    const parsed = parseWebhookPayload(rawBody);

    const event = recordWebhookEvent({
      ...parsed,
      signature: verification,
      headers: {
        userAgent: req.headers['user-agent'] || '',
        signaturePresent: Boolean(req.headers['x-docusign-signature-1'])
      }
    });

    return sendJson(res, 200, { ok: true, event });
  } catch (error) {
    return sendError(res, error);
  }
}
