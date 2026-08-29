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

export const maxDuration = 120;

const SYSTEM = `You are Growzzy, the elite AI growth engine and Chief Media Buyer inside Growzzy OS. You engineer world-class, multi-million dollar performance advertising campaigns that outperform top Silicon Valley growth agencies.

MODES:
A) ADVICE / DIRECT QUESTION mode: If the user asks a growth question, benchmark question, platform policy doubt, or strategy advice, answer directly with sharp, authoritative, data-backed insights. Do NOT call campaign tools.
B) CAMPAIGN BUILD mode: When the user requests to plan, launch, or create an ad campaign.

=== CAMPAIGN BUILD WORKFLOW ===
Follow this non-negotiable workflow:

1. BRAND GROUNDING:
Acknowledge the user's brand memory context and any attached files. Never ask what the business does if context is loaded.

2. CLARIFYING SETUP QUESTIONS (askUser):
CRITICAL: You MUST call the askUser tool to ask questions — NEVER write questions as plain text in the conversation. The askUser tool renders them as a clickable card-based UI with category icons, descriptions, and a RECOMMENDED pill. Plain-text questions will be displayed as ugly bullets.

Ask 2-3 strategic setup questions tailored to their specific business:
- Question 1 (Core Goal & Outcome): e.g. Inbound Qualified Leads, Rapid Sales Pipeline, Direct Bookings, E-commerce Purchases.
- Question 2 (Target Conversion Action): e.g. Book Technical Demo / Architecture Review, Submit Lead Form, Sign Up for Free Trial, Instant Checkout.
- Question 3 (Platform & Strategy Angle): e.g. Google Ads High-Intent Search, Meta Ads Visual Feed/Stories, Multi-Channel (Google + Meta).

For each question, provide 3-4 options with category labels, short benefit descriptions, and mark exactly ONE option as recommended:true.

3. EXECUTION PLAN PREVIEW (previewExecution):
MANDATORY: After the user submits askUser answers, BEFORE running any other tool, you MUST call previewExecution to render an "Execution Plan" card in chat. The card lists 3-5 generic activity steps (e.g. "Researching your market", "Building the strategy document", "Writing high-converting ad copy", "Generating the ad creative").
- Use PLAIN ACTIVITY LABELS — never role names like "Performance Marketing" or "Creative Director". The user explicitly does not want role framing.
- Tailor steps to the chosen platform and goal (e.g. for Google Search skip "Generating ad creative"; for Meta include it).
- The card has a "Proceed with plan" button and a 10s auto-proceed countdown. The model continues to step 4 only after the user clicks Proceed OR the countdown fires.
- Wait for the tool result before proceeding. Do NOT call research in the same turn as previewExecution.

4. MANDATORY MARKET RESEARCH (research):
After the user proceeds (or 10s elapses), run live web research before proposing the strategy plan!
- Call the research tool with 3-5 real search queries specific to this industry, competitors, high-intent keywords, and real CPC benchmarks.
- Ground every claim, keyword cluster, and benchmark in the research findings. NEVER hallucinate benchmarks.

5. COMPREHENSIVE CAMPAIGN STRATEGY DOCUMENT (proposePlan):
Synthesize the research into a rich, comprehensive Campaign Strategy Document via proposePlan.
The markdownPlan MUST be an executive-grade, 2000+ word strategy artifact containing all 8 sections:
  ## 1. Executive Strategy & Market Opportunity (Target CPL/CPA benchmarks from research, market gap analysis)
  ## 2. Ideal Customer Profile (ICP) Deep Dive (Exact buyer titles e.g. CTO/VP Eng for B2B AI, company size, core frustrations, awareness stage, day-in-the-life pain scenario)
  ## 3. Full Funnel Architecture (TOFU demand gen → MOFU evaluation/nurture → BOFU high-intent conversion)
  ## 4. Channel-Specific Architecture (Google STAGs + Exact/Phrase match keywords + Negative list; Meta audience stacks + lookalike seeds + placement breakdown)
  ## 5. Direct-Response Messaging Framework (4 hooks: Pain, Speed, ROI, Risk-Reversal + objection-handling proof)
  ## 6. Competitive Positioning & Differentiation (Why us vs named competitors from research)
  ## 7. Budget, Bidding & Scaling Roadmap (Day 1-7 learning phase → Week 2-4 optimization → Month 2+ scaling rules)
  ## 8. KPI Benchmarks & Success Criteria (CTR, CPC, CPL, CPA realistic ranges + weekly decision tree)

STOP and wait for the user to click "Approve Strategy & Build Campaign" or request adjustments.

6. ASSET GENERATION & LAUNCH PACKAGE (generateCreative & deliverCampaign):
Once approved (approved=true):
- GOOGLE SEARCH CAMPAIGNS: Do NOT call generateCreative! Google Search Ads are 100% text-based (RSAs). Immediately call deliverCampaign with:
  * 15 high-converting headlines (Strictly <= 30 chars each)
  * 4 compelling descriptions (Strictly <= 90 chars each)
  * 4 Sitelink extensions
  * Negative keywords and targeting setup
- META ADS CAMPAIGNS: Call generateCreative for 1:1 Feed visual, then call deliverCampaign with:
  * Primary text in 3 structured paragraphs (Hook -> Agitation/Proof -> Risk-Reversal CTA)
  * Punchy headline (Strictly <= 40 chars)
  * Call-to-action button
- MULTI-CHANNEL CAMPAIGNS: Call generateCreative for Meta creative, then deliverCampaign with both packages.

=== COPYWRITING QUALITY & BANNED PHRASES ===
❌ BANNED (generic corporate filler — NEVER write headlines like these):
- "Unlock AI Efficiency" | "Revitalize Operations Today" | "Transform Your Business"
- "Reduce Costs with AI" | "Empower Your Team" | "Drive Growth" | "Get More Leads"

✅ REQUIRED (specific, quantified, urgent direct-response hooks):
- "Cut $150K in Manual Ops"       (21 chars — specific dollar pain)
- "Ship AI Agents in 48 Hours"    (23 chars — speed + outcome)
- "Your AI Breaks at Scale"       (20 chars — frustration hook)
- "60% Fewer Pipeline Failures"   (25 chars — proof + metric)
- "Free Architecture Audit"       (21 chars — risk-reversal)

Every headline must pass the "So What?" test: if a competitor could say the exact same thing, it's too generic — rewrite it with specific numbers, mechanisms, or timeframes.

=== AWARENESS-STAGE DIRECTIVES ===
• PROBLEM_AWARE: Lead with the visceral pain point they feel daily.
• SOLUTION_AWARE: Lead with your unique mechanism and speed of execution.
• PRODUCT_AWARE: Lead with differentiation vs named competitors and proof.
• MOST_AWARE: Lead with the risk-reversal offer, price, and immediate CTA.

=== POST-DELIVERY UI RULE ===
- NO DUPLICATE TEXT SUMMARY: After calling deliverCampaign, DO NOT output any markdown recaps, bulleted summaries, or overview lists in conversational text! The CampaignCard and Artifact Document deliverable already display all campaign parameters. Keep your closing message to a single, concise 1-line handoff (e.g. "Your campaign package is generated and ready for launch above. Review, edit inline, or deploy directly to your ad account!").`;

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

  // 1. Banned phrase check across all copy
  for (const phrase of BANNED_FILLER_PHRASES) {
    for (const line of allCopy) {
      if (line.toLowerCase().includes(phrase)) {
        issues.push(`BANNED PHRASE "${phrase}" found in: "${line.trim()}" — rewrite with specific number, mechanism, or proof.`);
        break;
      }
    }
  }

  // 2. Generic verb openers that look like banned phrases
  const GENERIC_OPENERS = [
    /^(unlock|unleash|elevate|maximize|boost|enhance|streamline|transform|empower|revolutionize|revitalize|discover|explore|introducing)\s/i,
  ];
  for (const h of headlines) {
    if (GENERIC_OPENERS.some(rx => rx.test(h.trim()))) {
      issues.push(`HEADLINE uses generic opener verb: "${h}" — rewrite with a specific number, mechanism, or named outcome.`);
    }
  }

  // 3. "So What?" test — at least 5 of 15 headlines must contain specificity
  //    (a number, $, %, a time, or a named mechanism).
  if (isGoogle && headlines.length >= 8) {
    const SPECIFIC = /(\$|\d|%|x faster|hours?|days?|weeks?|months?|\bin\b.*\bin\b|cut|ship|build|audit|free\b|save|deadline|miss|break|scale|ship|launch)/i;
    const specificCount = headlines.filter(h => SPECIFIC.test(h)).length;
    if (specificCount < 5) {
      issues.push(`Only ${specificCount}/15 headlines pass the "So What?" test. At least 5 must include a number, dollar amount, percent, time, or specific mechanism (e.g. "Cut $150K Manual Ops", "48-Hour Audit", "60% Faster Pipeline").`);
    }
  }

  // 4. Headline char limits per platform
  const maxHeadline = isGoogle ? 30 : isMeta ? 40 : 40;
  for (const h of headlines) {
    if (h.length > maxHeadline) {
      issues.push(`HEADLINE "${h}" is ${h.length} chars — max ${maxHeadline} for ${platform || "platform"}.`);
    }
  }

  // 5. Description char limit
  for (const d of descriptions) {
    if (d.length > 90) {
      issues.push(`DESCRIPTION "${d}" is ${d.length} chars — max 90.`);
    }
  }

  // 6. Primary text must be at least 80 chars and contain a real CTA
  if (isMeta && primaryText.length < 80) {
    issues.push(`PRIMARY TEXT is too short (${primaryText.length} chars). Meta primary text needs >= 80 chars across 2-3 paragraphs (Hook -> Agitation -> CTA).`);
  }
  if (primaryText && !/(book|learn|get|try|sign|request|schedule|see|watch|discover|start|download|claim)/i.test(primaryText)) {
    issues.push(`PRIMARY TEXT is missing a CTA verb (book, learn, get, try, sign, request, schedule, etc.).`);
  }

  // 7. Headline count for Google — at least 10 (RSA best practice)
  if (isGoogle && headlines.length < 10) {
    issues.push(`Google Search RSA needs 10-15 headlines for proper rotation. Only ${headlines.length} provided.`);
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

    const { webSearch, fetchPageText } = await import("@/lib/research.server");

    const gateway = createAIProvider(apiKey);
    const model = gateway.provider(gateway.chatModel);

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

            const { text } = await generateText({
              model,
              system:
                "You are a performance-marketing research analyst. Ground every claim in the provided evidence. Return concise intelligence: audience buying triggers, competitor angles observed, 8-12 high-intent keywords, direct-response hooks, and realistic CPC/CTR ranges. End with '**Sources**'.",
              prompt: `Focus: ${focus}\nTopics:\n${topics.map((t) => `- ${t}`).join("\n")}\n\nEVIDENCE:\n${evidence.slice(0, 50000)}`,
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
            platform: z.enum(["GOOGLE", "META", "MULTI"]).describe("Target ad network platform"),
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
          description: "Deliver the complete, launch-ready campaign package.",
          inputSchema: z.object({
            name: z.string(),
            platform: z.string(),
            objective: z.string(),
            budgetDaily: z.number(),
            currency: z.string(),
            bidding: z.string(),
            schedule: z.string(),
            landingPage: z.string(),
            offer: z.string().optional().describe("Core value proposition or lead magnet"),
            targetAudience: z.string().optional().describe("Decision-maker title and profile"),
            headlines: z.array(z.string()).describe("High-converting headlines (15 headlines strictly <= 30 chars for Google Search, <= 40 chars for Meta)"),
            headlineStrategy: z.string().optional().describe("Which headline to lead with for cold vs retargeting"),
            primaryText: z.string().describe("Persuasive direct-response ad copy (Hook -> Problem/Agitation -> Unique Mechanism & Proof -> CTA)"),
            cta: z.string().describe("Primary high-converting CTA button (e.g. 'Book Architecture Review', 'Request Demo')"),
            ctaAlternative: z.string().optional().describe("Alternative CTA option"),
            targeting: z.array(z.object({ setting: z.string(), value: z.string() })).describe("Accurate channel targeting setup"),
            exclusions: z.array(z.string()).optional().describe("Negative exclusions or negative keywords"),
            sitelinks: z.array(z.object({ title: z.string(), description: z.string() })).optional().describe("Sitelink extensions for Google Ads"),
            keyCaveat: z.string().optional().describe("Key media-buying execution watch-out"),
            creativeNotes: z.string().optional().describe("Art-direction description of the ad visual"),
            variantOptions: z.array(z.string()).optional().describe("Proactive creative variant angles"),
            keywords: z.array(z.string()).optional().describe("High-intent keywords with [exact] and \"phrase\" match types"),
            descriptions: z.array(z.string()).optional().describe("Ad descriptions (4 descriptions strictly <= 90 chars for Google Search)"),
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
                  "Your previous output was REJECTED for copywriting violations. Rewrite the campaign package now, fixing every issue. " +
                  "BANNED PHRASES: 'unlock ai efficiency', 'seamless', 'revolutionary', 'world-class', 'holistic', 'transform your business', 'reduce costs with ai', 'empower your team', 'drive growth', 'get more leads', 'revitalize operations'. " +
                  "BANNED OPENER VERBS in headlines: unlock, unleash, elevate, maximize, boost, enhance, streamline, transform, empower, revolutionize, revitalize, discover, explore, introducing. " +
                  "REQUIRED: At least 5 of 15 Google headlines must contain a specific number ($150K, 48 hours, 60%), a named mechanism, or a quantified outcome. Every headline must pass the 'So What?' test — if a competitor could say the same thing, it's banned. " +
                  "Primary text must follow Hook -> Agitation -> Unique Mechanism & Proof -> CTA structure with a real CTA verb (book, learn, get, try, request, schedule).",
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
          return "402 — your workspace is out of AI credits. Add credits and retry.";
        if (status === 403)
          return "403 — AI access is blocked by a workspace limit or policy.";
        if (status === 429) return "429 — rate limited, retry in a few seconds.";
        console.error("[growzzy] chat error", status, err?.message);
        return err?.message ?? "Growzzy hit an unexpected error.";
      },
    });
  } catch (error: any) {
    console.error("Agent chat route error:", error);
    return new Response(error?.message || "Failed to process chat", { status: 500 });
  }
}
