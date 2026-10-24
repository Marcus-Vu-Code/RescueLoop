# RescueLoop

Live application: https://rescueloop-live.rescueloop-campus.workers.dev/

Sample walkthrough: https://rescueloop-live.rescueloop-campus.workers.dev/demo

Source repository: https://github.com/Marcus-Vu-Code/RescueLoop

## Short description

Good food. Greater impact. Independent campus dining and community partner accounts turn verified surplus into explainable pickup matches and collection receipts.

## Inspiration

Good surplus food and community demand can exist nearby while narrow pickup windows, storage requirements, and incomplete inventory notes prevent a handoff. We built a focused coordination workflow that donors and receiving organizations can inspect together.

## What it does

Users create email/password accounts and opt-in organization profiles, request partnerships, and accept connections. Donors enter food manually, import CSVs, or structure inventory notes into drafts. People verify handling and declared allergens. Transparent rules check receiving windows, time zones, storage, categories, dietary requirements, and remaining daily capacity.

Receivers request eligible batches and donors approve them. Approval atomically reserves capacity. The two organizations can coordinate in a private pickup conversation and receive in-app notifications. A receiver-confirmed collection creates a receipt and updates the impact report and CSV export.

## AI contribution

The live application uses IBM watsonx.ai with `ibm/granite-4-h-small` to extract explicitly stated inventory facts using IBM Cloud IAM and a bounded, schema-validated request. Hosted synthetic extraction was verified on October 24, 2026. Missing details stay unknown, and output cannot certify food or approve a pickup. The separate `/demo` route uses a clearly labeled offline parser and browser-local sample data.

## How it is built

TypeScript, React, Vinext/Vite, Cloudflare Workers, shared D1/SQLite storage, Zod validation, Lucide icons, Node's test runner, Miniflare integration tests, and an IBM watsonx.ai REST adapter. Independent credentials use salted scrypt and hashed opaque sessions. D1 transactions and conditional updates protect receiving capacity and collection lifecycle. An isolated `/demo` retains synthetic browser-local data for demonstrations.

## Responsible AI and privacy

People verify source facts and approve pickups. Unknown allergens block matching. The application does not infer dietary suitability from food names, decide who qualifies for assistance, or certify food safety. It needs no beneficiary personal information. Shared records and pickup conversations use organization-level authorization. Only notes deliberately submitted to a configured IBM extractor are sent to that model provider; extraction credentials remain server-side.

## Impact and limitations

Only receiver-confirmed collections count. Weights are donor reported; meal equivalents use the explicitly labeled illustrative 0.5 kg assumption. Synthetic records do not establish real-world impact, and no emissions savings are claimed.

The app includes email verification, expiring password-reset links, opt-in notification emails, and background retries through Resend. The current deployment uses owner-only email test mode. Delivery to other users needs a verified sending domain. Organization affiliation remains self-reported. Whole-batch allocation, declared constraints, and manually entered inventory need a campus pilot with validated handling procedures and measurement assumptions. Live routing and verified institutional onboarding are future additions.

## AI development disclosure

Codex assisted with design, implementation, testing, and documentation. The team is responsible for review and accurately identifying configured integrations. Do not claim IBM Bob unless the team actually used it.

## Before submitting

- Confirm the actual team name and every team member.
- Use the public application and repository links above. The live demonstration can serve as prototype evidence under the challenge's final reminder.
- The original managed Sites URL remains owner-private under workspace policy. Use the direct Cloudflare public URL for judges.
- The October 24 preflight passed all 35 tests, typecheck, production build, and the synthetic two-account live workflow. Temporary QA data was removed.
- State whether the presentation used live IBM extraction or the offline parser.
- Follow the organizers' current deadline and submission instructions.
