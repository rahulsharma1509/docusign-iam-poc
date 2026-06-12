import { getConfig } from '../../_lib/config.js';
import { downloadCombinedDocument } from '../../_lib/docusign.js';
import { getEnvelopeId, handleOptions, methodNotAllowed, sendBinary, sendError } from '../../_lib/http.js';

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
    const document = await downloadCombinedDocument(config, envelopeId);
    return sendBinary(res, 200, document.buffer, {
      'Content-Type': document.contentType,
      'Content-Disposition': `attachment; filename="docusign-${envelopeId}.pdf"`
    });
  } catch (error) {
    return sendError(res, error);
  }
}
