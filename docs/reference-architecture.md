# Reference Architecture: DocuSign Integration Patterns for B2B SaaS

## Core Pattern

```text
SaaS workflow -> Integration backend -> DocuSign eSignature API
      ^                    |                  |
      |                    v                  v
State update <- Webhook consumer <- DocuSign Connect
```

The SaaS product remains the system of record for customer, deal, and workflow state. DocuSign remains the system of record for signing ceremony, certificate, document history, and completed agreements.

## Authentication

Use JWT grant when the integration sends envelopes from a controlled service account or fixed sender identity.

Recommended controls:

- Keep the RSA private key server-side.
- Rotate integration keys and private keys on a defined schedule.
- Grant user consent once per impersonated user.
- Cache access tokens until shortly before expiry.
- Never expose account ID, user ID, access token, or private key to the browser.

## Envelope Creation

Use the API backend to construct envelope definitions.

Common inputs:

- Signer name and email
- Source document or generated PDF
- Template ID for repeatable workflows
- Workflow correlation ID
- Return URL for embedded signing
- Webhook callback URL

For repeatable SaaS workflows, prefer templates or server-side document generation over ad hoc uploads.

## Signing UX

### Embedded Signing

Best for logged-in SaaS users who are already known to the product. The backend creates the envelope with `clientUserId`, then creates a recipient view URL when the signer starts the session.

Tradeoffs:

- Better UX inside the app.
- Requires recipient identity to be managed by the SaaS product.
- Recipient view URLs are short-lived and should be generated on demand.

### Remote Email Signing

Best for external parties who are not in the SaaS app. Do not set `clientUserId`; DocuSign sends the signing email.

Tradeoffs:

- Simpler recipient onboarding.
- Signing happens outside the app.
- Status still returns through webhooks.

## Status Updates

Use webhooks as the primary status source.

Polling is useful for:

- Manual refresh
- UI recovery after network errors
- Backfill jobs

Webhook consumer requirements:

- Return a fast 2xx acknowledgment.
- Verify HMAC signatures in production.
- Store every event before processing side effects.
- Make event handling idempotent by envelope ID and event timestamp.
- Retry downstream SaaS updates safely.

## Storage

For the POC, in-memory storage is enough. For production, store:

- Envelope ID
- Workflow correlation ID
- Signer identity
- Current status
- Raw webhook event metadata
- Last successful DocuSign API sync
- Completed document pointer, if documents are copied into SaaS storage

Good storage options:

- Postgres for relational SaaS workflows
- DynamoDB for serverless/event-heavy workflows
- Redis only for cache, not authoritative state

## Error Handling

Design explicit handling for:

- Missing consent for JWT grant
- Expired or rotated private key
- Envelope tab anchor not found
- Signer email typo
- Recipient view URL expired
- Webhook replay
- Completed document not yet available

## Partner Enablement Notes

When presenting this architecture to ISV partners, anchor the conversation in their workflow:

- What business event creates the agreement?
- Who is the sender?
- Who signs inside the product versus through email?
- What status changes matter to their users?
- Which system owns renewal, onboarding, or approval state after signing?
