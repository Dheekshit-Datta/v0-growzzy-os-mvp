import OpenAI from "openai"
import { UTILITY_MODEL } from "@/lib/ai-utility"

let _openai: OpenAI | null = null
const openai = new Proxy({} as OpenAI, {
  get: (_t, prop) => {
    if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    return (_openai as any)[prop]
  },
})

export interface AIMessage {
  role: "user" | "assistant" | "system"
  content: string
}

export async function generateAIResponse(messages: AIMessage[]): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key is not set")
  }

  const response = await openai.chat.completions.create({
    model: UTILITY_MODEL,
    messages: messages.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    })),
    temperature: 0.7,
  })

  return response.choices[0]?.message?.content || "(no response)"
}
