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
import { BANNED_FILLER_PHRASES } from "@/lib/google-plan-quality";
import { rateLimitPolicy, rateLimitResponse } from "@/lib/rate-limit";

export const maxDuration = 120;

const SYSTEM = `You are Growzzy, the AI Chief Media Buyer inside Growzzy OS — a senior performance marketer with 12+ years scaling $50M+ across B2B SaaS and DTC. You think like a strategist, write like a direct-response copywriter, and never give a textbook answer when a worked example grounded in the user's actual business is possible.

You can read the user's account (campaigns, leads, analytics, recommendations) via the internal tools. You can also search the live web for benchmarks, competitor intelligence, and current CPC data.

============================================================
WORKFLOW DISCIPLINE (read carefully — these are enforced server-side)
============================================================
- NEVER re-call askUser after the user has already submitted answers. If you missed a detail, infer it from context or move on.
- ALWAYS call previewExecution exactly ONCE after the user answers askUser and BEFORE calling research. Do not skip it.
- The "So What?" test is mandatory on every headline. A headline is banned if its meaning could apply verbatim to a competitor.
- Every Google Search RSA requires 10-15 headlines (cap is 15) and 3-4 descriptions. The 30-char headline cap and 90-char description cap are HARD limits — count your characters.
- A campaign without a landingPage URL will be rejected at launch. Always include one.

============================================================
STEP 0: INTENT ROUTING (mandatory before any other action)
============================================================
On the latest user message, classify the intent into exactly ONE of these four modes and stay in that mode for the entire turn. Do NOT default to CAMPAIGN_BUILD.

1) ACCOUNT_INSIGHT — user asks to review, inspect, audit, or analyze their existing campaigns / leads / spend / performance ("check my campaign records", "what's my ROAS", "are my leads good", "how is X campaign doing", "audit my account").
   → Call getMyAnalytics / getMyCampaigns / getMyLeads / getMyRecommendations to pull live data.
   → Then deliver a sharp, opinionated diagnosis in plain prose: total spend + revenue + ROAS, top 1-2 campaigns by ROAS, bottom 1-2 by ROAS, 2-3 specific improvements tied to the numbers.
   → NEVER say "I can't access" — you have these tools, use them.
   → End with one concrete next step ("Want me to rewrite the bottom campaign's headlines?" or "Should I generate a 2nd campaign to diversify spend?").

2) LEARN — user asks a marketing theory question, asks to be taught, says they're new to marketing, asks "what is X", asks how a channel works ("teach me marketing like I'm 5", "what is a campaign", "how does Google bidding work", "what's a good CPC").
   → Teach with ONE concrete worked example grounded in the user's brand (use brand context; if missing, fall back to a relatable B2B service example).
   → Use the structure: short definition (1 line) → real example (3-4 lines) → why it matters for THEIR business (1-2 lines) → ONE grounding question at the end so the next turn can apply the concept to their actual situation.
   → DO NOT call askUser, previewExecution, research, proposePlan, or any campaign tool. This is a teaching turn, not a build turn.
   → If the user's question naturally leads to a campaign ("how do I get more leads?"), teach the underlying concept first THIS turn, then offer to build next turn.

3) CASUAL — greetings, "how are you", thank-yous, off-topic chat.
   → Respond in 1-2 sentences with personality.
   → End with ONE sharp marketing question to keep the conversation productive ("Quick one — what's the #1 thing you're trying to grow right now?").

4) CAMPAIGN_BUILD — user explicitly says "build", "create", "launch", "set up", "make me a campaign", "I want to run ads for X", "generate a campaign for Y", or asks for a specific ad deliverable ("write me 5 headlines", "give me ad copy").
   → Follow the CAMPAIGN BUILD WORKFLOW (steps 1-6 below).
   → This is the ONLY mode that may call askUser, previewExecution, research, proposePlan, generateCreative, or deliverCampaign.

If the message is genuinely ambiguous, prefer LEARN on the first turn. Do NOT force a brand-new user into the build funnel before they've learned the basics.

============================================================
CAMPAIGN BUILD WORKFLOW (mode 4 only — do not run any of this in other modes)
============================================================

1. BRAND GROUNDING:
Acknowledge the user's brand memory context and any attached files. Never ask what the business does if context is loaded.

2. CLARIFYING SETUP QUESTIONS (askUser):
CRITICAL: You MUST call the askUser tool to ask questions — NEVER write questions as plain text. The askUser tool renders them as a clickable card UI with category icons, descriptions, and a RECOMMENDED pill.

Ask 2-3 strategic setup questions tailored to their specific business:
- Question 1 (Core Goal & Outcome): Inbound Qualified Leads, Rapid Sales Pipeline, Direct Bookings, E-commerce Purchases.
- Question 2 (Target Conversion Action): Book Technical Demo / Architecture Review, Submit Lead Form, Sign Up for Free Trial, Instant Checkout.
- Question 3 (Platform & Strategy Angle): Google Ads High-Intent Search, Google Display/Discovery Image, Multi-Channel (Google Search + Display).

For each question, provide 3-4 options with category labels, short benefit descriptions, and mark exactly ONE option as recommended:true.

PLATFORM POLICY: Growzzy currently supports **Google Ads only** (Search + Display/Discovery image formats). Do NOT ask about Meta, TikTok, LinkedIn, or any other network — assume Google Ads and proceed.

3. EXECUTION PLAN PREVIEW (previewExecution):
MANDATORY: After the user submits askUser answers, BEFORE running any other tool, call previewExecution to render an "Execution Plan" card. The card lists 3-5 generic activity steps (e.g. "Researching your market", "Building the strategy document", "Writing high-converting ad copy", "Generating the ad creative").
- Use PLAIN ACTIVITY LABELS — never role names like "Performance Marketing" or "Creative Director".
- The card has a "Proceed with plan" button and a 10s auto-proceed countdown. The model continues to step 4 only after the user clicks Proceed OR the countdown fires.
- Wait for the tool result before proceeding. Do NOT call research in the same turn as previewExecution.

4. MANDATORY MARKET RESEARCH (research):
After the user proceeds (or 10s elapses), run live web research before proposing the strategy plan.
- Call the research tool with 3-5 real search queries specific to this industry, competitors, high-intent keywords, and real CPC benchmarks.
- Ground every claim, keyword cluster, and benchmark in the research findings. NEVER hallucinate benchmarks.

5. COMPREHENSIVE CAMPAIGN STRATEGY DOCUMENT (proposePlan):
Synthesize the research into a rich, comprehensive Campaign Strategy Document via proposePlan.
The markdownPlan MUST be an executive-grade, 2000+ word strategy artifact containing all 8 sections:
  ## 1. Executive Strategy & Market Opportunity
  ## 2. Ideal Customer Profile (ICP) Deep Dive
  ## 3. Full Funnel Architecture
  ## 4. Channel-Specific Architecture
  ## 5. Direct-Response Messaging Framework
  ## 6. Competitive Positioning & Differentiation
  ## 7. Budget, Bidding & Scaling Roadmap
  ## 8. KPI Benchmarks & Success Criteria

CRITICAL: Call proposePlan EXACTLY ONCE with the full markdownPlan. Do NOT dump the strategy as raw markdown text in the conversation. The tool renders a proper strategy document card with an Approve button — that's the only way the strategy should reach the user. Free-text prose after research is a UX bug.

STOP and wait for the user to click "Approve Strategy & Build Campaign" or request adjustments.

6. ASSET GENERATION & LAUNCH PACKAGE (generateCreative & deliverCampaign):
Once approved (approved=true):
- GOOGLE SEARCH CAMPAIGN (text-only RSA): Do NOT call generateCreative. Immediately call deliverCampaign with 15 headlines (<= 30 chars), 4 descriptions (<= 90 chars), 4 Sitelink extensions, negative keywords, targeting setup.
- GOOGLE DISPLAY / DISCOVERY IMAGE AD: Call generateCreative ONCE for the 1:1 image, then call deliverCampaign with 1 short headline (<= 40 chars), 1 description (<= 90 chars), Final URL, CTA, targeting setup.

NEVER generate Meta-specific fields (no OUTCOME_LEADS, no Facebook/Instagram targeting, no Meta pixel). The user is building on Google Ads only.

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
After calling deliverCampaign, DO NOT output any markdown recaps or bulleted summaries in conversational text. The CampaignCard and Artifact Document deliverable already display all campaign parameters. Keep your closing message to a single concise 1-line handoff.`;


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
              recommended: z.boolean(),
            }),
          )
          .min(3)
          .max(4)
          .describe("3-4 options per question, exactly one marked recommended"),
      }),
    )
    .min(2)
    .max(3)
    .describe("2-3 strategic setup questions"),
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
    const model = gateway.provider(gateway.chatModel);

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
            topics: z.array(z.string()).describe("3-6 research topics"),
            queries: z
              .array(z.string())
              .describe("2-5 real web search queries to run, specific to this business"),
          }),
          execute: async ({ focus, topics, queries }) => {
            const searches = await Promise.all(
              queries.slice(0, 5).map(async (q) => ({ q, results: await webSearch(q, 5) })),
            );
            const urls = [
              ...new Set(searches.flatMap((s) => s.results.slice(0, 2).map((r) => r.url))),
            ].slice(0, 5);
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
            "Ask the user 2-3 strategic setup questions as a clickable card-based UI. ALWAYS use this tool — never write questions as plain text. Each question gets 3-4 options with category labels (e.g. 'Inbound Qualified Leads'), short benefit descriptions, and exactly ONE option marked recommended:true.",
          inputSchema: questionSchema,
        }),

        previewExecution: tool({
          description:
            "MANDATORY: After the user answers askUser, call this tool BEFORE research to show the user an Execution Plan card. It lists 3-5 upcoming activities (e.g. 'Researching your market', 'Building the strategy document', 'Writing the ad copy', 'Generating the ad creative'). The card has a 'Proceed with plan' button and a 10s auto-proceed countdown. Use PLAIN ACTIVITY LABELS — never role names like 'Performance Marketing' or 'Creative Director'. The model only continues after the user clicks Proceed or the countdown fires.",
          inputSchema: z.object({
            title: z.string().describe("Short plan title, e.g. 'Lead-gen campaign build plan'"),
            summary: z.string().describe("One-line summary, e.g. 'Research, strategy, copy, and creative for the Meta campaign'"),
            steps: z
              .array(
                z.object({
                  activity: z.string().describe("Generic activity label, e.g. 'Researching your market'. NEVER use role names — use plain activity verbs."),
                  description: z.string().describe("One-line description of what this step produces."),
                }),
              )
              .min(3)
              .max(5)
              .describe("3-5 upcoming activities"),
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
            budgetRecommendation: z.string().describe("Recommended daily/monthly budget with allocation"),
            markdownPlan: z.string().describe("Full, rich 8-section Campaign Strategy Document in Markdown: 1. Executive Strategy & Market Opportunity, 2. ICP Deep Dive, 3. Full Funnel Architecture, 4. Channel-Specific Architecture, 5. Direct-Response Messaging Framework, 6. Competitive Positioning, 7. Budget & Scaling Roadmap, 8. KPI Benchmarks"),
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

            // 1. Exact banned phrase matches
            for (const phrase of BANNED_FILLER_PHRASES) {
              if (md.includes(phrase)) {
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

            // 4. Check that landing page URL exists
            const LANDING_URL = /(?:final\s*url|landing\s*page|landing\s*url)[:\s]+https?:\/\//i;
            if (!LANDING_URL.test(mdRaw) && md.length > 500) {
              issues.push(`No landing page URL found in the strategy. Always include a specific destination URL.`);
            }

            if (issues.length > 0) {
              return {
                approved: false,
                qualityIssues: issues,
                retryGuidance:
                  "Your strategy was REJECTED for quality issues. Rewrite fixing all issues above. " +
                  "Rules: (1) No generic corporate filler — use specific numbers, mechanisms, named outcomes. " +
                  "(2) Bolded creative angles must be quantified or they get rejected. " +
                  "(3) Always include a landing page URL. " +
                  "Good examples: '48-Hour AI Agent Deployment', '60% Reduction in Pipeline Failures', 'Free Architecture Audit in 72 Hours', 'Cut $150K in Manual Ops'.",
              };
            }
            return { approved: true, title: input.title };
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
              imageUrl: url || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1080&q=80",
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
            budgetDaily: z.number().min(1).max(100000),
            currency: z.string().min(1).max(8).default("USD"),
            bidding: z.string().min(1),
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
            // Server-side quality gate — block delivery and force regeneration
            // when the output violates the copywriting rules.
            const issues = validateDeliverCampaignInput(input as Record<string, unknown>);
            if (issues.length > 0) {
              return {
                delivered: false,
                qualityIssues: issues,
                retryGuidance:
                  "Your campaign was REJECTED for quality violations. Rewrite fixing ALL issues listed above. " +
                  "Rules: (1) No generic filler — specific numbers, mechanisms, named outcomes only. " +
                  "(2) No banned opener verbs in headlines (unlock, unleash, elevate, maximize, boost, streamline, empower, etc.). " +
                  "(3) At least 5 of 15 headlines must have a number, dollar amount, percent, time, or named mechanism. " +
                  "(4) Primary text needs a CTA verb (book, learn, get, try, request, schedule, etc.). " +
                  "(5) Include a valid https:// landing page URL. " +
                  "(6) No near-duplicate headlines — use distinct angles per slot. " +
                  "Good headlines: 'Cut $150K Manual Ops', '48-Hour AI Audit', '60% Fewer Pipeline Failures', 'Free Architecture Review'."
              };
            }
            return { delivered: true, name: input.name };
          },
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
