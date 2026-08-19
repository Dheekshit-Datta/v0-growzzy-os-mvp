import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export const CHAT_MODEL = "google/gemini-2.5-flash";
export const IMAGE_MODEL = "google/gemini-2.5-flash-image";

export const OPENAI_CHAT_MODEL = "gpt-4o";
export const OPENAI_IMAGE_MODEL = "dall-e-3";

/**
 * Creates the AI provider for AI SDK v7.
 * If LOVABLE_API_KEY or AI_GATEWAY_API_KEY is set, routes through Lovable gateway.
 * Otherwise uses OpenAI endpoint.
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

export function createLovableAiGatewayProvider(apiKey: string) {
  return createAIProvider(apiKey).provider;
}

/** Generates one ad creative image and returns it as a data URL or public URL. */
export async function generateAdImage(
  apiKey: string,
  prompt: string,
  signal?: AbortSignal,
): Promise<{ url: string | null; error?: string }> {
  const isLovable = Boolean(
    process.env["LOVABLE_API_KEY"] || process.env["AI_GATEWAY_API_KEY"]
  );

  // Clean and sanitize prompt for image generation
  const cleanPrompt = prompt
    .replace(/^["']|["']$/g, "")
    .replace(/[`*_#]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 950);

  if (isLovable) {
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
          messages: [{ role: "user", content: cleanPrompt }],
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
      console.error("[growzzy] lovable image generation failed", res.status, detail.slice(0, 300));
      return { url: null, error: `Image service error (${res.status}): ${detail.slice(0, 150)}` };
    }
    const data = (await res.json()) as {
      choices?: { message?: { images?: { image_url?: { url?: string } }[] } }[];
    };
    const url = data.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;
    if (!url) console.error("[growzzy] image generation returned no image");
    return { url, error: url ? undefined : "No image returned" };
  }

  // OpenAI DALL-E image generation with DALL-E 3 -> DALL-E 2 fallback
  const modelsToTry = ["dall-e-3", "dall-e-2"];
  let lastError = "Image generation failed";

  for (const model of modelsToTry) {
    try {
      const res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          prompt: cleanPrompt,
          n: 1,
          size: "1024x1024",
          response_format: "url",
        }),
        signal,
      });

      if (res.ok) {
        const data = (await res.json()) as { data?: { url?: string; b64_json?: string }[] };
        const item = data.data?.[0];
        const url = item?.url || (item?.b64_json ? `data:image/png;base64,${item.b64_json}` : null);
        if (url) return { url };
      } else {
        const errJson = await res.json().catch(() => null);
        const errMsg = errJson?.error?.message || `HTTP ${res.status}`;
        console.warn(`[growzzy] OpenAI ${model} failed:`, errMsg);
        lastError = errMsg;
      }
    } catch (error) {
      if (signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) {
        return { url: null, error: "Generation canceled" };
      }
      lastError = (error as Error).message || "Network error";
    }
  }

  return { url: null, error: `Image generation failed: ${lastError}` };
}
