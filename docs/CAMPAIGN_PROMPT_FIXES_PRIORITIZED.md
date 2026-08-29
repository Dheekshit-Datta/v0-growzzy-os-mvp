# Prompt-Engineering Fix List — Growzzy OS

Extracted from `FLAWS_CAMPAIGN_OUTPUT.md`, focused on the **prompt-side** fixes. Each item is a concrete change to `campaign-builder/route.ts` (Google + Meta prompts) or `generate-ad-copy/route.ts`.

---

## P0 — Fix today (do not ship without these)

### P0.1 — Drop the silent gpt-4o-mini fallback
**File:** `app/api/ai/campaign-builder/route.ts:335-355`

```ts
// REMOVE:
} catch (error) {
  if (model === "gpt-4o-mini") throw error
  log("warn", "ai/campaign-builder", "Configured campaign model failed; retrying fallback model", aiErrorMetadata(error))
  model = "gpt-4o-mini"
  completion = await openai.chat.completions.create({ ...request, model })
}

// REPLACE WITH:
} catch (error) {
  log("error", "ai/campaign-builder", "Campaign model call failed; not downgrading", {
    ...aiErrorMetadata(error),
    requestedModel: model,
  })
  throw error
}
```

Same in `lib/ai-utility.ts:88-96`.

---

### P0.2 — Remove hardcoded negative keywords from the prompt schema
**File:** `app/api/ai/campaign-builder/route.ts:290`

```ts
// REMOVE the literal:
"negativeKeywords": ["jobs", "employment", "career", "free trial", "free download", "free software"],

// REPLACE WITH:
"negativeKeywords": ["<derive 5-8 from the offer + irrelevant intents; never reuse defaults>"],
```

---

### P0.3 — Use the full psychology profile, not just `[0]` indexes
**File:** `app/api/ai/campaign-builder/route.ts:232-253`

```ts
// Change section 1 (WHO) to use the full array:
- Target Persona: ${psychologyProfile.targetPersona}
- Awareness Stage: ${psychologyProfile.awarenessStage}
- All Pain Points (use AT LEAST 2 across headlines): ${psychologyProfile.corePainPoints.join(' | ')}
- All Desired Outcomes (use AT LEAST 2 across headlines): ${psychologyProfile.desireOutcomes.join(' | ')}

// Change section 3 (WHY):
- Primary Emotional Lever: ${psychologyProfile.primaryEmotionalTrigger}
- Cost of Inaction (paint this vividly): ${psychologyProfile.corePainPoints.map(p => `continued ${p.toLowerCase()}`).join(' AND ')}

// Change section 4 (VISUAL):
- Build the imagePrompt on this foundation: ${psychologyProfile.recommendedVisualPrompt}
- Pattern-interrupt concept: ${psychologyProfile.visualPatternInterrupt}
```

---

## P1 — Fix this week

### P1.1 — Split into system + user messages
**File:** `app/api/ai/campaign-builder/route.ts:342-345`, `app/api/ai/generate-ad-copy/route.ts:57`

```ts
// System (new):
const systemPrompt = `You are a world-class Performance Marketing Creative Director.
Non-negotiable rules:
- Return ONLY valid JSON matching the schema in the user message. No commentary.
- Headlines ≤30 chars, descriptions ≤90 chars. RSA: 11-15 headlines, 4 descriptions.
- Each ad group must include ≥2 headlines from EACH angle: pain, solution, social_proof, cta, curiosity.
- At least 3 headlines per ad group must contain a token from the offer or brand.
- Derive negative keywords from the offer + irrelevant intents. Never reuse defaults.
- Awareness-stage copy rules:
  • PROBLEM_AWARE → lead with pain
  • SOLUTION_AWARE → lead with mechanism
  • PRODUCT_AWARE → lead with differentiation
  • MOST_AWARE → lead with offer/price/CTA
- No fabricated stats, guarantees, or "#1" claims.
- Do NOT include placeholder URLs (example.com, yoursite.com, etc).`

// User (refactored to data only):
const userPrompt = JSON.stringify({
  brief: { offer, targetCustomer, budget, location, goal, landingPageUrl, enhancedBrief, clarifications },
  psychology: psychologyProfile,
  schema: { /* JSON schema as object, not as a code block */ }
})
```

---

### P1.2 — Awareness-stage → copy-angle mapping
**File:** `app/api/ai/campaign-builder/route.ts:232-253` (inside googlePrompt)

Add an explicit awareness-driven instruction block right after the psychology dump:
```ts
- AWARENESS-STAGE COPY DIRECTIVE: ${awarenessDirective(psychologyProfile.awarenessStage)}
```

Where `awarenessDirective` returns:
- PROBLEM_AWARE: `"Lead every ad group with the pain. Open the headline with the problem the user feels but hasn't named."`
- SOLUTION_AWARE: `"Lead with the unique mechanism. The user knows solutions exist — show them why this one is different."`
- PRODUCT_AWARE: `"Lead with differentiation vs named alternatives. Assume the user is comparing you to 1-2 competitors."`
- MOST_AWARE: `"Lead with offer, price, or strong CTA. The user is ready — remove friction."`

---

### P1.3 — Visual prompt as a foundation, not a free-for-all
**File:** `app/api/ai/campaign-builder/route.ts:284`

```ts
// REMOVE:
"imagePrompt": "Detailed DALL-E 3 image prompt representing the high-converting ad visual concept...",

// REPLACE WITH:
"imagePrompt": "DALL-E 3 prompt — BUILD ON this foundation and refine with subject + composition + studio lighting + color harmony + high contrast. Foundation: ${psychologyProfile.recommendedVisualPrompt}",
```

---

### P1.4 — Same fix for Meta prompt
**File:** `app/api/ai/campaign-builder/route.ts:306-329`

Mirror the Google prompt structure for meta:
- Pass full psychology profile (all pain points, all desires)
- Add `"primaryVisualConcept": "..."` to schema
- Pass `landingPageUrl`, `businessContext`, `budget` properly
- Add awareness-stage directive

---

### P1.5 — Temperature split by task type
**File:** `app/api/ai/campaign-builder/route.ts:340`

```ts
// REMOVE:
temperature: 0.35,

// REPLACE WITH:
temperature: 0.2,  // campaign shell is structured; creativity comes from the model itself
```

`generate-ad-copy/route.ts:55` — bump to `0.7` (this route is pure creative output).

---

## P2 — Fix this sprint

### P2.1 — Add cross-ad-group dedup
**File:** `lib/google-plan-quality.ts:110-121`

```ts
// After the per-group loop, add:
const allHeadlines = value.adGroups.flatMap(g => g.headlines.map(h => ({ group: g.name, h })))
const seenHeadline = new Map<string, string>()
for (const { group, h } of allHeadlines) {
  const key = normalized(h)
  if (!key) continue
  if (seenHeadline.has(key)) warnings.push(`Headline "${h}" appears in both "${seenHeadline.get(key)}" and "${group}"`)
  else seenHeadline.set(key, group)
}
```

---

### P2.2 — Strengthen unsupported-claims + generic-template regex
**File:** `lib/google-plan-quality.ts:51-53`

```ts
const INTERNAL_COPY = /\b(campaign brief|launch direction|missing before launch|structured the brief locally|ai is temporarily unavailable|deterministic fallback)\b/i
const GENERIC_TEMPLATE = /^(best|top|get|discover|amazing|ultimate|powerful)\s+(ai|tool|solution|app|software|platform|service)\b/i
const UNSUPPORTED_CLAIMS = /(?:\bguaranteed\b|\b100\s*%\b|\b#\s*1\b|\bbest\s+(?:in|on|across|ever)\b|\b(?:limited\s+time\s+offer|act\s+now|don'\s*t\s*miss\s*out|premium|top[\s-]?rated|industry[\s-]?leading|world[\s-]?class)\b)/i
const PLACEHOLDER_HOSTS = new Set([
  "example.com", "www.example.com", "yoursite.com", "www.yoursite.com",
  "landingpage.com", "mysite.io", "placeholder.com", "test.com", "demo.com"
])

// In assessGoogleSearchPlan:
if (allText.some((text) => GENERIC_TEMPLATE.test(text))) errors.push("Plan contains generic-template copy that is not tailored to the offer.")
```

---

### P2.3 — Two-pass generation (structure → copy)
**File:** `app/api/ai/campaign-builder/route.ts`

Pass 1 (temp 0.2): structure + keywords + bidding + theme per ad group
Pass 2 per ad group (temp 0.7): 11-15 headlines + 4 descriptions, anchored on the ad group's theme + the psychology profile

This is the biggest quality jump. Cost: ~3-4x more tokens per build, but each call is cheaper and produces dramatically better output.

---

### P2.4 — Cache the psychology profile
**File:** `lib/ad-psychology-engine.ts:42`

```ts
// Wrap the OpenAI call in a cache keyed by:
//   hash(offer | targetCustomer | goal | brandMemory | landingPageUrl)
const cacheKey = `psych:${createHash('sha256').update(JSON.stringify({offer, targetCustomer, goal, brandMemory, landingPageUrl})).digest('hex')}`
const cached = await redisGet(cacheKey)
if (cached) return JSON.parse(cached)
// ... existing call ...
await redisSet(cacheKey, JSON.stringify(result), 60 * 60 * 24) // 24h TTL
```

---

### P2.5 — Targeted retry guidance
**File:** `app/api/ai/campaign-builder/route.ts:344`

```ts
content: `${input.platform === "META" ? metaPrompt : googlePrompt}${attempt ? `\n\nThe previous response was invalid: ${String(generationError).slice(0, 400)}. Fix ONLY that issue and return complete JSON.` : ""}`,
```

---

### P2.6 — Validate `businessContext` before injecting
**File:** `app/api/ai/campaign-builder/route.ts:241`

```ts
const safeContext = (() => {
  try {
    const parsed = typeof businessContext === 'string' ? JSON.parse(businessContext) : businessContext
    const trimmed = JSON.stringify(parsed).slice(0, 2000) // cap to 2KB
    return trimmed === '{}' ? 'Standard B2B/B2C Brand' : trimmed
  } catch {
    return 'Standard B2B/B2C Brand'
  }
})()
```

---

### P2.7 — Drop placeholder string substitutes
**File:** `app/api/ai/campaign-builder/route.ts:258-260`

```ts
// REMOVE the "Not generated" / "Not provided" string substitutions.
// Omit fields entirely when missing, instead of substituting placeholder strings that confuse the model.
```

---

## P3 — Backlog

### P3.1 — Long-headline support (RSA)
Allow 4-6 headlines at 90 chars in addition to the 11-15 at 30 chars.

### P3.2 — Required business-name token check
Reject any ad group where 0 headlines contain a token from the offer or brand.

### P3.3 — Per-headline policy reasons
`checkPlanPolicy` returns reasons per offending headline; UI surfaces as warnings, not hard failures.

### P3.4 — Add `DISPLAY`, `PERFORMANCE_MAX`, `SHOPPING` to `campaignType` literal

### P3.5 — Meta image-prompt support
Add `"primaryVisualConcept": "..."` to the Meta JSON schema.

### P3.6 — Standardize temperatures across all AI calls
0.2 for structured, 0.7 for creative, document the convention.

---

## Order of operations

1. Land P0.1, P0.2, P0.3 in one PR (1 hour, huge impact)
2. Land P1.1 + P1.2 + P1.3 + P1.4 + P1.5 in one PR (half day, biggest prompt quality jump)
3. Land P2.1 + P2.2 in one PR (1 hour, validator hardening)
4. Land P2.3 (two-pass generation) as the big-bang refactor (1-2 days, biggest creative jump)
5. P2.4-P2.7 as time permits

P0 + P1 alone should take "worst output" to "good output" for most briefs. P2.3 takes "good" to "great."
