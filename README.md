# RescueLoop

**Good food. Greater impact.** A campus food rescue coordinator built for the SpartHill Hacks 2026 IBM AI Challenge.

## Run locally

Requires **Node.js 22.13 or newer** and npm.

```powershell
npm run install:ci
npm run dev
```

Open the Local URL printed by the development server. No API key is required. The default demo runs a clearly labeled offline rule-based note parser.

```powershell
npm test
npm run typecheck
npm run build
```

`npm run start` serves the built Worker locally. The project uses the portable Sites execution profile, including on Windows.

## What works

- Coordinator overview with available food, receiving capacity, verified collections, and estimated meal equivalents.
- Notes-to-draft extraction, manual entry, and inventory CSV uploads, with a human review queue.
- Editable partners and capacity CSV uploads, including pickup windows, food categories, storage, dietary requirements, and allergen restrictions.
- Transparent matching, human pickup approval, reserved daily capacity, collection confirmation, and cancellation with capacity release.
- Impact charts, collection-level CSV exports, activity, search, local persistence, sample-workspace reset, and responsive navigation.
- Optional server-side IBM watsonx.ai extraction adapter with schema validation, timeout handling, and no client-side credentials.

## The demonstration

The demo clock is fixed at **2:30 PM Pacific on October 23, 2026** so judges can replay it reliably. All inventory, organizations, distances, pickups, and impact figures are synthetic. The network map is illustrative. No real partner affiliation is claimed.

Start with five verified food listings, one unverified soup listing, three partners, and four historical sample collections totaling 124 kg. **Find matches → Approve pickup → Approved pickups → Confirm collection → Impact report** shows the full loop. The first rice-bowl collection adds 24 kg and 48 estimated meal equivalents.

To structure a note, select **Add surplus → Use a sample note → Structure note & review**. Review the fields, verify them with the fictional donor for the demo, then check the verification box and save. Unknown allergens cannot be verified. Imported listings always start in review, even if an input file claims they are verified.

Download inventory and partner CSV templates from their import tabs. Weight is in kg, time is 24-hour `HH:MM`, and multiple dietary labels or partner categories/storage types use `|` separators.

See [the three-minute demo script](docs/DEMO.md) and [the Devpost draft](docs/DEVPOST.md).

## Enable IBM watsonx.ai

1. Obtain an IBM Cloud API key, a watsonx.ai project ID, and a **chat-capable model ID available in that project and region**. Model availability changes; the app intentionally requires an explicit model ID.
2. Copy `.env.example` to **`.dev.vars`** for local Worker development and fill in `WATSONX_API_KEY`, `WATSONX_PROJECT_ID`, `WATSONX_MODEL_ID`, and `WATSONX_URL`. Both local secret files are ignored by Git.
3. Restart the development server. **Add surplus → From a note** should identify IBM watsonx.ai as configured. In production, set these same four values through Sites runtime environment variables and redeploy.
4. Use a test inventory note with no personal information, inspect the extracted fields, and confirm that missing details remain unknown. A configured adapter is not proof of a successful live call.

The server exchanges the API key at IBM IAM, then sends a chat request to `/ml/v1/text/chat?version=2024-05-31`. Supported regional hosts are explicitly allowlisted. The request uses temperature 0 and an extraction-only prompt; returned fields pass Zod validation. Provider failures never create a listing or silently impersonate successful inference. The offline parser remains available when no IBM configuration is provided.

Credentials remain server-side. Live extraction requires same-origin requests and a signed-in Site visitor; loopback development is permitted without sign-in. No model call is made automatically. Notes are sent only when the coordinator chooses live extraction.

References: [IBM watsonx.ai API](https://cloud.ibm.com/docs/apis/watsonx-ai) and [IBM IAM API](https://cloud.ibm.com/docs/apis/iam-identity-token-api).

## Matching and impact

The matcher uses hard constraints before ranking:

1. Food is available on the demo date, has positive weight, and has been human verified with known declared allergens.
2. Partner is active, accepts the category, and has compatible storage.
3. Declared dietary labels satisfy requirements. Vegan listings can satisfy vegetarian requirements.
4. Declared allergens do not conflict with configured exclusions. Basic common allergen aliases are checked; this is not a comprehensive food-safety assessment.
5. Pickup and receiving windows overlap by at least 15 minutes after the demo clock.
6. The whole batch fits remaining daily receiving capacity, including existing reservations and collections and earlier suggestions in the same run.

Process batches by earliest deadline, then select the closest eligible partner using illustrative distance values. Approval rechecks eligibility and reserves capacity. Collection keeps daily capacity used; cancellation releases it. The algorithm is a deterministic greedy heuristic, not a global optimization or a trained matching model. Suggestions can change as approvals consume capacity.

Rescued food = sum of confirmed collected weight. Estimated meal equivalents = `floor(total collected kg / 0.5)`. The 0.5 kg portion assumption is illustrative, not a validated nutrition or servings claim. Suggestions and reserved food do not count as rescued. No carbon savings are claimed.

## Architecture

```text
app/rescue-app.tsx       Responsive coordinator interface and local workspace state
lib/rescue.ts            Data types, synthetic seed, validation, parsers, matching, impact
lib/watsonx.ts           IBM IAM/chat adapter and untrusted model-output validation
app/api/extract/route.ts Server configuration status and bounded extraction endpoint
tests/                  Node tests for constraints, lifecycle, parsers, and mocked IBM API
worker/index.ts          Vinext Worker entrypoint with Sites integration
```

React/TypeScript runs on Vinext/Vite and Cloudflare Workers. The Sites starter’s build, auth, and deployment integration is retained. The prototype stores operational data in versioned browser localStorage. Malformed saved state is rejected. CSV exports quote cells and neutralize leading spreadsheet formulas. Tests mock IBM; a live provider call requires the owner's credentials and was not assumed.

## Limits and next steps

This is a **single-coordinator hackathon prototype**, not an operational food redistribution service. Records are local to one browser; there is no shared transactional database, multi-user conflict protection, real dispatch, live inventory feed, food-safety certification, or live routing. Coordinator verification must follow actual donor and partner procedures. Matching checks only the explicitly configured constraints, and whole-batch allocation can miss feasible partial allocations.

Before a real pilot: partner with campus dining and a pantry, validate food handling and allergen procedures, add shared records and atomic reservations, introduce real dates/expiry and routing, validate portion and impact assumptions, and evaluate extraction against labeled donor notes. Obtain explicit partner consent before notifications or public listings.

## Publishing and disclosure

Sites deployments default to **owner-private**. The owner must explicitly change sharing before judges can access a deployed URL. A short recorded demonstration also meets the supplied brief's demonstration requirement. `.openai/hosting.json` retains the registered Site identity; deployment secrets are not stored there.

Codex assisted with design, implementation, tests, and documentation. Review the project and accurately disclose the tools and AI configuration used in your submission. Do not claim live IBM inference when presenting the offline parser.
