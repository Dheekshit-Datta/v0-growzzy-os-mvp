import { z } from "zod";
export const GoogleKeywordSchema = z.object({
    text: z.string().trim().min(1).max(80),
    matchType: z.enum(["BROAD", "PHRASE", "EXACT"]),
    intent: z.string().trim().max(40).optional(),
});
export const GoogleAdGroupSchema = z.object({
    name: z.string().trim().min(1).max(80),
    theme: z.string().trim().max(200).default(""),
    keywords: z.array(GoogleKeywordSchema).min(1).max(25),
    negativeKeywords: z.array(z.string().trim().min(1).max(80)).max(30),
    headlines: z.array(z.string().trim().min(1).max(30)).min(3).max(15),
    descriptions: z.array(z.string().trim().min(1).max(90)).min(2).max(4),
    finalUrl: z.string().url().optional(),
});
export const GoogleSearchPlanSchema = z.object({
    platform: z.literal("GOOGLE").default("GOOGLE"),
    campaignType: z.literal("SEARCH").default("SEARCH"),
    objective: z.string().trim().min(1).max(40),
    campaignName: z.string().trim().min(1).max(120),
    biddingStrategy: z.enum(["MAXIMIZE_CONVERSIONS", "MAXIMIZE_CLICKS", "TARGET_CPA", "TARGET_ROAS"]),
    targetCpa: z.number().positive().nullable().optional(),
    targetRoas: z.number().positive().nullable().optional(),
    dailyBudget: z.number().positive().max(100000),
    finalUrl: z.string().url().optional(),
    locations: z.array(z.string().trim().min(2).max(120)).min(1).max(20),
    languages: z.array(z.string().trim().min(2).max(40)).min(1).max(10),
    adGroups: z.array(GoogleAdGroupSchema).min(1).max(6),
    rationale: z.object({
        whyThisStructure: z.string().trim().min(1).max(600),
        whyTheseKeywords: z.string().trim().min(1).max(600),
        whyThisBidding: z.string().trim().min(1).max(600),
        expectedResultsRange: z.string().trim().max(300).optional().default(""),
    }),
    landingPageSuggestions: z.array(z.string().trim().min(1).max(300)).max(5).optional().default([]),
    launchReadinessScore: z.number().min(0).max(100),
    risks: z.array(z.string().trim().min(1).max(300)).max(8).default([]),
}).passthrough();
const INTERNAL_COPY = /\b(campaign brief|launch direction|missing before launch|structured the brief locally|ai is temporarily unavailable|deterministic fallback)\b/i;
const PLACEHOLDER_HOSTS = new Set(["example.com", "www.example.com", "yoursite.com", "www.yoursite.com"]);
const UNSUPPORTED_CLAIMS = /(?:\bguaranteed\b|\b100%\b|\b#\s*1\b|\bbest\s+(?:in|on|across)\b|\b(?:limited\s+time\s+offer|act\s+now|don'\s*t\s*miss\s*out)\b)/i;
function normalized(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function duplicateIndexes(values) {
    const seen = new Map();
    const duplicates = [];
    values.forEach((value, index) => {
        const key = normalized(value);
        if (!key)
            return;
        if (seen.has(key))
            duplicates.push(index);
        else
            seen.set(key, index);
    });
    return duplicates;
}
function placeholderUrl(value) {
    if (!value)
        return false;
    try {
        return PLACEHOLDER_HOSTS.has(new URL(value).hostname.toLowerCase());
    }
    catch (_a) {
        return true;
    }
}
export function assessGoogleSearchPlan(plan, options = {}) {
    const parsed = GoogleSearchPlanSchema.safeParse(plan);
    if (!parsed.success) {
        return {
            status: "FAIL",
            errors: parsed.error.issues.map((issue) => `${issue.path.join(".") || "plan"}: ${issue.message}`),
            warnings: [],
        };
    }
    const value = parsed.data;
    const errors = [];
    const warnings = [];
    const allText = [
        value.campaignName,
        ...value.adGroups.flatMap((group) => [
            group.name,
            group.theme,
            ...group.keywords.map((keyword) => keyword.text),
            ...group.headlines,
            ...group.descriptions,
        ]),
    ];
    if (allText.some((text) => INTERNAL_COPY.test(text)))
        errors.push("The plan contains internal Growzzy fallback or instruction text.");
    if (allText.some((text) => UNSUPPORTED_CLAIMS.test(text)))
        errors.push("The plan contains an unsupported guarantee, ranking, statistic, or scarcity claim.");
    if (options.requireFinalUrl && !value.finalUrl)
        errors.push("Add a final landing page URL before launch.");
    if (placeholderUrl(value.finalUrl))
        errors.push("Replace the placeholder landing page with the real destination URL.");
    if (value.adGroups.length < 2)
        warnings.push("Use at least two distinct ad groups when the offer has multiple search intents.");
    for (const [index, group] of value.adGroups.entries()) {
        const label = `Ad group ${index + 1} (${group.name})`;
        if (!group.theme)
            warnings.push(`${label} is missing a distinct search-intent theme.`);
        if (duplicateIndexes(group.keywords.map((keyword) => keyword.text)).length)
            errors.push(`${label} contains duplicate keywords.`);
        if (duplicateIndexes(group.headlines).length)
            errors.push(`${label} contains duplicate headlines.`);
        if (duplicateIndexes(group.descriptions).length)
            errors.push(`${label} contains duplicate descriptions.`);
        if (group.keywords.length < 10)
            warnings.push(`${label} has fewer than 10 keywords.`);
        if (group.negativeKeywords.length < 5)
            warnings.push(`${label} has fewer than 5 negative keywords.`);
        if (group.headlines.length < 8)
            warnings.push(`${label} has fewer than 8 headlines.`);
        if (group.descriptions.length < 3)
            warnings.push(`${label} has fewer than 3 descriptions.`);
        if (group.keywords.some((keyword) => keyword.matchType === "BROAD"))
            warnings.push(`${label} uses broad match; confirm conversion tracking and bidding are ready.`);
    }
    return { status: errors.length ? "FAIL" : warnings.length ? "WARN" : "PASS", errors, warnings };
}
export function parseGoogleSearchPlan(value) {
    const parsed = GoogleSearchPlanSchema.safeParse(value);
    if (!parsed.success)
        return { error: parsed.error.issues.map((issue) => `${issue.path.join(".") || "plan"}: ${issue.message}`).join("; ") };
    const quality = assessGoogleSearchPlan(parsed.data);
    if (quality.status === "FAIL")
        return { error: quality.errors.join(" "), quality };
    return { plan: parsed.data, quality };
}
