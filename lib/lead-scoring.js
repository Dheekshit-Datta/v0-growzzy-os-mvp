/**
 * GROWZZY OS â€” Deterministic Lead Scoring Engine
 * Replaces ALL random-based scores with a calculated model.
 *
 * Score = weighted sum of data-completeness, engagement, and intent signals.
 * Range: 0â€“100
 */
// â”€â”€ Weights â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const WEIGHTS = {
    dataCompleteness: 0.30,
    engagement: 0.35,
    intent: 0.20,
    value: 0.15,
};
// â”€â”€ High-value email domains â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const CORPORATE_DOMAINS = new Set([
    'google.com', 'microsoft.com', 'apple.com',
    'meta.com', 'facebook.com', 'salesforce.com', 'hubspot.com',
    'stripe.com', 'oracle.com', 'ibm.com',
]);
const FREE_DOMAINS = new Set([
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
    'aol.com', 'protonmail.com', 'mail.com', 'yandex.com',
]);
// â”€â”€ High-intent sources â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const HIGH_INTENT_SOURCES = {
    'referral': 90,
    'organic': 80,
    'direct': 75,
    'google_ads': 70,
    'meta_ads': 65,
    'webinar': 85,
    'demo_request': 95,
    'pricing_page': 90,
    'content_download': 55,
    'social': 40,
    'import': 30,
    'manual': 30,
    'cold_outreach': 20,
};
// â”€â”€ Seniority keywords â†’ higher intent â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SENIORITY_SCORES = {
    'ceo': 100, 'cto': 100, 'cfo': 100, 'cmo': 100, 'coo': 100,
    'founder': 95, 'co-founder': 95, 'owner': 90,
    'vp': 85, 'vice president': 85,
    'director': 80, 'head of': 75,
    'senior': 65, 'lead': 60,
    'manager': 55, 'specialist': 40,
    'associate': 30, 'intern': 10,
};
// â”€â”€ Main Scoring Function â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function calculateLeadScore(input) {
    var _a;
    // 1. Data Completeness (0â€“100)
    let dataScore = 0;
    if (input.email)
        dataScore += 20;
    if (input.phone)
        dataScore += 15;
    if (input.company)
        dataScore += 25;
    if (input.position)
        dataScore += 15;
    if (input.source)
        dataScore += 10;
    if (input.estimatedValue && input.estimatedValue > 0)
        dataScore += 15;
    // Bonus for corporate email
    if (input.email) {
        const domain = ((_a = input.email.split('@')[1]) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || '';
        if (CORPORATE_DOMAINS.has(domain)) {
            dataScore = Math.min(100, dataScore + 15);
        }
        else if (!FREE_DOMAINS.has(domain) && domain.length > 0) {
            // Custom corporate domain â€” good signal
            dataScore = Math.min(100, dataScore + 10);
        }
    }
    // 2. Engagement Score (0â€“100)
    let engagementScore = 0;
    engagementScore += Math.min(30, (input.openedEmails || 0) * 5);
    engagementScore += Math.min(40, (input.clickedAds || 0) * 10);
    engagementScore += input.visitedWebsite ? 20 : 0;
    engagementScore += Math.min(10, (input.pagesViewed || 0) * 2);
    engagementScore = Math.min(100, engagementScore);
    // If no engagement data yet, give a baseline from source quality
    if (!input.openedEmails && !input.clickedAds && !input.visitedWebsite) {
        const sourceKey = (input.source || 'manual').toLowerCase().replace(/\s+/g, '_');
        engagementScore = (HIGH_INTENT_SOURCES[sourceKey] || 30) * 0.4; // 40% of source intent
    }
    // 3. Intent Score (0â€“100)
    let intentScore = 0;
    // Source-based intent
    const sourceKey = (input.source || 'manual').toLowerCase().replace(/\s+/g, '_');
    intentScore += (HIGH_INTENT_SOURCES[sourceKey] || 30) * 0.5;
    // Position/seniority-based intent
    if (input.position) {
        const posLower = input.position.toLowerCase();
        for (const [keyword, score] of Object.entries(SENIORITY_SCORES)) {
            if (posLower.includes(keyword)) {
                intentScore += score * 0.5;
                break;
            }
        }
    }
    intentScore = Math.min(100, intentScore);
    // 4. Value Score (0â€“100)
    let valueScore = 0;
    const val = input.estimatedValue || 0;
    if (val >= 100000)
        valueScore = 100;
    else if (val >= 50000)
        valueScore = 85;
    else if (val >= 20000)
        valueScore = 70;
    else if (val >= 10000)
        valueScore = 55;
    else if (val >= 5000)
        valueScore = 40;
    else if (val >= 1000)
        valueScore = 25;
    else if (val > 0)
        valueScore = 15;
    else
        valueScore = 10; // Unknown value
    // â”€â”€ Weighted Total â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const totalScore = Math.round(dataScore * WEIGHTS.dataCompleteness +
        engagementScore * WEIGHTS.engagement +
        intentScore * WEIGHTS.intent +
        valueScore * WEIGHTS.value);
    const clampedScore = Math.max(0, Math.min(100, totalScore));
    // â”€â”€ Tier Assignment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    let tier;
    if (clampedScore >= 80)
        tier = 'HOT';
    else if (clampedScore >= 55)
        tier = 'WARM';
    else if (clampedScore >= 30)
        tier = 'COLD';
    else
        tier = 'ICE';
    // â”€â”€ Reasoning â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const reasons = [];
    if (dataScore >= 70)
        reasons.push('Complete profile data');
    else if (dataScore < 40)
        reasons.push('Incomplete profile â€” get more info');
    if (engagementScore >= 50)
        reasons.push('High engagement signals');
    if (intentScore >= 60)
        reasons.push('Strong buying intent from source/role');
    if (valueScore >= 70)
        reasons.push('High estimated deal value');
    if (input.company && input.position)
        reasons.push('Decision-maker at identified company');
    return {
        score: clampedScore,
        tier,
        breakdown: {
            dataCompleteness: Math.round(dataScore),
            engagementScore: Math.round(engagementScore),
            intentScore: Math.round(intentScore),
            valueScore: Math.round(valueScore),
        },
        reasoning: reasons.length > 0 ? reasons.join('. ') + '.' : 'Baseline score â€” enrich data for accuracy.',
    };
}
