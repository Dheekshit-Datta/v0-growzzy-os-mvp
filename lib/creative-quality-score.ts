/**
 * Weighted Creative Quality Scoring
 *
 * Scores RSA copy 0-100 across multiple weighted dimensions:
 * - Headline angle coverage (25%)
 * - Quantified/specificity (20%)
 * - Offer/brand presence (15%)
 * - Emotional trigger presence (15%)
 * - Banned phrase avoidance (15%)
 * - Sentence structure (10%)
 */

import { BANNED_FILLER_PHRASES } from "./google-plan-quality"

export type CreativeQualityScore = {
  total: number
  dimensions: {
    angleCoverage: { score: number; weight: number; reason: string }
    specificity: { score: number; weight: number; reason: string }
    offerPresence: { score: number; weight: number; reason: string }
    emotionalTrigger: { score: number; weight: number; reason: string }
    bannedPhrases: { score: number; weight: number; reason: string }
    sentenceStructure: { score: number; weight: number; reason: string }
  }
  passed: boolean
  threshold: number
}

const PASS_THRESHOLD = 70

const ANGLE_KEYWORDS: Record<string, RegExp> = {
  pain_point: /\b(pain|frustrat|issue|problem|struggle|tired|hate|annoying|exhausted)\b/i,
  solution: /\b(solution|fix|answer|solve|tool|method|approach|system)\b/i,
  urgency: /\b(now|today|hurry|limited|act fast|expires|deadline|don't wait)\b/i,
  cta: /\b(get|start|book|order|try|sign|request|call|download|claim)\b/i,
  social_proof: /\b(trusted|proven|reviews|testimonial|customers|users|companies|rated)\b/i,
  risk_reversal: /\b(guarantee|refund|risk-free|no commitment|cancel anytime|warranty|trial)\b/i,
  feature: /\b(integration|api|platform|app|dashboard|automation|analytics|secure)\b/i,
  question: /^(how|what|why|when|where|which|who|do you|are you|is your)/i,
}

export function scoreCreativeQuality(
  headlines: string[],
  descriptions: string[],
  offer: string,
  brandToken?: string
): CreativeQualityScore {
  const dims = {
    angleCoverage: scoreAngleCoverage(headlines),
    specificity: scoreSpecificity(headlines, descriptions),
    offerPresence: scoreOfferPresence(headlines, descriptions, offer, brandToken),
    emotionalTrigger: scoreEmotionalTrigger(headlines, descriptions),
    bannedPhrases: scoreBannedPhrases(headlines, descriptions),
    sentenceStructure: scoreSentenceStructure(descriptions),
  }

  const total = Math.round(
    Object.values(dims).reduce((sum, d) => sum + d.score * d.weight, 0)
  )

  return {
    total,
    dimensions: dims,
    passed: total >= PASS_THRESHOLD,
    threshold: PASS_THRESHOLD,
  }
}

function scoreAngleCoverage(headlines: string[]): CreativeQualityScore["dimensions"]["angleCoverage"] {
  if (headlines.length === 0) return { score: 0, weight: 0.25, reason: "No headlines" }

  const detectedAngles = new Set<string>()
  for (const h of headlines) {
    for (const [angle, regex] of Object.entries(ANGLE_KEYWORDS)) {
      if (regex.test(h)) detectedAngles.add(angle)
    }
  }
  const coverage = detectedAngles.size / 6
  return {
    score: Math.min(100, Math.round(coverage * 100)),
    weight: 0.25,
    reason: `${detectedAngles.size}/6 distinct angles: ${Array.from(detectedAngles).join(", ")}`,
  }
}

function scoreSpecificity(headlines: string[], descriptions: string[]): CreativeQualityScore["dimensions"]["specificity"] {
  const all = [...headlines, ...descriptions]
  if (all.length === 0) return { score: 0, weight: 0.20, reason: "No copy" }

  let quantified = 0
  for (const text of all) {
    if (/\b\d+(\.\d+)?%?\b/.test(text)) quantified++
    if (/\b\d+\s+(hours?|minutes?|days?|weeks?|months?|years?)\b/i.test(text)) quantified++
    if (/\$\d+/.test(text)) quantified++
  }
  const ratio = quantified / all.length
  return {
    score: Math.min(100, Math.round(ratio * 200)),
    weight: 0.20,
    reason: `${quantified}/${all.length} copy lines have specific numbers/timeframes/prices`,
  }
}

function scoreOfferPresence(headlines: string[], descriptions: string[], offer: string, brandToken?: string): CreativeQualityScore["dimensions"]["offerPresence"] {
  const all = [...headlines, ...descriptions]
  if (all.length === 0) return { score: 0, weight: 0.15, reason: "No copy" }

  const offerTokens = offer
    .toLowerCase()
    .split(/\s+/)
    .filter(t => t.length > 3)
    .slice(0, 5)

  if (offerTokens.length === 0 && !brandToken) {
    return { score: 50, weight: 0.15, reason: "No offer tokens extracted" }
  }

  let withOfferToken = 0
  for (const text of all) {
    const lower = text.toLowerCase()
    if (offerTokens.some(t => lower.includes(t))) withOfferToken++
    else if (brandToken && lower.includes(brandToken.toLowerCase())) withOfferToken++
  }
  const ratio = withOfferToken / all.length
  return {
    score: Math.min(100, Math.round(ratio * 100)),
    weight: 0.15,
    reason: `${withOfferToken}/${all.length} copy lines reference offer/brand`,
  }
}

function scoreEmotionalTrigger(headlines: string[], descriptions: string[]): CreativeQualityScore["dimensions"]["emotionalTrigger"] {
  const all = [...headlines, ...descriptions]
  if (all.length === 0) return { score: 0, weight: 0.15, reason: "No copy" }

  const emotionalWords = /\b(stop|lose|miss|discover|unlock|reveal|secret|imagine|finally|breakthrough|win|achieve|dominate|transform|boost|elevate|maximize|effortless|seamless|amazing|incredible|powerful)\b/i
  let withEmotion = 0
  for (const text of all) {
    if (emotionalWords.test(text)) withEmotion++
  }
  const ratio = withEmotion / all.length
  return {
    score: Math.min(100, Math.round(ratio * 150)),
    weight: 0.15,
    reason: `${withEmotion}/${all.length} copy lines have emotional triggers`,
  }
}

function scoreBannedPhrases(headlines: string[], descriptions: string[]): CreativeQualityScore["dimensions"]["bannedPhrases"] {
  const all = [...headlines, ...descriptions]
  if (all.length === 0) return { score: 0, weight: 0.15, reason: "No copy" }

  let violations = 0
  for (const text of all) {
    if (BANNED_FILLER_PHRASES.some(f => text.toLowerCase().includes(f))) violations++
  }
  if (violations === 0) {
    return { score: 100, weight: 0.15, reason: "No banned phrases" }
  }
  const penalty = (violations / all.length) * 100
  return {
    score: Math.max(0, Math.round(100 - penalty * 2)),
    weight: 0.15,
    reason: `${violations} banned phrase(s): ${BANNED_FILLER_PHRASES.slice(0, 3).join(" | ")}`,
  }
}

function scoreSentenceStructure(descriptions: string[]): CreativeQualityScore["dimensions"]["sentenceStructure"] {
  if (descriptions.length === 0) return { score: 0, weight: 0.10, reason: "No descriptions" }

  let totalScore = 0
  for (const d of descriptions) {
    const words = d.split(/\s+/).length
    if (words > 15) totalScore += 30
    else if (words > 12) totalScore += 60
    else if (words >= 8) totalScore += 100
    else totalScore += 70
  }
  return {
    score: Math.round(totalScore / descriptions.length),
    weight: 0.10,
    reason: `Avg ${(descriptions.reduce((s, d) => s + d.split(/\s+/).length, 0) / descriptions.length).toFixed(1)} words/description (target 8-12)`,
  }
}
