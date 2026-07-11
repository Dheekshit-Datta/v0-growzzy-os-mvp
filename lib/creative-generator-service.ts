
import OpenAI from "openai"

let _openai: OpenAI | null = null
const openai = new Proxy({} as OpenAI, {
  get: (_t, prop) => {
    if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    return (_openai as any)[prop]
  },
})

export async function generateAdCreatives(productData: {
  name: string
  description: string
  benefits: string[]
  targetAudience: string
  goal: string
  platform: string
}) {
  try {
    const benefitsList = productData.benefits.join(", ")

    const prompt = `You are an expert direct-response copywriter. Create 10 high-converting ad variations for:

Product: ${productData.name}
Description: ${productData.description}
Key Benefits: ${benefitsList}
Target Audience: ${productData.targetAudience}
Campaign Goal: ${productData.goal}
Platform: ${productData.platform}

For each variation provide JSON with:
- primaryText (max 125 chars, punchy hook)
- headline (max 40 chars)
- description (max 30 chars)
- cta (call-to-action text)
- creativeIdea (what image/video should show)
- psychologicalTrigger (urgency, social proof, curiosity, scarcity, FOMO, exclusivity, etc.)
- score (1-10 predicted performance score)

Use different copywriting frameworks:
- PAS (Problem-Agitate-Solution)
- AIDA (Attention-Interest-Desire-Action)
- Before-After-Bridge
- Problem-Promise-Proof-Push

Return in this JSON format:
{
  "creatives": [
    {
      "primaryText": "...",
      "headline": "...",
      "description": "...",
      "cta": "...",
      "creativeIdea": "...",
      "psychologicalTrigger": "...",
      "score": 9
    }
  ]
}

Make each DIFFERENT, not just word swaps.`

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert direct-response copywriter. Respond ONLY with the requested JSON."
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
    })

    const content = response.choices[0]?.message?.content
    if (content) {
      try {
        const parsed = JSON.parse(content)
        return parsed.creatives || []
      } catch {
        console.error("[v0] Failed to parse creatives JSON")
        return []
      }
    }

    return []
  } catch (error) {
    console.error("[v0] Creative generation error:", error)
    return []
  }
}
