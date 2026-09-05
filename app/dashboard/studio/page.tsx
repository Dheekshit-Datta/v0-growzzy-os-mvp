"use client"

import { useState, useEffect } from "react"
import { Shell } from "@/components/dashboard-v2/shell"
import { Sparkles, Grid, RefreshCw, Copy, Check, ImageIcon, Loader2, Maximize2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

const AD_STYLES = ["Auto", "Luxury", "Bold", "Minimal", "Festive", "Corporate", "Playful"]
const ASPECT_RATIOS = [
  { label: "Auto", desc: "Best for platform" },
  { label: "1:1", desc: "Square" },
  { label: "4:5", desc: "Portrait" },
  { label: "16:9", desc: "Landscape" },
  { label: "9:16", desc: "Story" },
]

type Tab = "generate" | "library"

type Variation = { headline: string; body?: string; description?: string; cta?: string }
type GeneratedCreative = {
  id: string
  headlines: string[] | null
  descriptions: string[] | null
  imageUrls: unknown
  createdAt: string
}

function readSessionValue<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const value = window.sessionStorage.getItem(key)
    return value ? (JSON.parse(value) as T) : fallback
  } catch {
    return fallback
  }
}

function writeSessionValue(key: string, value: unknown) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

function CreativePreview({
  imageUrl, headline, body, format, onPreview,
}: { imageUrl: string | null; headline: string; body?: string; format: string; onPreview?: (url: string, title: string) => void }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText([headline, body].filter(Boolean).join("\n")).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="sku-card overflow-hidden group">
      <div className="w-full h-[180px] relative bg-[#F0F2F5] flex items-center justify-center">
        {imageUrl ? (
          <button type="button" onClick={() => onPreview?.(imageUrl, headline)} className="w-full h-full" aria-label={`View ${headline} full size`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={headline} className="w-full h-full object-cover" />
          </button>
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-center px-3">
            <ImageIcon size={18} className="text-[#D1D5DB]" />
            <p className="text-[10px] text-[#9CA3AF]">Image unavailable — copy still real</p>
          </div>
        )}
        {imageUrl && <div className="pointer-events-none absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100"><Maximize2 size={20} className="text-white" /></div>}
        <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button type="button" onClick={handleCopy} className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-[#374151] shadow hover:bg-[#F0F2F5] transition-colors" aria-label="Copy creative text">
            {copied ? <Check size={14} className="text-[#2E9E5B]" /> : <Copy size={14} />}
          </button>
        </div>
      </div>
      <div className="px-3 py-2.5">
        <p className="text-[12px] font-semibold text-[#111827] leading-snug line-clamp-2">{headline}</p>
        <p className="text-[10.5px] text-[#9CA3AF] mt-0.5">{format}</p>
      </div>
    </div>
  )
}

export default function AdStudioPage() {
  const [activeTab, setActiveTab] = useState<Tab>("generate")
  const [prompt, setPrompt] = useState("")
  const [format, setFormat] = useState("Social image")
  const [style, setStyle] = useState("Luxury")
  const [ratio, setRatio] = useState("1:1 Square")
  const [count, setCount] = useState(4)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState("")
  const [variations, setVariations] = useState<Variation[]>([])
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null)

  const [library, setLibrary] = useState<GeneratedCreative[]>(() => readSessionValue("growzzy_studio_library", []))
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [libraryLoaded, setLibraryLoaded] = useState(false)
  const [libraryEmptyReason, setLibraryEmptyReason] = useState<"account_required" | "empty" | null>(null)

  useEffect(() => {
    if (activeTab !== "library" || libraryLoaded) return
    setLibraryLoading(true)
    fetch("/api/generated-creatives", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.accountRequired) {
          if (library.length === 0) setLibraryEmptyReason("account_required")
        } else {
          const creatives = json?.creatives ?? []
          setLibrary(creatives)
          writeSessionValue("growzzy_studio_library", creatives)
          setLibraryEmptyReason(creatives.length === 0 ? "empty" : null)
        }
      })
      .finally(() => { setLibraryLoading(false); setLibraryLoaded(true) })
  }, [activeTab, libraryLoaded, library.length])

  const handleGenerate = async () => {
    if (!prompt.trim() || generating) return
    setGenerating(true)
    setError("")
    setVariations([])
    setImageUrls([])
    try {
      const res = await fetch("/api/ai/generate-creatives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: "GOOGLE",
          format,
          visualStyle: style,
          adFormat: ratio,
          productDescription: prompt.trim(),
          valueProp: prompt.trim(),
          variations: count,
          generateImages: true,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json?.success) throw new Error(json?.error || "Couldn't generate creatives.")
      setVariations(json.variations || [])
      setImageUrls(json.imageUrls || [])
      if (json.imageError) setError(json.imageError)
      if (json.creative) {
        setLibrary((current) => {
          const next = [json.creative, ...current.filter((item) => item.id !== json.creative.id)].slice(0, 50)
          writeSessionValue("growzzy_studio_library", next)
          return next
        })
        setLibraryEmptyReason(null)
      }
      setLibraryLoaded(false)
    } catch (err: any) {
      setError(err?.message || "Something went wrong generating creatives.")
    } finally {
      setGenerating(false)
    }
  }

  const openPreview = (url: string, title: string) => setPreview({ url, title })

  return (
    <Shell title="Ad Studio">
      <div className="p-5 space-y-4">
        <div
          className="flex gap-0.5 p-0.5 rounded-[10px] self-start w-fit"
          style={{ background: 'linear-gradient(145deg, #e0e3e8 0%, #eaecef 100%)', boxShadow: '0 1px 3px rgba(0,0,0,0.1) inset' }}
        >
          {(["generate", "library"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "h-7 px-4 rounded-[8px] text-[12.5px] font-semibold capitalize transition-all",
                activeTab === tab ? "bg-white text-[#111827] shadow-sm" : "text-[#6B7280] hover:text-[#374151]"
              )}
            >
              {tab}
              {tab === "library" && library.length > 0 && (
                <span className="ml-1.5 text-[10px] font-bold text-[#1F57F5] bg-[#EAF0FE] px-1.5 py-0.5 rounded-full">{library.length}</span>
              )}
            </button>
          ))}
        </div>

        {activeTab === "generate" && (
          <div className="grid grid-cols-[1fr_1.2fr] gap-5" style={{ height: 'calc(100vh - 200px)', minHeight: 500 }}>
            <div
              className="rounded-[14px] p-5 flex flex-col gap-4 overflow-y-auto"
              style={{ background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fb 100%)', boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.06)' }}
            >
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-[#1F57F5]" />
                <p className="text-[14px] font-semibold text-[#111827]">Ad Creative</p>
                <span className="text-[11px] text-[#9CA3AF] ml-1">— describe it, we generate it</span>
              </div>

              <div>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={14}
                  placeholder="A luxury jewelry ad showing a woman at a festive wedding event, warm gold tones, premium and elegant feel. Headline: 'Crafted for your forever'. Offer: 20% off this weekend."
                  className="w-full px-4 py-3 text-[13.5px] text-[#111827] placeholder-[#9CA3AF] resize-none outline-none leading-relaxed rounded-[10px] sku-input"
                />
                <p className="mt-1.5 text-[11px] text-[#9CA3AF]">
                  Tip: include the product, the audience, the mood, and the offer. The more specific, the better the result.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-[11px] font-semibold text-[#6B7280] mb-1">Style</label>
                  <select value={style} onChange={(e) => setStyle(e.target.value)} className="w-full h-8 px-2.5 text-[12px] text-[#111827] outline-none rounded-[8px] sku-input">
                    {AD_STYLES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-[11px] font-semibold text-[#6B7280] mb-1">Aspect</label>
                  <select value={ratio} onChange={(e) => setRatio(e.target.value)} className="w-full h-8 px-2.5 text-[12px] text-[#111827] outline-none rounded-[8px] sku-input">
                    {ASPECT_RATIOS.map((r) => <option key={r.label}>{r.label} {r.desc}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-[120px]">
                  <label className="block text-[11px] font-semibold text-[#6B7280] mb-1">Variants</label>
                  <select value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-full h-8 px-2.5 text-[12px] text-[#111827] outline-none rounded-[8px] sku-input">
                    {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={!prompt.trim() || generating}
                className={cn(
                  "flex items-center justify-center gap-2 h-10 rounded-[10px] text-[13.5px] font-semibold transition-colors mt-auto",
                  prompt.trim() && !generating ? "text-white sku-btn-primary" : "bg-[#E9EBEF] text-[#9CA3AF] cursor-not-allowed"
                )}
              >
                {generating ? (<><Loader2 size={16} className="animate-spin" />Generating…</>) : (<><Sparkles size={14} />Generate ad creative</>)}
              </button>
              {error && <p className="text-[11.5px] text-[#D3564C]">{error}</p>}
            </div>

            <div
              className="rounded-[14px] p-5 overflow-y-auto"
              style={{ background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fb 100%)', boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.06)' }}
            >
              {variations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: 'linear-gradient(145deg, #e8eaed 0%, #f4f5f7 100%)', boxShadow: '0 1px 3px rgba(0,0,0,0.08) inset' }}>
                    <Sparkles size={20} className="text-[#D1D5DB]" />
                  </div>
                  <p className="text-[13px] font-semibold text-[#374151]">Preview appears here</p>
                  <p className="text-[11.5px] text-[#9CA3AF] mt-1 max-w-[220px]">Describe the ad you want and click Generate for real AI-written copy and images.</p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[13px] font-semibold text-[#111827]">{variations.length} creative{variations.length > 1 ? "s" : ""} generated</p>
                    <button onClick={handleGenerate} className="flex items-center gap-1 text-[12px] font-semibold text-[#1F57F5] hover:text-[#1849d6] transition-colors">
                      <RefreshCw size={12} /> Regenerate
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {variations.map((v, i) => (
                      <CreativePreview key={i} imageUrl={imageUrls[i] || null} headline={v.headline} body={v.body || v.description} format={format} onPreview={openPreview} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "library" && (
          libraryLoading ? (
            <div className="flex items-center justify-center py-24 text-[#9CA3AF]"><Loader2 className="animate-spin" size={20} /></div>
          ) : library.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: 'linear-gradient(145deg, #e8eaed 0%, #f4f5f7 100%)', boxShadow: '0 1px 3px rgba(0,0,0,0.08) inset' }}>
                <Grid size={20} className="text-[#D1D5DB]" />
              </div>
              <p className="text-[14px] font-semibold text-[#374151]">
                {libraryEmptyReason === "account_required" ? "Connect an ad account first" : "No saved creatives yet"}
              </p>
              <p className="text-[12.5px] text-[#9CA3AF] mt-1 max-w-[260px]">
                {libraryEmptyReason === "account_required"
                  ? "Creatives you generate are saved against your active ad account — connect one in Settings to build a library."
                  : "Every creative you generate is saved here automatically."}
              </p>
              <button onClick={() => setActiveTab("generate")} className="mt-4 flex items-center gap-1.5 h-8 px-4 text-white text-[12.5px] font-semibold rounded-[8px] sku-btn-primary">
                <Sparkles size={13} /> Generate creatives
              </button>
            </div>
          ) : (
            <div>
              <p className="text-[13.5px] font-semibold text-[#111827] mb-3">{library.length} saved creative{library.length > 1 ? "s" : ""}</p>
              <div className="grid grid-cols-4 gap-4">
                {library.flatMap((c) => {
                  const urls = Array.isArray(c.imageUrls) ? (c.imageUrls as string[]) : []
                  const count = Math.max(urls.length, c.headlines?.length || 0, 1)
                  return Array.from({ length: count }, (_, index) => (
                    <CreativePreview
                      key={`${c.id}-${index}`}
                      imageUrl={urls[index] || null}
                      headline={c.headlines?.[index] || "Untitled creative"}
                      body={c.descriptions?.[index]}
                      format={new Date(c.createdAt).toLocaleDateString()}
                      onPreview={openPreview}
                    />
                  ))
                })}
              </div>
            </div>
          )
        )}

        <Dialog open={Boolean(preview)} onOpenChange={(open) => { if (!open) setPreview(null) }}>
          <DialogContent className="max-w-[min(92vw,960px)] border-0 bg-white p-3">
            <DialogTitle className="sr-only">{preview?.title || "Creative preview"}</DialogTitle>
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.url} alt={preview.title} className="max-h-[82vh] w-full object-contain rounded-[8px]" />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Shell>
  )
}
