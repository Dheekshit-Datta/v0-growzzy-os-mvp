/** Brand context persisted in this browser and fed to the AI on every campaign. */
export interface BrandCompetitor {
  name: string;
  url: string;
  angle: string;
}

export interface BrandSegment {
  segment: string;
  pains: string;
  triggers: string;
}

export interface BrandProfile {
  businessName: string;
  website: string;
  industry: string;
  businessModel: string;
  whatTheySell: string;
  productDescription: string;
  positioning: string;
  differentiators: string[];
  audience: string;
  segments: BrandSegment[];
  competitors: BrandCompetitor[];
  keywords: string[];
  creativeAngles: string[];
  tone: string;
  palette: { name: string; primary: string; accent: string };
  defaultLandingPage: string;
  analyzedAt?: string;
  sources?: string[];
}

export const emptyBrand: BrandProfile = {
  businessName: "",
  website: "",
  industry: "",
  businessModel: "",
  whatTheySell: "",
  productDescription: "",
  positioning: "",
  differentiators: [],
  audience: "",
  segments: [],
  competitors: [],
  keywords: [],
  creativeAngles: [],
  tone: "friendly",
  palette: { name: "Growzzy", primary: "#1F57F5", accent: "#EAF0FE" },
  defaultLandingPage: "",
};

const KEY = "growzzy.brand.v1";

export function loadBrand(): BrandProfile {
  if (typeof window === "undefined") return emptyBrand;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return emptyBrand;
    const parsed = JSON.parse(raw) as Partial<BrandProfile>;
    return {
      ...emptyBrand,
      ...parsed,
      differentiators: Array.isArray(parsed.differentiators) ? parsed.differentiators : [],
      segments: Array.isArray(parsed.segments) ? parsed.segments : [],
      competitors: Array.isArray(parsed.competitors) ? parsed.competitors : [],
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
      creativeAngles: Array.isArray(parsed.creativeAngles) ? parsed.creativeAngles : [],
    };
  } catch {
    return emptyBrand;
  }
}

export function saveBrand(profile: BrandProfile) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(profile));
  window.dispatchEvent(new Event("growzzy:brand-updated"));
}

export function brandIsReady(p: BrandProfile): boolean {
  return Boolean(p?.businessName && (p?.whatTheySell || p?.productDescription));
}

/** Compact, model-readable brand brief. Empty string when nothing is known. */
export function brandContextText(p: BrandProfile): string {
  if (!p || !brandIsReady(p)) return "";
  const lines = [
    p.businessName && `Business: ${p.businessName}`,
    p.website && `Website: ${p.website}`,
    p.industry && `Industry: ${p.industry}`,
    p.businessModel && `Business model: ${p.businessModel}`,
    p.whatTheySell && `What they sell: ${p.whatTheySell}`,
    p.productDescription && `Product detail: ${p.productDescription}`,
    p.positioning && `Positioning: ${p.positioning}`,
    p.differentiators?.length ? `Differentiators: ${p.differentiators.join("; ")}` : null,
    p.audience && `Ideal customer: ${p.audience}`,
    p.segments?.length
      ? `Audience segments:\n${p.segments
          .map((s) => `- ${s.segment} — pains: ${s.pains} | triggers: ${s.triggers}`)
          .join("\n")}`
      : null,
    p.competitors?.length
      ? `Competitors:\n${p.competitors.map((c) => `- ${c.name} (${c.url}) — ${c.angle}`).join("\n")}`
      : null,
    p.keywords?.length ? `Known high-intent keywords: ${p.keywords.join(", ")}` : null,
    p.creativeAngles?.length ? `Creative angles that fit: ${p.creativeAngles.join("; ")}` : null,
    p.tone && `Tone of voice: ${p.tone}`,
    p.defaultLandingPage && `Default landing page: ${p.defaultLandingPage}`,
  ].filter(Boolean);
  return lines.join("\n");
}