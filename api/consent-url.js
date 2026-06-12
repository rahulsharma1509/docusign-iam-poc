import { buildConsentUrl, getConfig } from './_lib/config.js';
import { handleOptions, methodNotAllowed, sendJson } from './_lib/http.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  const config = getConfig(req);
  return sendJson(res, 200, {
    consentUrl: buildConsentUrl(config),
    redirectUri: `${config.appBaseUrl}/api/oauth-callback`
  });
}
