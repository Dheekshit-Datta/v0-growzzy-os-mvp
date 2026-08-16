var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import OpenAI from "openai";
import { UTILITY_MODEL } from "@/lib/ai-utility";
const HARD_BLOCK_PATTERNS = [
    { pattern: /\b(cocaine|heroin|meth|fentanyl)\b/i, reason: "Prohibited category: illegal drugs" },
    { pattern: /\b(escort|prostitut)/i, reason: "Prohibited category: adult services" },
    { pattern: /\b(counterfeit|replica (watches|bags|goods))\b/i, reason: "Prohibited category: counterfeit goods" },
    { pattern: /\b(assault rifle|ammunition|firearm)s?\b/i, reason: "Prohibited category: weapons" },
];
const WARN_RULES = [
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
];
export function runStaticPolicyRules(adGroups) {
    const flags = [];
    for (const group of adGroups) {
        const fields = [
            { field: "headline", texts: group.headlines },
            { field: "description", texts: group.descriptions },
        ];
        for (const { field, texts } of fields) {
            for (const text of texts) {
                if (!text)
                    continue;
                for (const rule of HARD_BLOCK_PATTERNS) {
                    if (rule.pattern.test(text)) {
                        flags.push({ text, adGroupName: group.name, field, reason: rule.reason, suggestion: "Remove this content — it cannot be advertised on Google", source: "STATIC" });
                    }
                }
                for (const rule of WARN_RULES) {
                    if (rule.pattern.test(text)) {
                        flags.push({ text, adGroupName: group.name, field, reason: rule.reason, suggestion: rule.suggestion, source: "STATIC" });
                    }
                }
            }
        }
    }
    return flags;
}
export function runAiPolicyReview(adGroups) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        if (!process.env.OPENAI_API_KEY)
            return [];
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const adText = adGroups
            .map((g) => `Ad group "${g.name}":\nHeadlines: ${g.headlines.join(" | ")}\nDescriptions: ${g.descriptions.join(" | ")}`)
            .join("\n\n");
        try {
            const completion = yield openai.chat.completions.create({
                model: UTILITY_MODEL,
                temperature: 0,
                response_format: { type: "json_object" },
                messages: [
                    {
                        role: "system",
                        content: 'You review Google Ads text for likely policy disapprovals (misrepresentation, unsubstantiated claims, restricted categories, editorial issues, trademark misuse). Return JSON: {"flags":[{"text":"exact flagged phrase","adGroupName":"...","field":"headline|description","reason":"specific policy area","suggestion":"compliant rewrite"}]}. Only flag genuine risks — an empty flags array is a valid answer. Never invent phrases not present in the input.',
                    },
                    { role: "user", content: adText },
                ],
            });
            const parsed = JSON.parse(((_b = (_a = completion.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) || "{}");
            const flags = Array.isArray(parsed === null || parsed === void 0 ? void 0 : parsed.flags) ? parsed.flags : [];
            return flags
                .filter((f) => (f === null || f === void 0 ? void 0 : f.text) && (f === null || f === void 0 ? void 0 : f.reason))
                .slice(0, 20)
                .map((f) => ({
                text: String(f.text).slice(0, 200),
                adGroupName: String(f.adGroupName || "Unknown"),
                field: String(f.field || "headline"),
                reason: String(f.reason).slice(0, 300),
                suggestion: String(f.suggestion || "Rewrite this phrase to be specific and provable").slice(0, 300),
                source: "AI",
            }));
        }
        catch (_c) {
            return [];
        }
    });
}
export function checkPlanPolicy(adGroups) {
    return __awaiter(this, void 0, void 0, function* () {
        const staticFlags = runStaticPolicyRules(adGroups);
        const hasHardBlock = staticFlags.some((f) => f.reason.startsWith("Prohibited category"));
        const aiFlags = hasHardBlock ? [] : yield runAiPolicyReview(adGroups);
        const seen = new Set();
        const flags = [...staticFlags, ...aiFlags].filter((f) => {
            const key = `${f.text}|${f.field}|${f.reason}`;
            if (seen.has(key))
                return false;
            seen.add(key);
            return true;
        });
        return {
            status: hasHardBlock ? "FAIL" : flags.length > 0 ? "WARN" : "PASS",
            flags,
            checkedAt: new Date().toISOString(),
        };
    });
}
