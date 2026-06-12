import { handleOptions, methodNotAllowed, sendJson } from '../_lib/http.js';
import { getWebhookDeliveries, getWebhookInboxSummary } from '../_lib/store.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  return sendJson(res, 200, {
    summary: getWebhookInboxSummary(),
    deliveries: getWebhookDeliveries(25)
  });
}
