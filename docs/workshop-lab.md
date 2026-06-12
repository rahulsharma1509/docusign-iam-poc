# Workshop Lab: Integrate DocuSign Into a SaaS Product in 60 Minutes

## Audience

ISV engineers, solution architects, and partner technical teams building contract, approval, onboarding, procurement, or customer lifecycle workflows.

## Outcomes

By the end of the lab, participants can:

- Configure a DocuSign developer integration key for JWT auth.
- Create and send an envelope from a SaaS workflow.
- Launch embedded signing for a known recipient.
- Receive webhook events from DocuSign Connect.
- Update the SaaS workflow state after signing.

## Lab Flow

| Time | Segment | Artifact |
| --- | --- | --- |
| 0-10 min | Integration model | Auth, account, envelope, recipient, webhook map |
| 10-20 min | Environment setup | `.env` with integration key, user ID, account ID, private key |
| 20-35 min | Envelope creation | Sent envelope with anchor tabs |
| 35-45 min | Embedded signing | Recipient view URL launched inside the app |
| 45-55 min | Webhook status | Connect event received and shown in the timeline |
| 55-60 min | Production checklist | Storage, retries, security, observability |

## Instructor Script

### 1. Integration Model

Walk through the working surface:

- SaaS app owns business workflow state.
- Backend owns DocuSign credentials and API calls.
- DocuSign owns signing ceremony, audit trail, and completed documents.
- Webhooks are the primary source for status updates.
- Polling is only a fallback for user refresh and recovery.

### 2. Auth Setup

Configure a DocuSign developer app with:

- JWT grant enabled through an RSA key pair.
- Redirect URI: `http://localhost:3000/api/oauth-callback`
- Consent granted for `signature impersonation`.

Run:

```bash
cp .env.example .env
npm run dev
```

Open `http://localhost:3000` and confirm the config badge is green.

### 3. Create Envelope

Use generated PDF mode first. It includes `/sn1/` and `/date1/` anchor tags.

Expected result:

- `/api/envelopes` returns an `envelopeId`.
- Envelope status starts as `sent`.
- The local timeline shows a local state event.

### 4. Start Embedded Signing

Click `Focused signing`.

Expected result:

- Backend calls recipient view creation.
- App opens a short-lived signing URL.
- The signer completes the signing ceremony.

### 5. Webhook Validation

For local testing, expose the server with a tunnel and set:

```text
DOCUSIGN_WEBHOOK_URL=https://your-tunnel.example.com/api/webhooks/docusign
```

Expected result:

- DocuSign posts a Connect event.
- `/api/webhooks/docusign` records it.
- Status refresh shows webhook events in the timeline.

## Production Checklist

- Persist envelopes and webhook events in durable storage.
- Validate webhook HMAC signatures.
- Make envelope creation idempotent with a workflow correlation ID.
- Store secrets only in the deployment platform secret manager.
- Use retry-safe webhook consumers.
- Add structured logging around DocuSign API calls.
- Separate sender identity from app administrator identity.
- Track API limits and error rates.
