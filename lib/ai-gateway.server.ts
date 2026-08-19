import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export const CHAT_MODEL = "google/gemini-2.5-flash";
export const IMAGE_MODEL = "google/gemini-2.5-flash-image";

// Direct OpenAI model names (when using OPENAI_API_KEY directly)
export const OPENAI_CHAT_MODEL = "gpt-4o";
export const OPENAI_IMAGE_MODEL = "dall-e-3";

/**
 * Creates the AI provider.
 * If LOVABLE_API_KEY or AI_GATEWAY_API_KEY is set, uses the Lovable gateway.
 * Otherwise uses direct OpenAI endpoint.
 */
export function createAIProvider(apiKey: string) {
  const isLovable = Boolean(
    process.env["LOVABLE_API_KEY"] || process.env["AI_GATEWAY_API_KEY"]
  );

  if (isLovable) {
    return {
      provider: createOpenAICompatible({
        name: "lovable-ai-gateway",
        baseURL: "https://ai.gateway.lovable.dev/v1",
        apiKey,
        headers: {
          "Lovable-API-Key": apiKey,
          "X-Lovable-AIG-SDK": "vercel-ai-sdk",
        },
      }),
      chatModel: CHAT_MODEL,
    };
  }

  return {
    provider: createOpenAICompatible({
      name: "openai",
      baseURL: "https://api.openai.com/v1",
      apiKey,
    }),
    chatModel: OPENAI_CHAT_MODEL,
  };
}

// Legacy export for backward compatibility
export function createLovableAiGatewayProvider(apiKey: string) {
  return createAIProvider(apiKey).provider;
}

/** Generates one ad creative image and returns it as a data URL. */
export async function generateAdImage(
  apiKey: string,
  prompt: string,
  signal?: AbortSignal,
): Promise<{ url: string | null; error?: string }> {
  const isLovable = Boolean(
    process.env["LOVABLE_API_KEY"] || process.env["AI_GATEWAY_API_KEY"]
  );

  if (isLovable) {
    // Use Lovable gateway for image generation
    let res: Response;
    try {
      res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": apiKey,
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify({
          model: IMAGE_MODEL,
          messages: [{ role: "user", content: prompt }],
          modalities: ["image", "text"],
        }),
        signal,
      });
    } catch (error) {
      if (signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) {
        return { url: null, error: "Generation canceled" };
      }
      throw error;
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[growzzy] image generation failed", res.status, detail.slice(0, 300));
      return { url: null, error: `Image service returned ${res.status}` };
    }
    const data = (await res.json()) as {
      choices?: { message?: { images?: { image_url?: { url?: string } }[] } }[];
    };
    const url = data.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;
    if (!url) console.error("[growzzy] image generation returned no image");
    return { url, error: url ? undefined : "No image returned" };
  }

  // Fall back to OpenAI DALL-E image generation
  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_IMAGE_MODEL,
        prompt,
        n: 1,
        size: "1024x1024",
      }),
      signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[growzzy] OpenAI image generation failed", res.status, detail.slice(0, 300));
      return { url: null, error: `Image service returned ${res.status}` };
    }
    const data = (await res.json()) as { data?: { url?: string }[] };
    const url = data.data?.[0]?.url ?? null;
    return { url, error: url ? undefined : "No image returned" };
  } catch (error) {
    if (signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) {
      return { url: null, error: "Generation canceled" };
    }
    throw error;
  }
}
