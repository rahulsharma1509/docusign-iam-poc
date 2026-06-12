import { getConfig } from './_lib/config.js';
import { createEnvelope } from './_lib/docusign.js';
import { handleOptions, methodNotAllowed, readJson, sendError, sendJson } from './_lib/http.js';
import { saveEnvelope } from './_lib/store.js';

function validateEnvelopeInput(body) {
  const missing = [];
  if (!body.signerName) missing.push('signerName');
  if (!body.signerEmail) missing.push('signerEmail');

  if (missing.length) {
    const error = new Error('Missing required envelope fields.');
    error.statusCode = 400;
    error.details = { missing };
    throw error;
  }
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  try {
    const body = await readJson(req);
    validateEnvelopeInput(body);

    const config = getConfig(req);
    const result = await createEnvelope(config, body);
    const stored = saveEnvelope({
      ...result,
      signerName: body.signerName,
      signerEmail: body.signerEmail,
      dealName: body.dealName || 'DocuSign POC Agreement',
      embeddedSigning: body.embeddedSigning !== false,
      createdAt: new Date().toISOString()
    });

    return sendJson(res, 201, stored);
  } catch (error) {
    return sendError(res, error);
  }
}
