import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { auth } from "@/lib/auth";
import { webSearch, fetchPageText } from "@/lib/research.server";
import { analyzeSite } from "@/lib/brand-analysis.server";

export const maxDuration = 120;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const body = await req.json();
    const { messages, brandContext } = body as {
      messages: any[];
      brandContext?: string;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Messages are required" }, { status: 400 });
    }

    const lastMsg = messages[messages.length - 1];
    let userQuery = "";
    if (typeof lastMsg?.content === "string") {
      userQuery = lastMsg.content;
    } else if (Array.isArray(lastMsg?.parts)) {
      userQuery = lastMsg.parts
        .map((p: any) => p.text || (p.output ? JSON.stringify(p.output) : ""))
        .filter(Boolean)
        .join(" ");
    }

    const lowerQuery = userQuery.toLowerCase();
    const hasBrand = brandContext && brandContext.trim().length > 15;

    // Check if the user just answered askBrandUrl
    const urlMatch = userQuery.match(/https?:\/\/[^\s]+|[a-zA-Z0-9-]+\.(?:com|io|co|ai|org|net|app|in|dev)/i);
    const isUrlAnswer = (lowerQuery.includes("url") || lowerQuery.includes("answers provided") || urlMatch) && !hasBrand;

    // 1. If Brand Context is empty and user wants to analyze/start, ask for website URL
    if (!hasBrand && (lowerQuery.includes("analyse") || lowerQuery.includes("analyze") || lowerQuery.includes("set up my brand") || lowerQuery.includes("learn my business")) && !urlMatch) {
      return NextResponse.json({
        blocks: [
          {
            type: "askBrandUrl",
            reason: "Drop your website URL and I'll analyse your business live — offer, audience, competitors, keywords — before asking anything else.",
          },
        ],
      });
    }

    // 2. If website URL provided, run deep website analysis
    if (urlMatch && (lowerQuery.includes("analyse") || lowerQuery.includes("analyze") || lowerQuery.includes("website") || isUrlAnswer)) {
      const targetUrl = urlMatch[0];
      try {
        const { site, profile } = await analyzeSite(process.env.OPENAI_API_KEY || "", targetUrl);
        return NextResponse.json({
          blocks: [
            {
              type: "analyzeWebsite",
              site,
              profile,
            },
            {
              type: "text",
              content: `I've analyzed **${profile.businessName}**! I've learned your offer (${profile.whatTheySell}), audience (${profile.audience}), and top competitors (${profile.competitors.map((c) => c.name).join(", ")}). What campaign would you like to build?`,
            },
          ],
        });
      } catch (err: any) {
        return NextResponse.json({
          blocks: [
            {
              type: "text",
              content: `I couldn't reach ${targetUrl}. Please check the URL or configure your brand details in My Brand.`,
            },
          ],
        });
      }
    }

    // 3. Campaign Building / Planning Flow
    const isCampaignRequest = lowerQuery.includes("campaign") || lowerQuery.includes("launch") || lowerQuery.includes("lead-gen") || lowerQuery.includes("google ads") || lowerQuery.includes("meta ads") || lowerQuery.includes("ad copy");
    const isApproval = lowerQuery.includes("approved") || lowerQuery.includes("approve plan");

    if (isApproval) {
      // Step: Generate Creative & Deliver Campaign Package
      const searches = await webSearch(`${brandContext?.slice(0, 40) || "b2b"} top converting ads hooks`, 3);
      
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_CHAT_MODEL || "gpt-4o",
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are Growzzy AI Campaign Generator. Return ONLY a JSON object with keys:
            "creative": { "caption": string, "imagePrompt": string, "primaryText": string },
            "campaign": {
              "name": string,
              "platform": "Google Ads" | "Meta Ads",
              "objective": string,
              "budgetDaily": number,
              "currency": "USD",
              "bidding": string,
              "schedule": string,
              "landingPage": string,
              "targeting": [{"setting": string, "value": string}],
              "keywords": string[],
              "headlines": string[],
              "descriptions": string[],
              "primaryText": string,
              "cta": string,
              "kpis": [{"metric": string, "target": string}],
              "risks": string[]
            },
            "summary": string`,
          },
          {
            role: "user",
            content: `Brand: ${brandContext}\nPlan Approved. Generate complete campaign deliverables.`,
          },
        ],
      });

      const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
      return NextResponse.json({
        blocks: [
          {
            type: "creative",
            creative: {
              caption: parsed.creative?.caption || "High-Impact Ad Creative",
              primaryText: parsed.creative?.primaryText || "",
              imagePrompt: parsed.creative?.imagePrompt || "Commercial product photography, clean minimalist lighting",
            },
          },
          {
            type: "campaign",
            campaign: parsed.campaign || {
              name: "High-Intent Growth Campaign",
              platform: "Google Ads",
              objective: "Lead Generation",
              budgetDaily: 50,
              currency: "USD",
              bidding: "Maximize Conversions",
              schedule: "All Days (8 AM - 8 PM)",
              landingPage: "https://yourbrand.com/demo",
              targeting: [{ setting: "Geography", value: "United States, United Kingdom" }],
              keywords: ["b2b software", "lead generation", "sales automation"],
              headlines: ["Supercharge Your Sales", "Automate Growth Today", "#1 Marketing Platform"],
              descriptions: ["Scale your customer acquisition with automated AI pipelines.", "Get started in 5 minutes."],
              primaryText: "Stop losing pipeline to slow processes. Growzzy powers high-converting ads.",
              cta: "Start Free Trial",
              kpis: [{ metric: "Target CPA", target: "$35" }, { metric: "Est. ROAS", target: "3.8x" }],
              risks: ["Ensure landing page tracking pixel is verified before scaling budget."],
            },
          },
          {
            type: "text",
            content: parsed.summary || "Your campaign package is ready for review and launch!",
          },
        ],
      });
    }

    if (isCampaignRequest) {
      // Step: Run Market Research + Propose Questions & Plan
      const searchTopic = userQuery.slice(0, 80);
      const searchResults = await webSearch(`${searchTopic} competitor ads keywords benchmark`, 5);
      const citations = searchResults.map((r) => {
        let site = r.url;
        try { site = new URL(r.url).hostname.replace(/^www\./, ""); } catch {}
        return { url: r.url, site, title: r.title, snippet: r.snippet };
      });

      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_CHAT_MODEL || "gpt-4o",
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are Growzzy AI Brain. The user wants to launch a campaign.
            Return a JSON object with:
            "plan": {
              "title": string,
              "summary": string,
              "steps": [{"title": string, "detail": string}]
            },
            "questions": [
              {
                "id": string,
                "question": string,
                "why": string,
                "options": [{"label": string, "description": string, "recommended": boolean}]
              }
            ] (at most 2 questions, optional if details clear),
            "researchNotes": string`,
          },
          {
            role: "user",
            content: `User query: ${userQuery}\nBrand Context: ${brandContext || "None"}\nLive Search Results: ${JSON.stringify(searchResults)}`,
          },
        ],
      });

      const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
      const blocks: any[] = [
        {
          type: "research",
          topic: `Market & Competitor Insights for ${userQuery.slice(0, 40)}`,
          subQueries: [
            "Audience intent and search behavior",
            "Competitor bidding strategy & positioning",
            "High-converting copy hooks",
          ],
          results: citations,
          notes: parsed.researchNotes || "Live market research complete. Competitor search patterns and buying triggers identified.",
        },
      ];

      if (parsed.questions && parsed.questions.length > 0 && !lowerQuery.includes("answers provided")) {
        blocks.push({
          type: "questions",
          questions: parsed.questions,
        });
      }

      if (parsed.plan) {
        blocks.push({
          type: "plan",
          plan: parsed.plan,
        });
      }

      return NextResponse.json({ blocks });
    }

    // Default: General Marketing / Growth Advice with OpenAI
    const generalCompletion = await openai.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL || "gpt-4o",
      temperature: 0.5,
      messages: [
        {
          role: "system",
          content: `You are Growzzy, a concise performance marketing expert for Google Ads and Meta Ads. Brand context:\n${brandContext || "No brand loaded yet."}`,
        },
        { role: "user", content: userQuery },
      ],
    });

    return NextResponse.json({
      blocks: [
        {
          type: "text",
          content: generalCompletion.choices[0]?.message?.content || "How can I help you grow your ads today?",
        },
      ],
    });
  } catch (error: any) {
    console.error("Agent chat route error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process chat" },
      { status: 500 }
    );
  }
}
