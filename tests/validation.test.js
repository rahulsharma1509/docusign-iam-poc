import assert from 'node:assert/strict';
import test from 'node:test';

import { validateEnvelopeInput } from '../api/_lib/validation.js';

test('validateEnvelopeInput normalizes valid envelope input', () => {
  const pdf = Buffer.from('%PDF-1.4').toString('base64');
  const input = validateEnvelopeInput({
    dealName: '  Acme   renewal  ',
    signerName: '  Alex   Morgan ',
    signerEmail: ' ALEX@example.COM ',
    fileName: 'agreement.pdf',
    documentBase64: `data:application/pdf;base64,${pdf}`
  });

  assert.equal(input.dealName, 'Acme renewal');
  assert.equal(input.signerName, 'Alex Morgan');
  assert.equal(input.signerEmail, 'alex@example.com');
  assert.equal(input.fileName, 'agreement.pdf');
  assert.equal(input.documentBase64, pdf);
  assert.equal(input.embeddedSigning, true);
});

test('validateEnvelopeInput rejects missing signer fields', () => {
  assert.throws(
    () => validateEnvelopeInput({ dealName: 'Acme' }),
    (error) => error.statusCode === 400 && error.details.missing.includes('signerName')
  );
});

test('validateEnvelopeInput rejects invalid signer email', () => {
  assert.throws(
    () => validateEnvelopeInput({ signerName: 'Alex', signerEmail: 'not-an-email' }),
    /valid email/
  );
});

test('validateEnvelopeInput rejects non-PDF upload file names', () => {
  assert.throws(
    () => validateEnvelopeInput({
      signerName: 'Alex',
      signerEmail: 'alex@example.com',
      fileName: 'agreement.docx',
      documentBase64: Buffer.from('hello').toString('base64')
    }),
    /must be a PDF/
  );
});

test('validateEnvelopeInput rejects malformed base64 document content', () => {
  assert.throws(
    () => validateEnvelopeInput({
      signerName: 'Alex',
      signerEmail: 'alex@example.com',
      fileName: 'agreement.pdf',
      documentBase64: 'not base64'
    }),
    /base64/
  );
});
