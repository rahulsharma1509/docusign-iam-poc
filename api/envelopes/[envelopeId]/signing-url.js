import { getConfig } from '../../_lib/config.js';
import { createRecipientView } from '../../_lib/docusign.js';
import { getEnvelopeId, handleOptions, methodNotAllowed, readJson, sendError, sendJson } from '../../_lib/http.js';
import { getEnvelope } from '../../_lib/store.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  try {
    const envelopeId = getEnvelopeId(req);
    if (!envelopeId) {
      const error = new Error('Envelope ID is required.');
      error.statusCode = 400;
      throw error;
    }

    const body = await readJson(req);
    const local = getEnvelope(envelopeId) || {};
    const config = getConfig(req);
    const signerName = body.signerName || local.signerName;
    const signerEmail = body.signerEmail || local.signerEmail;
    const clientUserId = body.clientUserId || local.clientUserId;

    if (!signerName || !signerEmail || !clientUserId) {
      const error = new Error('Embedded signing requires signerName, signerEmail, and clientUserId from the envelope creation response.');
      error.statusCode = 400;
      throw error;
    }

    const result = await createRecipientView(config, {
      envelopeId,
      signerName,
      signerEmail,
      clientUserId,
      returnUrl: body.returnUrl || `${config.appBaseUrl}/?event=signing_complete&envelopeId=${encodeURIComponent(envelopeId)}`
    });

    return sendJson(res, 200, {
      url: result.url,
      expiresInHint: 'Recipient view URLs are short-lived. Create a new URL when the signer starts the session.'
    });
  } catch (error) {
    return sendError(res, error);
  }
}
