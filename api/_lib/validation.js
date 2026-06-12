const maxDocumentBase64Bytes = 4 * 1024 * 1024;

function badRequest(message, details) {
  const error = new Error(message);
  error.statusCode = 400;
  if (details) error.details = details;
  return error;
}

function requirePlainObject(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('Request body must be a JSON object.');
  }
}

function cleanString(value, maxLength) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function stripPdfDataUrl(value) {
  return String(value || '').replace(/^data:application\/pdf;base64,/, '').trim();
}

function looksLikeBase64(value) {
  return /^[A-Za-z0-9+/]+={0,2}$/.test(value) && value.length % 4 === 0;
}

export function validateEnvelopeInput(body) {
  requirePlainObject(body);

  const input = {
    dealName: cleanString(body.dealName || 'DocuSign POC Agreement', 120),
    signerName: cleanString(body.signerName, 100),
    signerEmail: cleanString(body.signerEmail, 254).toLowerCase(),
    emailSubject: cleanString(body.emailSubject, 160),
    emailBlurb: cleanString(body.emailBlurb, 500),
    fileName: cleanString(body.fileName, 140),
    embeddedSigning: body.embeddedSigning !== false
  };

  const missing = [];
  if (!input.signerName) missing.push('signerName');
  if (!input.signerEmail) missing.push('signerEmail');
  if (missing.length) throw badRequest('Missing required envelope fields.', { missing });

  if (!validateEmail(input.signerEmail)) {
    throw badRequest('Signer email must be a valid email address.', { field: 'signerEmail' });
  }

  if (body.documentBase64) {
    const documentBase64 = stripPdfDataUrl(body.documentBase64);
    if (Buffer.byteLength(documentBase64, 'utf8') > maxDocumentBase64Bytes) {
      throw badRequest('PDF upload is too large.', { maxDocumentBase64Bytes });
    }

    if (!looksLikeBase64(documentBase64)) {
      throw badRequest('Uploaded document must be base64-encoded PDF content.', { field: 'documentBase64' });
    }

    if (input.fileName && !input.fileName.toLowerCase().endsWith('.pdf')) {
      throw badRequest('Uploaded document must be a PDF.', { field: 'fileName' });
    }

    input.documentBase64 = documentBase64;
    input.fileName = input.fileName || 'uploaded-agreement.pdf';
  }

  return input;
}
