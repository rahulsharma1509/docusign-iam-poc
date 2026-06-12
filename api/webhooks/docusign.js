import { getConfig } from '../_lib/config.js';
import { handleOptions, methodNotAllowed, readRawBody, sendError, sendJson } from '../_lib/http.js';
import { recordWebhookEvent } from '../_lib/store.js';
import { parseWebhookPayload, verifyWebhookHmac, webhookDeliveryId } from '../_lib/webhook.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  try {
    const config = getConfig(req);
    const rawBody = await readRawBody(req);
    const verification = verifyWebhookHmac(config, req, rawBody);
    const parsed = parseWebhookPayload(rawBody);

    const event = recordWebhookEvent({
      ...parsed,
      idempotencyKey: webhookDeliveryId(req) || parsed.idempotencyKey,
      signature: verification,
      headers: {
        userAgent: req.headers['user-agent'] || '',
        deliveryId: webhookDeliveryId(req),
        signaturePresent: Boolean(req.headers['x-docusign-signature-1'])
      }
    });

    return sendJson(res, 200, { ok: true, event });
  } catch (error) {
    return sendError(res, error);
  }
}
