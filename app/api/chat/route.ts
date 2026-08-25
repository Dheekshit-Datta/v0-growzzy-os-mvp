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

export const maxDuration = 120;

const SYSTEM = `You are Growzzy, the elite AI growth engine and Chief Media Buyer inside Growzzy OS. You engineer world-class, multi-million dollar performance advertising campaigns that outperform top Silicon Valley growth agencies.

MODES:
A) ADVICE / DIRECT QUESTION mode: If the user asks a growth question, benchmark question, platform policy doubt, or strategy advice, answer directly with sharp, authoritative, data-backed insights. Do NOT call campaign tools.
B) CAMPAIGN BUILD mode: When the user requests to plan, launch, or create an ad campaign.

=== CAMPAIGN BUILD WORKFLOW ===
Follow this systematic workflow:

1. BRAND GROUNDING:
Acknowledge the user's brand memory context and any attached files. Never ask what the business does if context is loaded.

2. CLARIFYING SETUP QUESTIONS (askUser):
Ask 2-3 strategic setup questions tailored to their specific business:
- Question 1 (Core Goal & Outcome): e.g. Inbound Qualified Leads, Rapid Sales Pipeline, Direct Bookings, E-commerce Purchases.
- Question 2 (Target Conversion Action): e.g. Book Technical Demo / Architecture Review, Submit Lead Form, Sign Up for Free Trial, Instant Checkout.
- Question 3 (Platform & Strategy Angle): e.g. Google Ads High-Intent Search, Meta Ads Visual Feed/Stories, Multi-Channel (Google + Meta).
Provide clear options with category icons, benefit descriptions, and a RECOMMENDED pill on the highest-converting option.

3. DEEP STRATEGY SYNTHESIS & CAMPAIGN PLAN (proposePlan):
After the user submits answers, generate a COMPREHENSIVE, WORLD-CLASS CAMPAIGN STRATEGY PLAN in Markdown via the proposePlan tool.
The plan must be a rich strategic document (markdownPlan) containing:
- **Executive Strategy & Objective**: Target outcome, target CPL/CPA benchmarks.
- **ICP Psychographics & Buyer Persona**: Core frustration, awareness stage (Problem-Aware vs Solution-Aware), decision-maker roles (e.g. CTO, VP of Eng, Technical Founder for B2B AI; CMOs for growth; Consumers for D2C).
- **Full Funnel Architecture**: Top of Funnel (Demand Gen/Cold Search), Middle of Funnel (Evaluation), Bottom of Funnel (High-Intent Conversion & Retargeting).
- **Channel-Specific Architecture**:
  * For Google Search: Single-Topic Ad Groups (STAGs), Exact Match [keywords], Phrase Match "keywords", Negative Keyword list (-free, -jobs, -salary, -internship, -github, -tutorial), and Ad Extensions (Sitelinks, Callouts).
  * For Meta Ads: Audience Interest Stacking (DevOps, Kubernetes, AI/LLMs), Lookalike seeding, 1:1 Feed & 9:16 Story/Reels placements.
  * For Multi-Channel: Precise budget split (e.g. 60% Google Search to capture high intent, 40% Meta to build demand and retarget).
- **Direct-Response Messaging Hooks**:
  * Hook 1: Pain / Frustration (e.g. "Tired of Fragile AI Scripts?")
  * Hook 2: Speed / Outcome (e.g. "Deploy Multi-Agent AI in 48h")
  * Hook 3: ROI / Efficiency (e.g. "Cut Ops Overhead by 40%")
  * Hook 4: Risk-Reversal Offer (e.g. "Free AI Architecture Audit")
- **Budget, Bidding Model & Scaling Milestones**: Daily budget recommendation, Target CPA / Maximize Conversions bidding.

STOP and wait for the user to click "Approve Strategy & Build Campaign" or request adjustments.

4. ASSET GENERATION & LAUNCH PACKAGE (generateCreative & deliverCampaign):
Once approved (approved=true):
1. Call generateCreative to render high-converting ad creative imagery.
2. Call deliverCampaign to output the launch-ready campaign package.

=== CRITICAL COPYWRITING & CHARACTER LIMIT RULES ===
- GOOGLE SEARCH ADS:
  * Headlines: STRICTLY 30 CHARACTERS OR FEWER (length <= 30). NEVER exceed 30 chars.
  * Descriptions: STRICTLY 90 CHARACTERS OR FEWER (length <= 90). NEVER exceed 90 chars.
- META ADS:
  * Primary Text: 3 structured direct-response paragraphs (Hook -> Problem/Agitation -> Unique Mechanism & Risk-Reversal CTA).
  * NEVER output prompt instructional meta-text (like "Handle objections by...") as ad copy! Write the actual persuasive objection-handling proof (e.g., "SOC2 Type II certified with zero data retention.").
  * Headline: Punchy, high-impact <= 40 characters.
- CTAs: Choose industry-accurate CTAs (e.g. "Book Architecture Review", "Request Technical Demo", "Audit Your AI Stack" for B2B AI; "Start Free Trial" for SaaS; "Get 20% Off" for D2C). Never use generic "Get Your Instant Quote" for enterprise software.
- NO DUPLICATE TEXT SUMMARY: After calling deliverCampaign, DO NOT output any markdown recaps, bulleted summaries, or overview lists in conversational text! The CampaignCard and Artifact Document deliverable already display all campaign parameters. Keep your closing message to a single, concise 1-line handoff (e.g. "Your campaign package is generated and ready for launch above. Review, edit inline, or deploy directly to your ad account!").`;

const questionSchema = z.object({
  questions: z
    .array(
      z.object({
        id: z.string().describe("short slug, e.g. 'budget'"),
        question: z.string(),
        why: z.string().describe("one line on why this matters"),
        options: z.array(
          z.object({
            label: z.string(),
            description: z.string(),
            recommended: z.boolean(),
          }),
        ),
      }),
    )
    .describe("2-3 clarifying doubts"),
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
            "Ask the user 2-3 strategic setup questions before generating the campaign strategy plan.",
          inputSchema: questionSchema,
        }),

        proposePlan: tool({
          description:
            "Deliver the comprehensive Campaign Strategy Plan in Markdown for user review and approval before generating campaign assets.",
          inputSchema: z.object({
            title: z.string().describe("Campaign strategy title, e.g. 'Markitxai Enterprise AI Lead-Gen Strategy'"),
            summary: z.string().describe("Executive summary of campaign approach and core objective"),
            platform: z.enum(["GOOGLE", "META", "MULTI"]).describe("Target ad network platform"),
            targetAudience: z.string().describe("Primary ICP role & company profile"),
            budgetRecommendation: z.string().describe("Recommended daily/monthly budget with allocation"),
            markdownPlan: z.string().describe("Full, rich Campaign Strategy Document in Markdown with sections: Executive Strategy, ICP Psychographics, Funnel Architecture, Channel-Specific Setup (STAG keywords / Audience Stacks), Direct-Response Copy Hooks, Bidding & Scaling"),
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
          description: "Generate high-converting ad creative visual mockups.",
          inputSchema: z.object({
            prompt: z.string().describe("Detailed art-direction prompt for the ad visual"),
            caption: z.string().describe("Short label for the creative, e.g. 'Enterprise Automation Visual'"),
          }),
          toModelOutput: (output) => ({
            type: "text" as const,
            value: (output as { imageUrl?: string | null }).imageUrl
              ? "Ad creative generated and displayed to the user."
              : "Creative visual ready.",
          }),
          execute: async ({ prompt, caption }) => {
            const { url, error } = await generateAdImage(
              apiKey,
              `High-converting advertising creative visual, square 1:1, modern commercial tech aesthetic, clean typography space, professional lighting. ${prompt}`,
              req.signal,
            );
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
            headlines: z.array(z.string()).describe("High-converting headlines (Strictly <= 30 chars for Google Search, <= 40 chars for Meta)"),
            headlineStrategy: z.string().optional().describe("Which headline to lead with for cold vs retargeting"),
            primaryText: z.string().describe("Persuasive direct-response ad copy (Hook -> Problem/Agitation -> Unique Mechanism & Proof -> CTA)"),
            cta: z.string().describe("Primary high-converting CTA button (e.g. 'Book Architecture Review', 'Request Demo')"),
            ctaAlternative: z.string().optional().describe("Alternative CTA option"),
            targeting: z.array(z.object({ setting: z.string(), value: z.string() })).describe("Accurate channel targeting setup"),
            exclusions: z.array(z.string()).optional().describe("Negative exclusions or negative keywords"),
            keyCaveat: z.string().optional().describe("Key media-buying execution watch-out"),
            creativeNotes: z.string().optional().describe("Art-direction description of the ad visual"),
            variantOptions: z.array(z.string()).optional().describe("Proactive creative variant angles"),
            keywords: z.array(z.string()).optional().describe("High-intent keywords with [exact] and \"phrase\" match types"),
            descriptions: z.array(z.string()).optional().describe("Ad descriptions (Strictly <= 90 chars for Google Search)"),
            kpis: z.array(z.object({ metric: z.string(), target: z.string() })).optional(),
            risks: z.array(z.string()).optional(),
          }),
          execute: async (input) => ({ delivered: true, name: input.name }),
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
