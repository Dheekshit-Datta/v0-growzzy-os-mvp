import OpenAI from "openai"
import { UTILITY_MODEL } from "@/lib/ai-utility"

export type PolicyFlag = {
  text: string
  adGroupName: string
  field: string
  reason: string
  suggestion: string
  source: "STATIC" | "AI"
}

export type PolicyCheckResult = {
  status: "PASS" | "WARN" | "FAIL"
  flags: PolicyFlag[]
  checkedAt: string
}

type PlanAdGroupText = {
  name: string
  headlines: string[]
  descriptions: string[]
}

const HARD_BLOCK_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\b(cocaine|heroin|meth|fentanyl)\b/i, reason: "Prohibited category: illegal drugs" },
  { pattern: /\b(escort|prostitut)/i, reason: "Prohibited category: adult services" },
  { pattern: /\b(counterfeit|replica (watches|bags|goods))\b/i, reason: "Prohibited category: counterfeit goods" },
  { pattern: /\b(assault rifle|ammunition|firearm)s?\b/i, reason: "Prohibited category: weapons" },
]

const WARN_RULES: Array<{ pattern: RegExp; reason: string; suggestion: string }> = [
  {
    pattern: /\b(#1|number one|best in the world|world's best|guaranteed results?|100% guaranteed)\b/i,
    reason: "Unsubstantiated superlative/guarantee claims are commonly disapproved",
    suggestion: "Replace with a specific, provable claim (e.g. 'Rated 4.8/5 by 200+ customers')",
  },
  {
    pattern: /\b(cure|cures|miracle|instant results?)\b/i,
    reason: "Health/miracle claims trigger policy review",
    suggestion: "Describe the benefit without medical or miracle framing",
  },
  {
    pattern: /(!{3,}|\?{3,}|[A-Z]{7,})/, // Increased threshold to reduce false positives
    reason: "Excessive punctuation or all-caps words violate Google editorial policy",
    suggestion: "Use sentence case and single punctuation marks",
  },
  {
    pattern: /\b\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/,
    reason: "Phone numbers in ad text are disallowed (use call extensions instead)",
    suggestion: "Remove the phone number from the ad copy",
  },
  {
    pattern: /\bclick here\b/i,
    reason: "'Click here' style CTAs violate Google editorial guidelines",
    suggestion: "Use a descriptive CTA like 'Get your free quote'",
  },
  {
    pattern: /\b(lose \d+ (kg|kgs|pounds|lbs)|weight loss guaranteed)\b/i,
    reason: "Specific weight-loss claims are restricted",
    suggestion: "Describe the program without promising specific results",
  },
]

export function runStaticPolicyRules(adGroups: PlanAdGroupText[]): PolicyFlag[] {
  const flags: PolicyFlag[] = []
  for (const group of adGroups) {
    const fields: Array<{ field: string; texts: string[] }> = [
      { field: "headline", texts: group.headlines },
      { field: "description", texts: group.descriptions },
    ]
    for (const { field, texts } of fields) {
      for (const text of texts) {
        if (!text) continue
        for (const rule of HARD_BLOCK_PATTERNS) {
          if (rule.pattern.test(text)) {
            flags.push({ text, adGroupName: group.name, field, reason: rule.reason, suggestion: "Remove this content — it cannot be advertised on Google", source: "STATIC" })
          }
        }
        for (const rule of WARN_RULES) {
          if (rule.pattern.test(text)) {
            flags.push({ text, adGroupName: group.name, field, reason: rule.reason, suggestion: rule.suggestion, source: "STATIC" })
          }
        }
      }
    }
  }
  return flags
}

export async function runAiPolicyReview(adGroups: PlanAdGroupText[]): Promise<PolicyFlag[]> {
  if (!process.env.OPENAI_API_KEY) return []
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const adText = adGroups
    .map((g) => `Ad group "${g.name}":\nHeadlines: ${g.headlines.join(" | ")}\nDescriptions: ${g.descriptions.join(" | ")}`)
    .join("\n\n")
  try {
    const completion = await openai.chat.completions.create({
      model: UTILITY_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'You review Google Ads text for likely policy disapprovals (misrepresentation, unsubstantiated claims, restricted categories, editorial issues, trademark misuse). Return JSON: {"flags":[{"text":"exact flagged phrase","adGroupName":"...","field":"headline|description","reason":"specific policy area","suggestion":"compliant rewrite"}]}. Only flag genuine risks — an empty flags array is a valid answer. Never invent phrases not present in the input.',
        },
        { role: "user", content: adText },
      ],
    })
    const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}")
    const flags = Array.isArray(parsed?.flags) ? parsed.flags : []
    return flags
      .filter((f: any) => f?.text && f?.reason)
      .slice(0, 20)
      .map((f: any) => ({
        text: String(f.text).slice(0, 200),
        adGroupName: String(f.adGroupName || "Unknown"),
        field: String(f.field || "headline"),
        reason: String(f.reason).slice(0, 300),
        suggestion: String(f.suggestion || "Rewrite this phrase to be specific and provable").slice(0, 300),
        source: "AI" as const,
      }))
  } catch {
    return []
  }
}

export async function checkPlanPolicy(adGroups: PlanAdGroupText[]): Promise<PolicyCheckResult> {
  const staticFlags = runStaticPolicyRules(adGroups)
  const hasHardBlock = staticFlags.some((f) => f.reason.startsWith("Prohibited category"))
  const aiFlags = hasHardBlock ? [] : await runAiPolicyReview(adGroups)
  const seen = new Set<string>()
  const flags = [...staticFlags, ...aiFlags].filter((f) => {
    const key = `${f.text}|${f.field}|${f.reason}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return {
    status: hasHardBlock ? "FAIL" : flags.length > 0 ? "WARN" : "PASS",
    flags,
    checkedAt: new Date().toISOString(),
  }
}
