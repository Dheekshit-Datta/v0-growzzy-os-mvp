import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export const CHAT_MODEL = "google/gemini-2.5-flash";
export const IMAGE_MODEL = "google/gemini-2.5-flash-image";

export function createLovableAiGatewayProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "lovable-ai-gateway",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: {
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
}

/** Generates one ad creative image and returns it as a data URL. */
export async function generateAdImage(
  apiKey: string,
  prompt: string,
  signal?: AbortSignal,
): Promise<{ url: string | null; error?: string }> {
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
