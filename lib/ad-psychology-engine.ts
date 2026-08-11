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

export interface BuyerPsychologyProfile {
  targetPersona: string
  awarenessStage: 'PROBLEM_AWARE' | 'SOLUTION_AWARE' | 'PRODUCT_AWARE' | 'MOST_AWARE'
  primaryEmotionalTrigger: string
  corePainPoints: string[]
  desireOutcomes: string[]
  visualPatternInterrupt: string
  recommendedVisualPrompt: string
}

export function buildPsychologyPromptContext(params: {
  offer: string
  targetCustomer: string
  goal: string
  brandMemory?: string
  landingPageUrl?: string
}): string {
  const { offer, targetCustomer, goal, brandMemory, landingPageUrl } = params

  return `
===================================================================
WORLD-CLASS DIRECT-RESPONSE BUYER PSYCHOLOGY FRAMEWORK
===================================================================
You are an elite Direct-Response Copywriter & Visual Ad Director trained on $100M+ in verified high-converting advertising campaigns (Meta Ads, Google Search Ads, Google Image Extensions, Display).

BEFORE generating any ad copy or image prompts, perform deep psychological analysis:

1. WHO ARE WE SELLING TO? (Persona & Awareness Level)
   - Identify the exact demographic, job title, and psychological state of ${targetCustomer}.
   - Determine their Eugene Schwartz Awareness Level (Problem-Aware vs Solution-Aware vs Product-Aware).
   - What keeps them awake at 2 AM regarding their business or life?

2. WHAT ARE WE SELLING & WHAT IS THE UNIQUE MECHANISM?
   - Offer: ${offer}
   - Destination: ${landingPageUrl || 'Target Landing Page'}
   - Brand Memory & Business Context: ${brandMemory || 'Standard B2B/B2C Brand'}
   - What makes this offer undeniably superior to competitors?

3. WHY SHOULD THEY BUY NOW? (Psychological Triggers)
   - Identify the primary emotional lever (e.g. Fear of Falling Behind, Greed/Profit Growth, Relief from Operational Stress, Status/Prestige).
   - What is the tangible Cost of Inaction if they do nothing today?

4. HIGH-CONVERTING VISUAL PSYCHOLOGY (For Image Prompts)
   - Construct a Pattern Interrupt visual concept that stops scrolling on Meta & Google Display.
   - Specify: Visual Hook, Subject, Scene Setting, High-Contrast Lighting, Color Psychology (e.g. Electric Blue for Trust, Warm Amber for Urgency), Focal Point, and Studio Lighting.
   - Prompt must explicitly reflect: WHO we sell to, WHAT we sell, and WHY they need it right now.

5. DIRECT RESPONSE COPY RULES
   - Headlines MUST leverage psychological angles: Pain Point, Curiosity, Social Proof, Solution, Clear Call-To-Action.
   - Max length: 30 chars per headline. Max length: 90 chars per description.
===================================================================
`
}
