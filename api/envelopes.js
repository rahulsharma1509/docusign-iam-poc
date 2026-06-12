import { getConfig } from './_lib/config.js';
import { createEnvelope } from './_lib/docusign.js';
import { handleOptions, methodNotAllowed, readJson, sendError, sendJson } from './_lib/http.js';
import { enforceRateLimit } from './_lib/rateLimit.js';
import { saveEnvelope } from './_lib/store.js';
import { validateEnvelopeInput } from './_lib/validation.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  try {
    enforceRateLimit(req, { keyPrefix: 'create-envelope', limit: 10, windowMs: 60_000 });
    const body = validateEnvelopeInput(await readJson(req));

    const config = getConfig(req);
    const result = await createEnvelope(config, body);
    const stored = saveEnvelope({
      ...result,
      signerName: body.signerName,
      signerEmail: body.signerEmail,
      dealName: body.dealName,
      embeddedSigning: body.embeddedSigning !== false,
      createdAt: new Date().toISOString()
    });

    return sendJson(res, 201, stored);
  } catch (error) {
    return sendError(res, error);
  }
}
