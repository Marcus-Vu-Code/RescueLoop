# RescueLoop

## Short description

Good food. Greater impact. RescueLoop turns campus surplus into explainable, human-approved pickup matches for community food partners.

## Inspiration

Good surplus food and community demand can exist a short distance apart. Pickup windows, receiving capacity, storage requirements, and incomplete inventory notes make the handoff difficult. We wanted a focused workflow that a dining coordinator or campus pantry could inspect and use.

## What it does

Coordinators enter a surplus listing, paste an inventory note, or import a CSV. Notes become editable structured drafts. Every listing requires donor-confirmed handling and allergen verification before it can be matched. A transparent rule engine checks pickup overlap, capacity, food category, storage, dietary labels, and declared allergens. It prioritizes the earliest deadline and chooses the nearest eligible sample partner.

A coordinator approves each pickup. Approval reserves partner capacity. A separate collection confirmation closes the loop and updates rescued weight and estimated meal equivalents. The impact report and CSV export trace totals to individual collection records.

## AI contribution

An optional server-side IBM watsonx.ai chat adapter extracts explicitly stated inventory facts. It authenticates using IBM Cloud IAM, restricts destinations to supported IBM regional endpoints, limits request size, applies a constrained extraction prompt, and validates the response schema. Model output cannot approve a listing or certify safety. Missing facts remain unknown.

The credential-free demo uses a clearly labeled rule-based parser. **Do not describe this as live IBM inference unless you have configured and demonstrated the watsonx.ai connection.** The matching engine is deterministic and explainable; it is not presented as machine learning.

## How it is built

TypeScript, React, Vinext/Vite, Cloudflare Workers through Sites, Zod, Lucide icons, browser localStorage, Node's test runner, and the IBM watsonx.ai REST API adapter. Inventory and community partners are synthetic. The campus network is an illustrative SVG, with no external map dependency.

## Responsible AI

People verify source facts and approve every pickup. Unknown allergens and unverified handling block matching. The prototype does not infer dietary suitability from food names, decide eligibility for food assistance, contact partners, or claim to certify food safety. It needs no beneficiary personal information. Only notes deliberately submitted to a configured live IBM endpoint leave the browser; credentials remain server-side.

## Impact and limitations

Only confirmed collected weight counts toward rescued food. Meal equivalents divide collected kg by an explicitly labeled illustrative 0.5 kg assumption. Sample data does not establish real-world impact. No emissions savings are claimed.

The prototype uses a fixed demo day and clock, sample distances, whole-batch allocation, and browser-local records. It does not provide shared transactional reservations, live dispatch, production food-safety certification, or a verified pantry partnership. A practical next step is a small campus pilot with validated handling protocols, a shared database, and real receiving capacity.

## AI development disclosure

Codex assisted with design, implementation, testing, and documentation. The team is responsible for reviewing the implementation and accurately describing which model integrations were configured and demonstrated. Do not claim use of IBM Bob unless your team actually used it.

## Before submitting

- Add the actual team name and all team members.
- Add the repository URL and a live URL accessible to judges, or record a demonstration video under three minutes.
- The default Sites deployment is owner-private. The owner must explicitly choose broader sharing before judges can access that URL.
- Run the setup and tests from the README; verify links in the final submission.
- State whether the presentation used IBM extraction or the offline parser.
- Follow the deadline and any additional instructions announced by the organizers.
