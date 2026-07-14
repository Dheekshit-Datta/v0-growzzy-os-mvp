# Growzzy Campaign Builder - UI Spec (Blynk-derived)

Derived directly from frame-by-frame analysis of BlynkAds product videos (prompt intake, targeting, creative generation, lead forms). This replaces the current 5-step form wizard at `app/dashboard/campaigns/new/page.tsx`. Landing page generation is explicitly excluded - Growzzy links to the user's own site instead.

**The one pattern that matters most:** Blynk never makes the user imagine the result. Every editing step shows a live, real ad preview on one side while fields are edited on the other. Growzzy's current builder shows no preview at all during editing - that's the single highest-leverage gap to close.

**The second pattern:** AI never leaves a blank field for the user to fill. It proposes a specific answer plus a one-line plain-English "why," and the user edits or accepts. This is exactly what the `rationale` object in `GROWZZY_COMPETITIVE_PARITY_SPEC.md` Part 1.3 already specifies - Blynk's targeting modal literally shows "why this audience" as a sentence above the picks.

---

## Screen 1 - Prompt Intake

Single centered card, not a form:
- One large textarea: "Describe what you're promoting"
- Below the textarea, a live checklist row that fills in as the AI parses the text while typing (debounced): `Ad Objective` `Target Audience` `Budget` `Location` - each goes from outline circle to filled green check the moment that detail is inferable from the text. This is a trust signal - the user sees the system understanding them in real time, not just accepting raw text.
- "AI Enhance" button: expands a short prompt into a fuller paragraph brief (calls the enhancement step already spec'd in parity doc Part 1.1) - shown inline as an editable rewrite of their own text, not a separate screen.
- Primary action: circular arrow button, becomes active once the minimum required checklist items are filled.

Do not tab this behind "Campaign / Boolean search / Create Image / Launch Ads" mode-switcher like Blynk - Growzzy only needs the Campaign path for v1. Skip that complexity.

## Screen 2 - Campaign Flow (split-screen, the core rebuild)

**This is the actual replacement for the current 5-step wizard.** Two-column layout:

**Left column - collapsible step rail**, each section expands accordion-style, one open at a time:
1. **Goal** - pills, already generated from Screen 1, editable
2. **Plan Review** - this is where the AI-generated `CampaignPlan` (ad groups, keywords, negatives, RSA headlines/descriptions, bidding strategy) renders as editable fields, per parity spec Part 1.4. Each ad group is its own expandable sub-card.
3. **Audience/Targeting** (Meta pass only, Google v1 uses keyword targeting shown inline in Plan Review - no separate step)
4. **Landing page URL** - a single URL field only (explicitly not a builder)
5. **Budget** - slider, live-updates the expected-results estimate text beneath it
6. **Policy Check** - status badge (PASS/WARN/FAIL) with expandable flag list, per parity spec Part 1.5
7. **Publish** - final step, shows the paused-launch confirmation

**Right column - live preview, persistent across all steps.** For Google Search (v1): a realistic SERP mockup - sponsored label, headline combination, display URL, description - regenerating live as headlines/descriptions are edited in the left column. This does not require a real Google API call; it's a static styled mockup using the current form state, matching Section 1.6 of the parity spec.

The right column never goes blank or shows a placeholder - it always reflects current state, exactly like Blynk's phone mockup does.

## Screen 2a - Ad Group Editor (nested inside Plan Review)

Per ad group, editable inline (not a modal):
- Name - text field
- Keywords - chip list, click to remove, type + enter to add, match-type toggle per chip (Broad/Phrase/Exact)
- Negative keywords - same chip pattern, visually distinct (red-tinted border) from positive keywords
- Headlines - list of text inputs with live character counters (red at 30 char limit)
- Descriptions - same pattern, 90 char limit
- A collapsed "Why this ad group" line pulling from `plan.rationale.whyTheseKeywords` - small, muted text, always visible without a click. This is the Blynk-derived pattern: the rationale is ambient, not buried behind a tooltip.

## Screen 3 - Launch Confirmation

Not a separate page - the final accordion step. Summary card:
- Campaign name, total daily budget, number of ad groups, total keyword count
- Policy badge repeated here (can't miss it before publishing)
- Button: "Launch (starts paused)" - matches parity spec Part 1.7's two-step safety default
- On success: redirect to Campaign Detail, which now polls real Google status rather than a local flag

---

## What to explicitly NOT copy from Blynk

- **Landing page builder** - locked out of scope by prior decision. The URL field only.
- **Four-mode top switcher** (Campaign/Boolean/Create Image/Launch Ads) - unnecessary complexity for v1, collapses to one flow.
- **Lead form builder as a separate product surface** - if lead-gen campaigns are in scope, a lead form is just one field group inside the existing flow, not its own multi-step wizard with "AI Question Suggestions" as a distinct feature. Revisit only if user research shows it's needed.
- **Radius-based city chip targeting with map** - Google Search v1 uses geo-target strings from the plan, not a Meta-style radius picker. This pattern is relevant for the Meta pass (Part 5 of parity spec), not now.

## Build order

1. Split-screen shell (left accordion rail + right persistent preview panel) - pure layout, no new data needed, wraps the existing `CampaignPlan` from `campaign-builder/route.ts`
2. Wire Plan Review step to the persisted plan (GET/PATCH `/api/ai/campaign-plan/[id]`)
3. Ad Group Editor chip components (keywords, negatives, headlines, descriptions) with live character counts
4. SERP preview component in the right panel, pure presentational, derives from current form state
5. Policy Check step wired to `/api/ai/policy-check`
6. Launch step wired to `/api/ai/campaign-plan/[id]/launch`

This spec is additive to `GROWZZY_COMPETITIVE_PARITY_SPEC.md` Part 1 - it specifies layout and interaction, the parity spec specifies data contracts and endpoints. Build both together.
