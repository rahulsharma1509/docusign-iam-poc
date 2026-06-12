import { getQuery, handleOptions, methodNotAllowed, sendHtml } from './_lib/http.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  const query = getQuery(req);
  const hasError = Boolean(query.error);

  return sendHtml(res, hasError ? 400 : 200, `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>DocuSign Consent</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f5f7fb; color: #1f2937; }
      main { max-width: 520px; padding: 32px; background: white; border: 1px solid #d8dee9; border-radius: 8px; box-shadow: 0 18px 50px rgb(15 23 42 / 0.08); }
      h1 { margin: 0 0 12px; font-size: 24px; }
      p { line-height: 1.6; }
      a { color: #0f766e; font-weight: 650; }
    </style>
  </head>
  <body>
    <main>
      <h1>${hasError ? 'Consent was not completed' : 'Consent completed'}</h1>
      <p>${hasError ? `DocuSign returned: ${query.error}` : 'The integration can now request JWT access tokens for this user.'}</p>
      <p><a href="/">Return to the DocuSign POC</a></p>
    </main>
  </body>
</html>`);
}
