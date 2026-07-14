# Growzzy OS App Redesign Spec

Source: BlynkAds product videos plus the Growzzy parity plan. This file is the UI structure contract. It does not replace `GROWZZY_BUILDER_UI_SPEC.md`; it defines the whole app around that builder.

## Product Shape

Growzzy combines two halves:

- Blynk: campaign creation, prompt-first, live preview, non-marketer flow.
- Madgicx: campaign management, dense analytics, recommendations, optimization log.

The app must feel like: prompt -> editable plan -> live preview -> paused launch -> verified metrics -> plain-English optimization.

## Navigation

Use 6 top-level items:

- Dashboard
- Campaigns
- Creative Studio
- AI Advisor
- Reports
- Settings

Delete as top-level items:

- Ad Accounts: move into Settings -> Integrations.
- Automations: move into AI Advisor -> Autopilot.
- Leads: hide until lead-gen flow is real.

## Blynk Pattern To Copy

Blynk's Create Campaign is not a next/back wizard. It is one persistent 3-column screen.

Column 1: Campaign Flow

- Title: "Campaign Flow"
- Subtitle: "Complete all steps before publish"
- Vertical clickable step list:
  - Set Goal
  - Creative
  - Audience
  - Website/Product Page or Instant Form
  - Placements, Meta only
  - Budget
  - Publish
- Completed steps show a filled icon.
- Active step is highlighted.
- Future steps are muted.

Column 2: Accordion Editor

- One section open at a time.
- Fields are edited inline.
- AI proposes values with a one-line why.
- Schedule/Publish actions are pinned at the bottom.

Column 3: Live Ad Preview

- Always visible.
- Never blank.
- Google Search v1 uses a live SERP mockup.
- Meta later uses Facebook/Instagram preview tabs.
- The preview updates as text, URL, budget, or creative changes.

This is the highest-priority UI rebuild after Checkpoint 1.

## Dashboard

Goal: answer "is my money working?" in under 3 seconds.

Connected state:

- KPI row: Spend, Conversions, Cost/result, ROAS.
- 30-day spend and results chart.
- Needs Attention feed with real recommendations and inline actions.
- Campaign Performance table plus Today's Recommendations.
- Platform Breakdown for Google and Meta.

Disconnected state:

- One centered empty state, not stacked cards.
- Primary action: Connect Google Ads.
- Disabled Meta action with honest "coming after Google proof" copy.

Delete app-wide:

- "Trust filter"
- "Verified live campaigns only"
- "stale only"
- "reload-safe"
- "workspace scoped"
- "platform changes happen first"
- any literal mention of "empty states"

## Campaigns

Keep it clean:

- Header with Sync icon and New Campaign primary button.
- Search field.
- Two filters max: Platform and Status.
- Campaign rows: name, platform, status pill, spend, primary metric, menu.

Delete:

- min/max spend filters
- min/max ROAS filters
- trust filters
- verified/stale toggles
- "Go to Ad Accounts" empty-state detours

## Creative Studio

Two tabs only:

- Generate
- Library

Generate:

- Left: prompt-first input, format, platform, aspect ratio, AI Enhance.
- Right: live preview plus generated result cards.
- Brand, tone, and product context come from workspace settings silently.

Library:

- Grid of saved creatives.
- Show real performance only after a creative is used.

## AI Advisor

Three tabs:

- Recommendations: real signals, real numbers, Apply/Dismiss/Snooze.
- Action Log: every AI/user mutation, outcome, undo.
- Autopilot: Alert, Approval, Autopilot modes and guardrails.

This absorbs the old Automations top-level page.

## Reports

One-click report:

- Date range.
- Campaign selection.
- AI executive summary grounded in real daily metrics.
- KPI table.
- Chart.
- Campaign table.
- PDF export.
- Scheduled email toggle.

## Settings

Four tabs:

- General: business info, budget ceiling, product description.
- Integrations: Google live, Meta disabled until backend is real.
- Billing.
- Notifications.

## Build Order

Do not start the full redesign before Checkpoint 1 evidence is accepted.

1. Checkpoint 1: real paused Google campaign proof on the correct account.
2. App shell cleanup: nav reduced to 6 items and jargon deleted.
3. Campaigns page cleanup: remove filter wall.
4. Blynk 3-column Campaign Builder.
5. Checkpoint 2: AI plan -> real Google launch proof.
6. Dashboard metrics and reports from `CampaignMetricDaily`.
7. AI Advisor signals, actions, undo, Autopilot.
8. Creative Studio split-screen.
9. Meta pass only after Google Checkpoints 1-3.

## Non-Goals For V1

- Landing page builder.
- Boolean search mode.
- Standalone lead form product.
- Custom rule builder.
- Meta publishing before Google is proven.
