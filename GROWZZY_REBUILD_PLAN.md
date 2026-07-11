# Growzzy OS — Full Rebuild & Re-Architecture Plan

**Audience for this doc:** an autonomous coding agent (Codex) that will refactor, fix, and build this repo.
**Product goal:** a "one prompt → live, high-performing ad campaign" platform for **solo founders / small teams with zero marketing knowledge**, combining:
- **Blynk-style** prompt-to-launch: describe your business → AI generates creative + copy + audience + full campaign → publish to Google & Meta.
- **Madgicx-style** AI optimization/autopilot: continuous, data-driven budget/bid/audience/creative optimization with an AI "marketer" that recommends and (with approval or fully autonomous) executes changes.

**Scope decisions (locked):**
- Platforms: **Google Ads + Meta (Facebook/Instagram) only.** Remove LinkedIn from the product surface. Landing-page generation is **deferred** (design the seam for it, don't build it yet).
- Every feature listed here must be **real, end-to-end wired, and verified** — no stubs, no fake data, no disconnected UI.

---

## 0. How to use this document

Work in the numbered **Phases**. Each phase has a **Definition of Done (DoD)**. Do not advance to a later phase until the current phase's DoD is met and verified by actually driving the flow (not just typecheck). Prefer deleting code over patching dead code. When a section says "DELETE," delete the file and all imports/nav links to it.

Global engineering rules for the whole rebuild:
1. **One canonical route per action.** No `-real` / `-platform` / `-on-platform` duplicates. If two routes do the same thing, merge into one and delete the rest.
2. **One response envelope everywhere:** `{ ok: true, data }` or `{ ok: false, error: { code, message } }`. No mix of `{success}`/`{error:string}`/`{ok}`.
3. **Every DB query is scoped by `userId` AND `workspaceId` AND (where relevant) `adAccountId`.** No exceptions.
4. **No secrets in source or static files.** All secrets via env; all OAuth tokens encrypted at rest.
5. **No fabricated metrics, ever.** If data is missing, return an explicit empty/`needs-connection` state. Never invent revenue/ROAS.
6. **Every mutating platform action** goes through one typed service layer (`lib/platforms/*`) with real API calls, retries, and structured errors.
7. **Tests required** for: money math (metrics/ROAS/budget), campaign publish payload builders, optimization rule engine, auth/session, workspace scoping.

---

## 1. Target Architecture

### 1.1 Stack (keep, upgrade, or replace)
- **Framework:** Next.js (App Router) + TypeScript. Keep. Pin to one Next major; align `eslint-config-next` to the **same** major (currently mismatched: Next 14 vs eslint-config-next 16). Remove `legacy-peer-deps=true` once deps are consistent.
- **DB/ORM:** Postgres (Supabase) + Prisma. Keep. All schema changes via Prisma migrations only — **no loose `.sql` files, no runtime DDL**.
- **Auth:** NextAuth. Move off `5.0.0-beta.x` to a stable release, OR pin the beta deliberately and document it. Single session-based login path only.
- **AI:** Standardize on **one** primary LLM provider for text (pick OpenAI `gpt-4o`/successor or Anthropic Claude — do not keep both half-wired). Images via OpenAI `gpt-image-1`. Keep the provider behind `lib/ai/provider.ts` so it's swappable.
- **Charts:** Pick **one** library (recommend Recharts). Remove `chart.js` + `react-chartjs-2`.
- **Background jobs:** Vercel Cron for scheduled sync/optimization + a durable job/queue table in Postgres (the current empty `queue/` dirs must become real or be deleted). For "autopilot," a cron that runs the optimization engine per workspace.
- **Rate limiting / caching:** Upstash Redis (real), not the in-memory Map. Make rate limiting **fail-closed** on auth endpoints.

### 1.2 Layering (enforce this shape)
```
app/                      ← routes (UI) + app/api (thin controllers only)
  (marketing)/            ← public landing
  (auth)/                 ← login/signup/reset  (ONE shell)
  (app)/dashboard/...     ← authenticated product (ONE shell, sidebar)
  api/...                 ← thin: parse → authorize → call service → envelope
lib/
  ai/                     ← provider, prompts, schemas, scoring
  platforms/
    google/               ← real Google Ads API client + mappers
    meta/                 ← real Meta Graph API client + mappers
    index.ts              ← platform-agnostic facade used by services
  services/               ← business logic (campaigns, creatives, optimization, reports, analytics, automations)
  db/                     ← prisma client, scoping helpers
  auth/                   ← session, workspace, crypto
  domain/                 ← pure functions: metrics math, rule engine, health scoring
```
**Controllers never call Prisma or fetch platforms directly.** They call `lib/services/*`. Services call `lib/platforms/*` and `lib/db`. Pure math/rules live in `lib/domain/*` and are unit-tested.

### 1.3 Canonical data model (Prisma) — redesign
Consolidate to these core models; remove legacy/duplicate ones (`Creative` vs `GeneratedCreative`, legacy `AutomationRule` columns, orphaned `OptimizationSuggestion`, untracked `CampaignScores`/`Analytics`/`UserOAuthConfig`).

- `User`, `Workspace`, `WorkspaceMember(role)`, `Session` (NextAuth).
- `Integration` — one per (workspace, platform). Fields: `platform(GOOGLE|META)`, `status`, `hasAdsAccess`, **encrypted** `accessTokenEnc`, `refreshTokenEnc`, `tokenExpiresAt`, `selectedAdAccountExternalId`, `scopes`, `lastSyncAt`, `lastSyncStatus`.
- `AdAccount` — `externalId`, `name`, `currency`, `platform`, `integrationId` (FK), `isPrimary`.
- `Campaign` — **`adAccountId` must be a real FK to `AdAccount.id`.** Add `externalId`, `platform`, `objective`, `channelType`, `biddingStrategy`, `budgetType`, `budgetAmount`, `status`, `liveStatus`, `isLive`. Store the platform's external account id on `AdAccount`, not on `Campaign`.
- `AdGroup` / `AdSet`, `Ad`, `Keyword`, `NegativeKeyword`.
- `Creative` (single model — delete `GeneratedCreative` OR rename and merge into one): `brief`, `variations[]`, `assets[]` (image/video URLs + aspect ratio + placement), `scoreBreakdown`, `status`, `campaignId?`.
- `MetricDaily` — per (campaign|adset|ad, date): spend, impressions, clicks, conversions, revenue, ctr, cpc, cpa, roas. **Single source of truth for all analytics.** No raw denormalized columns feeding some endpoints and `MetricDaily` feeding others.
- `Recommendation` — persisted AI/rule optimization suggestions: `type`, `entityRef`, `currentValue`, `recommendedValue`, `rationale`, `expectedImpact`, `confidence`, `status(PENDING|PREVIEWED|APPLIED|DISMISSED|UNDONE)`, `previewSnapshot`, `appliedSnapshot`.
- `AutomationRule` — `trigger(metric,operator,value,window)`, `action(type,params)`, `mode(ALERT|APPROVAL|AUTOPILOT)`, `isActive`, `workspaceId`. Remove the legacy `threshold/action/active` columns.
- `AutomationRun` / `OptimizationLog` — audit trail of every evaluated rule + every applied change (for undo + reporting).
- `Report` — **single** shape: `type`, `period`, `metricsJson` (numbers, never formatted strings), `narrative`, `recommendations`, `pdfUrl?`.
- `Lead` (+ `LeadSource`) — scoped by workspace + adAccount, single scoring model.
- `ActivityLog`, `Notification`.

---

## PHASE 1 — Stop the bleeding (security + destructive code)

**Do first. Nothing else ships until this is done.**

1. **Rotate every credential** currently in `.env` / `.env.local` (DB password, Google/Meta/LinkedIn OAuth secrets, `TOKEN_ENCRYPTION_KEY`, `NEXTAUTH_SECRET`, dev tokens). Move all to environment config; ensure `.env*` is git-ignored and scrub from history.
2. **DELETE `public/direct-access.html`** (hardcoded admin creds served publicly).
3. **DELETE `lib/clear-db.ts`** (unguarded `DELETE FROM` on all campaigns/creatives). If a reset tool is ever needed, it lives in `scripts/` behind an explicit env guard + `--confirm` flag, never in `lib/`.
4. **Remove the hardcoded admin bypass** in `lib/auth.ts` and the hardcoded user id in `lib/resolve-user.ts`. If a break-glass admin is needed, it's an env-configured email allowlist + real password, gated to non-prod.
5. **Encrypt all OAuth tokens at rest.** Use `lib/crypto.ts` (AES-256-GCM) as the *only* path to read/write tokens for **all** platforms including Meta. No plaintext `accessToken`/`refreshToken` columns — migrate to `*Enc`.
6. **Fix the lead webhook to fail closed** (`app/api/webhooks/google-leads`): if the secret is unset, reject all requests; verify signature/secret on every call.
7. **OAuth CSRF for all providers:** wire the existing `lib/oauth-state.ts` (httpOnly cookie + `timingSafeEqual`) into Google and Meta connect/callback. No provider without verified `state`.
8. **Delete the fake "encryption"** (`lib/oauth-utils.ts` base64) and the whole dead oauth trio (`lib/oauth.ts`, `oauth-config.ts`, `oauth-utils.ts`).
9. **Rate limiting fail-closed** on `login`, `signup`, `forgot-password`, `reset-password`, and NextAuth `authorize`. Back it with Upstash Redis.

**DoD:** No secret in source/static. All tokens encrypted. All OAuth flows CSRF-protected. Webhook rejects unsigned calls. Destructive scripts removed. Confirmed by grep + a manual OAuth round-trip on Google and Meta.

---

## PHASE 2 — Demolition (delete dead & duplicate code)

Delete these (and every import, nav link, and route reference to them). This shrinks the surface so the real build is legible.

**Duplicate/legacy top-level pages:** `app/campaigns/`, `app/leads/`, `app/reports/`, `app/connections/` (keep only the `app/dashboard/*` equivalents).

**410/stub API routes (delete the files, not just the bodies):**
`api/campaigns/create`, `create-real`, `create-on-platform`, `create-platform`, `[id]/pause`, `[id]/resume`, `bulk`; `api/ai/optimize`, `execute`, `copilot`, `generate-ads`, `generate-image`, `generate-creatives` (the alias), `push-creative`, `report-insights`, `reports`, `assistant/chat`, `chat-real`; `api/creatives` (410), `creatives/generate`, `creatives/publish`, `content/generate`, `campaigns/run`, `automations/run`, `automations/[id]/run` (replace with real ones in later phases), `cron/automations`, `cron/check-automations`.

**Empty directories:** all `shopify` dirs, `admin` dirs (unless Phase 9 builds admin), `queue/add`, `queue/process`, `analytics/meta/audience`, `analytics/meta/campaigns`, `reports/custom|data|generate-pdf|generate-real|[id]/share` (rebuild the ones you need for real in later phases).

**Dead lib files:** `lib/ai-client.ts`, `lib/claude-ai-service.ts`, `lib/ai/scoring.ts`, `lib/report-analysis.ts`, `lib/campaign-health.ts` (re-add as `lib/domain/health.ts` only when wired), `lib/engines/forecasting-engine.ts`, `health-scorer.ts`, `metrics-engine.ts` (fold real logic into `lib/domain/*` when used), `lib/background-sync.ts`, `lib/errors.ts`, `lib/api-handler.ts`, `lib/security.ts`, `lib/pdf-generator.ts`, `lib/validation.ts` (fix the `$$$$` regex bug if kept), `lib/platforms/mcp-loader.ts`, `lib/platform-connector.ts` (MockPlatformConnector).

**Dead components:** `components/analytics-dashboard.tsx`, `components/dashboard/DashboardLayout.tsx`, `components/dashboard/Overview.tsx`, `components/dashboard/empty-state.tsx`. Keep exactly **one** dashboard layout component.

**Drop LinkedIn:** remove `LINKEDIN` from the platform enum surface, all `api/integrations/linkedin/*`, `api/auth/linkedin/*`, `api/platforms/linkedin/*`, `lib/linkedin-token-store.ts`, `lib/platform-apis/linkedin.ts`, `app/dashboard/campaigns/linkedin`, and LinkedIn options in every wizard/filter. (Keep data migration-safe: mark existing LinkedIn integrations inactive rather than hard-deleting rows if any real users exist.)

**Kill fake data sources:** `api/insights` (hardcoded fictional campaigns) — replace with a real insights endpoint or delete and remove from dashboard. Remove the fake team-member row and hardcoded "$48/month" billing block in `app/dashboard/settings` (rebuild real in Phase 9 or hide behind a flag).

**DoD:** `next build` passes. No route returns 410 anywhere. Grep shows zero imports of deleted files. Nav has no links to removed pages. The app has exactly one auth shell and one dashboard shell.

---

## PHASE 3 — Foundation: schema, platform layer, sync (the spine)

Everything else depends on real data flowing in. Build this before features.

### 3.1 Migrate the schema to §1.3.
- Add proper FKs (`Campaign.adAccountId → AdAccount.id`). Write a data migration that backfills existing rows by matching external account ids.
- Introduce `MetricDaily` as the single metrics source. Migrate any denormalized metric columns into it.
- All new/changed schema via `prisma migrate` — delete the two loose `*_manual.sql` files and fold their intent into real migrations. Remove runtime DDL (`lib/google-schema-guard.ts`); guarantee schema via migrations.

### 3.2 Real platform clients (`lib/platforms/google`, `lib/platforms/meta`)
Each exposes a typed, tested interface used by services:
```
listAdAccounts(integration): AdAccount[]
getCampaigns(account, dateRange): { campaign, metricsDaily[] }[]
createCampaign(account, spec): { externalId }
createAdGroupOrAdSet(...), createAd(...), createKeywords(...), createNegativeKeywords(...)
updateCampaignStatus(campaign, status)
updateBudget(campaign, amount)
updateBidStrategy(campaign, strategy)
uploadCreativeAsset(account, asset)  // image/video → platform asset id
```
- **Google:** real Google Ads API (developer token + OAuth). Support at minimum **Search + Performance Max**. Honor `biddingStrategy` (MAXIMIZE_CONVERSIONS / TARGET_CPA / TARGET_ROAS / MAXIMIZE_CLICKS) — **stop hardcoding `manualCpc` and `"SEARCH"`.** Publish negative keywords.
- **Meta:** real Graph API. Support Advantage+ / standard campaigns, ad sets (audience, budget, optimization goal), ads (creative from generated assets). Use the **correct request encoding** (form/query where required — fix the JSON-body bug). Never fabricate revenue; pull real purchase/conversion values via the conversions API/pixel where available, else leave revenue null and show "not tracked."

### 3.3 Sync engine (one implementation)
- One `lib/services/sync.ts` (delete `lib/sync.ts` vs `lib/sync-engine.ts` duplication). Per (workspace, integration, adAccount): refresh token → pull campaigns/adsets/ads + `MetricDaily` → upsert → set real `lastSyncStatus`.
- **Meta sync must actually call the API** (the current stub sets SYNCED with zero data — remove it). Only mark `ACTIVE/SYNCED` on a genuine successful fetch.
- Cron (`/api/cron/sync`) iterates workspaces with a real job record, retries, and per-account locks. Give it adequate `maxDuration` and chunk large accounts.

**DoD:** Connect a real Google account and a real Meta account → sync pulls real campaigns + daily metrics into `MetricDaily` → they appear in the DB correctly FK'd. Token stored encrypted. Re-sync is idempotent. Unit tests green for metric mappers and money math.

---

## PHASE 4 — Analytics (real, single source of truth)

Model the "high-level, at-a-glance" analytics a solo founder needs, plus Madgicx-grade depth one click deeper.

### 4.1 One analytics service
- Delete the four divergent endpoints. Build `lib/services/analytics.ts` with **one** aggregation over `MetricDaily`, parameterized by `{workspaceId, adAccountIds, platform?, dateRange, granularity}`.
- Endpoints (thin controllers): `GET /api/analytics/overview`, `/timeseries`, `/breakdown?dimension=platform|campaign|creative`.

### 4.2 Dashboard home (what it shows)
Top: **KPI row** — Spend, Revenue, ROAS, Conversions, CPA, CTR — each with period-over-period delta and a sparkline. All from the one service.
- **Performance timeseries** (spend vs revenue vs conversions; toggle metric).
- **Platform breakdown** (Google vs Meta) with spend/revenue/ROAS.
- **Top & bottom campaigns** by ROAS (with a "why" tag from the rule engine).
- **AI Copilot summary card** ("Here's what happened this week and what I'd do") — real, generated from data (Phase 6).
- **Action center**: pending recommendations count → deep-link to Optimization.
- **Connection health**: which accounts are synced, last sync, reconnect prompts.
Empty states: if no connection or zero spend, show a **connect/needs-data** state — never invented numbers.

### 4.3 Deeper analytics (one level down, Madgicx-style)
- **Creative analytics:** performance per creative/ad (spend, CTR, CVR, ROAS, thumb-stop/hook rate for video where Meta provides it), sortable, with winner/loser tags.
- **Audience/segment breakdown** (Meta: age/gender/placement/platform; Google: device/network/geo).
- **Funnel view:** impressions → clicks → conversions → revenue with drop-off rates.
- **Attribution note:** be explicit about the model (platform-reported vs pixel). Don't imply multi-touch you can't compute.

**DoD:** Every number on every analytics surface comes from `lib/services/analytics.ts`. Same query → same number everywhere. Deltas and sparklines correct against seeded fixtures. No endpoint reads raw denormalized columns.

---

## PHASE 5 — AI Campaign Generator (Blynk-style prompt → launch)

This is the flagship flow. **One connected pipeline**, not three islands.

### 5.1 UX flow (single guided experience, novice-friendly)
Screen 1 — **Describe your business** (one prompt + a few light fields):
- Free text: "What do you sell / what's the offer?" (required)
- Website URL (optional, used to enrich)
- Goal (Leads / Sales / Traffic / Awareness) — plain language with one-line explanations
- Monthly or daily budget (single number)
- Target locations, target customer (free text)
- Platforms: Google, Meta, or both (checkboxes that **actually drive** the pipeline)

Screen 2 — **AI builds the plan** (show a live "thinking" → structured result):
- For each selected platform, AI proposes: campaign type + objective, budget split, bidding strategy, audiences (Meta) / keywords + negative keywords + ad groups (Google), and 3–5 ad creative concepts (headline/primary text/description + image concept).
- Everything is **editable inline**. Show an "Intelligent brief" the AI expanded from the prompt (Blynk's "prompt enhancement").
- Show a **Launch Readiness score** and explicit risks.

Screen 3 — **Review & Launch**:
- Show exactly what will be created on each platform (campaign → adset/adgroup → ads → creative).
- One **"Launch"** button that **actually publishes** to the platform(s) via the platform layer, in the correct hierarchy, transactionally with rollback on partial failure. Default new campaigns to **PAUSED** or a small budget for safety, with a clear toggle.
- After launch: store real `externalId`s, set `isLive: true`, deep-link to the campaign in analytics.

### 5.2 Backend
- `POST /api/ai/campaign/plan` → `lib/services/campaign-planner.ts`: calls AI with a strict JSON schema (validated with zod), returns a `CampaignPlan` for each platform. Persist it and **read it back** in the launch step (fix the write-only `CampaignPlan` bug).
- `POST /api/ai/campaign/launch` → `lib/services/campaign-launcher.ts`: takes the (possibly edited) plan, calls `lib/platforms/*` to create the full hierarchy on Google/Meta, uploads generated creative assets, wires negative keywords/audiences, sets bidding strategy from the plan (no hardcoding). Returns created entities + any per-step errors with rollback.
- Merge/replace the old `/api/campaigns` draft-only POST and `/api/campaigns/publish`: campaign creation and publish are **one coherent service** with a draft→live state machine, not two incompatible payloads.

### 5.3 Guardrails (so novices don't get burned)
- Budget sanity checks, duplicate-campaign detection, policy pre-check on copy (Phase 6.4).
- Always create with conversion-optimized bidding by default (TARGET_CPA/MAXIMIZE_CONVERSIONS or Advantage+), never Manual CPC by default.

**DoD:** From a single prompt, a user launches a real, correctly-structured campaign on Google **and** Meta, with AI-generated keywords/audiences + negative keywords + creatives, correct bidding strategy, real `externalId`s, visible in analytics. The edited plan is what gets published. Partial-failure rolls back cleanly.

---

## PHASE 6 — AI Ad Creative Studio + AI Copilot

### 6.1 Creative generation (real, multi-format)
`lib/services/creative.ts` + `POST /api/ai/creative/generate`:
- Input brief: brand, product, value prop, pain point, audience, tone, offer, platform(s), **format** (image / video-script / carousel), and desired variation count.
- **Copy:** N genuinely distinct variations (angle-varied: proof, urgency, objection, outcome). Never invent social proof.
- **Images:** generate the **correct aspect ratios per placement** — Meta feed 1:1 and 4:5, Stories/Reels 9:16; Google Display standard IAB sizes; Google Search = RSA text (no image). Drive size from the selected format/placement (fix the hardcoded 1024×1024 and the ignored `platforms` array — schema accepts an array and it flows through).
- Generate images for **all** requested variations (fix the silent cap of 3), or clearly show which got images and why.
- **Video (Blynk parity):** at minimum generate a **video script + storyboard + AI voiceover/stock-assembly** path, or integrate a video-gen provider. If full video is out of budget for v1, ship script+storyboard and label it, but wire the seam.
- **Scoring:** replace the keyword-regex heuristic with a **real signal**: (a) LLM rubric scoring against direct-response best practices, and (b) once account history exists, a lightweight model/regression on the workspace's own historical CTR/CVR by copy features. Show a breakdown, not a cosmetic label.
- **Storage:** one `Creative` model. Assets stored with URL + aspectRatio + placement. Selectable into the campaign launcher and pushable to the platform as real ad creatives.

### 6.2 Creative library + performance (make the dead pages real)
- **Library** (`/dashboard/creatives`): lists real `Creative` rows from a real endpoint (not the 410 `/api/creatives`). Filter, preview, reuse, push-to-campaign.
- **Performance** (`/dashboard/creatives/performance`): build the real `GET /api/creatives/performance` reading `MetricDaily` joined to creatives. Winner/loser tags, spend/CTR/CVR/ROAS. Wire it into nav.

### 6.3 AI Copilot (one chat assistant, grounded in real data)
- **One** implementation. Delete the chat/assistant/copilot/conversations/messages sprawl; keep a single `POST /api/ai/copilot` that streams, persists conversation, and is grounded with the workspace's real campaigns/metrics as context.
- Capabilities: answer "how are my ads doing," explain a metric, draft a new creative, propose an optimization, or **take an action** (create campaign / apply a recommendation) via tool-calls that hit the same services — with the same approval model as Optimization.
- **Prompt-injection safe:** never concatenate raw DB text into a system prompt as instructions; pass data as clearly delimited, non-authoritative content. Guard all `JSON.parse` of model output with schema validation + fallback.

### 6.4 Ad policy pre-check
- Before a creative is marked "launch-ready," run a policy/compliance pass (LLM rubric for prohibited claims + basic Google/Meta policy checklist). Flag risky copy with the reason so a novice fixes it before disapproval.

**DoD:** A user generates copy + correctly-sized images (per placement) for Google and Meta, sees real score breakdowns, saves them to a working library, pushes them to a live campaign, and later sees per-creative performance. Copilot answers grounded questions and can trigger a real (approval-gated) action. Policy pre-check flags a deliberately non-compliant headline.

---

## PHASE 7 — AI Optimization / Autopilot (Madgicx-style) — real & connected

This is the second flagship. It must actually change live campaigns (with the right guardrails) and be fully wired to the UI.

### 7.1 Optimization engine (`lib/services/optimization.ts` + `lib/domain/rules.ts`)
- **Signal generation (real):** over `MetricDaily`, compute per-entity diagnostics vs account averages and benchmarks — wasted spend, budget-limited winners, high CPA, low ROAS, zero-conversion spend, creative fatigue (frequency/CTR decline on Meta), learning-phase status.
- **Recommendation types that actually execute:** budget increase/decrease, pause/enable, bid-strategy change, bid target adjust (tCPA/tROAS), audience expansion/exclusion (Meta), negative-keyword add (Google), creative refresh (generate + swap in a new ad — actually do it, don't just redirect).
- **LLM layer adds explanation + prioritization** on top of deterministic signals — and if you pay for the LLM call, **use its output** (fix the audit route that discards it). Keep deterministic values authoritative for anything touching money.
- Persist every recommendation to the `Recommendation` table (fix the generate-writes-nothing / read-reads-nothing split).

### 7.2 Three modes (per rule / per workspace)
- **Alert:** notify only.
- **Approval (default):** show recommendation → **Preview** (exact before/after + expected impact) → **Apply** (real platform mutation) → **Undo** (restore snapshot). The UI Apply button must call the real preview/apply endpoints (fix the ai-advisor fake-apply). Works for **Google and Meta**, not Google-only.
- **Autopilot:** cron evaluates rules per workspace and **auto-applies** within safety caps (max % budget change/day, min spend before acting, daily change limits, spend ceilings), logging every action to `OptimizationLog` with undo snapshots. This is the Madgicx "autopilot" parity feature.

### 7.3 UI
- **Optimization page:** ranked recommendations with impact/confidence, filters, bulk apply, and an autopilot settings panel (which rules, which mode, caps). Full audit log of applied/undone changes.
- **Account audit:** on-demand full-account scorecard (budget efficiency, creative health, structure, bidding) with the prioritized fix list — Google **and** Meta.

**DoD:** A recommendation generated from real data can be previewed, applied (verified change on the live Google/Meta platform), and undone (verified restore) from the UI. Autopilot mode auto-applies within caps and logs everything. No recommendation type is a silent no-op; every one either executes or is clearly labeled "manual."

---

## PHASE 8 — Reports & Automations (real, single pipeline each)

### 8.1 Reports
- **One** report pipeline. `metricsJson` holds **numbers** (never formatted strings — fixes the `.toFixed` crash and the $0.00 export). One builder produces the PDF from that JSON (delete the three divergent builders/routes).
- Types: weekly/monthly performance, creative report, optimization-impact report. Include AI narrative (real, from data) + the period's applied optimizations and their measured impact.
- Endpoints: `POST /api/reports` (create), `GET /api/reports/:id`, `GET /api/reports/:id/pdf`. Scheduled email delivery via cron. Every field populated from the analytics service.

### 8.2 Automations (make it truly automate)
- Rebuild on the same rule engine as Optimization (§7.1). A rule = trigger + action + mode.
- **Real execution:** `AUTOPILOT` rules actually mutate the platform (budget/status/bid/negative-kw/creative) within caps; `APPROVAL` rules create recommendations; `ALERT` rules notify. Remove the always-no-op executor and the always-409 run routes.
- **Fix workspace scoping:** rule evaluation and `[id]` GET/PATCH/DELETE must scope by `workspaceId` (current cross-workspace leak).
- Dedicated cron `/api/cron/automations` (rebuilt, workspace-safe) — not a side effect of the sync cron. Real "Test rule" that evaluates against live data (delete the 1.5s fake).
- Full run history in `AutomationRun`.

**DoD:** A weekly report generates with correct real numbers and a working PDF. An automation rule in autopilot mode fires on real metrics and makes a verified, capped, logged change to the correct workspace's campaign only. Alert/approval modes behave correctly.

---

## PHASE 9 — Onboarding, Settings, Leads, Admin, polish

### 9.1 Onboarding (novice-first, Blynk-fast)
- Connect Google and/or Meta (real OAuth, CSRF-safe) → select ad account → optional first-campaign prompt. Get the user to value fast; don't hard-block AI features behind a fully-synced account where a sensible preview is possible.

### 9.2 Settings
- Real integrations tab (connect/disconnect/reconnect, per-account selection, sync status).
- Real team management (invite via real endpoint + `WorkspaceMember` roles) or hide until built — **no fake rows**.
- Billing: integrate a real provider (e.g. Stripe) or hide — **no hardcoded plan/price**.
- Fix sign-out target (`/auth/login` → the real auth route).

### 9.3 Leads (keep lean or defer)
- If kept: one scoring model (delete the duplicate), real CSV/Excel import (build it — currently all 410), workspace-scoped. If not core to v1, hide behind a flag and don't advertise import in the UI.

### 9.4 Admin (optional)
- If needed: a real, role-gated admin area (env allowlist), not the empty dirs. Otherwise delete the scaffolding.

**DoD:** New user can go signup → connect → launch first campaign in one sitting. No fake data anywhere in settings. Sign-out works. Every nav item leads to a real, working page.

---

## PHASE 10 — Hardening, tests, observability

- **Tests:** unit (domain math, rule engine, publish payload builders, scoring), integration (services against a test DB + mocked platform APIs), and a few e2e happy-paths (connect → sync → plan → launch → optimize → report).
- **Error handling:** consistent envelope, structured logging that **never logs tokens** (fix the message-arg leak — sanitize both message and data), Sentry (real DSN) for server errors.
- **Performance:** paginate lists, cache analytics aggregates, chunk sync/cron jobs.
- **Docs:** a short RUNBOOK (env vars, how OAuth apps are configured for Google/Meta, how cron is scheduled, how autopilot caps are set).

**DoD:** CI runs tests on every push. No token appears in logs. Core flows covered by e2e. Runbook exists.

---

## Feature → module → "what it connects to" map (quick reference for wiring)

| Feature | UI | Service | Platform calls | Data written | Reads from |
|---|---|---|---|---|---|
| Dashboard home | `dashboard/page` | analytics, optimization, copilot | — | — | `MetricDaily`, `Recommendation`, `Integration` |
| AI Campaign Generator | `dashboard/campaigns/new` | campaign-planner, campaign-launcher | create campaign/adset/adgroup/ad/keywords/audiences | `Campaign*`, `Creative`, `CampaignPlan` | prompt + `Integration`/`AdAccount` |
| Creative Studio | `dashboard/creatives/generate` | creative | uploadCreativeAsset | `Creative` | brief + account history |
| Creative library/perf | `dashboard/creatives`, `/performance` | creative, analytics | — | — | `Creative`, `MetricDaily` |
| Copilot | `dashboard/copilot` | copilot (+ tool-calls into other services) | via approval | `Conversation`, actions | real campaigns/metrics |
| Optimization/Autopilot | `dashboard/optimization` | optimization, rules | update budget/status/bid/negkw/creative | `Recommendation`, `OptimizationLog` | `MetricDaily` |
| Automations | `dashboard/automations` | automations, rules | same as optimization | `AutomationRule`, `AutomationRun` | `MetricDaily` |
| Analytics | `dashboard/analytics/*` | analytics | — | — | `MetricDaily` |
| Reports | `dashboard/reports` | reports, analytics | — | `Report` | `MetricDaily`, `OptimizationLog` |
| Sync | cron | sync | getCampaigns/metrics | `Campaign*`, `MetricDaily` | platform APIs |

---

## Definition of "done" for the whole product
1. Zero stubs, zero 410s, zero fake data, zero dead nav links.
2. Google **and** Meta both fully real across connect → sync → plan → launch → optimize → report.
3. One prompt produces a real, well-structured, high-intent campaign on both platforms with AI creatives, correct bidding, negatives/audiences.
4. AI optimization previews, applies (real), and undoes (real) changes on both platforms; autopilot works within caps and logs everything.
5. Every metric everywhere traces to `MetricDaily` via one analytics service.
6. All tokens encrypted, all OAuth CSRF-safe, rate limiting fail-closed, no secrets in source.
7. Tests cover money math, publish builders, rule engine, auth, workspace scoping; core flows have e2e.

---

## Appendix A — Complete audit findings (source of the "fix" work above)
The rebuild above already absorbs these; listed here so Codex has the concrete anchors.

**Critical security:** hardcoded admin creds in `public/direct-access.html`; unguarded `lib/clear-db.ts`; plaintext OAuth tokens (Meta has no encryption at all); Google OAuth no `state`, LinkedIn `state` never verified; lead webhook fails open; hardcoded admin bypass in `lib/auth.ts` + hardcoded user id in `lib/resolve-user.ts`; secrets committed in `.env`.

**Fake/disconnected features:** `api/insights` hardcoded fictional campaigns wired to dashboard; ai-advisor "Apply" only mutates local state (never calls apply endpoint); Meta sync stub marks SYNCED with zero data; `app/actions/automations.ts` "Test" is a `setTimeout`; settings fake team row + hardcoded $48/mo billing.

**Campaign pipeline:** `POST /api/campaigns` writes local draft only; AI plan stored only in React state and never submitted; "Launch" never calls publish; publish is Google+Search-only, hardcodes `manualCpc` and `"SEARCH"`, no negative keywords; `CampaignPlan` write-only; Meta/LinkedIn create functions exist but are never called; a second Meta create fn sends wrong encoding; `lib/platform-apis/meta.ts` fabricates `revenue = conversions*50`; `lib/platform-sync.ts` has no Meta branch; LinkedIn status change hardcoded 501.

**Creatives:** images hardcoded 1024×1024; `platforms` multiselect dropped by zod (schema is singular); only 3 variations get images; `/creatives/library` calls 410 `api/creatives`; `/creatives/performance` calls nonexistent endpoint; duplicate creative impls (`lib/creative-generator-service.ts`, `app/actions/creatives.ts` on a separate `Creative` model).

**Optimization/automation:** recommendations generate-vs-read split (write-nothing / read-nothing); audit's paid GPT-4o output discarded; only budget + pause/enable execute (Google-only), `CREATIVE_REFRESH` just redirects; automation engine + `[id]` routes miss `workspaceId` (cross-workspace leak); run routes always 409; executor always no-op incl. rollback.

**Reports:** two incompatible pipelines to one table; `.toFixed` on a string crashes download; export reads `data.totals` nobody writes → $0.00 PDFs; three duplicate PDF builders.

**Analytics:** four divergent aggregation endpoints; `analytics/platforms` reads raw columns while others read `MetricDaily`; dead `components/analytics-dashboard.tsx` calls nonexistent `/api/analytics/summary`.

**Leads:** CSV/Excel/bulk/create all 410 (import doesn't exist); two disagreeing scoring models.

**Duplicate/dead:** legacy top-level `app/campaigns|leads|reports|connections`; sign-out → nonexistent `/auth/login`; dead libs and components listed in Phase 2; empty `shopify`/`admin`/`queue`/`analytics/meta` dirs.

**Schema/config:** `Campaign.adAccountId` not a FK (stores external id); two loose `*_manual.sql` outside migrations (untracked `CampaignScores`/`Analytics`/`UserOAuthConfig`); runtime DDL in `lib/google-schema-guard.ts`; Next 14 vs eslint-config-next 16 (+`legacy-peer-deps`); `next-auth` beta; deps pinned `latest`; two chart libs; logger can leak tokens via the message arg.

## Appendix B — Competitor parity checklist
**From Blynk (prompt-to-launch for non-marketers):** single-prompt intake; intelligent prompt/brief enhancement; AI creative (image + video); AI audience/keyword targeting; auto-built campaign structure; publish to Google + Meta together in minutes; (landing page — deferred).
**From Madgicx (AI optimization for performance marketers):** AI autopilot for budgets/bids; automated rules with triggers; creative analytics + creative scoring; audience/targeting intelligence; anomaly/alerts; account audit; AI marketer agent that recommends and acts; multi-account dashboards; cross-platform (Meta + Google) reporting.
