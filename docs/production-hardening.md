# Production Hardening Review

This document captures the engineering review posture for the DocuSign IAM Integration POC. It is written as if the POC were being promoted from a partner demo into a production candidate.

## Review Goals

- Keep DocuSign credentials, JWT assertions, and access tokens out of the browser.
- Make envelope creation predictable, validated, and observable.
- Treat DocuSign Connect as the primary state-change channel.
- Make webhook handling safe under retries, duplicates, and malformed payloads.
- Give security reviewers a clear map of controls, known limits, and next production steps.

## Controls Implemented

| Area | Control | Implementation |
| --- | --- | --- |
| Credential boundary | DocuSign credentials remain server-side | `api/_lib/docusign.js`, environment variables |
| Input validation | Required fields, email format, PDF extension, base64 sanity, string limits | `api/_lib/validation.js` |
| Request size | API body limit defaults to 5 MB | `api/_lib/http.js`, `MAX_REQUEST_BODY_BYTES` |
| Abuse protection | Best-effort route rate limits | `api/_lib/rateLimit.js` |
| Embedded signing | Return URL restricted to configured app origin | `api/envelopes/[envelopeId]/signing-url.js` |
| Webhook authenticity | Optional DocuSign Connect HMAC verification | `api/_lib/webhook.js` |
| Webhook idempotency | Duplicate delivery keys return the original event | `api/_lib/store.js` |
| Webhook observability | Delivery inbox separates attempts from processed events | `api/webhooks/events.js`, `api/webhooks/replay.js` |
| Observability | Request IDs and redacted structured logs | `api/_lib/http.js`, `api/_lib/logger.js` |
| Browser safety | Escapes user-provided values before rendering | `public/app.js` |
| Deployment headers | CSP, frame rules, content sniffing, referrer, permissions | `vercel.json` |
| Validation automation | Syntax checks, secret scan, unit tests | `npm run validate` |

## Threat Notes

### Secret Exposure

Risk: Private keys or webhook secrets could be committed, logged, or exposed to the browser.

Mitigations:

- `.env` and `.env.local` are ignored.
- `.env.example` uses placeholders only.
- Secret scanner checks tracked and untracked repository files.
- Logger redacts token, secret, private key, signature, and document payload fields.
- Frontend calls backend routes only; it does not receive DocuSign credentials.

### Webhook Replay and Duplicate Processing

Risk: DocuSign Connect may retry events, or an attacker may replay a webhook payload if the webhook secret is not configured.

Mitigations:

- HMAC verification is supported when `DOCUSIGN_WEBHOOK_SECRET` is set.
- Delivery headers or parsed event metadata become an idempotency key.
- Duplicate events return the existing event and do not update envelope state again.
- The webhook inbox records delivery attempts so duplicate retries are visible during demos and debugging.

Production next step:

- Persist event keys in a durable database with a retention window.
- Alert if HMAC is skipped outside local development.

### Open Redirect in Embedded Signing

Risk: A malicious caller could request a recipient view that returns to an attacker-controlled page.

Mitigation:

- The signing route rejects return URLs outside `APP_BASE_URL`.

Production next step:

- Store expected return URL and workflow correlation ID at envelope creation time.

### Malicious Document Upload

Risk: Large or malformed uploads can overload the API route or create invalid envelopes.

Mitigations:

- Body-size limit defaults to 5 MB.
- Uploaded documents must use base64 content and `.pdf` file names.

Production next step:

- Add malware scanning and content-type inspection in the document storage layer.
- Prefer templates or server-side document generation for repeatable workflows.

### Cross-Site Scripting

Risk: Deal, signer, status, or webhook values could be displayed in the UI.

Mitigations:

- User-provided fields rendered through `innerHTML` are escaped.
- Vercel CSP limits script execution to the app origin.

Production next step:

- Replace remaining template-string rendering with DOM node construction if the UI grows.

## Operational Readiness

Before a real partner pilot, complete these checks:

- Configure DocuSign developer credentials in local or hosted environment variables.
- Complete JWT consent for the impersonated user.
- Configure DocuSign Connect to send JSON events to the deployed webhook URL.
- Set and verify `DOCUSIGN_WEBHOOK_SECRET`.
- Run `npm run validate`.
- Create one real envelope and complete embedded signing.
- Confirm webhook event status updates the local state.
- Confirm duplicate webhook delivery does not duplicate event history.
- Use the replay simulator to demonstrate a new delivery and then a duplicate delivery with the same idempotency key.
- Confirm completed document download works only after envelope completion.

## Production Gaps

These are intentionally left out of the lightweight POC:

- Durable envelope/event database
- Managed rate limiting or API gateway
- Queue-based webhook processing
- Background retry worker for downstream SaaS updates
- Document malware scanning
- Centralized secrets manager
- Centralized logs, metrics, dashboards, and alerts
- Formal SLOs and incident response ownership

## Interview Walkthrough

Use this language when presenting the hardening pass:

"I started with a working DocuSign eSignature POC, then treated it like a production-readiness review. I added API validation, request limits, route-level rate limiting, HMAC webhook verification, idempotency, a webhook inbox with replay simulation, trusted embedded-signing callbacks, browser escaping, deployment security headers, redacted structured logs, and repeatable validation automation. The result is still lightweight enough for a portfolio demo, but it shows the engineering judgment needed to guide an ISV partner from prototype to safe implementation."
