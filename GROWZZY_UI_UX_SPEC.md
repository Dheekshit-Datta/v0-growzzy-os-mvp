# Growzzy OS — Product UI/UX Spec

Companion to `GROWZZY_REBUILD_PLAN.md`. This document specifies every screen in the app: what it contains, how it functions, and what data it must be wired to. It does not cover the marketing landing page (separate, already built).

**Sequencing rule:** Build Section 3 (Campaign Builder) and Section 2 (Dashboard Home) first — these are the two screens where "does the product actually work" gets decided. Do not build Sections 5–9 until Sections 2–3 are wired to real Google Ads publish end-to-end (Phase 3/5 checkpoint in the rebuild plan). Meta is deferred until Google works end-to-end, per current scope lock.

**Design system baseline:** Off-white or soft dark-navy background in-app (not pure black — that's the landing page's register, not the dashboard's). Instrument Serif for headings only. Inter for all data/functional text. `tabular-nums` on every numeric column. Status always encoded with color + icon/shape, never color alone. Skeleton loaders on every data-dependent panel — Google/Meta API calls are not instant.

---

## 1. Onboarding

First-run flow, target completion under 5 minutes.

**Step 1 — What are you selling?**
Single free-text input. No category dropdown. This text seeds the AI campaign builder later.

**Step 2 — Connect accounts**
Two cards: Google Ads, Meta. Each: "Connect" → OAuth → shows connected account name + ad account picker if multiple exist. Skippable, but campaign launch is blocked until at least one platform is connected.

**Step 3 — Business context**
- Website URL (auto-scrape name/logo/description on blur — best effort, don't block on failure)
- Monthly budget — slider, not text input
- Primary goal — radio: Sales / Leads / App installs / Website traffic

**Step 4 — Straight into campaign builder**
No dashboard tour. Land directly in Section 3 with product description and goal pre-filled from Steps 1 and 3.

**Function:**
- Progress dots, back button always available
- Auto-save at every step (survives refresh)
- Skipping account connection is allowed; skipping business context is not (needed for AI generation)

---

## 2. Dashboard Home

Must answer "is my money working" in under 3 seconds of looking at it.

**KPI strip (4 cards, horizontal, top of page)**
Spend (7-day) · Conversions/Leads · Cost per result · ROAS (or CPA if no revenue tracking configured)
Each card: large number, 7-day sparkline, colored delta. Delta color is metric-aware (CPA down = green, ROAS down = red).

**Platform breakdown (2-panel row)**
Google | Meta, each showing spend / results / active campaign count for the period. Click-through filters the campaigns table below to that platform.

**Needs attention (feed, not chart)**
Card list, most urgent first:
- "Campaign X has 0 conversions after $[spend] — pause or review?" → [Pause] [Review] inline buttons, both call real endpoints
- "Ad creative Y is fatiguing (CTR down [n]%) — generate fresh variant?" → [Generate]
- "Google approved your new campaign — now live" (informational, dismissible)

This feed is the real product value surface — AI advisor output belongs here contextually, not buried in a separate tab only.

**Active campaigns table**
Name · platform icon · status pill (Live / Paused / Learning / Rejected) · spend · primary metric · quick actions (pause / edit / view). Sortable, filterable by platform and status.

**Empty state rule:** No fake/demo data ever. If there's no data yet, show a clear "Launch your first campaign" CTA, not zeroed-out cards pretending to be real.

---

## 3. Campaign Builder

The core prompt-to-launch flow. One continuous screen with four stages, not four separate pages — state must persist across stages and submit as a single object at launch.

**Stage 1 — Describe**
- Large text box: "What do you want to promote?" (pre-filled from onboarding context if available)
- Goal — pills: Sales / Leads / Traffic / Installs
- Budget — slider, daily $ shown live
- Platform toggle: Google / Meta / Both

**Stage 2 — AI Plan Review**
This is the current biggest product gap — the plan must be real and editable, not static text that gets discarded.
- Campaign structure: ad groups/ad sets, targeting (audience for Meta, keywords + negative keywords for Google), bidding strategy, budget split
- Every field inline-editable — clicking targeting opens a real editor, not a read-only summary
- Estimated reach + estimated cost-per-result range
- Policy pre-check badge: green "Passes ad policy check" or amber "Review: [specific flagged phrase]" with the actual flagged text shown

**Stage 3 — Creative Review**
- Grid of AI-generated creatives (image + headline + copy), one row per ad
- Per-creative regenerate button (not just whole-batch regenerate)
- Format preview toggle — see the creative as it will render (Feed post / Story / Search ad)

**Stage 4 — Launch**
- Summary: total budget, platforms, duration, expected results range
- "Launch Campaign" button — must call the real publish endpoint using the actual campaign type and bidding strategy from Stage 2 (today it hardcodes `SEARCH` + `manualCpc: {}` regardless of input — must fix)
- On success: redirect to Campaign Detail page (Section 4) showing status pulled live from the platform API, not a local DB flag frozen at "PENDING"

---

## 4. Campaign Detail Page

- Header: name, platform, status pill, actions (edit / pause / duplicate / delete)
- Metrics row: spend, results, cost/result, CTR — date-range selectable
- Performance chart: spend vs. results overlay, daily granularity
- Ad-level table: per-ad performance with creative thumbnail
- AI insight box scoped to this campaign specifically: e.g. "This ad set is outperforming the other 3x — consider shifting budget," generated from this campaign's real MetricDaily rows, not generic copy

---

## 5. Creative Studio

Standalone workspace, decoupled from the campaign builder flow.

**Generate tab:** Product description or URL in → AI generates a batch across formats (square / story / landscape) → each result as a card with regenerate / edit / download / "use in campaign" actions.

**Library tab:** Grid of all previously generated creatives. Filterable by campaign, platform, format. If a creative has been used in a live campaign, show its real performance (CTR, conversions) on the card — this requires the library to query actual usage, not just generation history.

**Performance tab:** Ranks creatives by real cross-campaign performance ("top 5 headlines," "top 3 images"). Must show a genuine empty state before enough usage data exists — never fabricate a ranking.

---

## 6. AI Advisor / Copilot

One engine, two surfaces:

**Chat panel** (slide-out, available from any screen): Grounded in the user's actual campaign data via `verifiedCampaignWhere`/`verifiedMetricCampaignWhere` scoping — answers must query real MetricDaily rows, never fabricate numbers.

**Optimization feed** (dedicated page): List of AI-detected opportunities, each showing:
- What was found, with real numbers
- Recommended action
- Three buttons: **Apply** (calls the real API — pause / budget shift / etc. — currently this button only removes the card from local React state and must be wired to `/api/ai/apply-optimization` or equivalent), **Dismiss**, **Snooze**
- History log of past applied optimizations with outcome ("Paused Ad Set B on [date] — saved $[x], no conversion loss")

**Autopilot toggle** (per-campaign or global), three modes:
- **Alert only** — informs, user decides
- **Approval required** — proposes a specific action, one-click approve
- **Full autopilot** — acts within guardrails the user sets (max daily budget shift %, never a full pause without approval)

Every action must show its work — no silent automated changes. This is the primary trust surface of the product.

---

## 7. Leads

Only build if lead-gen is a supported campaign goal — otherwise defer, consistent with the landing-page scope decision to cut what isn't load-bearing.

Table view: name, source (campaign/platform), pipeline status (New / Contacted / Qualified / Won / Lost), value. Optional kanban view (drag between status columns). AI lead-scoring badge if enabled.

---

## 8. Reports

**Report builder:** date range, campaigns, platforms → generates one report through a single pipeline (today there are two incompatible pipelines writing to the same `Report` table with different field types — must be consolidated to one before this section is usable).

**Report view:** AI-written executive summary (grounded in real totals — `report-builder.ts` currently calls `.toFixed()` on a string field and crashes; must be fixed) → charts → data table. PDF export must render real numbers, not the current `report.data.totals.*` fields nobody writes to.

**Scheduled reports:** weekly/monthly auto-email toggle per workspace.

---

## 9. Settings

- **Account:** name, email, password, notification preferences
- **Integrations:** Google/Meta connection status, reconnect/disconnect, token health indicator
- **Billing:** plan, usage, upgrade/downgrade, invoice history — real Stripe data only, no placeholder rows
- **Team:** invite/roles — build only if multi-user is actually planned; if not, remove from nav entirely rather than ship an empty fake tab
- **Danger zone:** delete workspace, export data

---

## Build order (ties to rebuild plan phases)

1. Dashboard Home (Section 2) + Campaign Builder (Section 3) — Google only, wired to real publish. This is the Phase 3/5 checkpoint.
2. Campaign Detail (Section 4) — needed to see the result of #1.
3. AI Advisor optimization feed (Section 6) — Apply button wired to real endpoint.
4. Creative Studio (Section 5).
5. Reports (Section 8) — after the single-pipeline consolidation.
6. Leads (Section 7) — only if in scope.
7. Settings (Section 9) — strip fake data before shipping, even if features are minimal.
8. Onboarding (Section 1) polish — last, since it depends on Campaign Builder being real.
