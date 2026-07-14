"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { ChevronDown, Copy, Download, ImageOff, RefreshCw, Sparkles, Wand2 } from "lucide-react"
import { toast } from "sonner"

type CreativeVariation = {
  headline: string
  body: string
  description?: string
  cta: string
  angle?: string
  score: number
  visualDirection?: string
  whyThisWorks?: string
  breakdown?: Record<string, number>
}

type SavedCreative = {
  id: string
  campaignId?: string | null
  brief?: Record<string, unknown> | null
  imageUrls?: string[] | null
  assets?: { imageError?: string | null } | null
  selectedIndex?: number | null
  selectedVariation?: CreativeVariation | null
  variations?: CreativeVariation[] | null
  score?: number | null
  scoreBreakdown?: Record<string, number> | null
  createdAt: string
}

type CreativeForm = {
  brandName: string
  industry: string
  tone: string
  objective: string
  platforms: string[]
  format: string
  productName: string
  valueProp: string
  painPoint: string
  cta: string
  socialProof: string
  urgency: string
  persona: string
  location: string
  painPoints: string
  visualStyle: string
}

const defaultForm: CreativeForm = {
  brandName: "GROWZZY OS",
  industry: "Marketing automation",
  tone: "Professional",
  objective: "Conversions",
  platforms: ["Google"],
  format: "Search Ad",
  productName: "GROWZZY OS - AI marketing platform",
  valueProp: "Launch on-brand campaigns in minutes and optimize them with AI.",
  painPoint: "Agencies waste too much time on campaign setup, creative testing, and reporting.",
  cta: "Book a Demo",
  socialProof: "",
  urgency: "",
  persona: "SMMA owners and agency operators",
  location: "United States, India, UK",
  painPoints: "Slow campaign setup\nCreative bottlenecks\nReporting fatigue",
  visualStyle: "Clean / Minimal",
}

function scoreColor(score: number) {
  if (score >= 90) return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (score >= 70) return "bg-amber-50 text-amber-700 border-amber-200"
  return "bg-red-50 text-red-700 border-red-200"
}

function downloadText(filename: string, text: string, type = "text/plain") {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export default function CreativeGeneratorPage() {
  const LIB_CACHE_KEY = "growzzy_creative_library_cache_v1"
  const LIB_CACHE_TTL_MS = 60_000
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"generator" | "library">("generator")
  const [age, setAge] = useState([25, 45])
  const [variationsCount, setVariationsCount] = useState("5")
  const [generating, setGenerating] = useState(false)
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)
  const [savedCreatives, setSavedCreatives] = useState<SavedCreative[]>([])
  const [libraryLoading, setLibraryLoading] = useState(true)
  const [imageError, setImageError] = useState<string | null>(null)
  const [form, setForm] = useState<CreativeForm>(defaultForm)
  const libraryLoadRef = useRef({ inFlight: false, lastRunAt: 0 })

  const update = (key: keyof CreativeForm, value: string | string[]) => setForm((prev) => ({ ...prev, [key]: value }))

  const loadLibrary = useCallback(async (force = false) => {
    const now = Date.now()
    if (libraryLoadRef.current.inFlight) return
    if (!force && now - libraryLoadRef.current.lastRunAt < 7000) return
    if (!force) {
      try {
        const raw = window.sessionStorage.getItem(LIB_CACHE_KEY)
        if (raw) {
          const cached = JSON.parse(raw) as { at: number; value: SavedCreative[] }
          if (Array.isArray(cached?.value) && Date.now() - Number(cached.at || 0) <= LIB_CACHE_TTL_MS) {
            setSavedCreatives(cached.value)
            setLibraryLoading(false)
          }
        }
      } catch {}
    }
    libraryLoadRef.current.inFlight = true
    setLibraryLoading(true)
    try {
      const response = await fetch("/api/creative-intelligence")
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Failed to load creative library")
      setSavedCreatives(data.aiGenerations || [])
      try {
        window.sessionStorage.setItem(LIB_CACHE_KEY, JSON.stringify({ at: Date.now(), value: data.aiGenerations || [] }))
      } catch {}
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Creative library failed to load")
    } finally {
      libraryLoadRef.current.inFlight = false
      libraryLoadRef.current.lastRunAt = Date.now()
      setLibraryLoading(false)
    }
  }, [])

  useEffect(() => {
    loadLibrary(true)
    const onWorkspaceChange = () => void loadLibrary(true)
    const onVisible = () => {
      if (document.visibilityState === "visible") void loadLibrary()
    }
    const onSync = () => void loadLibrary(true)
    window.addEventListener("growzzy:workspace-changed", onWorkspaceChange)
    window.addEventListener("growzzy:sync-complete", onSync)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.removeEventListener("growzzy:workspace-changed", onWorkspaceChange)
      window.removeEventListener("growzzy:sync-complete", onSync)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [loadLibrary])

  const generate = async () => {
    setGenerating(true)
    setImageError(null)
    try {
      const response = await fetch("/api/ai/generate-creatives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          targetAudience: `${form.persona}, age ${age[0]}-${age[1]}, ${form.location}`,
          productDescription: `${form.productName}. ${form.valueProp}. Pain point: ${form.painPoint}`,
          adFormat: form.format,
          variations: Number(variationsCount),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || data.success === false) throw new Error(data.error || "Failed to generate creatives")
      const id = data.creativeId || data.creative?.id
      const warning = data.imageError || data.data?.imageError || data.creative?.assets?.imageError || null
      setImageError(warning)
      await loadLibrary()
      setActiveTab("library")
      toast.success(warning ? "Copy generated. Image generation needs attention." : "Creatives generated and saved")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Creative generation failed")
    } finally {
      setGenerating(false)
    }
  }

  const copyCreative = async (creative: CreativeVariation) => {
    const text = [`Headline: ${creative.headline}`, `Body: ${creative.body}`, `CTA: ${creative.cta}`, creative.description ? `Description: ${creative.description}` : ""].filter(Boolean).join("\n")
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Creative copy copied")
    } catch {
      downloadText("growzzy-creative-copy.txt", text)
      toast.success("Clipboard blocked, downloaded copy instead")
    }
  }

  const exportCreative = (saved: SavedCreative, creative: CreativeVariation, index: number) => {
    const imageUrl = saved.imageUrls?.[index]
    const payload = { creativeId: saved.id, selectedIndex: index, creative, imageUrl, brief: saved.brief, scoreBreakdown: creative.breakdown || saved.scoreBreakdown }
    const safeName = creative.headline.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "creative"
    downloadText(`growzzy-${safeName}.json`, JSON.stringify(payload, null, 2), "application/json")
    downloadText(
      `growzzy-${safeName}-preview.html`,
      `<!doctype html><html><head><meta charset="utf-8"><title>${creative.headline}</title><style>body{font-family:Inter,Arial,sans-serif;background:#f8fafc;padding:32px}.card{max-width:520px;border:1px solid #dbe5f3;border-radius:18px;background:white;overflow:hidden}.hero{min-height:300px;background:linear-gradient(135deg,#eaf2ff,#ecfeff);display:grid;place-items:center;padding:24px}.hero img{max-width:100%;border-radius:14px}.content{padding:24px}button{background:#2563eb;color:white;border:0;border-radius:10px;padding:10px 16px;font-weight:700}</style></head><body><div class="card"><div class="hero">${imageUrl ? `<img src="${imageUrl}" alt="">` : `<strong>${creative.visualDirection || "Image unavailable"}</strong>`}</div><div class="content"><h1>${creative.headline}</h1><p>${creative.body}</p><button>${creative.cta}</button><pre>${JSON.stringify(payload, null, 2)}</pre></div></div></body></html>`,
      "text/html"
    )
    toast.success("Creative exported")
  }

  const useCreative = async (saved: SavedCreative, index: number) => {
    const response = await fetch(`/api/generated-creatives/${saved.id}/select`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selectedIndex: index }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      toast.error(data.error || "Failed to select creative")
      return
    }
    toast.success("Creative selected for campaign builder")
    router.push(`/dashboard/campaigns/new?creativeId=${saved.id}&variant=${index}`)
  }

  const regenerate = async (saved: SavedCreative) => {
    setRegeneratingId(saved.id)
    try {
      const brief = (saved.brief || form) as Record<string, unknown>
      const response = await fetch("/api/creative-intelligence/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...brief, variations: Number(variationsCount) }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || data.success === false) throw new Error(data.error || "Regeneration failed")
      await loadLibrary()
      toast.success("New generation saved")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not regenerate creative")
    } finally {
      setRegeneratingId(null)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Creative Studio</h1>
          <p className="mt-1 text-sm text-muted-foreground">Generate new ad ideas and reuse your saved creative library.</p>
        </div>

        <div className="flex flex-wrap gap-2 rounded-xl border bg-card p-1">
          {[
            ["generator", "Generate"],
            ["library", "Library"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as typeof activeTab)}
              className={cn("rounded-lg px-4 py-2 text-sm font-semibold transition", activeTab === id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted")}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === "generator" && (
          <div className="grid items-start gap-5 lg:grid-cols-[420px_minmax(0,1fr)]">
            <CreativeBriefForm
              age={age}
              form={form}
              generating={generating}
              variationsCount={variationsCount}
              onAgeChange={setAge}
              onGenerate={generate}
              onUpdate={update}
              onVariationChange={setVariationsCount}
            />
            <GenerationPreview
              imageError={imageError}
              libraryLoading={libraryLoading}
              savedCreatives={savedCreatives}
              onCopy={copyCreative}
              onExport={exportCreative}
              onRegenerate={regenerate}
              onUse={useCreative}
              regeneratingId={regeneratingId}
            />
          </div>
        )}

        {activeTab === "library" && (
          <SavedLibrary
            libraryLoading={libraryLoading}
            savedCreatives={savedCreatives}
            onCopy={copyCreative}
            onExport={exportCreative}
            onRegenerate={regenerate}
            onUse={useCreative}
            regeneratingId={regeneratingId}
          />
        )}
      </div>
    </DashboardLayout>
  )
}

function CreativeBriefForm({
  age,
  form,
  generating,
  variationsCount,
  onAgeChange,
  onGenerate,
  onUpdate,
  onVariationChange,
}: {
  age: number[]
  form: CreativeForm
  generating: boolean
  variationsCount: string
  onAgeChange: (value: number[]) => void
  onGenerate: () => void
  onUpdate: (key: keyof CreativeForm, value: string | string[]) => void
  onVariationChange: (value: string) => void
}) {
  return (
    <aside className="rounded-lg border bg-card lg:sticky lg:top-20">
      <div className="border-b p-4">
        <h2 className="text-sm font-semibold">Generator</h2>
        <p className="text-xs text-muted-foreground">Every successful generation is saved to your Library.</p>
      </div>
      <Accordion type="multiple" defaultValue={["brand", "goal", "offer"]} className="px-3">
        <AccordionItem value="brand">
          <AccordionTrigger className="text-sm">A. Brand</AccordionTrigger>
          <AccordionContent className="space-y-3">
            <Field label="Brand name"><Input value={form.brandName} onChange={(event) => onUpdate("brandName", event.target.value)} /></Field>
            <Field label="Industry"><Input value={form.industry} onChange={(event) => onUpdate("industry", event.target.value)} /></Field>
            <Field label="Tone">
              <Select value={form.tone} onValueChange={(value) => onUpdate("tone", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Professional", "Playful", "Bold", "Luxurious", "Urgent", "Friendly"].map((tone) => <SelectItem key={tone} value={tone}>{tone}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="goal">
          <AccordionTrigger className="text-sm">B. Goal</AccordionTrigger>
          <AccordionContent className="space-y-3">
            <Field label="Objective">
              <Select value={form.objective} onValueChange={(value) => onUpdate("objective", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Awareness", "Traffic", "Leads", "Conversions", "Retargeting"].map((objective) => <SelectItem key={objective} value={objective}>{objective}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Platforms">
              <div className="space-y-1.5">
                {["Google"].map((platform) => (
                  <label key={platform} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.platforms.includes(platform)} onCheckedChange={(checked) => onUpdate("platforms", checked ? [...form.platforms, platform] : form.platforms.filter((item) => item !== platform))} />
                    {platform}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="Format">
              <Select value={form.format} onValueChange={(value) => onUpdate("format", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Search Ad", "Static Image", "Carousel", "Video Script", "Story/Reel"].map((format) => <SelectItem key={format} value={format}>{format}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="offer">
          <AccordionTrigger className="text-sm">C. Offer</AccordionTrigger>
          <AccordionContent className="space-y-3">
            <Field label="Product / service"><Input value={form.productName} onChange={(event) => onUpdate("productName", event.target.value)} /></Field>
            <Field label="Value proposition"><Textarea rows={2} value={form.valueProp} onChange={(event) => onUpdate("valueProp", event.target.value)} /></Field>
            <Field label="Pain point"><Textarea rows={2} value={form.painPoint} onChange={(event) => onUpdate("painPoint", event.target.value)} /></Field>
            <Field label="CTA"><Input value={form.cta} onChange={(event) => onUpdate("cta", event.target.value)} /></Field>
            <Field label="Social proof"><Input value={form.socialProof} onChange={(event) => onUpdate("socialProof", event.target.value)} placeholder="Trusted by 1,000+ agencies" /></Field>
            <Field label="Offer / urgency"><Input value={form.urgency} onChange={(event) => onUpdate("urgency", event.target.value)} placeholder="Optional" /></Field>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="audience">
          <AccordionTrigger className="text-sm">D. Audience</AccordionTrigger>
          <AccordionContent className="space-y-3">
            <Field label="Persona"><Input value={form.persona} onChange={(event) => onUpdate("persona", event.target.value)} /></Field>
            <Field label={`Age range: ${age[0]}-${age[1]}`}><Slider value={age} onValueChange={onAgeChange} min={18} max={65} step={1} /></Field>
            <Field label="Location"><Input value={form.location} onChange={(event) => onUpdate("location", event.target.value)} /></Field>
            <Field label="Pain points"><Textarea rows={3} value={form.painPoints} onChange={(event) => onUpdate("painPoints", event.target.value)} /></Field>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="style">
          <AccordionTrigger className="text-sm">E. Style</AccordionTrigger>
          <AccordionContent className="space-y-3">
            <Field label="Visual style">
              <Select value={form.visualStyle} onValueChange={(value) => onUpdate("visualStyle", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["UGC / Raw", "Clean / Minimal", "Bold / Graphic", "Photo-realistic", "Illustrated"].map((style) => <SelectItem key={style} value={style}>{style}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Variations">
              <div className="grid grid-cols-4 gap-1.5">
                {["1", "3", "5", "10"].map((count) => (
                  <button key={count} onClick={() => onVariationChange(count)} className={cn("rounded-md border-2 py-2 text-sm font-mono font-semibold", variationsCount === count ? "border-primary bg-primary/5 text-primary" : "border-border")}>{count}</button>
                ))}
              </div>
            </Field>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      <div className="border-t p-4">
        <Button onClick={onGenerate} disabled={generating} className="w-full gap-2">
          {generating ? <><RefreshCw className="h-4 w-4 animate-spin" /> Generating...</> : <><Wand2 className="h-4 w-4" /> Generate Creatives</>}
        </Button>
      </div>
    </aside>
  )
}

function GenerationPreview(props: {
  imageError: string | null
  libraryLoading: boolean
  savedCreatives: SavedCreative[]
  regeneratingId: string | null
  onCopy: (creative: CreativeVariation) => void
  onExport: (saved: SavedCreative, creative: CreativeVariation, index: number) => void
  onRegenerate: (saved: SavedCreative) => void
  onUse: (saved: SavedCreative, index: number) => void
}) {
  const latest = props.savedCreatives[0]
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <div className="font-semibold">Latest saved generation</div>
        <div className="text-xs text-muted-foreground">Saved to your library</div>
      </div>
      {props.imageError && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{props.imageError}. Copy and scoring are still available.</div>}
      {props.libraryLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-80 animate-pulse rounded-lg bg-muted" />)}</div>
      ) : latest ? (
        <CreativeGrid saved={latest} {...props} />
      ) : (
        <div className="grid min-h-[420px] place-items-center rounded-lg border bg-card p-8 text-center">
          <div>
            <Sparkles className="mx-auto h-10 w-10 text-muted-foreground" />
            <h3 className="mt-3 text-lg font-semibold">Your saved creative angles will appear here</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">Describe the ad you want, then generate copy and visual directions you can use in Campaign Builder.</p>
          </div>
        </div>
      )}
    </section>
  )
}

function SavedLibrary(props: {
  libraryLoading: boolean
  savedCreatives: SavedCreative[]
  regeneratingId: string | null
  onCopy: (creative: CreativeVariation) => void
  onExport: (saved: SavedCreative, creative: CreativeVariation, index: number) => void
  onRegenerate: (saved: SavedCreative) => void
  onUse: (saved: SavedCreative, index: number) => void
}) {
  if (props.libraryLoading) {
    return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-80 animate-pulse rounded-lg bg-muted" />)}</div>
  }
  if (!props.savedCreatives.length) {
    return <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">No saved creatives yet. Create one from the Generate tab.</div>
  }
  return (
    <div className="space-y-8">
      {props.savedCreatives.map((saved) => (
        <div key={saved.id} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold">Generation from {new Date(saved.createdAt).toLocaleString()}</h2>
              {saved.assets?.imageError && <p className="text-xs text-amber-700">{saved.assets.imageError}</p>}
            </div>
            <Button variant="outline" size="sm" onClick={() => props.onRegenerate(saved)} disabled={props.regeneratingId === saved.id}>
              {props.regeneratingId === saved.id ? "Regenerating..." : "Regenerate from brief"}
            </Button>
          </div>
          <CreativeGrid saved={saved} {...props} />
        </div>
      ))}
    </div>
  )
}

function CreativeGrid(props: {
  saved: SavedCreative
  regeneratingId: string | null
  onCopy: (creative: CreativeVariation) => void
  onExport: (saved: SavedCreative, creative: CreativeVariation, index: number) => void
  onRegenerate: (saved: SavedCreative) => void
  onUse: (saved: SavedCreative, index: number) => void
}) {
  const variants = props.saved.variations || []
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {variants.map((creative, index) => (
        <CreativeCard
          key={`${props.saved.id}-${index}`}
          saved={props.saved}
          creative={creative}
          imageUrl={props.saved.imageUrls?.[index]}
          selectedIndex={index}
          onCopy={props.onCopy}
          onExport={props.onExport}
          onRegenerate={props.onRegenerate}
          onUse={props.onUse}
          regenerating={props.regeneratingId === props.saved.id}
        />
      ))}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  )
}

function CreativeCard({
  saved,
  creative,
  imageUrl,
  selectedIndex,
  regenerating,
  showRegenerate = true,
  onCopy,
  onExport,
  onRegenerate,
  onUse,
}: {
  saved: SavedCreative
  creative: CreativeVariation
  imageUrl?: string
  selectedIndex: number
  regenerating?: boolean
  showRegenerate?: boolean
  onCopy: (creative: CreativeVariation) => void
  onExport: (saved: SavedCreative, creative: CreativeVariation, index: number) => void
  onRegenerate: (saved: SavedCreative) => void
  onUse: (saved: SavedCreative, index: number) => void
}) {
  const [open, setOpen] = useState(false)
  const isSelected = saved.selectedIndex === selectedIndex

  return (
    <div className={cn("overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-sm", isSelected && "border-primary ring-2 ring-primary/15")}>
      <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-primary/15 via-blue-50 to-cyan-50 p-5">
        {imageUrl ? (
          <>
            <img src={imageUrl} alt={creative.headline} className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
          </>
        ) : (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            <div>
              <ImageOff className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-xs text-muted-foreground">{saved.assets?.imageError || "Image unavailable. Copy and score are saved."}</p>
            </div>
          </div>
        )}
        <span className={cn("absolute right-3 top-3 rounded-md border px-2 py-0.5 font-mono text-xs font-bold", scoreColor(creative.score || saved.score || 0))}>{creative.score || saved.score || 0}</span>
        {isSelected && <span className="absolute left-3 top-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">Selected</span>}
        <div className="relative z-10 flex h-full flex-col justify-end">
          <div className={cn("text-base font-bold leading-tight", imageUrl ? "text-white" : "text-foreground")}>{creative.headline}</div>
          <div className={cn("mt-1.5 line-clamp-2 text-xs", imageUrl ? "text-white/80" : "text-foreground/70")}>{creative.body}</div>
          <button className="mt-3 w-fit rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">{creative.cta}</button>
        </div>
      </div>
      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between">
          <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{creative.angle || "Strategy"}</span>
          <button onClick={() => setOpen((value) => !value)} className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground">
            Details <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
          </button>
        </div>
        {open && (
          <div className="space-y-2 rounded-md bg-muted/40 p-2.5 text-xs">
            <div><span className="font-semibold">Visual: </span><span className="text-muted-foreground">{creative.visualDirection || "Clean ad layout with a focused product/value proposition."}</span></div>
            <div><span className="font-semibold">Why it works: </span><span className="text-muted-foreground">{creative.whyThisWorks || "Benefit-led messaging with a clear CTA."}</span></div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-1.5">
          <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => onUse(saved, selectedIndex)}><Sparkles className="h-3 w-3" /> Use</Button>
          {showRegenerate ? (
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={regenerating} onClick={() => onRegenerate(saved)}>
              <RefreshCw className={cn("h-3 w-3", regenerating && "animate-spin")} /> Regen
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => onExport(saved, creative, selectedIndex)}>
              <Download className="h-3 w-3" /> Export
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => onCopy(creative)}><Copy className="h-3 w-3" /> Copy</Button>
          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => onExport(saved, creative, selectedIndex)}><Download className="h-3 w-3" /> Export</Button>
        </div>
      </div>
    </div>
  )
}
