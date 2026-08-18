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
            className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-0.5 text-[11.5px] text-foreground"
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
          className="h-8 shrink-0 gap-1 cursor-pointer"
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
          })
        ),
        competitors: (m.competitors ?? []).map(
          (c: { name: string; description: string }): BrandCompetitor => ({
            name: c.name,
            url: "",
            angle: c.description,
          })
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
      [90, 101, 119]
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
            <Button variant="outline" onClick={exportReport} className="gap-1.5 cursor-pointer">
              <Download className="h-4 w-4" />
              Export PDF
            </Button>
            <Button onClick={save} className="gap-1.5 bg-[#1F57F5] text-white hover:bg-[#1845C2] cursor-pointer">
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
              <Button onClick={runAnalysis} disabled={analyzing} className="gap-1.5 bg-[#1F57F5] text-white hover:bg-[#1845C2] cursor-pointer">
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
              <div className="mt-3 rounded-[10px] border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-3 text-[12.5px] text-amber-900 dark:text-amber-300">
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
                              xi === i ? { ...x, segment: e.target.value } : x
                            )
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
                            xi === i ? { ...x, pains: e.target.value } : x
                          )
                        )
                      }
                      placeholder="Pain points"
                      className="mt-2 text-[12px]"
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
                No competitors recorded yet — analyse your website or add one manually.
              </p>
            ) : (
              <div className="space-y-2.5">
                {brand.competitors.map((c, i) => (
                  <div key={i} className="rounded-[10px] border border-border p-3">
                    <div className="flex items-center gap-2">
                      <Input
                        value={c.name}
                        onChange={(e) =>
                          set("competitors")(
                            brand.competitors.map((x, xi) =>
                              xi === i ? { ...x, name: e.target.value } : x
                            )
                          )
                        }
                        placeholder="Competitor name"
                        className="h-8 text-[12.5px] font-medium"
                      />
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
                            xi === i ? { ...x, angle: e.target.value } : x
                          )
                        )
                      }
                      placeholder="Their angle & how we beat them"
                      className="mt-2 text-[12px]"
                    />
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Search & creative signals">
            <div>
              <Label className="text-[12px]">High-intent search terms</Label>
              <div className="mt-1">
                <ChipEditor
                  items={brand.keywords}
                  onChange={set("keywords")}
                  placeholder="e.g. enterprise ai automation"
                />
              </div>
            </div>
            <div className="mt-4">
              <Label className="text-[12px]">Creative angles that fit</Label>
              <div className="mt-1">
                <ChipEditor
                  items={brand.creativeAngles}
                  onChange={set("creativeAngles")}
                  placeholder="e.g. before/after transformation"
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Voice & palette">
            <div>
              <Label className="text-[12px]">Tone of voice</Label>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {tones.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => set("tone")(t.value)}
                    className={cn(
                      "rounded-[10px] border p-2.5 text-left transition-all cursor-pointer",
                      brand.tone === t.value
                        ? "border-[#1F57F5] bg-[#EAF0FE]/40"
                        : "border-border hover:bg-muted/30"
                    )}
                  >
                    <span className="text-[12.5px] font-semibold text-foreground">{t.label}</span>
                    <p className="mt-1 text-[10.5px] text-muted-foreground line-clamp-2">{t.sample}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <Label className="text-[12px]">Theme palette</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {palettes.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => set("palette")(p)}
                    className={cn(
                      "flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-all cursor-pointer",
                      brand.palette.name === p.name
                        ? "border-[#1F57F5] bg-[#EAF0FE]/40 text-foreground"
                        : "border-border hover:bg-muted/30 text-muted-foreground"
                    )}
                  >
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: p.primary }} />
                    <span>{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Right Sticky Preview */}
        <div className="sticky top-4 space-y-4">
          <SectionCard title="Live preview">
            <div className="rounded-[12px] border border-border bg-card p-4 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Ad Preview
                </span>
                <StatusPill variant="success">Active Memory</StatusPill>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground">
                  {brand.website || "yourbrand.com"}
                </span>
                <h4 className="text-[14px] font-bold text-foreground mt-0.5 leading-snug">
                  {brand.businessName || "Your Business"}
                </h4>
                <p className="mt-1 text-[12px] text-muted-foreground line-clamp-3">
                  {brand.productDescription || brand.whatTheySell || "Add product description to see preview"}
                </p>
              </div>
              <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Tone: {tone.label}</span>
                <span>Palette: {palette.name}</span>
              </div>
            </div>
          </SectionCard>

          {brand.sources && brand.sources.length > 0 && (
            <SectionCard title={`Sources read (${brand.sources.length})`}>
              <div className="space-y-1.5 text-[12px]">
                {brand.sources.map((s, i) => (
                  <div key={i} className="truncate text-muted-foreground">
                    <span className="font-mono text-[10px] text-muted-foreground/60 mr-1.5">
                      {i + 1}.
                    </span>
                    <a href={s} target="_blank" rel="noopener noreferrer" className="text-[#1F57F5] hover:underline">
                      {s}
                    </a>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </div>
      </div>
    </Shell>
  )
}