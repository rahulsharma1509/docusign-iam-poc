import { getConfig } from '../../_lib/config.js';
import { createRecipientView } from '../../_lib/docusign.js';
import { getEnvelopeId, handleOptions, methodNotAllowed, readJson, sendError, sendJson } from '../../_lib/http.js';
import { enforceRateLimit } from '../../_lib/rateLimit.js';
import { getEnvelope } from '../../_lib/store.js';

function getTrustedReturnUrl(config, envelopeId, value) {
  const fallback = `${config.appBaseUrl}/?event=signing_complete&envelopeId=${encodeURIComponent(envelopeId)}`;
  const requested = value || fallback;
  const appOrigin = new URL(config.appBaseUrl).origin;
  const returnUrl = new URL(requested, config.appBaseUrl);

  if (returnUrl.origin !== appOrigin) {
    const error = new Error('Return URL must use the configured app origin.');
    error.statusCode = 400;
    error.details = { appOrigin };
    throw error;
  }

  return returnUrl.toString();
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  try {
    enforceRateLimit(req, { keyPrefix: 'recipient-view', limit: 20, windowMs: 60_000 });
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
      returnUrl: getTrustedReturnUrl(config, envelopeId, body.returnUrl)
    });

    return sendJson(res, 200, {
      url: result.url,
      expiresInHint: 'Recipient view URLs are short-lived. Create a new URL when the signer starts the session.'
    });
  } catch (error) {
    return sendError(res, error);
  }
}
