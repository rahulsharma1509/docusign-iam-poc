import assert from 'node:assert/strict';
import test from 'node:test';

import { buildEnvelopePayload } from '../api/_lib/docusign.js';

const config = {
  webhookUrl: 'https://example.com/api/webhooks/docusign'
};

test('buildEnvelopePayload creates embedded signer and webhook notification', () => {
  const result = buildEnvelopePayload(config, {
    dealName: 'Acme renewal',
    signerName: 'Alex Morgan',
    signerEmail: 'alex@example.com'
  });

  const signer = result.envelope.recipients.signers[0];

  assert.equal(result.envelope.status, 'sent');
  assert.equal(result.envelope.emailSubject, 'Signature requested: Acme renewal');
  assert.match(result.clientUserId, /^embedded-/);
  assert.equal(signer.clientUserId, result.clientUserId);
  assert.equal(result.envelope.eventNotification.url, config.webhookUrl);
  assert.equal(result.envelope.eventNotification.requireAcknowledgment, 'true');
});

test('buildEnvelopePayload supports remote email signing without clientUserId', () => {
  const result = buildEnvelopePayload(config, {
    signerName: 'Alex Morgan',
    signerEmail: 'alex@example.com',
    embeddedSigning: false
  });

  assert.equal(result.clientUserId, undefined);
  assert.equal(result.envelope.recipients.signers[0].clientUserId, undefined);
});

test('buildEnvelopePayload strips PDF data URLs before sending to DocuSign', () => {
  const documentBase64 = Buffer.from('%PDF-1.4').toString('base64');
  const result = buildEnvelopePayload(config, {
    signerName: 'Alex Morgan',
    signerEmail: 'alex@example.com',
    fileName: 'agreement.pdf',
    documentBase64: `data:application/pdf;base64,${documentBase64}`
  });

  assert.equal(result.envelope.documents[0].documentBase64, documentBase64);
  assert.equal(result.envelope.documents[0].fileExtension, 'pdf');
});
