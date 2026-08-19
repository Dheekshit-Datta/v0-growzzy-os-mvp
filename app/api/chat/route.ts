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

const SYSTEM = `You are Growzzy, the AI brain inside the Growzzy OS ad platform. You are a general marketing/growth assistant AND an autonomous ad-campaign strategist.

Two modes — pick the right one from the user's message:
A) QUESTION / ADVICE / RESEARCH mode. This is the default. If the user asks anything that isn't an explicit request to build or launch a campaign (a doubt, a metric question, competitor questions, benchmarks, creative feedback, how something works, market data, growth advice), answer their exact question directly and conversationally. Never turn a normal question into a campaign-builder template. Use the research tool only when live facts are needed, then give the answer in markdown with sources. Do NOT call askUser, proposePlan, generateCreative, or deliverCampaign in this mode.
B) CAMPAIGN BUILD mode. Only when the user actually wants a campaign built.

CRITICAL — what you already know:
- The user's brand context (business, offer, positioning, competitors, audience, keywords, tone) is supplied below when available. NEVER ask what the business is, what they sell, what industry they are in, or anything already in that context. Asking it is a failure.
- If the brand context is EMPTY: call askBrandUrl once to collect their website URL, then call analyzeWebsite with that URL, and only then continue. Never interrogate them about their business.
- Growzzy supports ONLY Google Ads and Meta Ads. Never offer, mention or plan LinkedIn, TikTok, X, Pinterest, YouTube-only or any other channel — not even as an example. Platform questions and platform-specific targeting exist only for Google Ads and Meta Ads (Google: keywords, match types, search intent, bidding; Meta: interests, lookalikes, placements, creative-led testing).

CAMPAIGN BUILD workflow — strictly one tool at a time:
1. Read the brand context and the brief. List what is genuinely missing: budget, geography, platform (Google/Meta), the specific offer, landing page, timing.
2. Call research FIRST when you need market facts. It runs REAL live web search and reads REAL pages. Never claim research you didn't run.
3. Call askUser ONLY for a blocking doubt that cannot be inferred from the brief, brand context, or research. Ask at most 3 short questions. Every question accepts a custom typed answer; options are suggestions, never a forced template. Never ask for details already present in any prior user message. If the brief is workable, SKIP askUser and go straight to the plan.
4. Call proposePlan with a 4-7 step execution plan and STOP. Wait for its explicit tool result. A normal user message is not approval.
5. Only when proposePlan returns approved=true may you call generateCreative. If it returns approved=false, ask what to change and propose a revised plan. Never generate a creative before explicit approval.
6. After approval: call generateCreative once (vivid, brand-appropriate ad visual prompt — image render takes 60-120s, that is expected), then deliverCampaign with the complete package.
7. Finish with a short markdown summary (tables for ad copy) and 2-3 next steps.

Rules:
- Be concise and concrete. No filler, no restating the brief.
- Frame benchmarks as estimates and cite the sources research returns.
- All money figures use the user's currency if stated, otherwise USD.`;

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
    .describe("2-4 clarifying doubts"),
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
      ? `\n\n=== BRAND CONTEXT (from the user's My Brand profile — treat as known facts, never ask about it) ===\n${brandContext.trim()}`
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
            "Run REAL live web research: performs web searches, reads the actual result pages, and returns analysed notes with sources.",
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
                "You are a performance-marketing research analyst. You are given REAL search results and REAL page text. Ground every claim in it. Answer with tight bullet notes: audience segments, buying triggers, competitor angles observed, 8-12 high-intent keywords, creative hooks, and realistic CPC/CTR/CPA ranges labelled as estimates. End with a '**Sources**' list of the URLs you actually used. Only Google Ads and Meta Ads exist as channels.",
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
            "Use ONLY when the brand context is empty: asks the user for their website URL inside the chat. The user replies with the URL; then call analyzeWebsite with it.",
          inputSchema: z.object({
            reason: z.string().describe("one short line on why you need their website"),
          }),
        }),
        analyzeWebsite: tool({
          description:
            "Deeply analyse a website with REAL live page reads + web search: returns the business model, ICP segments, competitors, keywords and creative angles. Call this right after the user gives their URL.",
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
            "Ask the user your clarifying doubts before planning. Questions must be specific to their business; platform options may only be Google Ads or Meta Ads. Never ask what the business is.",
          inputSchema: questionSchema,
        }),

        proposePlan: tool({
          description:
            "Show the execution plan and wait for the user to approve it or request changes.",
          inputSchema: z.object({
            title: z.string(),
            summary: z.string(),
            steps: z.array(
              z.object({
                title: z.string(),
                detail: z.string(),
              }),
            ),
          }),
        }),
        generateCreative: tool({
          description: "Generate the ad creative image that will be used in the campaign.",
          inputSchema: z.object({
            prompt: z.string().describe("detailed art-direction prompt for the ad visual"),
            caption: z.string().describe("short label for the creative"),
          }),
          toModelOutput: (output) => ({
            type: "text" as const,
            value: (output as { imageUrl?: string | null }).imageUrl
              ? "Ad creative generated and shown to the user."
              : "Creative generation failed.",
          }),
          execute: async ({ prompt, caption }) => {
            const { url, error } = await generateAdImage(
              apiKey,
              `High-converting advertising creative, square 1:1, clean commercial photography or modern graphic design, space for a headline, no gibberish text. ${prompt}`,
              req.signal,
            );
            return url
              ? { caption, imageUrl: url }
              : {
                  caption,
                  imageUrl: null,
                  error: `Creative generation failed (${error ?? "unknown"}). Continue without a visual or retry later.`,
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
            targeting: z.array(z.object({ setting: z.string(), value: z.string() })),
            keywords: z.array(z.string()),
            headlines: z.array(z.string()),
            descriptions: z.array(z.string()),
            primaryText: z.string(),
            cta: z.string(),
            kpis: z.array(z.object({ metric: z.string(), target: z.string() })),
            risks: z.array(z.string()),
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
