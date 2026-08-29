# Campaign Output Flaws — Growzzy OS

Full diagnosis of why campaign output is "worst" / generic. Tiered by blast radius.

**Source review:** `growzzyosmvpmain/lib/ad-psychology-engine.ts`, `growzzyosmvpmain/app/api/ai/campaign-builder/route.ts`, `growzzyosmvpmain/lib/google-plan-quality.ts`, `growzzyosmvpmain/lib/ai-utility.ts`, `growzzyosmvpmain/app/api/ai/generate-ad-copy/route.ts`

---

## 🔴 Tier 1 — Directly producing garbage output

### 1. Silent model downgrade to `gpt-4o-mini`
`campaign-builder/route.ts:351-355` and `ai-utility.ts:89-95` — any 429/timeout/parse glitch flips to the cheap model.
```ts
if (model === "gpt-4o-mini") throw error
model = "gpt-4o-mini"
completion = await openai.chat.completions.create({ ...request, model })
```
gpt-4o-mini at temp 0.35 with 7 output sections = generic mush. Most "garbage" output is just the wrong model.

**Fix:** remove the silent fallback. Log + throw, or retry the same model.

---

### 2. Single mega-`user` message, no `system` role
`campaign-builder/route.ts:342-345`, `generate-ad-copy/route.ts:57`
```ts
messages: [{
  role: "user",
  content: `${googlePrompt}...`
}],
```
~75 lines of mixed instructions + JSON schema + 7 output sections dumped into ONE user message. Model treats it as a loose "write me a campaign."

**Fix:** split into `system` (role, non-negotiable rules, JSON schema) + `user` (brief + persona fields).

---

### 3. Psychology profile is 80% wasted
Only `corePainPoints[0]`, `desireOutcomes[0]`, `primaryEmotionalTrigger`, `visualPatternInterrupt` actually get used in `googlePrompt` / `metaPrompt`. The other 3 pain points, 3 desires, awareness stage logic, and visual prompt are dropped.

**Fix:** render the full array; instruct the model to use at least 2 pain points and 2 desires across headlines.

---

### 4. Awareness stage is read but never acted on
`awarenessStage` appears in the prompt, but no instruction like:
- PROBLEM_AWARE → lead with pain
- SOLUTION_AWARE → lead with mechanism
- PRODUCT_AWARE → lead with differentiation
- MOST_AWARE → lead with offer/price/CTA

**Fix:** add an awareness-stage → copy-angle mapping in the system prompt.

---

### 5. Visual prompt is listed but not used as foundation
`visualPatternInterrupt` and `recommendedVisualPrompt` are dumped in a block, then the prompt separately asks for `imagePrompt` with no instruction to *build on* the recommended one. Model invents its own generic visual.

**Fix:** change to `"imagePrompt": "BUILD ON this foundation: ${recommendedVisualPrompt}. Refine with subject, composition, studio lighting, color harmony, high contrast."`

---

### 6. Hardcoded negative keywords in the prompt
`campaign-builder/route.ts:290` — inside the JSON schema example:
```json
"negativeKeywords": ["jobs", "employment", "career", "free trial", "free download", "free software"]
```
Model copies this into every ad group. `LAUNCH_SUMMARY.md` claimed this was fixed — it wasn't. Every campaign gets the same 5 negatives.

**Fix:** remove the literal from the schema example; instruct the model to derive negatives from offer + intent mismatch.

---

### 7. Temperature 0.35 for everything
Mid temp = not creative enough for headlines, not deterministic enough for structure. Worst of both.

**Fix:** temp 0.2 for the campaign-shell pass (structure, keywords, bidding), temp 0.8 for the headlines/descriptions pass.

---

### 8. One call does 7 jobs
Structure + 30-60 keywords + 24-45 headlines + 9-12 descriptions + image prompt + bidding + rationale. Model token-budgets against itself. Image prompt + rationale are first to be cut.

**Fix:** two-pass — pass 1: structure + keywords + theme; pass 2: headlines + descriptions per ad group.

---

## 🟠 Tier 2 — Output passes validation but is still bad

### 9. `INTERNAL_COPY` regex is too narrow
`google-plan-quality.ts:51` — only 6 phrases. Generic template output ("Best AI Tool For Your Business") sails through.

**Fix:** expand blocklist; add a generic-template regex (`/^(best|top|get|discover)\s+(ai|tool|solution|app)/i`).

---

### 10. No cross-ad-group duplicate check
`duplicateIndexes` in `google-plan-quality.ts:59-69` only checks within a group. Same headline in 3 ad groups passes.

**Fix:** add a second pass that flattens all headlines/descriptions across ad groups and dedupes.

---

### 11. Unsupported-claims regex misses obvious
`google-plan-quality.ts:53` — only flags `guaranteed`, `100%`, `# 1`, `best in/on/across`, `limited time offer`, `act now`, `don't miss out`. Misses `Premium`, `Top-Rated`, `#1` (no space), `Best Ever`, `Industry-Leading`, `World-Class`.

**Fix:** add `(?:#\s*1\b|\bpremium\b|\btop[\s-]?rated\b|\bindustry[\s-]?leading\b|\bworld[\s-]?class\b)`.

---

### 12. `placeholderUrl` only blocks 4 hosts
`google-plan-quality.ts:52` — catches `example.com`, `www.example.com`, `yoursite.com`, `www.yoursite.com`. Misses `landingpage.com`, `mysite.io`, `placeholder.com`, `test.com`, any made-up TLD.

**Fix:** add a "no DNS-resolvable host" check OR expand the Set to common placeholders.

---

### 13. No commercial-intent differentiation in keywords
Model returns a flat list. No `informational` vs `transactional` vs `comparison` split. All 3 ad groups end up with mid-intent keywords.

**Fix:** instruct the model to label each keyword with `intent: "high" | "medium" | "low"` and reject plans where <60% of keywords are high-intent.

---

### 14. No headline-angle enforcement
Prompt mentions Curiosity/Pain Point/Solution/Social Proof/CTA but doesn't *require* ≥2 headlines per angle.

**Fix:** in system prompt: `"Each ad group must include at least 2 headlines from EACH of these angles: pain, solution, social_proof, cta, curiosity."`

---

### 15. 30-char headline + 8-15 count forces generic copy
30 chars can't fit "Save 10 hours/week on lead gen" (35 chars). Model picks "Get More Leads" over anything specific.

**Fix:** allow 11-15 headlines at 30 chars, and add 4-6 long headlines at 90 chars (RSA feature).

---

### 16. No required business-name / offer-keyword presence
Headlines never have to mention the actual offer/product. Generic B2B headlines pass.

**Fix:** require ≥3 headlines per ad group to contain a token from `input.offer` or `businessContext.brandName`.

---

### 17. Meta prompt starves the model
`metaPrompt` (route.ts:306-329) doesn't pass `landingPageUrl`, `businessContext`, or `budget` properly, and uses only 3 of 7 profile fields. Meta campaigns come out thinner than Google ones.

**Fix:** mirror the `googlePrompt` structure for meta; pass full context.

---

## 🟡 Tier 3 — Structural / reliability

### 18. Retry doesn't actually retry correctly
On `parseGoogleSearchPlan` failure, second attempt uses the **same prompt**. No correction guidance beyond "return complete JSON." Model often produces the same failure.

**Fix:** inject a targeted error message into the retry prompt: `"The previous output failed: ${err}. Specifically fix: ${issue}."`

---

### 19. Psychology call bypasses credit accounting
`buildPsychologyPromptContext` (ad-psychology-engine.ts:42) calls OpenAI directly — never goes through `cachedUtilityCompletion`. User gets charged once but you pay twice (and no cache).

**Fix:** route through `cachedUtilityCompletion` or a similar credit-tracked wrapper.

---

### 20. No caching for psychology profile
`ad-psychology-engine.ts` re-hits OpenAI on every campaign build, even for identical inputs. Wasted spend + 1-2s latency.

**Fix:** add an LRU/Redis cache keyed by `hash(offer|targetCustomer|goal|brandMemory)`.

---

### 21. `temperature: 0.3` for psychology + `0.35` for campaign = drift
Two calls, slightly different temps, two layers of generation drift.

**Fix:** standardize — 0.2 for both, or 0.7 for both.

---

### 22. `businessContext` raw-dumped into prompt
Stored as JSON, fetched, concatenated as a string. Could be `{}`, a 5KB memory dump, or malformed.

**Fix:** normalize at the read site — cap to 2KB, drop empty keys, validate JSON.

---

### 23. `"Not generated"` / `"Not provided"` placeholder strings go to the model
`route.ts:258`: `${JSON.stringify(input.enhancedBrief || "Not generated")}` — when missing, literal string `"Not generated"` is in the prompt. Model can confuse with real data.

**Fix:** omit the field entirely if missing; don't substitute placeholder strings.

---

### 24. Policy check has only pass/fail, no soft-warn
`checkPlanPolicy` in `services/policy-check.ts` is a hard gate. One bad headline → entire plan rejected → user retries with no info on which headline tripped.

**Fix:** return per-headline reasons; surface them in the UI as warnings, not hard failures.

---

### 25. Quality warnings lost on retry path
`parseGoogleSearchPlan` runs twice. Warnings from attempt 1 (`quality.warnings`) are discarded.

**Fix:** merge warnings across attempts, or only run quality once on the final accepted output.

---

### 26. Schema enums don't match prompt instructions
Prompt says "do NOT use TARGET_ROAS on day-one" but the JSON enum includes `TARGET_ROAS`. Model can pick it.

**Fix:** drop `TARGET_ROAS` from the enum; only allow it when the user explicitly opts in.

---

### 27. Image prompt section has no actual visual direction
"ENGINEER AN ELITE DALL-E 3 IMAGE PROMPT" with no subject/composition/lighting/color guidance in the prompt itself.

**Fix:** add a visual brief template: subject + composition + lighting + color palette + mood + style.

---

### 28. Meta prompt has no image prompt request
Meta campaigns get no visual concept output. Only Google does.

**Fix:** add `"primaryVisualConcept": "..."` to the meta JSON schema.

---

## 🟢 Tier 4 — Cost / scale / minor

### 29. UTILITY_MODEL defaults to `gpt-4o-mini`
`ai-utility.ts:8` — every cached utility call (chat, recommendations, etc.) hits mini by default. Only the campaign call uses gpt-4o.

---

### 30. 24h cache TTL for utility model
Per-workspace input dedup, but if the same workspace re-runs the same brief the next day, they get a stale psychology profile under a wrong key.

---

### 31. `integration.accountInfo.metaAssets` silently inserts `null`s
`validateMetaPlan` (route.ts:131-137) — `pageId`, `instagramActorId`, `pixelId`, `appId` default to `null`. If assets are required for the chosen objective, the model has no way to know.

**Fix:** hard-require the asset set per `metaObjective`; fail loudly if missing.

---

### 32. Model fallback log is silent in user-facing errors
`route.ts:352` logs at `warn`, but the user gets `"AI could not produce a safe campaign plan"` with no hint they got a mini response.

**Fix:** include the actual model in the error code/message metadata.

---

### 33. `campaignType` hardcoded to `"SEARCH"`
`route.ts:378` and `google-plan-quality.ts:21` — `z.literal("SEARCH")` rejects any other value. Brittle for PMax/Display.

**Fix:** add `DISPLAY`, `PERFORMANCE_MAX`, `SHOPPING` to the literal union.

---

### 34. `parseJsonObject` regex matches first `{...}` greedily
`route.ts:70`: `/\{[\s\S]*\}/` — if the JSON contains `}` inside a string, it cuts off early.

**Fix:** use a brace-counter or strict JSON mode (`response_format: json_object` is already set, so this is only a fallback path).

---

### 35. No length cap reminder for `rationale.*`
Schema says max 600 chars; prompt doesn't remind the model. 800-char rationales get truncated silently.

**Fix:** add a length reminder in the JSON schema block of the prompt.

---

## Quick fix priority (highest impact first)

If you only fix 3 things, fix these — they account for ~70% of the badness:

1. **#1 — Stop the silent gpt-4o-mini fallback**
2. **#6 — Remove the hardcoded negative keywords from the prompt schema**
3. **#3 — Use the full psychology profile, not just `[0]` indexes**
