"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/dashboard-v2/shell";
import { PageHeader, SectionCard } from "@/components/growzzy/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Sparkles,
  Check,
  Globe,
  Loader2,
  ExternalLink,
  Plus,
  X,
  Trash2,
  Download,
  Pencil,
  Briefcase,
  CircleHelp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  loadBrand,
  saveBrand,
  brandIsReady,
  emptyBrand,
  USER_ROLE_OPTIONS,
  type BrandProfile,
  type UserRole,
} from "@/lib/brand-store";

const PRODUCT_NAME = process.env.NEXT_PUBLIC_PRODUCT_NAME || "Growzzy OS";

const palettes = [
  { name: PRODUCT_NAME.replace(" OS", ""), primary: "#1F57F5", accent: "#EAF0FE" },
  { name: "Ember", primary: "#F97316", accent: "#FEF0E6" },
  { name: "Forest", primary: "#059669", accent: "#E7F5EF" },
  { name: "Rose", primary: "#E11D48", accent: "#FCE7EC" },
  { name: "Slate", primary: "#0F172A", accent: "#E9EBEF" },
];

const tones = [
  { value: "friendly", label: "Friendly", sample: "Hey! Grab yours before they're gone ✨" },
  {
    value: "professional",
    label: "Professional",
    sample: "Trusted by 10,000+ businesses worldwide.",
  },
  { value: "playful", label: "Playful", sample: "Warning: dangerously good products inside 💎" },
  { value: "premium", label: "Premium", sample: "Crafted for those who notice the details." },
];

/** Editable list of short strings, rendered as removable chips. */
function ChipEditor({
  items = [],
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v || items.includes(v)) return;
    onChange([...items, v]);
    setDraft("");
  };
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[11.5px] text-foreground"
          >
            {t}
            <button
              type="button"
              aria-label={`Remove ${t}`}
              onClick={() => onChange(items.filter((x) => x !== t))}
              className="text-muted-foreground hover:text-red-500 cursor-pointer"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="h-8 text-[12.5px]"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={add}
          className="h-8 shrink-0 gap-1 cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>
    </div>
  );
}

export default function BrandPage() {
  const [brand, setBrand] = useState<BrandProfile>(emptyBrand);
  const [urlInput, setUrlInput] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [tab, setTab] = useState<"edit" | "memory">("edit");
  const [showIcpGuide, setShowIcpGuide] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "memory") setTab("memory");
  }, []);

  useEffect(() => {
    const loaded = loadBrand();
    setBrand(loaded);
    setUrlInput(loaded.website);
  }, []);

  const set =
    <K extends keyof BrandProfile>(k: K) =>
    (v: BrandProfile[K]) =>
      setBrand((b) => ({ ...b, [k]: v }));

  const ready = brandIsReady(brand);

  const runAnalysis = async () => {
    if (!urlInput.trim()) {
      toast.error("Add your website URL first.");
      return;
    }
    setAnalyzing(true);
    try {
      const res = await fetch("/api/brand/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput.trim(), websiteUrl: urlInput.trim() }),
      });
      if (!res.ok) throw new Error("Analysis failed");
      const data = await res.json();
      const profile = data.profile || data.data?.brandMemory || {};
      const site = data.site || urlInput.trim();

      const next: BrandProfile = {
        ...brand,
        website: site,
        defaultLandingPage: brand.defaultLandingPage || site,
        businessName: profile.businessName || brand.businessName,
        industry: profile.industry || brand.industry,
        businessModel: profile.businessModel || brand.businessModel,
        whatTheySell: profile.whatTheySell || brand.whatTheySell,
        productDescription: profile.productDescription || brand.productDescription,
        positioning: profile.positioning || brand.positioning,
        differentiators: profile.differentiators ?? brand.differentiators,
        audience: profile.audience || brand.audience,
        segments: profile.segments ?? brand.segments,
        competitors: profile.competitors ?? brand.competitors,
        keywords: profile.keywords ?? brand.keywords,
        creativeAngles: profile.creativeAngles ?? brand.creativeAngles,
        tone: profile.tone || brand.tone,
        analyzedAt: new Date().toISOString(),
        sources: profile.sources ?? brand.sources,
      };
      setBrand(next);
      saveBrand(next);
      window.dispatchEvent(new Event("growzzy:brand-updated"));
      toast.success(`Analysed ${next.businessName}. ${PRODUCT_NAME} now knows your business.`);
    } catch (e) {
      toast.error((e as { message?: string })?.message ?? "Couldn't analyse that website.");
    } finally {
      setAnalyzing(false);
    }
  };

  const save = () => {
    saveBrand(brand);
    window.dispatchEvent(new Event("growzzy:brand-updated"));
    toast.success(`Brand context saved. ${PRODUCT_NAME} uses it on every campaign.`);
  };

  const exportReport = async () => {
    if (!brandIsReady(brand)) {
      toast.error("Analyse or complete your brand before exporting a report.");
      return;
    }
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 48;
    const contentWidth = pageWidth - margin * 2;
    let y = 54;

    const ensureSpace = (height: number) => {
      if (y + height <= pageHeight - 48) return;
      pdf.addPage();
      y = 54;
    };
    const line = (text: string, size = 10, color: [number, number, number] = [16, 22, 31]) => {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(size);
      pdf.setTextColor(...color);
      const rows = pdf.splitTextToSize(text || "Not provided", contentWidth) as string[];
      ensureSpace(rows.length * (size + 4));
      pdf.text(rows, margin, y);
      y += rows.length * (size + 4) + 5;
    };
    const heading = (text: string) => {
      ensureSpace(34);
      y += 10;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.setTextColor(31, 87, 245);
      pdf.text(text, margin, y);
      y += 20;
    };

    pdf.setFillColor(31, 87, 245);
    pdf.rect(0, 0, pageWidth, 10, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(23);
    pdf.setTextColor(16, 22, 31);
    pdf.text(`${brand.businessName} — Brand Research`, margin, y);
    y += 22;
    line(
      `Prepared by ${PRODUCT_NAME}${brand.analyzedAt ? ` · Research updated ${new Date(brand.analyzedAt).toLocaleDateString()}` : ""}`,
      9,
      [90, 101, 119],
    );

    heading("Business model");
    line(`Industry: ${brand.industry}`);
    line(`Model: ${brand.businessModel}`);
    line(`Offer: ${brand.whatTheySell}`);
    line(brand.productDescription);
    line(`Positioning: ${brand.positioning}`);

    heading("Ideal customer profile");
    line(brand.audience);
    brand.segments.forEach((segment, index) => {
      line(`${index + 1}. ${segment.segment}`, 11);
      line(`Pains: ${segment.pains}`, 9, [90, 101, 119]);
      line(`Buying triggers: ${segment.triggers}`, 9, [90, 101, 119]);
    });

    heading("Competitors");
    brand.competitors.forEach((competitor, index) => {
      line(`${index + 1}. ${competitor.name}${competitor.url ? ` — ${competitor.url}` : ""}`, 10);
      if (competitor.angle) line(competitor.angle, 9, [90, 101, 119]);
    });

    heading("High-intent keywords");
    line(brand.keywords.length ? brand.keywords.join(" · ") : "No keywords recorded.");

    heading("Citations and sources");
    (brand.sources ?? []).forEach((source, index) => line(`${index + 1}. ${source}`, 9));
    if (!brand.sources?.length) line("No source citations were recorded for this profile.", 9);

    const safeName = (brand.businessName || "brand").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    pdf.save(`${safeName}-research-report.pdf`);
    toast.success("Brand research PDF downloaded.");
  };

  const tone = tones.find((t) => t.value === brand.tone) ?? tones[0];
  const palette = palettes.find((p) => p.name === brand.palette?.name) ?? palettes[0];

  return (
    <Shell>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="My Brand"
          subtitle={`${PRODUCT_NAME} reads your live website so it never has to ask what your business is.`}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={exportReport} className="gap-1.5 cursor-pointer">
                <Download className="h-4 w-4" />
                Export PDF
              </Button>
              <Button onClick={save} className="gap-1.5 cursor-pointer">
                <Check className="h-4 w-4" />
                Save brand context
              </Button>
            </div>
          }
        />

        <div className="flex items-center gap-1 border-b border-border">
          <button
            type="button"
            onClick={() => setTab("edit")}
            className={cn(
              "px-3 py-2 text-[12.5px] font-medium border-b-2 -mb-px transition-colors cursor-pointer",
              tab === "edit"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Pencil className="inline h-3.5 w-3.5 mr-1.5" />
            Edit
          </button>
          <button
            type="button"
            onClick={() => setTab("memory")}
            className={cn(
              "px-3 py-2 text-[12.5px] font-medium border-b-2 -mb-px transition-colors cursor-pointer",
              tab === "memory"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Sparkles className="inline h-3.5 w-3.5 mr-1.5" />
            Memory
          </button>
        </div>

        {tab === "memory" ? (
          <MemoryView brand={brand} />
        ) : (
          <>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            <SectionCard title="Who's using this?">
              <p className="text-[12px] text-muted-foreground mb-3">
                Pick your role so {PRODUCT_NAME} frames every answer for your specific job. This unlocks the full app for the right teams — founders see growth, marketing managers see execution, sales leads see pipeline.
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {USER_ROLE_OPTIONS.map((r) => {
                  const selected = brand.userRole === r.value;
                  return (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => set("userRole")(r.value as UserRole)}
                      className={cn(
                        "rounded-[10px] border p-2.5 text-left transition-colors cursor-pointer",
                        selected
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/30",
                      )}
                    >
                      <div className="text-[12.5px] font-semibold">{r.label}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">
                        {r.description}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3">
                <Label className="text-[12px]">What are you responsible for? (optional)</Label>
                <Input
                  value={brand.userResponsibility || ""}
                  onChange={(e) => set("userResponsibility")(e.target.value)}
                  className="mt-1"
                  placeholder="e.g. Paid social, SEO, lead qualification, monthly reporting"
                />
              </div>
            </SectionCard>
            <SectionCard
              title="Your role"
            >
              <p className="mb-3 text-[12.5px] text-muted-foreground">
                {PRODUCT_NAME} tailors every answer to who is asking. Pick the role that best describes you and add a one-line note about what you own.
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {USER_ROLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => set("userRole")(opt.value as UserRole)}
                    className={cn(
                      "rounded-[10px] border p-2.5 text-left transition-colors cursor-pointer",
                      brand.userRole === opt.value
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/30",
                    )}
                  >
                    <div className="text-[12.5px] font-semibold">{opt.label}</div>
                    <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                      {opt.description}
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-3">
                <Label className="text-[12px]">What you own (optional)</Label>
                <Input
                  value={brand.userResponsibility || ""}
                  onChange={(e) => set("userResponsibility")(e.target.value)}
                  className="mt-1"
                  placeholder="e.g. Pipeline for 5L+ revenue SMBs across EdTech and Healthcare"
                />
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  This helps the agent skip questions you already have answers to.
                </p>
              </div>
            </SectionCard>

            <SectionCard title="Website analysis">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Label className="text-[12px]">Your website URL</Label>
                  <div className="relative mt-1">
                    <Globe className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="yourbrand.com"
                      className="pl-8"
                    />
                  </div>
                </div>
                <Button onClick={runAnalysis} disabled={analyzing} className="gap-1.5 cursor-pointer">
                  {analyzing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {analyzing ? "Analysing your business…" : "Deep-analyse my business"}
                </Button>
              </div>
              <p className="mt-2 text-[11.5px] leading-snug text-muted-foreground">
                {PRODUCT_NAME} reads your real pages, searches the live web for your category and
                competitors, then builds the brand context every campaign is written from.
              </p>
              {!ready && !analyzing && (
                <div className="mt-3 rounded-[10px] border border-amber-500/30 bg-amber-500/10 p-3 text-[12.5px] text-foreground">
                  Brand context is empty — the AI will ask for your website in chat until it's filled.
                </div>
              )}
              {brand.analyzedAt && (
                <div className="mt-3 text-[11.5px] text-muted-foreground">
                  Last analysed {new Date(brand.analyzedAt).toLocaleString()}
                  {brand.sources?.length ? ` · ${brand.sources.length} live sources read` : ""}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Campaign links & audience data">
              <p className="mb-3 text-[12px] text-muted-foreground">Optional details that help Growzzy target the right people and send each ad to the right page.</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div><Label className="text-[12px]">Your Instagram link</Label><Input value={brand.instagramUrl || ""} onChange={(e) => set("instagramUrl")(e.target.value)} className="mt-1" placeholder="https://instagram.com/yourbrand" /></div>
                <div><Label className="text-[12px]">Your LinkedIn page link</Label><Input value={brand.linkedinUrl || ""} onChange={(e) => set("linkedinUrl")(e.target.value)} className="mt-1" placeholder="https://linkedin.com/company/yourbrand" /></div>
                <div className="sm:col-span-2"><div className="mb-1.5 text-[12px] font-medium text-foreground">Other landing pages (if applicable)</div><ChipEditor items={brand.additionalLandingPages || []} onChange={set("additionalLandingPages")} placeholder="Paste a landing-page URL and press Enter" /></div>
                <div><Label className="text-[12px]">Age group</Label><Input value={brand.ageGroup || ""} onChange={(e) => set("ageGroup")(e.target.value)} className="mt-1" placeholder="e.g. 25–44" /></div>
                <div><Label className="text-[12px]">Preferred location</Label><Input value={brand.preferredLocations || ""} onChange={(e) => set("preferredLocations")(e.target.value)} className="mt-1" placeholder="e.g. India, US metros, or Mumbai" /></div>
                <div className="sm:col-span-2"><Label className="text-[12px]">Demographics</Label><Textarea rows={2} value={brand.demographics || ""} onChange={(e) => set("demographics")(e.target.value)} className="mt-1" placeholder="e.g. founders, working parents, senior marketers, income or education level" /></div>
                <div className="sm:col-span-2"><Label className="text-[12px]">Lookalike data (if available) — how much?</Label><Textarea rows={2} value={brand.lookalikeData || ""} onChange={(e) => set("lookalikeData")(e.target.value)} className="mt-1" placeholder="e.g. 2,400 past purchasers, 800 qualified leads, or 12 months of website visitors" /></div>
              </div>
            </SectionCard>

            <SectionCard title="Business">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-[12px]">Business name</Label>
                  <Input
                    value={brand.businessName}
                    onChange={(e) => set("businessName")(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[12px]">Industry</Label>
                  <Input
                    value={brand.industry}
                    onChange={(e) => set("industry")(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[12px]">Business model</Label>
                  <Input
                    value={brand.businessModel}
                    onChange={(e) => set("businessModel")(e.target.value)}
                    className="mt-1"
                    placeholder="e.g. D2C ecommerce, B2B SaaS"
                  />
                </div>
                <div>
                  <Label className="text-[12px]">Default landing page</Label>
                  <Input
                    value={brand.defaultLandingPage}
                    onChange={(e) => set("defaultLandingPage")(e.target.value)}
                    className="mt-1"
                    placeholder="https://"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-[12px]">What you sell</Label>
                  <Textarea
                    rows={2}
                    value={brand.whatTheySell}
                    onChange={(e) => set("whatTheySell")(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-[12px]">Product description</Label>
                  <Textarea
                    rows={3}
                    value={brand.productDescription}
                    onChange={(e) => set("productDescription")(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-[12px]">Positioning</Label>
                  <Textarea
                    rows={2}
                    value={brand.positioning}
                    onChange={(e) => set("positioning")(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-[12px]">Ideal customer</Label>
                  <Input
                    value={brand.audience}
                    onChange={(e) => set("audience")(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="mt-4">
                <div className="mb-1.5 text-[12px] font-medium text-foreground">Differentiators</div>
                <ChipEditor
                  items={brand.differentiators}
                  onChange={set("differentiators")}
                  placeholder="Add a differentiator and press Enter"
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Audience segments"
              action={
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 cursor-pointer"
                  onClick={() =>
                    set("segments")([...brand.segments, { segment: "", pains: "", triggers: "" }])
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add segment
                </Button>
              }
            >
              <div className="mb-3 rounded-[10px] border border-primary/20 bg-primary/5 p-3">
                <div className="flex items-center justify-between gap-3"><div><p className="text-[12.5px] font-semibold">Need help finding your first customer?</p><p className="mt-0.5 text-[11.5px] text-muted-foreground">Use the ICP Builder to turn your offer into a practical first audience hypothesis.</p></div><Button type="button" variant="outline" size="sm" onClick={() => setShowIcpGuide((open) => !open)} className="shrink-0 gap-1 cursor-pointer"><CircleHelp className="h-3.5 w-3.5" />ICP Builder</Button></div>
                {showIcpGuide && <div className="mt-3 space-y-3 border-t border-primary/15 pt-3"><p className="text-[11.5px] text-muted-foreground">An ICP is the customer most likely to buy and succeed with your offer. Start with a hypothesis; refine it from real leads and customers.</p><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div><Label className="text-[12px]">Who is most likely to buy?</Label><Input value={brand.audience} onChange={(e) => set("audience")(e.target.value)} className="mt-1" placeholder="e.g. B2B SaaS founders with 10–100 employees" /></div><div><Label className="text-[12px]">What urgent problem do they have?</Label><Input value={brand.segments[0]?.pains || ""} onChange={(e) => set("segments")([{ ...(brand.segments[0] || { segment: brand.audience || "Primary ICP", pains: "", triggers: "" }), pains: e.target.value }, ...brand.segments.slice(1)])} className="mt-1" placeholder="e.g. pipeline is inconsistent" /></div></div><Button type="button" size="sm" onClick={() => { const first = brand.segments[0] || { segment: brand.audience || "Primary ICP", pains: "", triggers: "" }; set("segments")([{ ...first, segment: first.segment || brand.audience || "Primary ICP", triggers: first.triggers || "Actively seeking a solution, new growth target, or recent funding" }, ...brand.segments.slice(1)]); setShowIcpGuide(false); toast.success("Your starter ICP was added. Refine it as you learn from real customers."); }} className="cursor-pointer">Create starter ICP</Button></div>}
              </div>
              {brand.segments.length === 0 ? (
                <p className="text-[12.5px] text-muted-foreground">
                  No segments yet — analyse your website or add one manually.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {brand.segments.map((seg, i) => (
                    <div key={i} className="rounded-[10px] border border-border p-3">
                      <div className="flex items-center gap-2">
                        <Input
                          value={seg.segment}
                          onChange={(e) =>
                            set("segments")(
                              brand.segments.map((x, xi) =>
                                xi === i ? { ...x, segment: e.target.value } : x,
                              ),
                            )
                          }
                          placeholder="Segment name"
                          className="h-8 text-[12.5px] font-medium"
                        />
                        <button
                          type="button"
                          aria-label="Remove segment"
                          onClick={() => set("segments")(brand.segments.filter((_, xi) => xi !== i))}
                          className="shrink-0 text-muted-foreground hover:text-red-500 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <Textarea
                        rows={2}
                        value={seg.pains}
                        onChange={(e) =>
                          set("segments")(
                            brand.segments.map((x, xi) =>
                              xi === i ? { ...x, pains: e.target.value } : x,
                            ),
                          )
                        }
                        placeholder="Pains"
                        className="mt-2 text-[12.5px]"
                      />
                      <Textarea
                        rows={2}
                        value={seg.triggers}
                        onChange={(e) =>
                          set("segments")(
                            brand.segments.map((x, xi) =>
                              xi === i ? { ...x, triggers: e.target.value } : x,
                            ),
                          )
                        }
                        placeholder="Buying triggers"
                        className="mt-2 text-[12.5px]"
                      />
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Competitors"
              action={
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 cursor-pointer"
                  onClick={() =>
                    set("competitors")([...brand.competitors, { name: "", url: "", angle: "" }])
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add competitor
                </Button>
              }
            >
              {brand.competitors.length === 0 ? (
                <p className="text-[12.5px] text-muted-foreground">
                  No competitors yet — analyse your website or add one manually.
                </p>
              ) : (
                <div className="space-y-2">
                  {brand.competitors.map((c, i) => (
                    <div key={i} className="rounded-[10px] border border-border p-3">
                      <div className="flex items-center gap-2">
                        <Input
                          value={c.name}
                          onChange={(e) =>
                            set("competitors")(
                              brand.competitors.map((x, xi) =>
                                xi === i ? { ...x, name: e.target.value } : x,
                              ),
                            )
                          }
                          placeholder="Competitor name"
                          className="h-8 text-[12.5px] font-medium"
                        />
                        <Input
                          value={c.url}
                          onChange={(e) =>
                            set("competitors")(
                              brand.competitors.map((x, xi) =>
                                xi === i ? { ...x, url: e.target.value } : x,
                              ),
                            )
                          }
                          placeholder="https://"
                          className="h-8 text-[12.5px]"
                        />
                        {c.url && (
                          <a
                            href={c.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="shrink-0 text-primary"
                            aria-label={`Visit ${c.name}`}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          aria-label="Remove competitor"
                          onClick={() =>
                            set("competitors")(brand.competitors.filter((_, xi) => xi !== i))
                          }
                          className="shrink-0 text-muted-foreground hover:text-red-500 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <Textarea
                        rows={2}
                        value={c.angle}
                        onChange={(e) =>
                          set("competitors")(
                            brand.competitors.map((x, xi) =>
                              xi === i ? { ...x, angle: e.target.value } : x,
                            ),
                          )
                        }
                        placeholder="Their angle / how they position"
                        className="mt-2 text-[12.5px]"
                      />
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Search & creative signals">
              <div>
                <div className="mb-1.5 text-[12px] font-medium text-foreground">
                  High-intent keywords
                </div>
                <ChipEditor
                  items={brand.keywords}
                  onChange={set("keywords")}
                  placeholder="Add a keyword and press Enter"
                />
              </div>
              <div className="mt-4">
                <div className="mb-1.5 text-[12px] font-medium text-foreground">Creative angles</div>
                <ChipEditor
                  items={brand.creativeAngles}
                  onChange={set("creativeAngles")}
                  placeholder="Add a creative angle and press Enter"
                />
              </div>
            </SectionCard>

            <SectionCard title="Voice & colors">
              <Label className="text-[12px]">Tone of voice</Label>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {tones.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => set("tone")(t.value)}
                    className={cn(
                      "rounded-[10px] border p-2.5 text-left transition-colors cursor-pointer",
                      brand.tone === t.value
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/30",
                    )}
                  >
                    <div className="text-[12.5px] font-semibold">{t.label}</div>
                    <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                      {t.sample}
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {palettes.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => set("palette")(p)}
                    className={cn(
                      "flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px] transition-colors cursor-pointer",
                      palette?.name === p.name
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background hover:border-primary/30",
                    )}
                  >
                    <span className="h-4 w-4 rounded-full" style={{ background: p.primary }} />
                    {p.name}
                  </button>
                ))}
              </div>
            </SectionCard>
          </div>

          <aside className="sticky top-4 space-y-4">
            <SectionCard title="Live preview">
              <div className="overflow-hidden rounded-[14px] border border-border">
                <div
                  className="flex h-16 items-center gap-3 px-4"
                  style={{ background: palette?.accent || "#EAF0FE" }}
                >
                  <div
                    className="grid h-8 w-8 place-items-center rounded-lg text-[13px] font-bold text-white"
                    style={{ background: palette?.primary || "#1F57F5" }}
                  >
                    {(brand.businessName || "G").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="text-[13.5px] font-semibold text-foreground">
                    {brand.businessName || "Your brand"}
                  </div>
                </div>
                <div className="bg-background p-4">
                  <div className="mb-1 text-[11px] text-muted-foreground">Sponsored</div>
                  <div
                    className="mb-1 text-[15px] font-medium leading-tight"
                    style={{ color: palette?.primary || "#1F57F5" }}
                  >
                    {brand.businessName
                      ? `${brand.businessName} — ${tone.label} ad`
                      : "Your headline appears here"}
                  </div>
                  <div className="text-[12.5px] text-foreground/80">
                    {brand.productDescription || tone.sample}
                  </div>
                  <button
                    type="button"
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium text-white"
                    style={{ background: palette?.primary || "#1F57F5" }}
                  >
                    <Sparkles className="h-3 w-3" />
                    Shop now
                  </button>
                </div>
              </div>
              <p className="mt-3 text-[11.5px] text-muted-foreground">
                {PRODUCT_NAME} only advertises on Google Ads and Meta Ads — this is how your ads will feel.
              </p>
            </SectionCard>

            {brand.sources?.length ? (
              <SectionCard title="Sources read">
                <ul className="space-y-1">
                  {brand.sources.slice(0, 10).map((s) => (
                    <li key={s} className="truncate text-[11.5px]">
                      <a
                        href={s}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-primary hover:underline"
                      >
                        {s}
                      </a>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            ) : null}
          </aside>
        </div>
      </>
        )}
      </div>
    </Shell>
  );
}

/* ──────────────────────────── Memory View ──────────────────────────── */
/** Read-only card grid of every fact the AI has on file for this brand. */
function MemoryView({ brand }: { brand: BrandProfile }) {
  const isAnalyzed = Boolean(brand.analyzedAt);
  const source = isAnalyzed ? "Site analysis" : "Manual entry";
  const updated = brand.analyzedAt
    ? new Date(brand.analyzedAt).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  type Fact = {
    label: string;
    value: React.ReactNode;
    icon?: React.ReactNode;
    span?: 1 | 2;
  };
  const facts: Fact[] = [];

  if (brand.businessName) {
    facts.push({ label: "Business name", value: brand.businessName, icon: <Briefcase className="h-3.5 w-3.5" />, span: 2 });
  }
  if (brand.website) {
    facts.push({ label: "Website", value: <a href={brand.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">{brand.website}</a>, icon: <Globe className="h-3.5 w-3.5" /> });
  }
  if (brand.industry) facts.push({ label: "Industry", value: brand.industry });
  if (brand.businessModel) facts.push({ label: "Business model", value: brand.businessModel });
  if (brand.whatTheySell) facts.push({ label: "What they sell", value: brand.whatTheySell, span: 2 });
  if (brand.positioning) facts.push({ label: "Positioning", value: brand.positioning, span: 2 });
  if (brand.differentiators?.length) {
    facts.push({
      label: "Differentiators",
      value: (
        <div className="flex flex-wrap gap-1.5">
          {brand.differentiators.map((d) => (
            <span key={d} className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px]">{d}</span>
          ))}
        </div>
      ),
      span: 2,
    });
  }
  if (brand.audience) facts.push({ label: "Audience", value: brand.audience, span: 2 });
  if (brand.segments?.length) {
    facts.push({
      label: "Audience segments",
      value: (
        <div className="space-y-1.5">
          {brand.segments.map((s) => (
            <div key={s.segment} className="rounded-md bg-muted/30 border border-border p-2 text-[11.5px]">
              <div className="font-medium text-foreground">{s.segment}</div>
              {s.pains && <div className="text-muted-foreground">Pains: {s.pains}</div>}
              {s.triggers && <div className="text-muted-foreground">Triggers: {s.triggers}</div>}
            </div>
          ))}
        </div>
      ),
      span: 2,
    });
  }
  if (brand.competitors?.length) {
    facts.push({
      label: "Competitors",
      value: (
        <div className="space-y-1.5">
          {brand.competitors.map((c) => (
            <div key={c.name} className="rounded-md bg-muted/30 border border-border p-2 text-[11.5px]">
              <div className="font-medium text-foreground">{c.name}{c.url ? <a href={c.url} target="_blank" rel="noreferrer" className="ml-1.5 text-primary hover:underline text-[10.5px]">↗</a> : null}</div>
              {c.angle && <div className="text-muted-foreground">Angle: {c.angle}</div>}
            </div>
          ))}
        </div>
      ),
      span: 2,
    });
  }
  if (brand.keywords?.length) {
    facts.push({
      label: "High-intent keywords",
      value: (
        <div className="flex flex-wrap gap-1.5">
          {brand.keywords.map((k) => (
            <span key={k} className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px]">{k}</span>
          ))}
        </div>
      ),
      span: 2,
    });
  }
  if (brand.creativeAngles?.length) {
    facts.push({
      label: "Creative angles",
      value: (
        <div className="flex flex-wrap gap-1.5">
          {brand.creativeAngles.map((k) => (
            <span key={k} className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px]">{k}</span>
          ))}
        </div>
      ),
      span: 2,
    });
  }
  if (brand.tone) {
    facts.push({ label: "Tone of voice", value: brand.tone });
  }
  if (brand.palette?.name) {
    facts.push({
      label: "Color palette",
      value: (
        <div className="flex items-center gap-2">
          <span className="h-5 w-5 rounded-md border border-border" style={{ background: brand.palette.primary }} />
          <span className="h-5 w-5 rounded-md border border-border" style={{ background: brand.palette.accent }} />
          <span className="text-[11.5px]">{brand.palette.name}</span>
        </div>
      ),
    });
  }
  if (brand.userRole) {
    facts.push({ label: "User role", value: brand.userRole.replace(/_/g, " ") });
  }

  if (!facts.length) {
    return (
      <SectionCard title="Brand memory">
        <div className="rounded-[12px] border border-dashed border-border bg-muted/20 p-8 text-center">
          <Sparkles className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
          <p className="text-[13px] font-medium text-foreground">No brand memory yet</p>
          <p className="mt-1 text-[12px] text-muted-foreground max-w-sm mx-auto">
            Tell Growzzy about your brand — analyse your site or fill the form in the Edit tab. Every fact you give us will appear here as a browseable memory unit.
          </p>
        </div>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[16px] font-semibold text-foreground">Brand memory</h2>
          <p className="text-[12px] text-muted-foreground">
            Every fact Growzzy has on file about {brand.businessName || "your brand"}. The chat uses these to ground every answer.
          </p>
        </div>
        {updated && (
          <div className="text-right">
            <div className="text-[11.5px] text-muted-foreground">Last updated</div>
            <div className="text-[12px] font-medium text-foreground">{updated}</div>
            <div className="text-[10.5px] text-muted-foreground mt-0.5">Source: {source}</div>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {facts.map((f) => (
          <div
            key={f.label}
            className={cn(
              "rounded-[12px] border border-border bg-card p-3.5 shadow-2xs",
              f.span === 2 && "sm:col-span-2",
            )}
          >
            <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
              {f.icon}
              {f.label}
            </div>
            <div className="mt-1.5 text-[12.5px] text-foreground">{f.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
