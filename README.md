# RescueLoop

**Good food. Greater impact.** A campus food rescue coordinator for the SpartHill Hacks IBM AI Challenge. Independent donor and receiver accounts connect, share verified surplus, arrange pickups, and record collections.

Public application: **https://rescueloop-live.rescueloop-campus.workers.dev**

## What works

- Independent email/password accounts, secure sessions, password changes, and single-use recovery codes.
- Organization profiles with opt-in directory discovery, partnership requests, acceptance, and closure.
- Shared food listings, manual entry, note-to-draft extraction, and validated CSV imports.
- Human verification and transparent checks for receiving hours, time zones, storage, category, dietary requirements, declared allergens, and daily capacity.
- Receiver pickup requests, donor approval, cancellation, atomic capacity reservations, private pickup conversations, and receiver-confirmed collection receipts.
- In-app notifications, unread counts, preferences, collection CSV exports, and traceable impact totals.
- A separate `/demo` with fictional data and browser-local persistence for a quick guided demonstration.

The main application uses a shared Cloudflare D1 database and the real clock. It starts empty. Local test accounts and `/demo` records are never uploaded to a public database.

## Run locally

Requires Node.js 22.13 or newer and npm. From this directory:

```powershell
npm run install:ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 migrations apply DB --local --config dist/server/wrangler.json --persist-to .wrangler/state
npm run dev
```

Open the Local URL printed by the development server. Create an account for the shared workflow or open `/demo` for the synthetic demonstration. Save the recovery code shown at registration; no recovery email is sent. `npm run start` serves the built Worker locally using the same local D1 state.

```powershell
npm test
npm run typecheck
npm run build
```

The tests cover multi-account authorization, sessions, email verification and password resets, notification delivery and retries, concurrent approvals, capacity release, collection receipts, time-zone restrictions, parser validation, CSV safety, and mocked IBM requests. Live integration tests use a temporary Miniflare D1 database. Migrations in `drizzle/` are append-only; generate future schema changes with `npm run db:generate`.

## Public hosting

See [PUBLIC-HOSTING.md](docs/PUBLIC-HOSTING.md) for direct Cloudflare deployment. `npm run deploy:cloudflare` builds and deploys the Worker, creates or reuses `rescueloop-live`, and applies pending migrations. The actual public address comes from Wrangler. A first-time Cloudflare account may require workers.dev setup.

The original managed Sites URL has an owner-only platform gate because this workspace does not offer public Sites access. Independent application accounts do not bypass that platform gate. `.openai/hosting.json` retains the registered Site identity; direct deployment generates its own ignored configuration and preserves the shared database between releases.

## Demonstrate the shared workflow

Use separate donor and receiver accounts, ideally in separate browser profiles. Publish their directory profiles, request and accept a partnership, and configure the receiver's receiving hours and capacity. The donor adds a verified future-dated listing. The receiver requests it, the donor approves, and the receiver confirms collection after the agreed window starts. Both parties can read the pickup conversation and receipt. Only a confirmed collection changes impact.

See [the demo script](docs/DEMO.md) and [the Devpost draft](docs/DEVPOST.md). `/demo` is isolated from the shared application, uses a fixed sample clock, and clearly labels its synthetic impact and illustrative distances.

## Optional IBM watsonx.ai

See [INTEGRATIONS.md](docs/INTEGRATIONS.md) for provider account setup, secure activation, email verification, password reset, and notification delivery. `npm run integrations:configure -- --ibm` verifies a synthetic IBM extraction before uploading secrets. `--email` activates a verified sending domain; `--email --owner-test` restricts delivery to the owner's Resend signup address when no domain is available.

Copy `.env.example` to ignored `.dev.vars` for local development. Configure `WATSONX_API_KEY`, `WATSONX_PROJECT_ID`, `WATSONX_MODEL_ID`, and `WATSONX_URL`. Choose a chat-capable model actually available in your project and region. In production, use Worker secrets with the generated direct-deployment config, or Sites runtime environment variables for the managed Site.

The server exchanges the API key through IBM IAM and calls `/ml/v1/text/chat?version=2025-10-25` with JSON output and a bounded completion limit. Explicit regional allowlists, bounded inputs, timeout handling, and schema validation protect extraction. Live extraction requires a signed-in RescueLoop account and a same-origin request. It runs only when selected. Credentials remain server-side, missing details stay unknown, and model output cannot verify food or approve a pickup.

Without credentials, the UI identifies the offline rule-based parser. Tests mock IBM responses; a live IBM request has not been verified without the owner's provider credentials. Do not claim live IBM inference when demonstrating the offline parser.

References: [IBM watsonx.ai API](https://cloud.ibm.com/docs/apis/watsonx-ai), [IBM IAM API](https://cloud.ibm.com/docs/apis/iam-identity-token-api).

## Data, security, and measurement

Passwords use salted scrypt with N=32768, r=8, p=3, an [OWASP-recommended parameter set](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) compatible with the deployed runtime. Legacy local PBKDF2 records remain readable locally. Random opaque session tokens are hashed in D1 and issued in HttpOnly, SameSite=Lax cookies, with Secure and `__Host-` in production. Mutations validate origin, ownership, roles, schema, and lifecycle. Sign-in and recovery are rate limited. Recovery rotates the code and invalidates previous sessions. Private source notes are excluded from partner views, and pickup messages are limited to the two participating organizations.

Approvals recheck current eligibility and reserve one whole batch with a conditional SQL update and D1 transaction. Concurrent donors cannot overbook the same receiver's daily capacity. Cancellation releases capacity. Collection retains that day's capacity and generates one receipt. Existing reservations prevent reducing capacity below commitments or changing the receiving time zone while active pickups would be affected.

Rescued kg is the sum of receiver-confirmed donor-reported batch weights. Estimated meal equivalents are `floor(collected kg / 0.5)`. The 0.5 kg assumption is illustrative and is not a nutritional or serving-size claim. Requests and approved pickups do not count as rescued. No carbon savings are claimed.

## Architecture

```text
app/live-app.tsx         Shared application interface
app/live.css             Responsive account and coordination UI
app/api/live/route.ts     D1-backed account and workflow endpoint
lib/live-service.ts       Authorization, lifecycle, notifications, transactions
lib/live-domain.ts        Validation, receiving windows, explainable eligibility
lib/passwords.ts          Password KDF and opaque token helpers
db/schema.ts / drizzle/   Shared D1 schema and immutable migrations
lib/watsonx.ts            IBM IAM/chat extraction adapter
app/api/extract/route.ts  Authenticated extraction endpoint
app/demo/                Isolated browser-local sample application
scripts/deploy-cloudflare.mjs  Direct public Worker/D1 deployment
```

React/TypeScript runs on Vinext/Vite and Cloudflare Workers. The Sites starter's deployment integration is retained. Notifications refresh when the application is open; messages poll within a pickup conversation.

## Current limits

Email verification, reset links, and opt-in notification delivery are implemented through Resend. Delivery requires configured provider credentials and a verified sending domain; no-domain owner-test mode cannot send to other users. In-app notifications and private recovery codes remain available independently. SMS and push are not implemented. Organization affiliation is self-reported. Each account manages one organization. Matching checks declared constraints and whole batches; it does not certify food safety, provide routing or dispatch, or verify reported weights. A campus pilot still needs partner consent, handling protocols, operational support, and measurement validation.

Codex assisted with design, implementation, testing, and documentation. Review the project and disclose which integrations your team actually configured and demonstrated.
