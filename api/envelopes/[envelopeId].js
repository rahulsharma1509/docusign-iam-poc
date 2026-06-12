import { getConfig } from '../_lib/config.js';
import { getEnvelopeStatus } from '../_lib/docusign.js';
import { getEnvelopeId, handleOptions, methodNotAllowed, sendError, sendJson } from '../_lib/http.js';
import { getEnvelope, getEnvelopeEvents, saveEnvelope } from '../_lib/store.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  try {
    const envelopeId = getEnvelopeId(req);
    if (!envelopeId) {
      const error = new Error('Envelope ID is required.');
      error.statusCode = 400;
      throw error;
    }

    const config = getConfig(req);
    const remote = await getEnvelopeStatus(config, envelopeId);
    const local = saveEnvelope({
      ...(getEnvelope(envelopeId) || {}),
      envelopeId,
      status: remote.status,
      statusChangedDateTime: remote.statusChangedDateTime,
      sentDateTime: remote.sentDateTime,
      completedDateTime: remote.completedDateTime
    });

    return sendJson(res, 200, {
      ...local,
      remote,
      events: getEnvelopeEvents(envelopeId)
    });
  } catch (error) {
    return sendError(res, error);
  }
}
