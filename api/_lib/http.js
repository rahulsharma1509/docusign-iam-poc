import crypto from 'node:crypto';
import { loadEnvFiles } from './config.js';
import { logError, logInfo } from './logger.js';

const defaultBodyLimitBytes = 5 * 1024 * 1024;

function headerValue(req, name) {
  if (!req?.headers) return '';
  return req.headers[name] || req.headers[name.toLowerCase()] || '';
}

function configuredAllowedOrigins() {
  loadEnvFiles();
  return String(process.env.CORS_ALLOWED_ORIGINS || process.env.CORS_ALLOWED_ORIGIN || '*')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

function resolveCorsOrigin(req) {
  const allowedOrigins = configuredAllowedOrigins();
  if (!allowedOrigins.length || allowedOrigins.includes('*')) return '*';

  const requestOrigin = String(headerValue(req, 'origin') || '').replace(/\/+$/, '');
  if (requestOrigin && allowedOrigins.includes(requestOrigin)) return requestOrigin;
  return allowedOrigins[0];
}

function bodyLimitBytes() {
  loadEnvFiles();
  const configured = Number(process.env.MAX_REQUEST_BODY_BYTES || defaultBodyLimitBytes);
  return Number.isFinite(configured) && configured > 0 ? configured : defaultBodyLimitBytes;
}

function createPayloadTooLargeError(limit) {
  const error = new Error(`Request body is too large. Limit is ${limit} bytes.`);
  error.statusCode = 413;
  error.publicMessage = 'Request body is too large.';
  error.details = { limitBytes: limit };
  return error;
}

function responseFromArgs(reqOrRes, maybeRes) {
  return maybeRes ? { req: reqOrRes, res: maybeRes } : { req: null, res: reqOrRes };
}

function ensureRequestId(res) {
  const existing = res.getHeader?.('X-Request-Id');
  const requestId = existing || crypto.randomUUID();
  res.setHeader('X-Request-Id', requestId);
  return requestId;
}

export function setCommonHeaders(reqOrRes, maybeRes) {
  const { req, res } = responseFromArgs(reqOrRes, maybeRes);

  res.setHeader('Access-Control-Allow-Origin', resolveCorsOrigin(req));
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-DocuSign-Signature-1,X-Request-Id');
  res.setHeader('Vary', 'Origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cache-Control', 'no-store');
  ensureRequestId(res);
}

export function handleOptions(req, res) {
  setCommonHeaders(req, res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}

export function sendJson(res, statusCode, payload) {
  setCommonHeaders(res);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export function sendText(res, statusCode, text) {
  setCommonHeaders(res);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end(text);
}

export function sendHtml(res, statusCode, html) {
  setCommonHeaders(res);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(html);
}

export function sendBinary(res, statusCode, buffer, headers = {}) {
  setCommonHeaders(res);
  res.statusCode = statusCode;
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }
  res.end(buffer);
}

export function methodNotAllowed(res, allowed = ['GET']) {
  res.setHeader('Allow', allowed.join(', '));
  sendJson(res, 405, { error: `Method not allowed. Use ${allowed.join(' or ')}.` });
}

export async function readRawBody(req) {
  const limit = bodyLimitBytes();

  if (req.body !== undefined) {
    const body = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));

    if (body.length > limit) throw createPayloadTooLargeError(limit);
    return body;
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > limit) throw createPayloadTooLargeError(limit);
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

export async function readJson(req) {
  const raw = await readRawBody(req);
  if (!raw.length) return {};

  try {
    return JSON.parse(raw.toString('utf8'));
  } catch {
    const error = new Error('Request body must be valid JSON.');
    error.statusCode = 400;
    throw error;
  }
}

export function getQuery(req) {
  if (req.query) return req.query;
  const url = new URL(req.url, 'http://localhost');
  return Object.fromEntries(url.searchParams.entries());
}

export function getEnvelopeId(req) {
  const query = getQuery(req);
  return query.envelopeId || query.id || '';
}

export function sendError(res, error) {
  const statusCode = error.statusCode || error.status || 500;
  const requestId = res.getHeader?.('X-Request-Id') || ensureRequestId(res);
  const payload = {
    error: error.publicMessage || error.message || 'Unexpected server error',
    requestId
  };

  const exposeDetails = statusCode < 500 || process.env.NODE_ENV !== 'production';
  if (error.details && exposeDetails) payload.details = error.details;

  const logFields = {
    requestId,
    statusCode,
    error: error.message,
    details: error.details
  };
  if (statusCode >= 500) logError('api.request.failed', logFields);
  else logInfo('api.request.rejected', logFields);

  sendJson(res, statusCode, payload);
}
