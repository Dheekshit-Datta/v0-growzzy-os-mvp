/** Brand context persisted in this browser and fed to the AI on every campaign. */
export type UserRole =
  | "founder"
  | "marketing_manager"
  | "growth_lead"
  | "agency_owner"
  | "performance_marketer"
  | "brand_marketer"
  | "content_creator"
  | "sales_lead"
  | "consultant"
  | "other";

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
  /** The user's role in the business. Drives how the AI frames answers. */
  userRole?: UserRole;
  /** Optional context about what the user is responsible for. */
  userResponsibility?: string;
}

export const USER_ROLE_OPTIONS: { value: UserRole; label: string; description: string }[] = [
  { value: "founder", label: "Founder / CEO", description: "Owns the business end-to-end. Wants growth, P&L, and ROI." },
  { value: "marketing_manager", label: "Marketing Manager", description: "Runs the marketing function. Needs to execute campaigns and report results." },
  { value: "growth_lead", label: "Growth Lead", description: "Owns acquisition funnel and experiments. Lives in conversion data." },
  { value: "agency_owner", label: "Agency Owner", description: "Runs the agency. Builds campaigns for multiple clients and needs client-ready output." },
  { value: "performance_marketer", label: "Performance Marketer", description: "Hands-on with ad platforms. Wants tactical depth on bidding, audiences, and creative." },
  { value: "brand_marketer", label: "Brand Marketer", description: "Focused on positioning, creative, and brand storytelling over direct response." },
  { value: "content_creator", label: "Content Creator", description: "Produces organic and paid content. Wants creative hooks and angles." },
  { value: "sales_lead", label: "Sales Lead", description: "Drives pipeline and revenue. Wants lead quality and conversion, not impressions." },
  { value: "consultant", label: "Consultant / Advisor", description: "Advises clients on strategy. Needs frameworks and decision support." },
  { value: "other", label: "Other", description: "Pick this if none of the above fit and add a note in the responsibility field." },
];

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
  const roleLabel = USER_ROLE_OPTIONS.find((r) => r.value === p.userRole)?.label;
  const lines = [
    roleLabel && `User role: ${roleLabel}${p.userResponsibility ? ` (${p.userResponsibility})` : ""}`,
    p.businessName && `Business: ${p.businessName}`,
    p.website && `Website: ${p.website}`,
    p.industry && `Industry: ${p.industry}`,
    p.businessModel && `Business model: ${p.businessModel}`,
    p.whatTheySell && `What they sell: ${p.whatTheySell}`,
    p.productDescription && `Product detail: ${p.productDescription}`,
    p.positioning && `Positioning: ${p.positioning}`,
    p.differentiators?.length ? `Differentiators: ${p.differentiators.join("; ")}` : null,
    p.audience && `Ideal customer: ${p.audience}`,
    Array.isArray(p.segments) && p.segments.length
      ? `Audience segments:\n${p.segments
          .map((s) => `- ${s?.segment ?? ""} — pains: ${s?.pains ?? ""} | triggers: ${s?.triggers ?? ""}`)
          .join("\n")}`
      : null,
    Array.isArray(p.competitors) && p.competitors.length
      ? `Competitors:\n${p.competitors.map((c) => `- ${c?.name ?? ""} (${c?.url ?? ""}) — ${c?.angle ?? ""}`).join("\n")}`
      : null,
    Array.isArray(p.keywords) && p.keywords.length ? `Known high-intent keywords: ${p.keywords.join(", ")}` : null,
    Array.isArray(p.creativeAngles) && p.creativeAngles.length ? `Creative angles that fit: ${p.creativeAngles.join("; ")}` : null,
    p.tone && `Tone of voice: ${p.tone}`,
    p.defaultLandingPage && `Default landing page: ${p.defaultLandingPage}`,
  ].filter(Boolean);
  return lines.join("\n");
}