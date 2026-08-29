/**
 * Direct-Response Buyer Psychology & High-Converting Ad Framework Engine
 *
 * Synthesizes the 5 Pillars of Ad Conversion Science:
 * 1. Target Audience Persona & Eugene Schwartz Customer Awareness Spectrum
 * 2. Emotional Motivators & Psychological Drivers (Pain, Desire, Fear of Inaction)
 * 3. Offer Positioning & Unique Mechanism
 * 4. High-CTR Pattern-Interrupt Visual Concepts for DALL-E 3
 * 5. Proven Direct-Response Copywriting Frameworks (PAS, AIDA, BAB)
 */

import { cachedUtilityCompletion } from "@/lib/ai-utility"

export interface BuyerPsychologyProfile {
  targetPersona: string
  awarenessStage: 'PROBLEM_AWARE' | 'SOLUTION_AWARE' | 'PRODUCT_AWARE' | 'MOST_AWARE'
  primaryEmotionalTrigger: string
  corePainPoints: string[]
  desireOutcomes: string[]
  visualPatternInterrupt: string
  recommendedVisualPrompt: string
}

export async function buildPsychologyPromptContext(params: {
  offer: string
  targetCustomer: string
  goal: string
  brandMemory?: string
  landingPageUrl?: string
  workspaceId?: string
  userId?: string
}): Promise<BuyerPsychologyProfile> {
  const { offer, targetCustomer, goal, brandMemory, landingPageUrl, workspaceId, userId } = params;

  if (!process.env.OPENAI_API_KEY) {
    return getFallbackPsychologyProfile(offer, targetCustomer, goal, brandMemory || "");
  }

  const systemPrompt = `You are an expert psychologist and marketing strategist specializing in direct-response advertising. Analyze the provided business information to extract deep psychological insights for creating high-converting ad campaigns.

Return a JSON object with EXACTLY these fields:
{
  "targetPersona": "string (e.g., 'founder', 'parent', 'student', 'executive')",
  "awarenessStage": "one of: 'PROBLEM_AWARE', 'SOLUTION_AWARE', 'PRODUCT_AWARE', 'MOST_AWARE'",
  "primaryEmotionalTrigger": "string describing the main emotional driver",
  "corePainPoints": ["array of 2-4 specific pain points"],
  "desireOutcomes": ["array of 2-4 specific desired outcomes"],
  "visualPatternInterrupt": "string describing a scroll-stopping visual concept",
  "recommendedVisualPrompt": "string for DALL-E 3 image generation"
}

Follow the 5-step framework:
1. WHO: Identify the actual persona and awareness level (not generic)
2. WHAT: Analyze the offer with context
3. WHY: Extract psychological triggers and emotional levers
4. VISUAL: Generate pattern-interrupt concepts
5. COPY: Specify psychological angles for headlines

Base your analysis on proven psychological frameworks like Eugene Schwartz's Customer Awareness Spectrum, PAS (Pain-Agitate-Solution), AIDA, and emotional trigger mapping.

Be specific and insightful - avoid generic responses. Tailor everything to the specific input provided.`

  const userPromptLines = [
    `Analyze this business for psychological insights:`,
    `OFFER: ${offer}`,
    `TARGET CUSTOMER: ${targetCustomer}`,
    `GOAL: ${goal}`,
  ]
  if (brandMemory) userPromptLines.push(`BRAND MEMORY: ${brandMemory}`)
  if (landingPageUrl) userPromptLines.push(`LANDING PAGE URL: ${landingPageUrl}`)
  userPromptLines.push(`Provide deep psychological analysis following the 5-step framework. Return ONLY the JSON object as specified.`)

  const userPrompt = userPromptLines.join("\n\n")

  try {
    const rawContent = await cachedUtilityCompletion({
      route: "/api/ai/psychology-profile",
      operation: "buyer-psychology",
      userId: userId || "system",
      workspaceId: workspaceId || "global",
      input: { offer, targetCustomer, goal, brandMemory: brandMemory || "", landingPageUrl: landingPageUrl || "" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      json: true,
    })

    const parsed = JSON.parse(rawContent || "{}")
    return validateAndReturnPsychologyProfile(parsed)
  } catch (error) {
    console.error("Psychological analysis failed, using fallback:", error);
    return getFallbackPsychologyProfile(offer, targetCustomer, goal, brandMemory || "");
  }
}


// Fallback function for when OpenAI is unavailable
function getFallbackPsychologyProfile(offer: string, targetCustomer: string, goal: string, brandMemory: string): BuyerPsychologyProfile {
  // Simple heuristic-based fallback (much simpler than before)
  const combined = (offer + ' ' + targetCustomer + ' ' + goal + ' ' + brandMemory).toLowerCase();

  // Determine target persona
  let targetPersona = "Business Owner";
  const personas = [
    'founder', 'ceo', 'cmo', 'marketing director', 'agency owner',
    'operations director', 'e-commerce brand', 'local business owner',
    'corporate client', 'online shopper', 'lifestyle consumer',
    'executive', 'consultant', 'entrepreneur', 'homeowner', 'local resident',
    'student', 'parent', 'learner', 'tester', 'examinee', 'applicant',
    'high schooler', 'college bound', 'test taker', 'study group'
  ];

  for (const persona of personas) {
    if (combined.includes(persona)) {
      targetPersona = persona;
      break;
    }
  }

  // Determine awareness stage
  let awarenessStage: 'PROBLEM_AWARE' | 'SOLUTION_AWARE' | 'PRODUCT_AWARE' | 'MOST_AWARE' = 'PROBLEM_AWARE';
  if (combined.includes('looking for') || combined.includes('need') ||
      combined.includes('solution') || combined.includes('tool') ||
      combined.includes('software') || combined.includes('platform') ||
      combined.includes('service')) {
    awarenessStage = 'SOLUTION_AWARE';
  } else if (combined.includes('comparison') || combined.includes('vs') ||
             combined.includes('alternative') || combined.includes('better than')) {
    awarenessStage = 'PRODUCT_AWARE';
  } else if (!(combined.includes('struggling') || combined.includes('problem') ||
             combined.includes('issue') || combined.includes('frustrated') ||
             combined.includes('tired of') || combined.includes('manual') ||
             combined.includes('wasting time') || combined.includes('inefficient'))) {
    awarenessStage = 'MOST_AWARE';
  }

  // Determine primary emotional trigger
  let primaryEmotionalTrigger = "Desire for improvement";
  const triggerMap: Record<string, string[]> = {
    'Relief from manual work': ['manual', 'time consuming', 'tedious', 'repetitive', 'automation', 'automate', 'automated'],
    'Scalable ARR Growth': ['scale', 'growth', 'arr', 'revenue', 'profit'],
    'Competitive Advantage': ['competitive', 'advantage', 'edge', 'outperform'],
    'High ROAS Guarantee': ['roas', 'roi', 'return', 'profitable', 'profitable'],
    'Client Retention': ['retention', 'keep clients', 'reduce churn', 'loyalty'],
    'Predictable Customer Acquisition': ['predictable', 'consistent', 'steady', 'reliable'],
    'Instant Gratification': ['instant', 'immediate', 'fast', 'quick'],
    'Social Proof': ['reviews', 'testimonials', 'trusted', 'popular'],
    'Exclusive Discount': ['discount', 'sale', 'offer', 'deal', 'coupon'],
    'Authority': ['authority', 'expert', 'leader', 'influential'],
    'Career Advancement': ['career', 'advancement', 'promotion', 'growth'],
    'Freedom & Revenue Growth': ['freedom', 'flexibility', 'revenue', 'income'],
    'Urgency': ['urgent', 'limited time', 'expiring', 'deadline'],
    'Local Trust': ['local', 'community', 'neighborhood', 'nearby'],
    'Fast Free Estimate': ['estimate', 'quote', 'assessment', 'evaluation'],
    'Score Improvement Anxiety': ['score', 'points', 'improve', 'increase', 'boost', 'higher'],
    'College Admission Stress': ['college', 'admission', 'accept', 'university', 'school', 'apply'],
    'Test Taking Confidence': ['confident', 'confidence', 'relaxed', 'calm', 'prepared', 'ready'],
    'Concept Mastery Frustration': ['struggling', 'confused', 'difficult', 'hard', 'understand', 'grasp'],
    'Time Management Stress': ['time', 'timing', 'pacing', 'rush', 'slow', 'finish', 'complete'],
    'Scholarship Eligibility Hope': ['scholarship', 'financial aid', 'grant', 'money', 'afford', 'cost']
  };

  for (const [trigger, keywords] of Object.entries(triggerMap)) {
    if (keywords.some(keyword => combined.includes(keyword))) {
      primaryEmotionalTrigger = trigger;
      break;
    }
  }

  // Simple pain points and desires based on keywords
  let corePainPoints: string[] = [
    'Not reaching enough potential customers',
    'Spending too much on ineffective marketing'
  ];

  let desireOutcomes: string[] = [
    'More customers and sales',
    'Better return on marketing investment'
  ];

  // Add context-specific pain points/desires if keywords match
  if (combined.includes('score') || combined.includes('test') || combined.includes('exam') || combined.includes('sat') || combined.includes('act')) {
    corePainPoints = [
      'Struggling to improve test scores despite studying',
      'Test anxiety affecting performance on exam day'
    ];
    desireOutcomes = [
      'Significant score improvement on standardized tests',
      'Reduced test anxiety and increased confidence'
    ];
  } else if (combined.includes('lead') || combined.includes('sales') || combined.includes('customer')) {
    corePainPoints = [
      'Manual lead follow-up taking too much time',
      'Inconsistent lead quality and quantity'
    ];
    desireOutcomes = [
      'Consistent flow of qualified leads',
      'Reduced manual work in lead generation'
    ];
  } else if (combined.includes('jewelry') || combined.includes('fashion') || combined.includes('store') || combined.includes('shop')) {
    corePainPoints = [
      'High cart abandonment rates',
      'Difficulty standing out in crowded markets'
    ];
    desireOutcomes = [
      'Increased sales and order volume',
      'Strong brand recognition and loyalty'
    ];
  }

  // Visual concepts
  let visualPatternInterrupt = "Professional modern interface showing key benefit";
  let recommendedVisualPrompt = "Professional modern interface showing key benefit, clean design with professional lighting, 4k digital render";

  if (combined.includes('sat') || combined.includes('test') || combined.includes('exam') || combined.includes('student') || combined.includes('parent')) {
    visualPatternInterrupt = "Student studying at desk with laptop showing practice questions, calm focused expression";
    recommendedVisualPrompt = "Student studying at desk with laptop showing SAT practice questions, calm focused expression, soft natural lighting";
  } else if (combined.includes('lead') || combined.includes('ai') || combined.includes('automation') || combined.includes('saas')) {
    visualPatternInterrupt = "Modern B2B SaaS dashboard with glowing analytics and clean neon accents";
    recommendedVisualPrompt = "Professional modern B2B SaaS dashboard interface showing AI lead generation analytics, dark mode UI with glowing royal blue accent lighting, sleek 3D isometric metric charts, 4k digital render";
  } else if (combined.includes('jewelry') || combined.includes('fashion') || combined.includes('store') || combined.includes('shop')) {
    visualPatternInterrupt = "Elegant product shot with vibrant colors and social proof elements";
    recommendedVisualPrompt = "Clean aesthetic product hero shot on pastel podium with soft ambient studio lighting, floating 5-star customer rating badge, 8k commercial photography";
  }

  return {
    targetPersona,
    awarenessStage,
    primaryEmotionalTrigger,
    corePainPoints,
    desireOutcomes,
    visualPatternInterrupt,
    recommendedVisualPrompt
  };
}

// Validate and ensure the psychology profile has correct types
function validateAndReturnPsychologyProfile(parsed: any): BuyerPsychologyProfile {
  // Validate awarenessStage
  const validAwarenessStages: ('PROBLEM_AWARE' | 'SOLUTION_AWARE' | 'PRODUCT_AWARE' | 'MOST_AWARE')[] =
    ['PROBLEM_AWARE', 'SOLUTION_AWARE', 'PRODUCT_AWARE', 'MOST_AWARE'];
  let awarenessStage: 'PROBLEM_AWARE' | 'SOLUTION_AWARE' | 'PRODUCT_AWARE' | 'MOST_AWARE' = 'PROBLEM_AWARE';
  if (parsed.awarenessStage && validAwarenessStages.includes(parsed.awarenessStage as any)) {
    awarenessStage = parsed.awarenessStage as typeof awarenessStage;
  }

  // Ensure arrays are arrays and have reasonable length
  const corePainPoints = Array.isArray(parsed.corePainPoints) ? parsed.corePainPoints.slice(0, 4) : ['Not reaching enough potential customers'];
  const desireOutcomes = Array.isArray(parsed.desireOutcomes) ? parsed.desireOutcomes.slice(0, 4) : ['More customers and sales'];

  return {
    targetPersona: String(parsed.targetPersona || 'Business Owner'),
    awarenessStage: awarenessStage,
    primaryEmotionalTrigger: String(parsed.primaryEmotionalTrigger || 'Desire for improvement'),
    corePainPoints: corePainPoints,
    desireOutcomes: desireOutcomes,
    visualPatternInterrupt: String(parsed.visualPatternInterrupt || 'Professional modern interface showing key benefit'),
    recommendedVisualPrompt: String(parsed.recommendedVisualPrompt || 'Professional modern interface showing key benefit, clean design with professional lighting, 4k digital render')
  };
}