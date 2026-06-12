# DocuSign IAM Integration POC

Fresh DocuSign portfolio project for eSignature and IAM integration work. The app creates an envelope from an uploaded or generated PDF, starts embedded signing through a recipient view, tracks status through polling plus webhook events, and downloads the completed PDF.

## What It Shows

- JWT grant service integration with DocuSign eSignature REST APIs
- Envelope creation with signer tabs anchored in the document
- Embedded signing via recipient view URL
- Webhook-first status tracking with a polling fallback
- Vercel-friendly API route structure
- Security-first API boundaries with validation, rate limiting, HMAC verification, idempotent webhook handling, and redacted logs
- Dependency-free validation using Node 18+ built-in tooling

## Production Hardening Added

This POC has been upgraded from a happy-path demo into a production-style engineering artifact.

- Strict server-side envelope input validation and PDF upload limits
- Request body size guardrails for API routes
- Best-effort route rate limiting for envelope creation and recipient view generation
- Trusted return URL validation for embedded signing callbacks
- DocuSign Connect HMAC verification support
- Webhook idempotency keys to avoid duplicate side effects on retries
- Request IDs, security headers, safer error responses, and redacted structured logs
- Browser-side output escaping for user-provided envelope data
- Vercel security headers with CSP, frame controls, referrer policy, and content sniffing protection
- CI-ready validation scripts for syntax checks, secret scanning, and automated tests

## Project Structure

```text
docusign-iam-poc/
  api/                  Vercel API routes
  api/_lib/             DocuSign, config, HTTP, storage helpers
  public/               Static frontend
  server/local-dev.js   Local server that emulates the API routes
  docs/                 Workshop and architecture notes
```

## Setup

1. Create a DocuSign developer app / integration key.
2. Add this redirect URI in the DocuSign app settings:

```text
http://localhost:3000/api/oauth-callback
```

3. Copy the env example and fill in your DocuSign values:

```bash
cp .env.example .env
```

4. Start the local app:

```bash
npm run dev
```

5. Open:

```text
http://localhost:3000
```

6. Use the app's consent link once for the JWT grant. DocuSign requires user consent for `signature impersonation`.

## Validation

Run the full local validation suite:

```bash
npm run validate
```

This runs:

- `npm run check:syntax` for JavaScript syntax checks
- `npm run scan:secrets` for committed-secret detection
- `npm test` for Node test coverage around envelope payloads, validation, rate limiting, webhook parsing, HMAC verification, and idempotency

## Required Environment Variables

| Variable | Description |
| --- | --- |
| `DOCUSIGN_INTEGRATION_KEY` | Integration key / client ID |
| `DOCUSIGN_USER_ID` | User GUID to impersonate with JWT grant |
| `DOCUSIGN_ACCOUNT_ID` | DocuSign account ID |
| `DOCUSIGN_PRIVATE_KEY` | RSA private key for the integration key |
| `DOCUSIGN_AUTH_SERVER` | `account-d.docusign.com` for demo |
| `DOCUSIGN_BASE_PATH` | `demo.docusign.net/restapi` for demo |
| `APP_BASE_URL` | Public URL for return URLs and webhooks |
| `CORS_ALLOWED_ORIGINS` | Optional comma-separated browser origins allowed to call the API |
| `MAX_REQUEST_BODY_BYTES` | Optional max request body size, defaults to 5 MB |
| `DOCUSIGN_WEBHOOK_SECRET` | Optional DocuSign Connect HMAC secret |

## API Routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Check configuration state |
| `GET` | `/api/consent-url` | Build JWT consent URL |
| `GET` | `/api/oauth-callback` | Consent callback landing route |
| `POST` | `/api/envelopes` | Create and send envelope |
| `GET` | `/api/envelopes/:id` | Fetch envelope status |
| `POST` | `/api/envelopes/:id/signing-url` | Create embedded signing URL |
| `GET` | `/api/envelopes/:id/documents` | Download combined document |
| `POST` | `/api/webhooks/docusign` | Receive DocuSign Connect events |

## Vercel Deployment

1. Import this folder as a Vercel project.
2. Add all required environment variables in Vercel.
3. Set `APP_BASE_URL` to your Vercel production URL.
4. Set `DOCUSIGN_WEBHOOK_URL` to:

```text
https://your-project.vercel.app/api/webhooks/docusign
```

The in-memory event store is fine for the POC. For production, replace `api/_lib/store.js` with Postgres, DynamoDB, Redis, or your SaaS platform's system of record.

## Security Model

The browser never receives DocuSign private keys, access tokens, or JWT assertions. The backend owns JWT token exchange, envelope creation, recipient view generation, document download, and webhook verification.

Production controls demonstrated in this repo:

- Validate every request at the API boundary
- Keep DocuSign credentials server-side
- Generate embedded signing URLs only on demand
- Restrict embedded signing return URLs to the configured app origin
- Verify DocuSign Connect HMAC signatures when a webhook secret is configured
- Process webhook events idempotently so retries do not duplicate state changes
- Avoid storing completed documents in the demo runtime
- Redact sensitive keys and document payloads from structured logs

See [docs/production-hardening.md](docs/production-hardening.md) for the engineering-manager review checklist, risk notes, and next production steps.

## Extension Ideas

- Add Salesforce or n8n trigger: closed-won deal creates a DocuSign envelope.
- Add AI contract generation before envelope creation.
- Persist webhook events and envelope state in a database.
- Turn `docs/workshop-lab.md` into a partner-facing workshop deck.
