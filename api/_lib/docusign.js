import crypto from 'node:crypto';
import { getMissingRequiredConfig } from './config.js';
import { createSamplePdfBase64 } from './samplePdf.js';

const tokenCacheKey = Symbol.for('docusignIamPoc.tokenCache');

function getTokenCache() {
  if (!globalThis[tokenCacheKey]) globalThis[tokenCacheKey] = new Map();
  return globalThis[tokenCacheKey];
}

function base64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function normalizePrivateKey(privateKey) {
  return String(privateKey || '').replace(/\\n/g, '\n').trim();
}

function normalizeBasePath(basePath) {
  return String(basePath || '')
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
}

function ensureConfigured(config) {
  const missing = getMissingRequiredConfig(config);
  if (missing.length) {
    const error = new Error('DocuSign environment is not fully configured.');
    error.statusCode = 500;
    error.details = { missing };
    throw error;
  }
}

function createJwtAssertion(config) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({
    iss: config.integrationKey,
    sub: config.userId,
    aud: config.authServer,
    iat: now,
    exp: now + 3600,
    scope: 'signature impersonation'
  }));

  const signingInput = `${header}.${payload}`;
  const signature = crypto.sign(
    'RSA-SHA256',
    Buffer.from(signingInput),
    normalizePrivateKey(config.privateKey)
  );

  return `${signingInput}.${base64Url(signature)}`;
}

async function getAccessToken(config) {
  ensureConfigured(config);

  const cacheKey = `${config.integrationKey}:${config.userId}:${config.authServer}`;
  const cached = getTokenCache().get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60000) {
    return cached.accessToken;
  }

  const assertion = createJwtAssertion(config);
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion
  });

  const response = await fetch(`https://${config.authServer}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error_description || payload.error || 'DocuSign JWT token request failed.');
    error.statusCode = response.status;
    error.details = payload;
    throw error;
  }

  const expiresIn = Number(payload.expires_in || 3600);
  getTokenCache().set(cacheKey, {
    accessToken: payload.access_token,
    expiresAt: Date.now() + expiresIn * 1000
  });

  return payload.access_token;
}

async function docusignRequest(config, apiPath, options = {}) {
  const accessToken = await getAccessToken(config);
  const url = `https://${normalizeBasePath(config.basePath)}${apiPath}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const text = await response.text();
    let details = text;
    try {
      details = JSON.parse(text);
    } catch {
      // Keep raw text for non-JSON errors.
    }

    const message = typeof details === 'object'
      ? details.message || details.error_description || details.error || 'DocuSign API request failed.'
      : details || 'DocuSign API request failed.';

    const error = new Error(message);
    error.statusCode = response.status;
    error.details = details;
    throw error;
  }

  return response;
}

function stripDataUrl(value) {
  return String(value || '').replace(/^data:application\/pdf;base64,/, '');
}

function fileExtension(fileName = '') {
  const extension = String(fileName).split('.').pop();
  return extension && extension !== fileName ? extension.toLowerCase() : 'pdf';
}

function envelopeEventNotification(config) {
  if (!config.webhookUrl) return undefined;

  return {
    url: config.webhookUrl,
    loggingEnabled: 'true',
    requireAcknowledgment: 'true',
    includeDocuments: 'false',
    includeEnvelopeVoidReason: 'true',
    includeTimeZone: 'true',
    envelopeEvents: [
      { envelopeEventStatusCode: 'sent' },
      { envelopeEventStatusCode: 'delivered' },
      { envelopeEventStatusCode: 'completed' },
      { envelopeEventStatusCode: 'declined' },
      { envelopeEventStatusCode: 'voided' }
    ],
    recipientEvents: [
      { recipientEventStatusCode: 'Sent' },
      { recipientEventStatusCode: 'Delivered' },
      { recipientEventStatusCode: 'Completed' },
      { recipientEventStatusCode: 'Declined' }
    ],
    eventData: {
      version: 'restv2.1',
      format: 'json',
      includeData: ['recipients', 'tabs', 'custom_fields']
    }
  };
}

export function buildEnvelopePayload(config, input) {
  const clientUserId = input.embeddedSigning === false ? undefined : `embedded-${crypto.randomUUID()}`;
  const documentBase64 = stripDataUrl(input.documentBase64)
    || createSamplePdfBase64({ signerName: input.signerName, dealName: input.dealName });

  const envelope = {
    emailSubject: input.emailSubject || `Signature requested: ${input.dealName || 'DocuSign POC Agreement'}`,
    emailBlurb: input.emailBlurb || 'Please review and sign this agreement.',
    status: 'sent',
    documents: [{
      documentBase64,
      name: input.fileName || 'docusign-poc-agreement.pdf',
      fileExtension: fileExtension(input.fileName || 'agreement.pdf'),
      documentId: '1'
    }],
    recipients: {
      signers: [{
        name: input.signerName,
        email: input.signerEmail,
        recipientId: '1',
        routingOrder: '1',
        ...(clientUserId ? { clientUserId } : {}),
        tabs: {
          signHereTabs: [{
            anchorString: '/sn1/',
            anchorUnits: 'pixels',
            anchorXOffset: '0',
            anchorYOffset: '12'
          }],
          dateSignedTabs: [{
            anchorString: '/date1/',
            anchorUnits: 'pixels',
            anchorXOffset: '0',
            anchorYOffset: '-2'
          }]
        }
      }]
    },
    customFields: {
      textCustomFields: [
        { name: 'source', value: 'docusign-iam-poc', show: 'false' },
        { name: 'dealName', value: input.dealName || 'DocuSign POC Agreement', show: 'false' }
      ]
    },
    eventNotification: envelopeEventNotification(config)
  };

  return {
    envelope,
    clientUserId,
    documentName: input.fileName || 'docusign-poc-agreement.pdf'
  };
}

export async function createEnvelope(config, input) {
  const { envelope, clientUserId, documentName } = buildEnvelopePayload(config, input);
  const response = await docusignRequest(
    config,
    `/v2.1/accounts/${config.accountId}/envelopes`,
    {
      method: 'POST',
      body: JSON.stringify(envelope)
    }
  );

  const data = await response.json();
  return {
    envelopeId: data.envelopeId,
    status: data.status,
    statusDateTime: data.statusDateTime,
    uri: data.uri,
    clientUserId,
    documentName
  };
}

export async function getEnvelopeStatus(config, envelopeId) {
  const response = await docusignRequest(
    config,
    `/v2.1/accounts/${config.accountId}/envelopes/${encodeURIComponent(envelopeId)}`,
    { method: 'GET' }
  );
  return response.json();
}

export async function createRecipientView(config, input) {
  const response = await docusignRequest(
    config,
    `/v2.1/accounts/${config.accountId}/envelopes/${encodeURIComponent(input.envelopeId)}/views/recipient`,
    {
      method: 'POST',
      body: JSON.stringify({
        returnUrl: input.returnUrl,
        authenticationMethod: 'none',
        email: input.signerEmail,
        userName: input.signerName,
        recipientId: '1',
        clientUserId: input.clientUserId
      })
    }
  );

  return response.json();
}

export async function downloadCombinedDocument(config, envelopeId) {
  const response = await docusignRequest(
    config,
    `/v2.1/accounts/${config.accountId}/envelopes/${encodeURIComponent(envelopeId)}/documents/combined`,
    {
      method: 'GET',
      headers: { Accept: 'application/pdf' }
    }
  );

  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: response.headers.get('content-type') || 'application/pdf'
  };
}
