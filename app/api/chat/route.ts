import {
  convertToModelMessages,
  streamText,
  stepCountIs,
  tool,
  generateText,
  type UIMessage,
} from "ai";
import { z } from "zod";
import {
  createAIProvider,
  generateAdImage,
} from "@/lib/ai-gateway.server";
import { BANNED_FILLER_PHRASES, isPhraseAllowedForIndustry } from "@/lib/google-plan-quality";
import { rateLimitPolicy, rateLimitResponse } from "@/lib/rate-limit";

export const maxDuration = 120;

// Wraps a primary model so that on rate-limit errors it transparently
// falls back to a secondary model. The user keeps getting responses; the
// model just degrades. The AI SDK accepts LanguageModelV1, so we forward
// every call to the primary unless it throws a 429.
function wrapWithFallback(
  primary: ReturnType<ReturnType<typeof createAIProvider>["provider"]>,
  secondary: ReturnType<ReturnType<typeof createAIProvider>["provider"]>,
) {
  const handler: ProxyHandler<typeof primary> = {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver)
      if (typeof value === "function") {
        return async (...args: unknown[]) => {
          try {
            return await (value as (...a: unknown[]) => Promise<unknown>).apply(target, args)
          } catch (err: unknown) {
            const e = err as { statusCode?: number; code?: string }
            if (e?.statusCode === 429 || e?.code === "rate_limit_exceeded") {
              console.warn("[growzzy] primary model rate-limited, falling back to mini")
              const fallbackValue = Reflect.get(secondary, prop, secondary as object)
              if (typeof fallbackValue === "function") {
                return await (fallbackValue as (...a: unknown[]) => Promise<unknown>).apply(secondary, args)
              }
            }
            throw err
          }
        }
      }
      return value
    },
  }
  return new Proxy(primary, handler) as typeof primary
}

const SYSTEM = `You are Growzzy, the AI Chief Media Buyer inside Growzzy OS — a senior performance marketer with 12+ years scaling $50M+ across B2B SaaS and DTC. You think like a strategist, write like a direct-response copywriter, and never give a textbook answer when a worked example grounded in the user's actual business is possible.

You can read the user's account (campaigns, leads, analytics, recommendations) via the internal tools. You can also search the live web for benchmarks, competitor intelligence, and current CPC data.

============================================================
THE OUTPUT STANDARD (this is the bar — every strategy doc must meet it)
============================================================
Your strategy documents are EXECUTION BLUEPRINTS, not consulting reports. The user opens Google Ads Manager and follows them line by line. Concretely:
- Every recommendation names the SPECIFIC button, dropdown, or field. (\"Set Daily Budget to ₹1,000\", \"Click Narrow Audience\").
- Every value is exact — no \"a modest budget\" or \"decent volume\". Use \"₹1,000/day\", \"12-16 conversations/day\", \"15 headlines\".
- Every table is a settings list: Setting | Value | Why.
- Every critical misstep gets a bold **CRITICAL:** callout so the user doesn't repeat last campaign's mistakes.
- Use tables liberally for settings, bullet lists sparingly for actions, prose only to explain WHY a setting exists.
- End every doc with a numbered pre-launch checklist and a clear **Go Live.** sign-off.

============================================================
WORKFLOW DISCIPLINE (read carefully — these are enforced server-side)
============================================================
- NEVER re-call askUser after the user has already submitted answers. If you missed a detail, infer it from context or move on.
- ALWAYS call previewExecution exactly ONCE after the user answers askUser and BEFORE calling research. Do not skip it.
- The "So What?" test is mandatory on every headline. A headline is banned if its meaning could apply verbatim to a competitor.
- Every Google Search RSA requires 10-15 headlines (cap is 15) and 3-4 descriptions. The 30-char headline cap and 90-char description cap are HARD limits — count your characters.
- A campaign without a landingPage URL will be rejected at launch. Always include one.

============================================================
AGENTIC BEHAVIOR (use freely — no fixed funnel)
============================================================
You are a senior marketing strategist, not a dropdown-menu bot. Use the available tools freely to serve the user:
- Need data? → getMyAnalytics / getMyCampaigns / getMyLeads / getMyRecommendations
- Need market intel? → research (with real queries) / analyzeWebsite
- Need user input? → askUser (1-2 questions, derived from what's missing, not a template)
- Need to build? → proposePlan (flexible structure) → deliverCampaign
- Need creativity? → generateCreative
- User asks a theory question? → Answer directly, teach with one example, ask one grounding question.
- User says "hi" or thanks? → Respond briefly, ask one sharp marketing question to keep conversation productive.

Do NOT follow a rigid 6-step funnel. Do NOT ask the same 3 questions every time. Derive questions from the user's message and brand context. If you can infer an answer, don't ask. If the user asks anything marketing-related, answer and do the work — don't force them into a template.

============================================================
CAMPAIGN BUILD WORKFLOW (mode 4 only — do not run any of this in other modes)
============================================================

1. BRAND GROUNDING:
Acknowledge the user's brand memory context and any attached files. Never ask what the business does if context is loaded.

2. CLARIFYING SETUP QUESTIONS (askUser):
CRITICAL: You MUST call the askUser tool to ask questions — NEVER write questions as plain text. The askUser tool renders them as a clickable card UI with category icons, descriptions, and a RECOMMENDED pill.

Ask 3-4 strategic setup questions **derived from the user's actual business and offer**, NOT a generic template. Cover ONLY the fields that are not already in brand context:
- If budget is unknown, ask for it (one question, with tiered options like ₹500/day / ₹1,000/day / ₹2,500/day / custom).
- If the landing page URL is unknown, ask for it (one free-text-input question).
- If the core conversion action is unclear, ask for it (3-4 specific options based on the user's offer — e.g. for a SaaS: "Book demo" / "Start free trial" / "Talk to sales" / "Other").
- If launch timing is unclear, ask for it (ASAP / 2 weeks / this quarter / flexible).
Skip any question whose answer is already in brand context or was provided in the user's message. Do NOT ask the same question twice.

For each question you DO ask, provide 3-4 options that are specific to the user's business. Avoid generic category labels like "Inbound Qualified Leads" or "Multi-Channel" — write the option text in the user's own words about their actual offer.

PLATFORM POLICY: Growzzy currently supports **Google Ads only** (Search + Display/Discovery image formats). Do NOT ask about Meta, TikTok, LinkedIn, or any other network — assume Google Ads and proceed. Do NOT offer a "Multi-Channel" option since we don't yet support it.

3. EXECUTION PLAN PREVIEW (previewExecution):
Call previewExecution when the user asks to build/run/launch a campaign and you have enough info to start. The card lists 3-5 activity steps SPECIFIC to this campaign's actual work. Derive the activity labels from the real work (e.g. for a B2B SaaS lead-gen campaign, the activities might be 'Researching your B2B SaaS competitors', 'Building keyword lists for enterprise buyers', 'Drafting your direct response copy'). The card has a 'Proceed with plan' button and a 10s auto-proceed countdown. The model continues only after the user clicks Proceed or the countdown fires.

PARALLEL ACTIVITIES: When two or more activities can run at the same time (e.g. copy-writing and image-generation, or research across two topics), set 'isParallel: true' on each and give them a short agentRole (e.g. 'Performance Marketer', 'Creative Director', 'Researcher', 'Strategist'). The chat groups them under a '2 agents working on this — 0/N done' card so the user sees real concurrency. Use 2-3 parallel activities max; the remaining steps are sequential.

4. RESEARCH (research):
When building a campaign, call the research tool with 3-5 real queries specific to this industry, competitors, high-intent keywords, and CPC benchmarks. Ground every claim and benchmark in the research findings. NEVER hallucinate benchmarks. If research returns nothing, use internal knowledge but mark numbers as 'industry typical' and note that the user should verify.

5. EXECUTION BLUEPRINT (proposePlan):
Synthesize research into an execution blueprint via proposePlan. The blueprint is the user's build sheet — they open Google Ads Manager and follow it line by line.

Structure the document to match the campaign type (Search RSA, Display image ad, B2B lead gen, e-commerce, local services, etc.). Do NOT force the same 7 sections on every campaign. Drop or rename sections when irrelevant to the user's situation. Use Setting|Value|Why markdown tables (with proper |---| separator rows) and bold **CRITICAL:** callouts where they matter. End with **Go Live.** as the final line.

FORMATTING RULES:
- Every Setting|Value|Why table MUST have a |---|---|---| separator row. A missing separator breaks the renderer.
- Every value must be EXACT (no "a modest budget" → use "$100/day"; no "good volume" → use "12-16 conversions/day").
- Every table cell that contains a pipe character must escape it as \\| or the table breaks.
- Bold **CRITICAL:** callouts go immediately after the relevant section.
- Tables for settings, bullet lists for actions, prose only to explain WHY a setting exists.

Call proposePlan EXACTLY ONCE with the full markdownPlan. Do NOT dump the strategy as raw markdown text in the conversation. The tool renders a proper strategy document card with an Approve button.

6. ASSET GENERATION & LAUNCH PACKAGE (generateCreative & deliverCampaign):
Once approved (approved=true):
- GOOGLE SEARCH CAMPAIGN (text-only RSA): Do NOT call generateCreative. Immediately call deliverCampaign with 15 headlines (<= 30 chars), 4 descriptions (<= 90 chars), 4 Sitelink extensions, negative keywords, targeting setup.
- GOOGLE DISPLAY / DISCOVERY IMAGE AD: Call generateCreative ONCE for the 1:1 image, then call deliverCampaign with 1 short headline (<= 40 chars), 1 description (<= 90 chars), Final URL, CTA, targeting setup.

If the user hasn't told you a budget, ask for it via askUser before calling deliverCampaign. Do NOT invent a budget number.

============================================================
COPYWRITING QUALITY & BANNED PHRASES
============================================================
❌ BANNED (generic corporate filler — NEVER write these):
- "Unlock AI Efficiency" | "Revitalize Operations Today" | "Transform Your Business"
- "Reduce Costs with AI" | "Empower Your Team" | "Drive Growth" | "Get More Leads"

✅ REQUIRED (specific, quantified, urgent direct-response hooks):
- "Cut $150K in Manual Ops" (21 chars)
- "Ship AI Agents in 48 Hours" (23 chars)
- "Your AI Breaks at Scale" (20 chars)
- "60% Fewer Pipeline Failures" (25 chars)
- "Free Architecture Audit" (21 chars)

Every headline must pass the "So What?" test: if a competitor could say the exact same thing, it's too generic — rewrite with specific numbers, mechanisms, or timeframes.

============================================================
AWARENESS-STAGE DIRECTIVES
============================================================
• PROBLEM_AWARE: Lead with the visceral pain point they feel daily.
• SOLUTION_AWARE: Lead with your unique mechanism and speed of execution.
• PRODUCT_AWARE: Lead with differentiation vs named competitors and proof.
• MOST_AWARE: Lead with the risk-reversal offer, price, and immediate CTA.

============================================================
POST-DELIVERY UI RULE
============================================================
After calling deliverCampaign, DO NOT output any markdown recaps or bulleted summaries in conversational text. The CampaignCard and Artifact Document deliverable already display all campaign parameters. Keep your closing message to a single concise 1-line handoff.

============================================================
INTEGRATION CONNECT PROMPT
============================================================
When the user asks to publish or sync to a network they have not connected (e.g. Meta Ads, TikTok, LinkedIn), do NOT silently fail. Call the connectIntegrationPrompt tool with the platform and a one-line reason. The chat renders an inline 'Connect / Skip' card. If the user picks Skip, fall back to Google Ads (or note that the campaign stays in draft) — do not retry publishing on the disconnected network. If the user picks Connect, return a one-line confirmation and continue building the campaign in draft state.
`;

const questionSchema = z.object({
  questions: z
    .array(
      z.object({
        id: z.string().describe("short slug, e.g. 'budget'"),
        question: z.string(),
        why: z.string().describe("one line on why this matters"),
        options: z
          .array(
            z.object({
              label: z.string(),
              description: z.string(),
              recommended: z.boolean().optional().describe("mark exactly one option as recommended if you have a clear pick"),
            }),
          )
          .min(2)
          .max(5)
          .describe("2-5 options per question"),
      }),
    )
    .min(1)
    .max(2)
    .describe("1-2 questions at a time — ask only what is genuinely missing. Derive each question from the user's message and brand context; do not ask what you can infer."),
});

/** Replaces base64 creative data URLs in history with a short placeholder. */
function stripCreativeImages(messages: UIMessage[]): UIMessage[] {
  return messages.map((m) => ({
    ...m,
    parts: m.parts.map((p) => {
      const part = p as { type?: string; output?: { imageUrl?: string | null } };
      if (part.type === "tool-generateCreative" && part.output?.imageUrl) {
        return { ...p, output: { ...part.output, imageUrl: "[image shown to the user]" } };
      }
      return p;
    }),
  })) as UIMessage[];
}

/** Server-side quality gate for the chat route's `deliverCampaign`.
 *  Returns a list of specific issues the model must fix before delivery.
 *  Empty array = pass. */
function validateDeliverCampaignInput(input: Record<string, unknown>): string[] {
  const issues: string[] = [];
  const platform = String(input.platform || "").toLowerCase();
  const isGoogle = platform.includes("google");
  const isMeta = platform.includes("meta") || platform.includes("facebook") || platform.includes("instagram");

  const headlines = Array.isArray(input.headlines) ? (input.headlines as unknown[]).map(String) : [];
  const descriptions = Array.isArray(input.descriptions) ? (input.descriptions as unknown[]).map(String) : [];
  const primaryText = String(input.primaryText || "");
  const allCopy = [...headlines, ...descriptions, primaryText];

  // 1. Landing page URL is required (ad account will reject without it)
  const landingPage = String(input.landingPage || "").trim();
  if (!landingPage) {
    issues.push(`Landing page URL is required. A campaign without a destination URL will be rejected at launch.`);
  } else if (!/^https?:\/\//i.test(landingPage)) {
    issues.push(`Landing page must be a valid http:// or https:// URL. Got: "${landingPage}"`);
  }

  // 2. Banned phrase check (exact)
  for (const phrase of BANNED_FILLER_PHRASES) {
    for (const line of allCopy) {
      if (line.toLowerCase().includes(phrase)) {
        issues.push(`BANNED PHRASE "${phrase}" found in: "${line.trim()}" — rewrite with specific number, mechanism, or proof.`);
        break;
      }
    }
  }

  // 3. Semantic banned phrase detection (catches rephrasings)
  const SEMANTIC_BANS = [
    { pattern: /\b(seamless|flawless|smooth)\s+(experience|integration|solution|process|workflow)\b/i, label: "seamless experience" },
    { pattern: /\b(comprehensive|holistic|all-in-one|end-to-end)\s+(approach|solution|platform)\b/i, label: "comprehensive approach" },
    { pattern: /\b(state-of-the-art|cutting-edge|next-gen|next generation)\s+(technology|platform|solution|tool)\b/i, label: "state-of-the-art" },
    { pattern: /\b(world-class|best-in-class|industry-leading|industry-standard)\s+/i, label: "world-class" },
    { pattern: /\b(revolutionary|game-chang(?:ing|er)|disrupt(?:ing|ive))\s+/i, label: "revolutionary" },
    { pattern: /\btransform(?:s|ing)?\s+(your|business|enterprise|workflow)/i, label: "transform your business" },
    { pattern: /\b(empower|enable|unlock)\s+(your|team|business|enterprise)/i, label: "empower your team" },
    { pattern: /\b(optimize|maximise|maximize)\s+(your|efficiency|workflows|operations)/i, label: "optimize efficiency" },
    { pattern: /\bdrive\s+(growth|results|value|success|revenue)/i, label: "drive growth" },
    { pattern: /\b(leverage|utilise|utilize)\s+ai\b/i, label: "leverage AI" },
    { pattern: /\b(ai-powered|ai-driven|ai-enabled)\s+(solution|platform|tool)/i, label: "AI-powered solution" },
  ];
  for (const line of allCopy) {
    for (const ban of SEMANTIC_BANS) {
      if (ban.pattern.test(line)) {
        issues.push(`Generic filler "${ban.label}" in: "${line.trim()}" — rewrite with specific numbers, mechanisms, or named outcomes.`);
        break;
      }
    }
  }

  // 4. Generic verb openers
  const GENERIC_OPENERS = /^(unlock|unleash|elevate|maximize|boost|enhance|streamline|transform|empower|revolutionize|revitalize|discover|explore|introducing)\s/i;
  for (const h of headlines) {
    if (GENERIC_OPENERS.test(h.trim())) {
      issues.push(`HEADLINE uses generic opener verb: "${h}" — rewrite with a specific number, mechanism, or named outcome.`);
    }
  }

  // 5. "So What?" test — at least 5 of 15 headlines must contain specificity
  if (isGoogle && headlines.length >= 10) {
    const SPECIFIC = /(\$|\d|%|x faster|hours?|days?|weeks?|months?|cut|ship|build|audit|save|deadline|miss|break|scale|launch|free|now|today|book|hire|deploy)/i;
    const specificCount = headlines.filter(h => SPECIFIC.test(h)).length;
    if (specificCount < 5) {
      issues.push(`Only ${specificCount}/${headlines.length} headlines pass the "So What?" test. At least 5 must include a number, dollar amount, percent, time, or specific mechanism.`);
    }
  }

  // 6. Char limits (defensive — schema enforces, but verify)
  const maxHeadline = isGoogle ? 30 : 40;
  for (const h of headlines) {
    if (h.length > maxHeadline) {
      issues.push(`HEADLINE "${h}" is ${h.length} chars — max ${maxHeadline} for ${platform || "platform"}.`);
    }
  }
  for (const d of descriptions) {
    if (d.length > 90) {
      issues.push(`DESCRIPTION "${d}" is ${d.length} chars — max 90.`);
    }
  }

  // 7. Primary text must contain a CTA verb
  if (primaryText && !/(book|learn|get|try|sign|request|schedule|see|watch|discover|start|download|claim|call|contact)/i.test(primaryText)) {
    issues.push(`PRIMARY TEXT is missing a CTA verb (book, learn, get, try, request, schedule, etc.).`);
  }

  // 8. Near-duplicate headlines
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const seen = new Map<string, number>();
  headlines.forEach((h, i) => {
    const key = normalize(h);
    if (key.length < 8) return;
    if (seen.has(key)) {
      issues.push(`Near-duplicate headlines: "${h}" and "${headlines[seen.get(key)!]}". Use distinct angles.`);
    } else {
      seen.set(key, i);
    }
  });

  // 9. Headline count: Google Search RSA needs 10-15
  if (isGoogle && headlines.length >= 5 && headlines.length < 10) {
    issues.push(`Google Search RSA needs 10-15 headlines. Only ${headlines.length} provided.`);
  }
  if (isGoogle && headlines.length < 5 && descriptions.length < 1) {
    issues.push(`A Google Ads campaign needs at least 1 headline and 1 description.`);
  }

  return issues;
}



export async function POST(req: Request) {
  try {
    const { messages, brandContext } = (await req.json()) as {
      messages?: UIMessage[];
      brandContext?: string;
    };
    if (!Array.isArray(messages)) return new Response("Messages are required", { status: 400 });

    const apiKey =
      process.env["LOVABLE_API_KEY"] ||
      process.env["AI_GATEWAY_API_KEY"] ||
      process.env["OPENAI_API_KEY"] ||
      "";
    if (!apiKey) return new Response("AI is not configured yet.", { status: 500 });

    // CSRF guard: reject cross-origin requests that aren't same-site
    const requestOrigin = req.headers.get("origin");
    if (requestOrigin) {
      try {
        const originUrl = new URL(requestOrigin);
        if (originUrl.origin !== new URL(req.url).origin) {
          return new Response("Forbidden", { status: 403 });
        }
      } catch {
        return new Response("Forbidden", { status: 403 });
      }
    }

    // Auth check
    const { auth } = await import("@/lib/auth");
    const session = await auth();
    if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

    // Rate limit: prevent abuse of the chat endpoint
    const limit = await rateLimitPolicy(session.user.id, "chatMessage");
    if (!limit.allowed) return rateLimitResponse(limit);

    const { webSearch, fetchPageText } = await import("@/lib/research.server");

    const gateway = createAIProvider(apiKey);
    const primaryModel = gateway.provider(gateway.chatModel);
    // Fallback model: when the primary hits rate limits, fall back to a
    // cheaper/faster model so the chat doesn't crash. The user experience
    // degrades (less depth) but stays online.
    const fallbackModel = gateway.provider("gpt-4o-mini");
    const model = wrapWithFallback(primaryModel, fallbackModel);

    // Forward the user's auth cookie when the chat route internally calls
    // other /api/* endpoints on the same origin. Used by the getMy* tools
    // below to read the user's account data without re-implementing auth.
    const forwardCookie = req.headers.get("cookie") ?? "";
    const origin = (() => {
      try {
        return new URL(req.url).origin;
      } catch {
        return "";
      }
    })();

    async function getJson(path: string): Promise<{ ok: boolean; status: number; data: unknown }> {
      if (!origin) return { ok: false, status: 0, data: { error: "no origin" } };
      try {
        const res = await fetch(`${origin}${path}`, {
          headers: { cookie: forwardCookie, accept: "application/json" },
          cache: "no-store",
          signal: req.signal,
        });
        const data = await res.json().catch(() => null);
        return { ok: res.ok, status: res.status, data };
      } catch (e) {
        return { ok: false, status: 0, data: { error: (e as Error).message } };
      }
    }

    const brandBlock = brandContext?.trim()
      ? `\n\n=== BRAND CONTEXT (from user's My Brand profile — treat as known facts, never ask about it) ===\n${brandContext.trim()}`
      : `\n\n=== BRAND CONTEXT ===\nEMPTY — nothing is known about this business yet. If the user's request needs business context, call askBrandUrl once, then analyzeWebsite with the URL they give, and continue from that analysis. Never ask "what is your business".`;

    const result = streamText({
      model,
      system: SYSTEM + brandBlock,
      messages: await convertToModelMessages(stripCreativeImages(messages)),
      abortSignal: req.signal,
      stopWhen: stepCountIs(50),
      tools: {
        research: tool({
          description:
            "Run live web research: performs web searches, reads actual result pages, and returns analyzed market/competitor intelligence.",
          inputSchema: z.object({
            focus: z.string().describe("what is being researched, shown to the user"),
            topics: z.array(z.string()).describe("1-8 research topics — use more for deeper research"),
            queries: z
              .array(z.string())
              .describe("1-8 real web search queries to run, specific to this business. Use 1-2 for quick checks, 5-8 for full competitive analysis."),
          }),
          execute: async ({ focus, topics, queries }) => {
            // Adaptive limits: scale research depth with query count.
            const queryLimit = Math.min(queries.length, 8)
            const resultLimit = queries.length <= 2 ? 3 : queries.length <= 4 ? 5 : 6
            const urlLimit = queries.length <= 2 ? 3 : queries.length <= 4 ? 5 : 7
            const searches = await Promise.all(
              queries.slice(0, queryLimit).map(async (q) => ({ q, results: await webSearch(q, resultLimit) })),
            );
            const urls = [
              ...new Set(searches.flatMap((s) => s.results.slice(0, 2).map((r) => r.url))),
            ].slice(0, urlLimit);
            const pages = await Promise.all(urls.map((u) => fetchPageText(u, 4000)));

            const evidence = [
              ...searches.map(
                (s) =>
                  `SEARCH "${s.q}":\n${s.results
                    .map((r) => `- ${r.title} (${r.url}): ${r.snippet}`)
                    .join("\n")}`,
              ),
              ...pages.map((p, i) => (p ? `PAGE (${urls[i]}):\n${p}` : "")),
            ]
              .filter(Boolean)
              .join("\n\n");

            // Quality gate: require real evidence. If searches returned nothing
            // (network issue, query mismatch, blocked), return a structured
            // failure so the agent falls back to internal knowledge rather
            // than hallucinating competitor names and CPCs.
            if (searches.every((s) => s.results.length === 0)) {
              return {
                focus,
                notes: "**No live research available.**\n\nLive web research returned no results. Use internal knowledge to draft a high-quality, honest strategy. Mark all numbers as 'industry typical' rather than specific competitor figures, and note in the brief that benchmarks should be verified by the user before launch.",
                sources: [],
                citations: [],
                queries: searches.map((s) => s.q),
                researchFailed: true,
              };
            }

            const { text } = await generateText({
              model,
              system:
                "You are a senior performance-marketing research analyst with 12+ years of experience. You write for a $50M+ media buyer who needs sharp, specific intelligence — not generic definitions. " +
                "\n\nRULES: " +
                "(1) Every claim MUST cite the source URL it came from. If you can't ground a claim in the provided evidence, do NOT include it. " +
                "(2) Never invent competitor names, CPCs, CTRs, or market size numbers. If the evidence doesn't show it, say 'verify before launch'. " +
                "(3) Use sharp, specific, direct-response language. BANNED: 'unlock', 'seamless', 'revolutionary', 'world-class', 'holistic', 'transform your business', 'drive growth', 'empower', 'comprehensive solution'. " +
                "(4) For CPC/CTR/range estimates, use the ranges implied by the evidence (e.g. 'Based on the [source]'s industry overview, B2B SaaS CPCs typically run $5-15 for high-intent terms'). " +
                "(5) End with a '**Sources**' section listing every URL you drew from.",
              prompt: `Focus: ${focus}\nTopics:\n${topics.map((t) => `- ${t}`).join("\n")}\n\nEVIDENCE (cite specific URLs when making claims):\n${evidence.slice(0, 50000)}`,
            });

            // Reject the research output if it contains banned phrases —
            // the model gets auto-corrected so the proposePlan step that
            // follows has clean material to work with.
            const issues: string[] = [];
            const lower = text.toLowerCase();
            for (const phrase of BANNED_FILLER_PHRASES) {
              if (lower.includes(phrase)) {
                issues.push(`BANNED PHRASE "${phrase}" found in research output. Rewrite with specific numbers, named mechanisms, or quantified outcomes.`);
                break;
              }
            }
            if (issues.length > 0) {
              const { text: retry } = await generateText({
                model,
                system:
                  "You are a performance-marketing research analyst. Rewrite the previous research notes, removing ALL generic corporate filler. Replace any 'seamless', 'revolutionary', 'world-class', 'comprehensive', 'holistic', 'transform', 'empower', 'drive growth' phrases with specific, quantified observations grounded in the evidence. " +
                  "Every claim must cite a source URL. If you cannot ground a number, write 'verify before launch' instead.",
                prompt: `PREVIOUS (REJECTED):\n${text}\n\nORIGINAL EVIDENCE:\n${evidence.slice(0, 50000)}`,
              });
              const citations = urls.map((u) => {
                const hit = searches.flatMap((s) => s.results).find((r) => r.url === u);
                let site = u;
                try {
                  site = new URL(u).hostname.replace(/^www\./, "");
                } catch {
                  /* keep raw */
                }
                return { url: u, site, title: hit?.title ?? site, snippet: hit?.snippet ?? "" };
              });
              return {
                focus,
                notes: retry,
                sources: urls,
                citations,
                queries: searches.map((s) => s.q),
                qualityRewritten: true,
              };
            }

            const citations = urls.map((u) => {
              const hit = searches.flatMap((s) => s.results).find((r) => r.url === u);
              let site = u;
              try {
                site = new URL(u).hostname.replace(/^www\./, "");
              } catch {
                /* keep raw */
              }
              return { url: u, site, title: hit?.title ?? site, snippet: hit?.snippet ?? "" };
            });
            return {
              focus,
              notes: text,
              sources: urls,
              citations,
              queries: searches.map((s) => s.q),
            };
          },
        }),
        askBrandUrl: tool({
          description:
            "Use ONLY when brand context is empty: asks user for their website URL inside chat.",
          inputSchema: z.object({
            reason: z.string().describe("one short line on why you need their website"),
          }),
        }),
        analyzeWebsite: tool({
          description:
            "Deeply analyse a website with live page reads + web search: returns business model, ICP segments, competitors, keywords and creative angles.",
          inputSchema: z.object({
            url: z.string().describe("the website URL the user gave"),
          }),
          execute: async ({ url }) => {
            try {
              const { analyzeSite } = await import("@/lib/brand-analysis.server");
              const { site, profile } = await analyzeSite(apiKey, url);
              return { site, profile };
            } catch (e) {
              return { site: url, error: (e as Error).message };
            }
          },
        }),

        // -----------------------------------------------------------------
        // Internal account lookup tools (read-only, mode = ACCOUNT_INSIGHT)
        // Returns raw data to the model — the model interprets and writes
        // a sharp, plain-language diagnosis in its response. No client UI.
        // -----------------------------------------------------------------
        getMyAnalytics: tool({
          description:
            "Pull the user's live account analytics (total spend, revenue, ROAS, CTR, clicks, impressions, conversions, leads, top/bottom campaigns, platform breakdown, daily chart) for the last N days. Use this whenever the user asks about account performance, asks for an audit, or wants to know how their ads are doing.",
          inputSchema: z.object({
            days: z
              .number()
              .min(1)
              .max(90)
              .default(30)
              .describe("Lookback window in days. Default 30."),
          }),
          execute: async ({ days }) => {
            const r = await getJson(`/api/analytics/overview?days=${days}`);
            if (!r.ok) return { error: `analytics fetch failed (${r.status})`, data: r.data };
            return r.data;
          },
        }),

        getMyCampaigns: tool({
          description:
            "List the user's existing campaigns with their status, budget, spend, and platform. Use when the user asks 'what campaigns do I have running' or wants a per-campaign review.",
          inputSchema: z.object({
            status: z
              .enum(["ACTIVE", "PAUSED", "ALL"])
              .default("ACTIVE")
              .describe("Campaign status filter. Default ACTIVE."),
          }),
          execute: async ({ status }) => {
            const qs = status === "ALL" ? "?status=ACTIVE" : `?status=${status}`;
            const r = await getJson(`/api/campaigns${qs}`);
            if (!r.ok) return { error: `campaigns fetch failed (${r.status})`, data: r.data };
            return r.data;
          },
        }),

        getMyLeads: tool({
          description:
            "Pull the user's recent leads (name, email, company, status, source, created date). Use when the user asks about their leads, lead quality, or sales pipeline.",
          inputSchema: z.object({
            status: z
              .string()
              .default("ALL")
              .describe("Lead status: NEW, CONTACTED, QUALIFIED, CONVERTED, LOST, or ALL. Default ALL."),
          }),
          execute: async ({ status }) => {
            const qs = status && status !== "ALL" ? `?status=${encodeURIComponent(status)}` : "";
            const r = await getJson(`/api/leads${qs}`);
            if (!r.ok) return { error: `leads fetch failed (${r.status})`, data: r.data };
            return r.data;
          },
        }),

        getMyRecommendations: tool({
          description:
            "Pull the AI-generated optimization recommendations for the user's account. Use when the user asks 'what should I improve' or 'what do you recommend I do next'.",
          inputSchema: z.object({}),
          execute: async () => {
            const r = await getJson(`/api/ai/recommendations`);
            if (!r.ok) return { error: `recommendations fetch failed (${r.status})`, data: r.data };
            return r.data;
          },
        }),

        askUser: tool({
          description:
            "Ask the user 1-2 questions when you genuinely need input — never write questions as plain text. Derive each question from what the user's message is missing (audience, geography, budget, conversion action, offer, urgency, competitive context, etc.). Each question gets 2-5 options tailored to the user's business; mark exactly one option as recommended:true only if you have a clear pick based on the brand context. If you can infer the answer from context or brand profile, do NOT ask — move on.",
          inputSchema: questionSchema,
        }),

        previewExecution: tool({
          description:
            "Show the user an Execution Plan card when the work involves 3+ steps (research, build, launch). Skip for simple asks like 'write me 5 headlines' or 'what's my ROAS'. The card lists 2-7 upcoming activities SPECIFIC to this campaign. Derive activity labels from the actual work (e.g. for a B2B SaaS lead-gen campaign: 'Analyzing your B2B SaaS competitors', 'Building keyword lists for enterprise buyers', 'Drafting your direct response copy'). The card has a 'Proceed with plan' button and a 10s auto-proceed countdown. The model only continues after the user clicks Proceed or the countdown fires.",
          inputSchema: z.object({
            title: z.string().describe("Short plan title specific to the campaign, e.g. the campaign's objective plus channel"),
            summary: z.string().describe("One-line summary specific to what this run will produce"),
            steps: z
              .array(
                z.object({
                  activity: z.string().describe("Activity label specific to this campaign. Derive from the work being done — do not copy a fixed template."),
                  description: z.string().describe("One-line description of what this step produces."),
                  agentRole: z
                    .string()
                    .optional()
                    .describe("When this step runs in parallel with one or more siblings, give the role a short, human-readable name (e.g. 'Performance Marketer', 'Creative Director', 'Researcher'). The UI groups parallel steps under a 'N agents working on this' card."),
                  isParallel: z
                    .boolean()
                    .optional()
                    .describe("Set to true when this step runs at the same time as another step. All steps with isParallel=true are rendered together as a single 'N agents in parallel' group."),
                }),
              )
              .min(2)
              .max(7)
              .describe("2-7 upcoming activities. Mark steps that run at the same time as siblings with isParallel=true and a distinct agentRole."),
          }),
          execute: async (input) => ({ proceed: false, ...input }),
        }),

        proposePlan: tool({
          description:
            "Deliver the comprehensive Campaign Strategy Document in Markdown for user review and approval before generating campaign assets.",
          inputSchema: z.object({
            title: z.string().describe("Campaign strategy title, e.g. 'Markitxai Enterprise AI Lead-Gen Strategy'"),
            summary: z.string().describe("Executive summary of campaign approach and core objective"),
            platform: z.enum(["GOOGLE"]).describe("Target ad network platform. Growzzy currently supports Google Ads only (Search + Display image formats)."),
            targetAudience: z.string().describe("Primary ICP role & company profile"),
            budgetRecommendation: z.string().optional().describe("Recommended daily/monthly budget with allocation. OPTIONAL — if the user hasn't told you a budget, leave this blank and ask them for it before launching. Do NOT invent a number."),
            markdownPlan: z.string().describe("EXECUTION BLUEPRINT — the user's build sheet for Google Ads Manager. Structure the document to match the campaign type (Search RSA, Display image ad, etc.) — do not force the same 7 sections for every campaign. Use Setting|Value|Why markdown tables (with proper |---| separator rows) and bold **CRITICAL:** callouts where they matter. End with **Go Live.** Every Setting|Value|Why table MUST have a |---| separator row with one cell per column. End the document with a bold 'Go Live.' sign-off on its own line."),
            steps: z.array(
              z.object({
                title: z.string().describe("Execution milestone title"),
                detail: z.string().describe("Milestone scope and deliverables"),
                isParallel: z.boolean().optional(),
              }),
            ),
          }),
          execute: async (input) => {
            // Server-side quality gate: reject any strategy document that
            // contains banned filler phrases in the prose. The model gets
            // auto-corrected in the same turn.
            const issues: string[] = [];
            const md = String(input.markdownPlan || "").toLowerCase();
            const mdRaw = String(input.markdownPlan || "");

            // 1. Exact banned phrase matches (with industry allowlist)
            const userIndustry = (input as { targetAudience?: string }).targetAudience || null
            for (const phrase of BANNED_FILLER_PHRASES) {
              if (md.includes(phrase) && !isPhraseAllowedForIndustry(phrase, userIndustry)) {
                issues.push(`BANNED PHRASE "${phrase}" found in strategy. Rewrite with specific numbers, named mechanisms, or quantified outcomes.`);
                break;
              }
            }

            // 2. Semantic banned phrases — common rephrasings of banned copy
            const SEMANTIC_BANS = [
              { pattern: /\b(seamless|flawless|smooth)\s+(experience|integration|solution|process)\b/i, label: "seamless/flawless experience" },
              { pattern: /\b(comprehensive|holistic|all-in-one|end-to-end)\s+(approach|solution|platform)\b/i, label: "comprehensive/holistic approach" },
              { pattern: /\b(state-of-the-art|cutting-edge|next-gen|next generation)\s+(technology|platform|solution)\b/i, label: "state-of-the-art" },
              { pattern: /\b(world-class|best-in-class|industry-leading|industry-standard)\s+/i, label: "world-class" },
              { pattern: /\b(revolutionary|game-chang(?:ing|er)|disrupt(?:ing|ive))\s+/i, label: "revolutionary" },
              { pattern: /\btransform(?:s|ing)?\s+(your|business|enterprise)/i, label: "transform your business" },
              { pattern: /\b(empower|enable|unlock)\s+(your|team|business)/i, label: "empower your team" },
              { pattern: /\b(optimize|maximise|maximize)\s+(your|efficiency)/i, label: "optimize/maximize efficiency" },
              { pattern: /\bdrive\s+(growth|results|value|success)/i, label: "drive growth" },
              { pattern: /\b(reduce|slash|cut)\s+cost/i, label: "reduce costs" },
              { pattern: /\b(leverage|utilise|utilize)\s+ai\b/i, label: "leverage AI" },
              { pattern: /\b(ai-powered|ai-driven|ai-enabled)\s+(solution|platform)/i, label: "AI-powered solution" },
            ];
            for (const ban of SEMANTIC_BANS) {
              if (ban.pattern.test(mdRaw)) {
                issues.push(`Generic filler "${ban.label}" found. Replace with a specific, quantified angle (e.g., "Cut 4-Hour Audit Cycles", "60% Fewer Pipeline Failures", "Ship in 48 Hours").`);
                break;
              }
            }

            // 3. Bolded generic-opener creative angles (headlines/angles shown in bold)
            const BOLDED_GENERIC = /\*{2}(unlock|unleash|elevate|maximize|boost|enhance|streamline|transform(?:ative)?|empower|revolutionize|revitalize|seamless|discover|explore|introducing|holistic|world-class|comprehensive|seamless)\b[^*]*\*{2}/i;
            if (BOLDED_GENERIC.test(mdRaw)) {
              issues.push(`Strategy bolded generic creative angles (e.g. "**Transformative Efficiency**"). Replace with specific, quantified angles.`);
            }

            // 4. Check that any https?:// URL exists in the strategy. We
            //    intentionally do NOT require it to be glued to a label
            //    like "Final URL:" — the model writes URLs in many phrasings
            //    ("Landing Page URL: Ensure https://x is set", "Final URL:
            //    https://x", "URL: https://x", "…goes to https://x"). The
            //    earlier regex required label + colon + URL on the same line
            //    and rejected valid strategies. Match any URL anywhere in
            //    the doc instead.
            const LANDING_URL = /https?:\/\/[^\s)<>\]]+/i;
            if (!LANDING_URL.test(mdRaw) && md.length > 500) {
              issues.push(`No landing page URL found in the strategy. Include a specific https://... destination URL anywhere in the document (e.g. "Final URL: https://example.com" or "Landing Page: https://example.com/contact").`);
            }

            // 5. Markdown table structural check — every "| a | b | c |" header
            //    row must be followed by a "|---|---|---|" separator row before
            //    the next data row. A missing separator makes GFM render the
            //    table as plain inline text (the "fuck" output).
            const lines = mdRaw.split(/\r?\n/);
            for (let i = 0; i < lines.length - 1; i += 1) {
              const headerLine = lines[i].trim();
              const nextLine = lines[i + 1].trim();
              if (/^\s*\|.+\|\s*$/.test(headerLine) && !/^\s*\|.+\|\s*$/.test(nextLine) && !/^\s*\|[\s\-:|]+\|\s*$/.test(nextLine)) {
                issues.push(`Malformed markdown table on line ${i + 1}: a table header row "${headerLine.slice(0, 60)}…" must be followed by a separator row like "|---|---|---|". Without it, the entire table renders as plain text. Re-emit the table with the separator row.`);
                break;
              }
            }

            // 6. Setting|Value|Why completeness — the blueprint requires every
            //    settings table to have all three columns. Catch the common
            //    omission where the model writes "| Setting | Value |" (2 cols)
            //    or "| Setting | Value | Why |" but the data rows have only 2
            //    cells.
            const tableBlocks = mdRaw.split(/\n\n+/);
            for (const block of tableBlocks) {
              const blockLines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
              if (blockLines.length < 2) continue;
              const headerCells = (blockLines[0].match(/\|/g) || []).length - 1;
              if (headerCells < 3) continue;
              for (let j = 1; j < blockLines.length; j += 1) {
                const line = blockLines[j];
                if (/^\s*\|[\s\-:|]+\|\s*$/.test(line)) continue;
                const cells = (line.match(/\|/g) || []).length - 1;
                if (cells !== headerCells) {
                  issues.push(`Malformed table: header row has ${headerCells} columns but a data row has ${cells} columns. Every data row must match the header column count.`);
                  break;
                }
              }
              if (issues.length > 0 && issues[issues.length - 1].startsWith("Malformed table")) break;
            }

            // 7. End the document with the Go Live sign-off (only for full
            //    strategy docs, not short briefs). Soft warning, not a block.
            if (md.length > 1500 && !/go\s+live\.?/i.test(mdRaw.slice(-200))) {
              issues.push(`Long strategy docs benefit from ending with a "Go Live." sign-off, but this is optional for shorter briefs.`);
            }

            // Soft quality gate: surface issues as warnings, not rejections.
            // The user can choose to revise or proceed. Only HARD blocks are
            // the markdown table separator (renders as plain text otherwise)
            // and a missing landing URL when one is required for launch.
            const hardIssues = issues.filter((i) =>
              i.startsWith("Malformed markdown table") ||
              i.startsWith("No landing page URL"),
            )
            const warnings = issues.filter((i) => !hardIssues.includes(i))

            if (hardIssues.length > 0) {
              return {
                approved: false,
                qualityIssues: hardIssues,
                warnings,
                retryGuidance:
                  "Fix the table structure and add a landing page URL. " +
                  "Banned phrases and bolded generic angles are now warnings — the user can override.",
              };
            }
            return {
              approved: true,
              title: input.title,
              warnings: warnings.length > 0 ? warnings : undefined,
            };
          },
        }),

        generateCreative: tool({
          description: "Generate high-converting ad creative visual mockups for Meta/Display campaigns.",
          inputSchema: z.object({
            prompt: z.string().describe("Detailed art-direction prompt for the ad visual (subject, style, lighting, composition, colors - no text)"),
            caption: z.string().describe("Short label for the creative, e.g. 'Enterprise Automation Visual'"),
          }),
          toModelOutput: (output) => ({
            type: "text" as const,
            value: (output as { imageUrl?: string | null }).imageUrl
              ? "Ad creative generated and displayed to the user."
              : "Creative visual ready.",
          }),
          execute: async ({ prompt, caption }) => {
            const { url, error } = await generateAdImage(apiKey, prompt, req.signal);
            return {
              caption,
              imageUrl: url || null,
              error: error,
            };
          },
        }),

        deliverCampaign: tool({
          description: "Deliver the complete, launch-ready campaign package. Platform is locked to GOOGLE (Search RSA text-only OR Display/Discovery image ad).",
          inputSchema: z.object({
            name: z.string().min(1).max(120),
            platform: z.literal("GOOGLE").describe("Always 'GOOGLE' — Growzzy only ships to Google Ads. Use 15 RSA headlines + 4 descriptions for Search, or 1 short headline + 1 description for a Display/Discovery image ad."),
            objective: z.string().min(1).max(40),
            budgetDaily: z.number().min(1).max(100000).optional().describe("Daily budget. Ask the user via askUser if not provided — do NOT invent a number."),
            currency: z.string().min(1).max(8).default("USD"),
            bidding: z.string().optional().describe("Bidding strategy. Default to MAXIMIZE_CONVERSIONS if not specified."),
            schedule: z.string().optional(),
            landingPage: z.string().url("Must be a valid https:// URL").describe("Required — ad will be rejected at launch without a destination URL."),
            offer: z.string().optional(),
            targetAudience: z.string().optional(),
            headlines: z
              .array(z.string().min(1).max(30))
              .min(10).max(15)
              .describe("10-15 headlines, each <= 30 chars for Google Search"),
            headlineStrategy: z.string().optional(),
            primaryText: z.string().min(40).describe("Hook -> Agitation -> Mechanism & Proof -> CTA"),
            cta: z.string().min(1).max(25).describe("High-converting CTA button label"),
            ctaAlternative: z.string().optional(),
            targeting: z.array(z.object({ setting: z.string(), value: z.string() })).optional().default([]),
            exclusions: z.array(z.string()).optional().default([]),
            sitelinks: z.array(z.object({ title: z.string().min(1).max(25), description: z.string().min(1).max(35) })).optional(),
            keyCaveat: z.string().optional(),
            creativeNotes: z.string().optional(),
            variantOptions: z.array(z.string()).optional(),
            keywords: z.array(z.string()).optional().default([]),
            descriptions: z
              .array(z.string().min(1).max(90))
              .min(3).max(4)
              .describe("3-4 descriptions, each <= 90 chars"),
            kpis: z.array(z.object({ metric: z.string(), target: z.string() })).optional(),
            risks: z.array(z.string()).optional(),
          }),
          execute: async (input) => {
            // Server-side quality gate — surface issues as warnings, not hard
            // blocks. The user can choose to revise or proceed. Only HARD
            // blocks are missing required fields (landingPage, budget when
            // provided, char limits that Google Ads will actually reject).
            const allIssues = validateDeliverCampaignInput(input as Record<string, unknown>);
            const hardIssues = allIssues.filter((i) =>
              i.startsWith("Landing page URL is required") ||
              i.startsWith("Landing page must be a valid") ||
              i.startsWith("HEADLINE") && i.includes("chars") ||
              i.startsWith("DESCRIPTION") && i.includes("chars"),
            );
            const warnings = allIssues.filter((i) => !hardIssues.includes(i));

            if (hardIssues.length > 0) {
              return {
                delivered: false,
                qualityIssues: hardIssues,
                warnings,
                retryGuidance:
                  "Fix the required fields above (landing URL, char limits). " +
                  "Banned phrases and headline overlap are now warnings — the user can override.",
              };
            }
            return {
              delivered: true,
              name: input.name,
              warnings: warnings.length > 0 ? warnings : undefined,
            };
          },
        }),

        connectIntegrationPrompt: tool({
          description:
            "Show an inline connect/skip card in the chat when the user asks to publish to a network they haven't connected yet (e.g. they ask to ship to Meta Ads but no MetaIntegration is linked). The card has a 'Connect' button and a 'Skip' button. Use this BEFORE deliverCampaign when the user requests a platform that isn't yet connected.",
          inputSchema: z.object({
            platform: z.enum(["META", "GOOGLE", "TIKTOK", "LINKEDIN"]).describe("Ad network the user is trying to use"),
            reason: z.string().describe("Why this card is being shown, e.g. 'You asked to publish to Meta but it's not connected yet.'"),
            missingCapabilities: z.array(z.string()).optional().describe("What the integration will unlock (e.g. ['publish campaigns', 'sync metrics'])"),
          }),
          execute: async (input) => input,
        }),
      },
    });

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      onError: (error) => {
        const err = error as { statusCode?: number; message?: string; responseBody?: string };
        const status = err?.statusCode;
        if (status === 402)
          return "Your workspace is out of AI credits. Add credits and retry.";
        if (status === 403)
          return "AI access is blocked by a workspace limit or policy.";
        if (status === 429) return "Rate limited — wait a few seconds and retry.";
        if (status === 529) return "AI provider is overloaded. Retry in a moment.";
        console.error("[growzzy] chat error", status, err?.message);
        return "Growzzy hit an unexpected error. Please try again or simplify your request.";
      },
    });
  } catch (error: any) {
    console.error("Agent chat route error:", error);
    return new Response(error?.message || "Failed to process chat", { status: 500 });
  }
}
