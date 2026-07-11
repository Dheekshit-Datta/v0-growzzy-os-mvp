import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'

let _openai: OpenAI | null = null
const openai = new Proxy({} as OpenAI, {
  get: (_t, prop) => {
    if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    return (_openai as any)[prop]
  },
})

export const CreativeAIService = {
  async generateCopy(prompt: string, platform: string) {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are an expert ad copywriter. Generate a title and primary text for a ${platform} ad.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      functions: [
        {
          name: "format_ad_copy",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string" },
              primaryText: { type: "string" }
            },
            required: ["title", "primaryText"]
          }
        }
      ],
      function_call: { name: "format_ad_copy" }
    })

    const args = response.choices[0].message.function_call?.arguments
    const result = args ? JSON.parse(args) : {}
    
    return {
      title: result.title || "AI Generated Ad",
      primaryText: result.primaryText || "Default ad copy"
    }
  },

  async generateImage(prompt: string) {
    try {
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
      })
      return response.data?.[0]?.url || null
    } catch (err) {
      console.error("DALL-E Generation failed:", err)
      return null
    }
  },

  async createCreative(userId: string, data: {
    title: string,
    primaryText: string,
    imageUrl?: string | null,
    platform: string,
    campaignId?: string,
    prompt?: string
  }) {
    try {
      return await prisma.creative.create({
        data: {
          userId,
          campaignId: data.campaignId,
          name: data.title,
          title: data.title,
          primaryText: data.primaryText,
          imageUrl: data.imageUrl,
          platform: data.platform,
          source: 'ai',
          aiGenerated: true,
          aiPrompt: data.prompt,
          status: 'draft'
        }
      })
    } catch (err) {
      console.error("Creative save failed:", err)
      throw err
    }
  }
}
