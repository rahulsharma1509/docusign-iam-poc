# DocuSign IAM Integration POC - Project Note

## What This App Does

This app is a small end-to-end DocuSign integration demo built as a portfolio project for technical pre-sales, partner solutions, and integration architecture roles.

The app lets a user create a signature workflow from a SaaS-style interface. A user enters a deal name, signer name, and signer email, then creates a DocuSign envelope using either a generated PDF or an uploaded PDF. The backend calls DocuSign eSignature REST APIs, sends the envelope, creates an embedded signing session, tracks envelope status, receives webhook events, and downloads the completed document once signing is finished.

In simple terms, it shows how a SaaS product can embed DocuSign into its own customer workflow.

## Main Capabilities

- Creates DocuSign envelopes from a backend service.
- Uses JWT authentication so DocuSign credentials stay server-side.
- Supports generated sample PDFs with signature anchor tags.
- Supports uploaded PDFs that contain DocuSign anchors.
- Starts embedded signing using a recipient view URL.
- Tracks envelope status through the DocuSign API.
- Receives DocuSign Connect webhook events.
- Downloads the final signed document.
- Runs locally and is structured for Vercel deployment.

## Why This Matters

This project directly maps to the kind of work expected from a DocuSign Partner Solutions Architect or ISV-focused pre-sales engineer.

It proves that I can understand a partner's product workflow, identify where DocuSign fits, and turn that into a working technical integration. It is not just a UI demo. It includes the core backend patterns needed for a real integration: authentication, REST API calls, envelope creation, embedded signing, webhook handling, and document retrieval.

## How This Helps Me

This app gives me a concrete project to talk about in interviews instead of only describing theory.

I can use it to explain:

- How DocuSign integrates into SaaS workflows.
- When to use embedded signing versus email signing.
- Why webhooks should drive status updates instead of only polling.
- How JWT auth works in a server-side integration.
- How partner platforms can trigger document workflows.
- How to think about production concerns like token management, storage, retries, security, and observability.

It also becomes the foundation for larger portfolio projects, such as:

- DocuSign plus Salesforce or n8n integration.
- AI-generated agreement workflows.
- A partner workshop called "How to integrate DocuSign into your SaaS product in 60 minutes."
- A reference architecture document for B2B SaaS integrations.

## Interview Story

The strongest way to present this project is:

"I built a DocuSign integration POC that simulates how a SaaS platform would send agreements for signature. The backend authenticates with DocuSign using JWT, creates envelopes, launches embedded signing, listens for Connect webhook events, and lets the app download the completed document. I built it this way to show both API implementation depth and partner-facing solution architecture thinking."

## Skills Demonstrated

- REST API integration
- OAuth/JWT-based authentication
- Server-side credential management
- Webhook-first architecture
- Embedded signing UX
- Event-driven workflow design
- SaaS integration patterns
- Partner enablement thinking
- Vercel-ready full-stack app structure

## Next Steps

The project is already pushed to GitHub:

https://github.com/rahulsharma1509/docusign-iam-poc

The next steps I will do later are:

1. Add real DocuSign developer credentials to the local `.env` file.
2. Complete DocuSign JWT consent for the integration user.
3. Run one real end-to-end signing test:
   - create envelope
   - open embedded signing
   - complete signing
   - verify status update
   - download the signed PDF
4. Test webhook delivery using a public tunnel or deployed Vercel URL.
5. Enable HMAC validation for DocuSign Connect webhook security.
6. Deploy the app to Vercel.
7. Add the live Vercel URL and screenshots to the README.
8. Add persistent storage for envelopes and webhook events.
9. Connect this app with the second project, `docusign-saas-bridge`, so a SaaS/n8n/Salesforce trigger can create a DocuSign envelope automatically.
10. Convert the docs into a partner-facing workshop deck.
