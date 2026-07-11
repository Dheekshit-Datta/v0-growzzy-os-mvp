# Growzzy OS — Competitive Parity & Superiority Spec (Blynk + Madgicx)

Companion to `GROWZZY_REBUILD_PLAN.md` (phases, checkpoints) and `GROWZZY_UI_UX_SPEC.md` (screens). This document specifies, feature by feature, exactly what to build so Growzzy matches and then beats **Blynk** (prompt-to-launch for non-marketers) and **Madgicx** (AI optimization/autopilot for active spenders).

**Positioning target:** Blynk owns campaign *birth*. Madgicx owns campaign *life*. Neither owns the full loop on both Google and Meta at a novice price point. Growzzy does: **prompt → editable plan → launch → guardrailed autopilot → plain-English reporting**, Google first, Meta second, per current scope lock.

**Non-negotiable principles carried from prior docs:**
- No fake data, no fake success states, anywhere, ever.
- Every AI action shows its work (what, why, outcome). Trust through legibility is the differentiator — Blynk hides the machinery, Madgicx assumes dashboard literacy. We explain to beginners.
- Money safety is architectural, not a setting (see Part 4).
- Checkpoint discipline stands: nothing in Part 2+ ships before Checkpoint 1 (real Google publish) passes.

---

# PART 1 — BLYNK PARITY: THE PROMPT-TO-LAUNCH PIPELINE

Blynk's flow: prompt → graphics → audience → landing page → live on Google + Meta, claimed <5 minutes. We match every step except landing pages (deferred by explicit scope decision) and beat them on transparency (editable plan) and rejection-proofing (policy pre-check).

## 1.1 Prompt Intake & Enhancement

**Route:** `/dashboard/campaigns/new` — Stage 1 of the four-stage builder (UX spec §3).

**Inputs:**
- `productDescription` — large free-text box. Placeholder: "What do you want to promote? e.g. 'Online yoga classes for busy professionals, ₹2,000/month, first class free'"
- `websiteUrl` — optional. On blur, trigger scrape (1.2).
- `goal` — pills: `SALES | LEADS | TRAFFIC | APP_INSTALLS`
- `dailyBudget` — slider, min $1, max user-configurable ceiling, live currency display
- `platform` — `GOOGLE` (Meta toggle visible but disabled with "coming soon" until Meta pass)

**Prompt enhancement (matches Blynk's "Intelligent Prompt Enhancement"):**
- Server-side step before plan generation. Takes raw `productDescription` + scraped site data and expands into a structured brief:
```ts
type EnhancedBrief = {
  productName: string
  productCategory: string        // inferred
  valueProposition: string[]     // 2-4 bullets
  targetCustomer: string         // plain-English persona
  pricePoint: string | null
  geography: string              // default from user locale, editable
  tone: "professional" | "casual" | "urgent" | "premium"  // inferred
  inferredKeywordThemes: string[]  // seeds for Google keyword gen
}
```
- Show the enhanced brief to the user at the top of Stage 2 in an editable card ("Here's what we understood — fix anything wrong"). **This is a beat-Blynk move: they enhance silently; we show it.** A wrong inference caught here saves a bad campaign.

**Acceptance criteria:**
- Empty description → inline validation, generate button disabled. No API call.
- Brief renders in <8s p95 (single GPT-4o call, `response_format: json_object`, zod-validated).
- Malformed model output → one silent retry, then honest error card ("Couldn't generate a brief — try adding more detail"), never a fabricated brief.

## 1.2 Website Scrape (beats Blynk's manual entry)

**Endpoint:** `POST /api/ai/scrape-site` `{ url }`.
- Fetch page server-side (10s timeout, 2MB cap, follow ≤3 redirects, block private IPs/localhost — SSRF guard).
- Extract: `<title>`, meta description, OG image, h1s, visible price patterns, brand name.
- Feed into enhancement. Failure is silent-degrade: banner "Couldn't read your site — no problem, we'll use your description," never a blocker.
- Cache per URL 24h.

## 1.3 Campaign Plan Generation (Google Search first)

**Endpoint:** `POST /api/ai/campaign-plan`. Input: `EnhancedBrief` + goal + budget. Output persisted to DB (NOT React state — the old bug):

```ts
type CampaignPlan = {
  id: string                    // persisted row, status: DRAFT
  workspaceId: string
  campaignName: string          // human-readable, e.g. "Yoga Classes — Search — Mar 2026"
  platform: "GOOGLE"
  campaignType: "SEARCH"        // v1; PMax later
  goal: Goal
  dailyBudgetMicros: bigint
  biddingStrategy:              // chosen by AI, editable, MUST flow to publish (fixes hardcoded manualCpc bug)
    | { type: "MAXIMIZE_CONVERSIONS" }
    | { type: "MAXIMIZE_CLICKS", cpcCeilingMicros?: bigint }
    | { type: "TARGET_CPA", targetCpaMicros: bigint }
  geoTargets: { name: string, googleGeoId: number }[]
  language: string
  adGroups: {
    name: string                          // theme, e.g. "Beginner Yoga"
    keywords: { text: string, matchType: "BROAD" | "PHRASE" | "EXACT" }[]   // 10-20 per group
    negativeKeywords: string[]            // REQUIRED, min 5 — "free", "jobs", "diy" class of waste
    rsa: {
      headlines: string[]                 // 8-15, each ≤30 chars, validated server-side
      descriptions: string[]              // 3-4, each ≤90 chars
      finalUrl: string
      path1?: string, path2?: string      // ≤15 chars each
    }
  }[]                                     // 2-3 ad groups
  rationale: {                            // THE LEGIBILITY LAYER — beat-both move
    whyThisStructure: string              // one paragraph, plain English, no jargon
    whyTheseKeywords: string
    whyThisBidding: string
    expectedCpcRange: { low: number, high: number }   // from keyword-category heuristics, labeled "estimate"
    expectedResultsRange: string          // "roughly 5-15 clicks/day at this budget", labeled honestly
  }
  policyCheck: PolicyCheckResult          // see 1.5
  status: "DRAFT" | "APPROVED" | "PUBLISHING" | "LIVE" | "FAILED"
}
```

**Validation:** every RSA headline/description length-checked server-side before save; oversize model outputs trimmed or regenerated, never sent to Google to bounce.

**Acceptance criteria:**
- Plan persists across refresh/logout (DB row, not state).
- Every plan has ≥2 ad groups, ≥10 keywords each, ≥5 negatives, valid RSA counts (≥3 headlines, ≥2 descriptions minimum per Google; target 8+/3+).
- `rationale` renders in Stage 2 as "Why this plan" expandable — written for someone who has never run an ad.

## 1.4 Editable Plan Review (beats Blynk's black box)

Stage 2 UI. Every field inline-editable:
- Campaign name: click-to-edit text.
- Budget: slider re-showing estimated results range live.
- Bidding: dropdown of the three strategies with one-line plain-English explanations ("Let Google chase the most sales within your budget" vs "Pay only for clicks, capped at $X").
- Keywords: chip list per ad group — delete chip, add chip (free text), toggle match type. Negative keywords same treatment.
- Headlines/descriptions: editable text rows with live character counters that turn red at limit.
- Geo: searchable location picker (Google geo constants; ship a static common-locations table v1).
- Every edit `PATCH`es the persisted plan (debounced). "Regenerate plan" discards and re-runs 1.3 with a confirm dialog.

**Acceptance:** user edits keyword → refresh → edit persisted. Plan at publish time byte-for-byte matches what Stage 4 displayed.

## 1.5 Ad Policy Pre-Check (beats both — nobody does this well)

**Endpoint:** `POST /api/ai/policy-check` — runs automatically after plan generation and after any creative edit.

Two layers:
1. **Static rules (deterministic):** regex/wordlist for Google's common disapproval categories — superlative claims without substantiation ("#1", "best", "guaranteed"), prohibited categories (weapons, pharma terms), excessive caps/punctuation ("BUY NOW!!!"), trademark-risky patterns, phone numbers in ad text.
2. **LLM review:** one GPT-4o pass over all ad text: "Would any of this text likely be disapproved under Google Ads policies? Return specific phrases and the policy area."

```ts
type PolicyCheckResult = {
  status: "PASS" | "WARN" | "FAIL"
  flags: { text: string, adGroupName: string, field: string, reason: string, suggestion: string }[]
}
```

UI: green badge "Passes policy pre-check" / amber "2 phrases may be rejected" — each flag shows the exact text, why, and a one-click "Apply suggestion." WARN doesn't block launch (user can override); FAIL (prohibited category) blocks with explanation.

**Why this matters:** ad disapproval is the #1 novice funnel-killer. Blynk launches blind; Madgicx doesn't create-from-zero. Catching rejection *before* submission is a visible, marketable win.

## 1.6 Creative Review (Stage 3) — Google Search v1

For Search campaigns "creative" = RSA text (done in 1.4). Stage 3 for Google v1 is the **ad preview**:
- Render each ad group's RSA as a realistic Google SERP mockup (headline combinations, display URL, descriptions) — static CSS mockup, no API needed.
- Preview 2-3 headline/description combinations per ad group ("Google mixes these automatically — here are examples").
- Per-ad-group "Regenerate copy" button (regenerates that group's RSA only, not the whole plan).

Image/video creative generation (Blynk's graphics engine) activates with the Meta pass — spec in Part 5. Do not build image gen into the Google Search flow.

## 1.7 Launch (Stage 4) — the checkpoint gate

- Summary card: name, budget, bidding, ad group count, keyword count, policy badge, expected results range.
- Explicit paused-launch default v1: **"Launch (starts paused)"** — publishes the full structure to Google in PAUSED state, then a second explicit "Enable campaign" action on the Campaign Detail page flips it live. Two-step = novice safety + matches Checkpoint 1's paused-campaign proof.
- Publish endpoint MUST read `campaignType` and `biddingStrategy` from the plan (kills the hardcoded `objective: "SEARCH"` + `manualCpc: {}` bug).
- Publish is idempotent: store `externalCampaignId` on first success; retries must not duplicate campaigns.
- Failure handling: partial-failure aware (campaign created, ad group failed → show exactly what exists, offer resume-from-failure, never silent half-state).
- Success → redirect to Campaign Detail; status shown is **fetched from Google**, not a local flag.

**Acceptance = Checkpoint 1 evidence:** Google Ads dashboard screenshot, external campaign ID, DB rows, redacted API request/response.

## 1.8 Time-to-live instrumentation (Blynk's "<5 minutes" — but measured)

Record timestamps: signup, integration connected, first plan generated, first publish. Emit `time_to_first_campaign` metric. Target p50 <5 min from builder-open to publish-click. This becomes the landing-page claim — measured, not asserted.

---

# PART 2 — MADGICX PARITY: THE OPTIMIZATION ENGINE

Madgicx's value = 24/7 audit + staged one-click optimizations + automation tactics (Stop Loss, Surf, Sunsetting, Revive). We implement their two money-makers first (Stop Loss, Surf), wrap everything in three user-facing modes, and beat them on default-safety and outcome-logging. All of this is Phase 7; requires MetricDaily sync (Phase 3/4) live first.

## 2.1 Signal Engine

**Runtime:** Vercel cron, twice daily per workspace (raise frequency later). Reads MetricDaily + campaign/ad-group/ad structure. Produces `Signal` rows:

```ts
type Signal = {
  id: string
  workspaceId: string
  campaignId: string
  scopeType: "CAMPAIGN" | "AD_GROUP" | "AD" | "KEYWORD"
  scopeExternalId: string
  kind: SignalKind
  severity: "INFO" | "WARN" | "CRITICAL"
  evidence: Record<string, number>   // the actual numbers that fired the rule
  detectedAt: DateTime
  status: "OPEN" | "ACTIONED" | "DISMISSED" | "SNOOZED" | "EXPIRED"
}
```

**v1 signal kinds (deterministic rules, not LLM — LLM only writes the explanation):**
| Kind | Rule (defaults, workspace-tunable) |
|---|---|
| `ZERO_CONVERSION_SPEND` | spend ≥ 3× dailyBudget total AND conversions = 0 over trailing 7d |
| `CPA_BREACH` | trailing-7d CPA > 1.5× workspace target CPA (if set) or > 2× account median |
| `WINNING_SCOPE` | trailing-7d CPA < 0.7× account median AND conversions ≥ 3 AND impression share lost to budget > 10% |
| `SPEND_SPIKE` | today's spend pace > 1.4× dailyBudget |
| `CTR_DECAY` | trailing-3d CTR < 60% of trailing-30d CTR, min 1k impressions (fatigue) |
| `KEYWORD_BLEED` | search term with spend > $X and 0 conversions (from search-terms report; later if report unavailable v1) |
| `POLICY_DISAPPROVED` | ad status from Google = DISAPPROVED |
| `LEARNING_EXIT` | campaign exits learning period (informational) |

Each signal maps to ≤1 recommended action (2.2). Explanations are generated once at detection time by LLM from `evidence` and cached on the row — plain English, numbers included: "This ad group spent $47 over 7 days with zero conversions. Similar ad groups in your account convert at $9. Recommended: pause it."

## 2.2 Action Engine (the only component allowed to mutate live campaigns)

```ts
type OptimizationAction = {
  id: string
  signalId: string | null          // null for user-initiated
  workspaceId: string
  campaignId: string
  type: "PAUSE_SCOPE" | "ENABLE_SCOPE" | "ADJUST_BUDGET" | "ADJUST_TARGET_CPA" | "ADD_NEGATIVE_KEYWORD"
  params: Record<string, unknown>  // e.g. { newBudgetMicros, previousBudgetMicros }
  mode: "MANUAL" | "APPROVED" | "AUTOPILOT"
  status: "PROPOSED" | "EXECUTING" | "EXECUTED" | "FAILED" | "UNDONE"
  executedAt?: DateTime
  result?: { previousState: Json, newState: Json }   // enables undo
  outcomeSnapshot?: Json           // filled by follow-up job: 7d-later metrics for the log
}
```

**Rules:**
- Every action stores prior state → **every action is undoable** (budget restore, re-enable). "Undo" button on the log for 30 days.
- Actions execute through the same Google client as publish. Same idempotency discipline.
- A follow-up job snapshots metrics 7 days post-action → renders outcome lines: **"Paused Ad Set B on Mar 3 — saved ~$340, no conversion loss."** This log is the trust engine and the single biggest beat-Madgicx surface. Build it with the action engine, not later.

## 2.3 Tactics (Madgicx-equivalent, novice-defaulted)

**Stop Loss — ON BY DEFAULT** (Madgicx makes you configure it; we don't):
- Default rule: pause any ad group whose trailing-7d spend ≥ 3× daily budget with 0 conversions, or CPA > 3× target.
- Fires in all three modes: Alert mode → CRITICAL signal only; Approval mode → staged action; Autopilot → executes + notifies.
- Configurable thresholds in Settings; can be disabled with a friction dialog ("Stop Loss is what prevents runaway spend — sure?").

**Surf (budget up-scaling on winners):**
- `WINNING_SCOPE` signal → propose budget increase, capped at `maxDailyBudgetShiftPct` (default 20%/day) and never above `workspaceDailyBudgetCeiling`.
- Autopilot may execute within caps; anything beyond caps always requires approval regardless of mode.

**Sunsetting (v1.5):** losers wind down −30%/day over 3 days before pause, reversing if performance recovers.
**Revive (v2):** paused-ad re-scoring — skip for now.
**Custom AND/OR rule builder: DO NOT BUILD.** That's Madgicx's agency UX. Our users get three modes + tunable thresholds, not a rules engine.

## 2.4 Three Modes (per-campaign, workspace default)

| Mode | Behavior |
|---|---|
| `ALERT` (default at signup) | Signals appear in feed + optional email. Nothing executes. |
| `APPROVAL` | Actions staged with [Approve] [Dismiss] [Snooze 7d]. Approve executes immediately, shows result. |
| `AUTOPILOT` | Executes within guardrails; every action notified + logged + undoable. **Hard limits in all modes:** never delete anything; never create net-new spend; never exceed budget caps; never fully pause an entire campaign without approval (ad groups/ads yes, whole campaign no). |

Mode switcher on Campaign Detail with plain-English descriptions of exactly what each mode may do.

## 2.5 Where it surfaces

1. **Dashboard "Needs attention" feed** (UX spec §2) — primary surface, on the home screen (beat-Madgicx: theirs lives in a separate tool). Card = explanation + evidence numbers + action buttons inline.
2. **AI Advisor page** — full feed with filters + the **Action Log** tab (chronological actions with outcomes, the "shows its work" ledger).
3. **Campaign Detail insight box** — signals scoped to that campaign.
4. **Weekly digest email** — "What Growzzy did this week": actions, savings, top performer, plain English. (Madgicx has nothing like this for novices.)

## 2.6 AI Copilot Chat (Madgicx "chat with your ads data")

Slide-out panel, grounded strictly in workspace data:
- Tool-calling over real queries: `get_campaign_metrics`, `get_signals`, `get_actions`, `compare_periods`. Answers must cite numbers from tool results; if data is missing, say so — **never fabricate a metric** (hard system-prompt rule + eval).
- Can draft an action ("pause it") → renders as a PROPOSED action card requiring explicit Approve tap in UI. Chat never executes directly.

---

# PART 3 — ANALYTICS & REPORTING PARITY (Madgicx One-Click Reports)

Depends on Phase 3 MetricDaily as single source. Dashboard KPI/breakdown layout already specced in UX spec §2/§4 — this adds the report product:

- **One-click report:** date range + campaigns → single pipeline (consolidating the two incompatible ones) → report with: AI executive summary (grounded in real totals; fix the `.toFixed()`-on-string crash), KPI table, daily trend chart, per-campaign table, action log excerpt ("what the AI did this period").
- **PDF export** renders the same real numbers (kill the never-written `report.data.totals.*` path).
- **Scheduled weekly/monthly email** per workspace.
- Report copy register: written for a founder, not a media buyer. "You spent $312 and got 41 leads at $7.60 each — 18% cheaper than last month."

---

# PART 4 — MONEY-SAFETY ARCHITECTURE (beats both; marketing-grade guarantee)

Enforced in the action/publish layer, not the UI:

1. `workspaceDailyBudgetCeiling` — set at onboarding; no publish or budget action may push aggregate daily budget above it. Server-side check on every mutation.
2. Budget increases capped at +20%/day per scope (configurable down, not up past 50%).
3. Stop Loss default-on (2.3).
4. New campaigns publish PAUSED; enabling is an explicit user action (1.7).
5. Full audit trail: every mutation (user or AI) in the action log with actor, prior state, new state.
6. No AI code path can create a campaign, only the user-driven publish flow.

Landing page gets to say: "Growzzy can never spend more than you approve — by design." Every clause above must be true before that copy ships.

---

# PART 5 — META PASS (activate only after Google Checkpoints 1–2 pass)

Deltas from the Google pipeline (architecture identical — brief → plan → editable review → policy check → paused publish → signals/actions):
- Plan shape: campaign → ad sets (audience targeting: geo, age, interests, advantage+ toggle) → ads (primary text 125ch, headline 40ch, description 30ch, image per placement).
- **Creative image generation activates here** (Blynk's graphics parity): product description + optional product image → generated images in 1:1, 9:16, 1.91:1 + realistic Feed/Story/Reels mockup previews; per-image regenerate; stored in Creative Library with usage-performance join (UX spec §5).
- Policy pre-check swaps in Meta's rulebook (personal-attributes callouts, before/after imagery, excessive text).
- Real `syncMetaCampaigns` (replacing the stub that marks SYNCED without calling the API) writing the same MetricDaily table.
- Revenue from Meta API actuals only — delete the `revenue = conversions * 50` fabrication.

---

# PART 6 — EXPLICITLY NOT BUILDING (so parity doesn't sprawl)

| Skipped | Whose feature | Why |
|---|---|---|
| Landing page builder | Blynk | Explicit scope decision — later |
| CRM feedback loop | Blynk | v2; needs leads volume first |
| White-label agency mode | Blynk | Different customer |
| Custom AND/OR rule builder | Madgicx | Agency UX; three modes instead |
| Ad-spend-based pricing tiers | Madgicx | Flat simple pricing is our advantage at this stage |
| Tracking/attribution add-on | Madgicx | Platform-reported conversions v1 |
| TikTok/LinkedIn/other platforms | — | Google + Meta only, locked |

---

# PART 7 — BUILD ORDER (mapped to existing phases)

1. **Phase 3 (foundation) + Checkpoint 1** — unchanged, everything gates on it.
2. **Phase 5 = Part 1 of this doc** (prompt→launch: enhancement, scrape, plan schema, editable review, policy pre-check, SERP preview, paused publish, instrumentation) → **Checkpoint 2.**
3. **Phase 4 = dashboard KPIs + Part 3 report pipeline** (MetricDaily-driven).
4. **Phase 7 = Part 2** in this order: Signal engine → Action engine + log + undo → Stop Loss (default-on) → three modes → Needs-attention feed → Surf → Copilot chat → weekly digest. **Checkpoint 3 (new): one real Stop Loss action fires on a live campaign in Approval mode, is approved, executes on Google, and appears in the action log with prior/new state. Stop for review.**
5. **Phase 6 creative library (Google RSA variants), Phase 8 reports consolidation** — parallelizable after 3.
6. **Meta pass = Part 5** — only after Checkpoints 1–3 all green.

Every feature above inherits the standing proof rule: build-passing is not done; a screenshot of the real platform + DB rows + redacted API traffic is done.
