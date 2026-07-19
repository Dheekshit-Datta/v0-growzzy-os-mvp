"use client"

import { useState, useEffect } from "react"
import { Shell } from "@/components/dashboard-v2/shell"
import { Sparkles, Grid, RefreshCw, Copy, Check, ImageIcon, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

const AD_STYLES = ["Luxury", "Bold", "Minimal", "Festive", "Corporate", "Playful"]
const ASPECT_RATIOS = [
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

function CreativePreview({
  imageUrl, headline, body, format,
}: { imageUrl: string | null; headline: string; body?: string; format: string }) {
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
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={headline} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-center px-3">
            <ImageIcon size={18} className="text-[#D1D5DB]" />
            <p className="text-[10px] text-[#9CA3AF]">Image unavailable — copy still real</p>
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
          <button onClick={handleCopy} className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-[#374151] shadow hover:bg-[#F0F2F5] transition-colors">
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

  const [library, setLibrary] = useState<GeneratedCreative[]>([])
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
          setLibraryEmptyReason("account_required")
        } else {
          setLibrary(json?.creatives ?? [])
          setLibraryEmptyReason((json?.creatives ?? []).length === 0 ? "empty" : null)
        }
      })
      .finally(() => { setLibraryLoading(false); setLibraryLoaded(true) })
  }, [activeTab, libraryLoaded])

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
      setLibraryLoaded(false)
    } catch (err: any) {
      setError(err?.message || "Something went wrong generating creatives.")
    } finally {
      setGenerating(false)
    }
  }

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
          <div className="grid grid-cols-2 gap-5" style={{ height: 'calc(100vh - 200px)', minHeight: 500 }}>
            <div
              className="rounded-[14px] p-5 flex flex-col gap-4 overflow-y-auto"
              style={{ background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fb 100%)', boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.06)' }}
            >
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-[#1F57F5]" />
                <p className="text-[14px] font-semibold text-[#111827]">Generate Ad Creative</p>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">Describe the ad visual</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={5}
                  placeholder="A luxury jewelry ad showing a woman at a festive wedding event, warm gold tones, premium and elegant feel..."
                  className="w-full px-3 py-2.5 text-[13px] text-[#111827] placeholder-[#9CA3AF] resize-none outline-none leading-relaxed rounded-[8px] sku-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">Format</label>
                  <select value={format} onChange={(e) => setFormat(e.target.value)} className="w-full h-9 px-3 text-[12.5px] text-[#111827] outline-none rounded-[8px] sku-input">
                    <option>Social image</option>
                    <option>Display banner</option>
                    <option>Search ad</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">Style</label>
                  <select value={style} onChange={(e) => setStyle(e.target.value)} className="w-full h-9 px-3 text-[12.5px] text-[#111827] outline-none rounded-[8px] sku-input">
                    {AD_STYLES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">Aspect ratio</label>
                  <select value={ratio} onChange={(e) => setRatio(e.target.value)} className="w-full h-9 px-3 text-[12.5px] text-[#111827] outline-none rounded-[8px] sku-input">
                    {ASPECT_RATIOS.map((r) => <option key={r.label}>{r.label} {r.desc}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">Variants</label>
                  <select value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-full h-9 px-3 text-[12.5px] text-[#111827] outline-none rounded-[8px] sku-input">
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
                      <CreativePreview key={i} imageUrl={imageUrls[i] || null} headline={v.headline} body={v.body || v.description} format={format} />
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
                {library.map((c) => {
                  const urls = Array.isArray(c.imageUrls) ? (c.imageUrls as string[]) : []
                  return (
                    <CreativePreview
                      key={c.id}
                      imageUrl={urls[0] || null}
                      headline={c.headlines?.[0] || "Untitled creative"}
                      body={c.descriptions?.[0]}
                      format={new Date(c.createdAt).toLocaleDateString()}
                    />
                  )
                })}
              </div>
            </div>
          )
        )}
      </div>
    </Shell>
  )
}
