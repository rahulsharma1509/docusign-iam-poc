import { handleOptions, methodNotAllowed, readJson, sendError, sendJson } from '../_lib/http.js';
import { enforceRateLimit } from '../_lib/rateLimit.js';
import { buildReplayWebhookEvent } from '../_lib/replay.js';
import { getWebhookDeliveries, getWebhookInboxSummary, recordWebhookEvent } from '../_lib/store.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  try {
    enforceRateLimit(req, { keyPrefix: 'webhook-replay', limit: 30, windowMs: 60_000 });
    const body = await readJson(req);
    const replayEvent = buildReplayWebhookEvent(body);
    const event = recordWebhookEvent(replayEvent);

    return sendJson(res, 201, {
      event,
      summary: getWebhookInboxSummary(),
      deliveries: getWebhookDeliveries(25)
    });
  } catch (error) {
    return sendError(res, error);
  }
}
