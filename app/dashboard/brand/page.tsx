"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Shell } from "@/components/dashboard-v2/shell"
import { PageHeader, SectionCard } from "@/components/growzzy/primitives"
import { StatusPill } from "@/components/growzzy/status-pill"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
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
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  loadBrand,
  saveBrand,
  brandIsReady,
  emptyBrand,
  type BrandProfile,
  type BrandSegment,
  type BrandCompetitor,
} from "@/lib/brand-store"

const palettes = [
  { name: "Growzzy", primary: "#1F57F5", accent: "#EAF0FE" },
  { name: "Ember", primary: "#F97316", accent: "#FEF0E6" },
  { name: "Forest", primary: "#059669", accent: "#E7F5EF" },
  { name: "Rose", primary: "#E11D48", accent: "#FCE7EC" },
  { name: "Slate", primary: "#0F172A", accent: "#E9EBEF" },
]

const tones = [
  { value: "friendly", label: "Friendly", sample: "Hey! Grab yours before they're gone ✨" },
  {
    value: "professional",
    label: "Professional",
    sample: "Trusted by 10,000+ businesses worldwide.",
  },
  { value: "playful", label: "Playful", sample: "Warning: dangerously good products inside 💎" },
  { value: "premium", label: "Premium", sample: "Crafted for those who notice the details." },
]

function ChipEditor({
  items,
  onChange,
  placeholder,
}: {
  items: string[]
  onChange: (next: string[]) => void
  placeholder: string
}) {
  const [draft, setDraft] = useState("")
  const add = () => {
    const v = draft.trim()
    if (!v || items.includes(v)) return
    onChange([...items, v])
    setDraft("")
  }
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
              className="text-muted-foreground hover:text-[#D3564C]"
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
              e.preventDefault()
              add()
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
          className="h-8 shrink-0 gap-1"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>
    </div>
  )
}

export default function BrandPage() {
  const [brand, setBrand] = useState<BrandProfile>(emptyBrand)
  const [urlInput, setUrlInput] = useState("")
  const [analyzing, setAnalyzing] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const loaded = loadBrand()
    setBrand(loaded)
    setUrlInput(loaded.website)
    setHydrated(true)
  }, [])

  const set =
    <K extends keyof BrandProfile>(k: K) =>
    (v: BrandProfile[K]) =>
      setBrand((b) => ({ ...b, [k]: v }))

  const ready = brandIsReady(brand)

  const runAnalysis = async () => {
    if (!urlInput.trim()) {
      toast.error("Add your website URL first.")
      return
    }
    setAnalyzing(true)
    try {
      const res = await fetch("/api/brand/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteUrl: urlInput.trim() }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        throw new Error(json?.error?.message || json?.message || "Couldn't analyse that website.")
      }
      const m = json.data?.brandMemory || {}
      const next: BrandProfile = {
        ...brand,
        website: json.data?.brandMemory?.defaultLandingPage || urlInput.trim(),
        defaultLandingPage:
          brand.defaultLandingPage || json.data?.brandMemory?.defaultLandingPage || urlInput.trim(),
        businessName: m.brandName || brand.businessName,
        industry: m.industry || brand.industry,
        businessModel: m.businessModel || brand.businessModel,
        whatTheySell: m.whatYouSell || brand.whatTheySell,
        productDescription: m.productDescription || brand.productDescription,
        positioning: m.positioning || brand.positioning,
        differentiators: m.differentiators ?? brand.differentiators,
        audience: m.idealCustomer || brand.audience,
        segments: (m.audienceSegments ?? []).map(
          (s: { title: string; painPoints: string }): BrandSegment => ({
            segment: s.title,
            pains: s.painPoints,
            triggers: "",
          }),
        ),
        competitors: (m.competitors ?? []).map(
          (c: { name: string; description: string }): BrandCompetitor => ({
            name: c.name,
            url: "",
            angle: c.description,
          }),
        ),
        keywords: m.highIntentKeywords ?? brand.keywords,
        creativeAngles: m.creativeAngles ?? brand.creativeAngles,
        tone: (m.toneOfVoice || "Professional").toLowerCase() || brand.tone,
        analyzedAt: new Date().toISOString(),
        sources: m.sourcesRead ?? brand.sources,
      }
      setBrand(next)
      saveBrand(next)
      toast.success(`Analysed ${next.businessName}. Growzzy now knows your business.`)
    } catch (e: any) {
      toast.error(e?.message || "Couldn't analyse that website.")
    } finally {
      setAnalyzing(false)
    }
  }

  const save = () => {
    saveBrand(brand)
    toast.success("Brand context saved. Growzzy uses it on every campaign.")
  }

  const exportReport = async () => {
    if (!brandIsReady(brand)) {
      toast.error("Analyse or complete your brand before exporting a report.")
      return
    }
    const { jsPDF } = await import("jspdf")
    const pdf = new jsPDF({ unit: "pt", format: "a4" })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 48
    const contentWidth = pageWidth - margin * 2
    let y = 54

    const ensureSpace = (height: number) => {
      if (y + height <= pageHeight - 48) return
      pdf.addPage()
      y = 54
    }
    const line = (text: string, size = 10, color: [number, number, number] = [16, 22, 31]) => {
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(size)
      pdf.setTextColor(...color)
      const rows = pdf.splitTextToSize(text || "Not provided", contentWidth) as string[]
      ensureSpace(rows.length * (size + 4))
      pdf.text(rows, margin, y)
      y += rows.length * (size + 4) + 5
    }
    const heading = (text: string) => {
      ensureSpace(34)
      y += 10
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(14)
      pdf.setTextColor(31, 87, 245)
      pdf.text(text, margin, y)
      y += 20
    }

    pdf.setFillColor(31, 87, 245)
    pdf.rect(0, 0, pageWidth, 10, "F")
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(23)
    pdf.setTextColor(16, 22, 31)
    pdf.text(`${brand.businessName} — Brand Research`, margin, y)
    y += 22
    line(
      `Prepared by Growzzy OS${brand.analyzedAt ? ` · Research updated ${new Date(brand.analyzedAt).toLocaleDateString()}` : ""}`,
      9,
      [90, 101, 119],
    )

    heading("Business model")
    line(`Industry: ${brand.industry}`)
    line(`Model: ${brand.businessModel}`)
    line(`Offer: ${brand.whatTheySell}`)
    line(brand.productDescription)
    line(`Positioning: ${brand.positioning}`)

    heading("Ideal customer profile")
    line(brand.audience)
    brand.segments.forEach((segment, index) => {
      line(`${index + 1}. ${segment.segment}`, 11)
      line(`Pains: ${segment.pains}`, 9, [90, 101, 119])
      line(`Buying triggers: ${segment.triggers}`, 9, [90, 101, 119])
    })

    heading("Competitors")
    brand.competitors.forEach((competitor, index) => {
      line(`${index + 1}. ${competitor.name}${competitor.url ? ` — ${competitor.url}` : ""}`, 10)
      if (competitor.angle) line(competitor.angle, 9, [90, 101, 119])
    })

    heading("High-intent keywords")
    line(brand.keywords.length ? brand.keywords.join(" · ") : "No keywords recorded.")

    heading("Citations and sources")
    ;(brand.sources ?? []).forEach((source, index) => line(`${index + 1}. ${source}`, 9))
    if (!brand.sources?.length) line("No source citations were recorded for this profile.", 9)

    const safeName = (brand.businessName || "brand").toLowerCase().replace(/[^a-z0-9]+/g, "-")
    pdf.save(`${safeName}-research-report.pdf`)
    toast.success("Brand research PDF downloaded.")
  }

  const tone = tones.find((t) => t.value === brand.tone) ?? tones[0]
  const palette = palettes.find((p) => p.name === brand.palette.name) ?? palettes[0]

  if (!hydrated) {
    return (
      <Shell>
        <PageHeader
          title="My Brand"
          subtitle="Growzzy reads your live website so it never has to ask what your business is."
        />
      </Shell>
    )
  }

  return (
    <Shell>
      <PageHeader
        title="My Brand"
        subtitle="Growzzy reads your live website so it never has to ask what your business is."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportReport} className="gap-1.5">
              <Download className="h-4 w-4" />
              Export PDF
            </Button>
            <Button onClick={save} className="gap-1.5">
              <Check className="h-4 w-4" />
              Save brand context
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
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
              <Button onClick={runAnalysis} disabled={analyzing} className="gap-1.5">
                {analyzing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {analyzing ? "Analysing your business…" : "Deep-analyse my business"}
              </Button>
            </div>
            <p className="mt-2 text-[11.5px] leading-snug text-muted-foreground">
              Growzzy reads your real pages, searches the live web for your category and
              competitors, then builds the brand context every campaign is written from.
            </p>
            {!ready && !analyzing && (
              <div className="mt-3 rounded-[10px] border border-border bg-[#FBF0DA]/50 p-3 text-[12.5px] text-foreground">
                Brand context is empty — the AI will keep asking you to set this up until it&apos;s
                filled.
              </div>
            )}
            {brand.analyzedAt && (
              <div className="mt-3 text-[11.5px] text-muted-foreground">
                Last analysed {new Date(brand.analyzedAt).toLocaleString()}
                {brand.sources?.length ? ` · ${brand.sources.length} live sources read` : ""}
              </div>
            )}
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
                className="gap-1"
                onClick={() =>
                  set("segments")([...brand.segments, { segment: "", pains: "", triggers: "" }])
                }
              >
                <Plus className="h-3.5 w-3.5" />
                Add segment
              </Button>
            }
          >
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
                        onClick={() =>
                          set("segments")(brand.segments.filter((_, xi) => xi !== i))
                        }
                        className="shrink-0 text-muted-foreground hover:text-[#D3564C]"
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
                className="gap-1"
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
                        className="shrink-0 text-muted-foreground hover:text-[#D3564C]"
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
                  onClick={() => set("tone")(t.value)}
                  className={cn(
                    "rounded-[10px] border p-2.5 text-left transition-colors",
                    brand.tone === t.value
                      ? "border-primary bg-[#EAF0FE]"
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
                  onClick={() => set("palette")(p)}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px] transition-colors",
                    palette.name === p.name
                      ? "border-primary bg-[#EAF0FE] text-primary"
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

        <aside className="sticky top-4">
          <SectionCard title="Live preview">
            <div className="overflow-hidden rounded-[14px] border border-border">
              <div
                className="flex h-16 items-center gap-3 px-4"
                style={{ background: palette.accent }}
              >
                <div
                  className="grid h-8 w-8 place-items-center rounded-lg text-[13px] font-bold text-white"
                  style={{ background: palette.primary }}
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
                  style={{ color: palette.primary }}
                >
                  {brand.businessName
                    ? `${brand.businessName} — ${tone.label} ad`
                    : "Your headline appears here"}
                </div>
                <div className="text-[12.5px] text-foreground/80">
                  {brand.productDescription || tone.sample}
                </div>
                <button
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium text-white"
                  style={{ background: palette.primary }}
                >
                  <Sparkles className="h-3 w-3" />
                  Shop now
                </button>
              </div>
            </div>
            <p className="mt-3 text-[11.5px] text-muted-foreground">
              Growzzy only advertises on Google Ads and Meta Ads — this is how your ads will feel.
            </p>
            <div className="mt-3">
              <Link
                href="/dashboard/campaigns/new"
                className="text-[12.5px] font-medium text-primary hover:underline"
              >
                Open campaign agent →
              </Link>
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <StatusPill variant={ready ? "success" : "warn"}>
                {ready ? "Brand ready" : "Brand missing"}
              </StatusPill>
            </div>
          </SectionCard>

          {brand.sources?.length ? (
            <SectionCard title="Sources read" className="mt-4">
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
    </Shell>
  )
}