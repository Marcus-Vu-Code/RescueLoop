# RescueLoop — three-minute demonstration

## 0:00–0:25 · The problem

“Campus dining can have good surplus food while nearby pantries need supply. The difficult part is coordinating the right food, capacity, and pickup window before it is too late. RescueLoop closes that coordination gap.”

Start on Overview. Point out the five ready listings, one human-review item, three receiving partners, and clearly labeled illustrative impact. Open the campus map's **Explore matches** action.

## 0:25–1:10 · A match with reasons

Show the earliest-deadline rice bowls and their eligible partner. Explain the rules: human verification, at least 15 minutes of pickup overlap, compatible storage, accepted food category, dietary and allergen constraints, and sufficient receiving capacity. After hard filters, choose the closest eligible partner. Distances are sample values.

Approve a pickup. Open **Approved pickups**. Explain that the capacity is now reserved, but rescued-food impact has not changed. Confirm collection, then open **Impact report**: 24 kg and 48 estimated meal equivalents have been added.

## 1:10–2:05 · AI assists; humans decide

Click **Add surplus → From a note → Use a sample note**. Structure the note. If IBM credentials are configured, the app calls watsonx.ai; otherwise identify this honestly as the offline rule-based parser, not a live model.

Show the original note beside the editable structured fields. Do not check verification yet; save it for human review. Open **Food listings → Needs review**. Point out that the soup with unknown allergens cannot be matched.

After checking details with a fictional donor for this demonstration, edit the new rice listing, check the verification box, and save. It is now eligible for matching.

## 2:05–2:35 · Operational workflow

Open **Partners** and edit a receiving capacity. Show storage, dietary requirements, allergen exclusions, and receiving windows. Show the **Import CSV** tab and downloadable templates for both inventory and partner capacity. The browser stores records so a refresh preserves the demo.

## 2:35–3:00 · Accountability and next steps

Open **Impact report → How we measure**. Only confirmed collections count; meal equivalents use the explicitly stated illustrative assumption of 0.5 kg per meal. Export a CSV to trace every collected batch.

“Next we would pilot with a campus pantry, validate food handling procedures and measurement assumptions, replace sample distances with routing, and add shared records with transactional reservations. Today we can demonstrate the entire coordination loop, with the limits visible.”

## Reset before judging

Open **Workspace settings → Reset sample workspace → Restore sample workspace**. This discards local demo edits. Never claim the sample collection totals are real-world impact.
