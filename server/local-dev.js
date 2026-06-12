import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import consentUrl from '../api/consent-url.js';
import envelopes from '../api/envelopes.js';
import envelopeStatus from '../api/envelopes/[envelopeId].js';
import envelopeDocuments from '../api/envelopes/[envelopeId]/documents.js';
import envelopeSigningUrl from '../api/envelopes/[envelopeId]/signing-url.js';
import health from '../api/health.js';
import oauthCallback from '../api/oauth-callback.js';
import docusignWebhook from '../api/webhooks/docusign.js';
import { sendJson } from '../api/_lib/http.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicRoot = path.resolve(__dirname, '../public');
const port = Number(process.env.PORT || 3000);

const apiRoutes = [
  { method: 'GET', pattern: /^\/api\/health$/, handler: health },
  { method: 'GET', pattern: /^\/api\/consent-url$/, handler: consentUrl },
  { method: 'GET', pattern: /^\/api\/oauth-callback$/, handler: oauthCallback },
  { method: 'POST', pattern: /^\/api\/envelopes$/, handler: envelopes },
  { method: 'GET', pattern: /^\/api\/envelopes\/([^/]+)$/, param: 'envelopeId', handler: envelopeStatus },
  { method: 'POST', pattern: /^\/api\/envelopes\/([^/]+)\/signing-url$/, param: 'envelopeId', handler: envelopeSigningUrl },
  { method: 'GET', pattern: /^\/api\/envelopes\/([^/]+)\/documents$/, param: 'envelopeId', handler: envelopeDocuments },
  { method: 'POST', pattern: /^\/api\/webhooks\/docusign$/, handler: docusignWebhook }
];

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8'
};

function matchApiRoute(req, pathname, searchParams) {
  for (const route of apiRoutes) {
    const match = pathname.match(route.pattern);
    if (!match) continue;
    if (route.method !== req.method && req.method !== 'OPTIONS') continue;

    const query = Object.fromEntries(searchParams.entries());
    if (route.param) query[route.param] = decodeURIComponent(match[1]);
    req.query = query;
    return route.handler;
  }
  return null;
}

function serveStatic(req, res, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.resolve(publicRoot, `.${decodeURIComponent(requested)}`);

  if (!filePath.startsWith(publicRoot)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', contentTypes[path.extname(filePath)] || 'application/octet-stream');
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || `localhost:${port}`}`);
  const handler = matchApiRoute(req, url.pathname, url.searchParams);

  try {
    if (handler) {
      await handler(req, res);
      return;
    }

    if (url.pathname.startsWith('/api/')) {
      sendJson(res, 404, { error: 'API route not found.' });
      return;
    }

    serveStatic(req, res, url.pathname);
  } catch (error) {
    sendJson(res, error.statusCode || 500, {
      error: error.message || 'Unexpected local dev server error.',
      details: error.details
    });
  }
});

server.listen(port, () => {
  console.log(`DocuSign IAM POC running at http://localhost:${port}`);
});
