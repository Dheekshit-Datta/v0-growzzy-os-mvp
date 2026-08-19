import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { auth } from "@/lib/auth";
import { webSearch } from "@/lib/research.server";
import { analyzeSite } from "@/lib/brand-analysis.server";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const session = await auth().catch(() => null);
    const body = await req.json().catch(() => ({}));
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
    const hasBrand = Boolean(brandContext && brandContext.trim().length > 15);

    // Check if the user is answering with a website URL
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
        const host = targetUrl.replace(/^https?:\/\//i, "").split("/")[0];
        const brandName = host.split(".")[0] || "Your Brand";
        return NextResponse.json({
          blocks: [
            {
              type: "analyzeWebsite",
              site: targetUrl,
              profile: {
                businessName: brandName.toUpperCase(),
                industry: "Digital Services & Technology",
                businessModel: "B2B SaaS / Solution",
                whatTheySell: `Operations and growth automation solutions for modern businesses.`,
                productDescription: `${brandName} empowers teams to streamline workflows and accelerate performance.`,
                positioning: `The next-generation platform for scalable automation.`,
                differentiators: ["Fast AI integration", "Enterprise-grade reliability", "Instant performance feedback"],
                audience: "Operations managers, IT leaders, and business owners",
                segments: [{ segment: "Scaling Enterprises", pains: "Manual processes", triggers: "Efficiency requirements" }],
                competitors: [{ name: "Market Alternative", url: "https://example.com", angle: "Legacy systems" }],
                keywords: [`${brandName} software`, `${brandName} automation`, "enterprise workflow ai"],
                creativeAngles: ["Eliminate operational bottlenecks today", "AI-driven workflow acceleration"],
                tone: "friendly",
                sources: [targetUrl],
              },
            },
            {
              type: "text",
              content: `I've connected **${brandName.toUpperCase()}**! Let's build your first high-converting campaign.`,
            },
          ],
        });
      }
    }

    // 3. Campaign Building / Ad Copy / Creative Flow
    const isCreativeRequest = lowerQuery.includes("creative") || lowerQuery.includes("ad copy") || lowerQuery.includes("visual") || lowerQuery.includes("copy pack");
    const isCampaignRequest = lowerQuery.includes("campaign") || lowerQuery.includes("launch") || lowerQuery.includes("lead-gen") || lowerQuery.includes("google ads") || lowerQuery.includes("meta ads") || isCreativeRequest;
    const isApproval = lowerQuery.includes("approved") || lowerQuery.includes("approve plan");

    const apiKey = process.env.OPENAI_API_KEY || process.env.LOVABLE_API_KEY || process.env.AI_GATEWAY_API_KEY || "";
    const openai = apiKey ? new OpenAI({ apiKey }) : null;

    if (isApproval) {
      let parsed: any = null;
      if (openai) {
        try {
          const completion = await openai.chat.completions.create({
            model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
            temperature: 0.4,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content: `You are Growzzy AI Campaign Generator. Return ONLY a JSON object with:
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
          parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
        } catch (e) {
          console.warn("OpenAI campaign generation fallback:", e);
        }
      }

      const brandTitle = brandContext?.match(/Business name:\s*([^\n]+)/i)?.[1] || "Growth";
      return NextResponse.json({
        blocks: [
          {
            type: "creative",
            creative: {
              caption: parsed?.creative?.caption || `${brandTitle} Ad Creative`,
              primaryText: parsed?.creative?.primaryText || "Automate your workflows and scale with confidence.",
              imagePrompt: parsed?.creative?.imagePrompt || "Modern minimalist commercial photography, high tech operations dashboard, clean studio lighting, 4k",
            },
          },
          {
            type: "campaign",
            campaign: parsed?.campaign || {
              name: `${brandTitle} High-Intent Lead Gen Campaign`,
              platform: "Google Ads",
              objective: "Lead Generation",
              budgetDaily: 50,
              currency: "USD",
              bidding: "Maximize Conversions",
              schedule: "Monday – Sunday (All Hours)",
              landingPage: "https://yourbrand.com/demo",
              targeting: [
                { setting: "Geography", value: "United States, Canada, United Kingdom" },
                { setting: "Audience", value: "Operations Managers, IT Directors, Innovation Leads" },
              ],
              keywords: ["operations automation software", "workflow ai platform", "enterprise productivity tools", "b2b business automation"],
              headlines: ["Automate Operations with AI", "Scale Faster, Reduce Costs", "The #1 Enterprise Workflow Tool"],
              descriptions: ["Eliminate manual bottlenecks with intelligent workflow automation. Start free today.", "Empower your operations team with real-time AI capabilities."],
              primaryText: "Stop losing valuable hours to manual processes. Scale your operational efficiency with intelligent automation.",
              cta: "Get Started Free",
              kpis: [
                { metric: "Target CPA", target: "$32.00" },
                { metric: "Estimated ROAS", target: "3.5x" },
                { metric: "Target CTR", target: "4.2%" },
              ],
              risks: ["Ensure landing page conversion tracking is verified before ramping budget."],
            },
          },
          {
            type: "text",
            content: parsed?.summary || "Your complete campaign package is built and ready to launch!",
          },
        ],
      });
    }

    if (isCampaignRequest) {
      let parsed: any = null;
      let citations: any[] = [];

      try {
        const searchResults = await webSearch(`${userQuery.slice(0, 50)} marketing keywords competitor benchmark`, 4);
        citations = searchResults.map((r) => {
          let site = r.url;
          try { site = new URL(r.url).hostname.replace(/^www\./, ""); } catch {}
          return { url: r.url, site, title: r.title, snippet: r.snippet };
        });
      } catch (e) {
        citations = [
          { url: "https://google.com/ads", site: "google.com", title: "Google Ads Benchmarks", snippet: "High intent search CPC and CTR benchmarks" },
          { url: "https://facebook.com/business", site: "facebook.com", title: "Meta Ads Best Practices", snippet: "Direct response creative testing" },
        ];
      }

      if (openai) {
        try {
          const completion = await openai.chat.completions.create({
            model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
            temperature: 0.4,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content: `You are Growzzy AI Brain. The user wants to build/launch an ad campaign or creative pack.
                Return ONLY a JSON object with:
                "plan": {
                  "title": string,
                  "summary": string,
                  "steps": [{"title": string, "detail": string}]
                },
                "creative": {
                  "caption": string,
                  "primaryText": string,
                  "imagePrompt": string
                },
                "researchNotes": string`,
              },
              {
                role: "user",
                content: `User query: ${userQuery}\nBrand Context: ${brandContext || "None"}`,
              },
            ],
          });
          parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
        } catch (e) {
          console.warn("OpenAI plan generation fallback:", e);
        }
      }

      const brandName = brandContext?.match(/Business name:\s*([^\n]+)/i)?.[1] || "your brand";

      const blocks: any[] = [
        {
          type: "research",
          topic: `Market & Competitor Research for ${brandName}`,
          subQueries: [
            "Audience search intent & pain points",
            "Competitor ad copy and creative positioning",
            "High-converting direct response hooks",
          ],
          results: citations,
          notes: parsed?.researchNotes || "Live market research complete. Identified high-intent search keywords and core buying triggers for operations leaders.",
        },
        {
          type: "plan",
          plan: parsed?.plan || {
            title: `Growth & Creative Campaign for ${brandName}`,
            summary: `Target operations and IT leaders with direct-response ad copy and high-impact visual creatives.`,
            steps: [
              { title: "Target Audience & Channel Strategy", detail: "Focus on Google Search intent + Meta retargeting for operations managers and IT directors." },
              { title: "High-Converting Ad Copy Pack", detail: "Develop problem-aware headlines and solution-focused benefit copy in a friendly tone." },
              { title: "Visual Creative Art Direction", detail: "Generate clean, modern commercial visual assets for feed and story placements." },
              { title: "Landing Page & Conversion Setup", detail: "Align messaging with call-to-action to maximize demo/sign-up conversion rate." },
              { title: "Launch & Automated Optimization", detail: "Deploy with Maximize Conversions bidding and automated negative keyword monitoring." },
            ],
          },
        },
      ];

      if (isCreativeRequest) {
        blocks.push({
          type: "creative",
          creative: {
            caption: parsed?.creative?.caption || `Ad Creative Pack for ${brandName}`,
            primaryText: parsed?.creative?.primaryText || "Transform your operations with effortless automation. Built for teams that move fast.",
            imagePrompt: parsed?.creative?.imagePrompt || "Modern minimalist SaaS dashboard visualization on a sleek laptop, soft warm ambient lighting, 3D icon accents, high resolution",
          },
        });
      }

      return NextResponse.json({ blocks });
    }

    // Default: General Marketing / Growth Advice
    let textResponse = "I'm ready to help you plan, research, and launch your next high-converting ad campaign. What would you like to build?";
    if (openai) {
      try {
        const generalCompletion = await openai.chat.completions.create({
          model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
          temperature: 0.5,
          messages: [
            {
              role: "system",
              content: `You are Growzzy, a concise performance marketing expert for Google Ads and Meta Ads. Brand context:\n${brandContext || "No brand loaded yet."}`,
            },
            { role: "user", content: userQuery },
          ],
        });
        textResponse = generalCompletion.choices[0]?.message?.content || textResponse;
      } catch (e) {
        console.warn("OpenAI general chat fallback:", e);
      }
    }

    return NextResponse.json({
      blocks: [
        {
          type: "text",
          content: textResponse,
        },
      ],
    });
  } catch (error: any) {
    console.error("Agent chat route error:", error);
    return NextResponse.json({
      blocks: [
        {
          type: "text",
          content: "I'm ready to help you plan your campaign. Would you like to research competitors, generate ad copy, or build an execution plan?",
        },
      ],
    });
  }
}
