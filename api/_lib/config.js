import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const envLoadedKey = Symbol.for('docusignIamPoc.envLoaded');

function parseEnvValue(raw) {
  let value = raw.trim();
  const quote = value[0];
  if ((quote === '"' || quote === "'") && value[value.length - 1] === quote) {
    value = value.slice(1, -1);
  }
  return value.replace(/\\n/g, '\n');
}

function loadEnvFile(filePath, originalEnvKeys) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = parseEnvValue(trimmed.slice(separator + 1));
    if (!key || originalEnvKeys.has(key)) continue;

    process.env[key] = value;
  }
}

export function loadEnvFiles() {
  if (globalThis[envLoadedKey]) return;

  const originalEnvKeys = new Set(Object.keys(process.env));
  loadEnvFile(path.join(projectRoot, '.env'), originalEnvKeys);
  loadEnvFile(path.join(projectRoot, '.env.local'), originalEnvKeys);
  globalThis[envLoadedKey] = true;
}

function getRequestBaseUrl(req) {
  if (!req?.headers) return '';

  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (!host) return '';

  const proto = req.headers['x-forwarded-proto'] || 'http';
  return `${proto}://${host}`;
}

function cleanUrl(value) {
  return String(value || '').replace(/\/+$/, '');
}

export function getConfig(req) {
  loadEnvFiles();

  const requestBaseUrl = getRequestBaseUrl(req);
  const appBaseUrl = cleanUrl(process.env.APP_BASE_URL || requestBaseUrl || 'http://localhost:3000');

  return {
    integrationKey: process.env.DOCUSIGN_INTEGRATION_KEY || '',
    userId: process.env.DOCUSIGN_USER_ID || '',
    accountId: process.env.DOCUSIGN_ACCOUNT_ID || '',
    privateKey: process.env.DOCUSIGN_PRIVATE_KEY || '',
    authServer: process.env.DOCUSIGN_AUTH_SERVER || 'account-d.docusign.com',
    basePath: process.env.DOCUSIGN_BASE_PATH || 'demo.docusign.net/restapi',
    appBaseUrl,
    webhookUrl: cleanUrl(process.env.DOCUSIGN_WEBHOOK_URL || `${appBaseUrl}/api/webhooks/docusign`),
    webhookSecret: process.env.DOCUSIGN_WEBHOOK_SECRET || ''
  };
}

export function getMissingRequiredConfig(config) {
  const required = {
    DOCUSIGN_INTEGRATION_KEY: config.integrationKey,
    DOCUSIGN_USER_ID: config.userId,
    DOCUSIGN_ACCOUNT_ID: config.accountId,
    DOCUSIGN_PRIVATE_KEY: config.privateKey
  };

  return Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);
}

export function buildConsentUrl(config) {
  const redirectUri = `${config.appBaseUrl}/api/oauth-callback`;
  const params = new URLSearchParams({
    response_type: 'code',
    scope: 'signature impersonation',
    client_id: config.integrationKey || 'YOUR_INTEGRATION_KEY',
    redirect_uri: redirectUri
  });

  return `https://${config.authServer}/oauth/auth?${params.toString()}`;
}

export function publicConfig(config) {
  const missing = getMissingRequiredConfig(config);
  return {
    configured: missing.length === 0,
    missing,
    authServer: config.authServer,
    basePath: config.basePath,
    appBaseUrl: config.appBaseUrl,
    webhookUrl: config.webhookUrl,
    consentUrl: buildConsentUrl(config)
  };
}
