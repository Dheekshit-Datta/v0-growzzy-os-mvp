"use client"

import { useState } from "react"
import { Shell } from "@/components/shell"
import { Sparkles, ChevronDown, Grid, RefreshCw, Download, Copy, Check, Wand2 } from "lucide-react"
import { cn } from "@/lib/utils"

const FORMATS = ["Search ad", "Display banner", "Social image", "Video script"]
const RATIOS = ["1:1 Square", "4:5 Portrait", "16:9 Landscape", "9:16 Story"]


type Tab = "generate" | "library"

function CreativePreview({
  bg, accent, headline, body, format,
}: {
  bg: string; accent: string; headline: string; body: string; format: string
}) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(headline + "\n" + body).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="sku-card overflow-hidden group">
      <div
        className="w-full h-[180px] relative flex flex-col justify-end p-4"
        style={{ background: `linear-gradient(135deg, ${bg} 0%, ${accent}99 100%)` }}
      >
        <div className="mb-2">
          <div className="h-2 w-16 rounded-full mb-1.5 opacity-50 bg-white" />
          <div className="text-[13px] font-bold text-white leading-snug mb-1 drop-shadow">{headline}</div>
          <div className="text-[11px] text-white/70 leading-snug">{body.slice(0, 60)}</div>
        </div>
        <div
          className="self-start px-3 py-1 rounded-[6px] text-[11px] font-bold text-white"
          style={{ background: accent, boxShadow: '0 2px 6px rgba(0,0,0,0.25)' }}
        >
          Shop Now
        </div>
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
          <button
            onClick={handleCopy}
            className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-[#374151] shadow hover:bg-[#F0F2F5] transition-colors"
          >
            {copied ? <Check size={14} className="text-[#2E9E5B]" /> : <Copy size={14} />}
          </button>
          <button className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-[#374151] shadow hover:bg-[#F0F2F5] transition-colors">
            <Download size={14} />
          </button>
        </div>
      </div>
      <div className="px-3 py-2.5">
        <p className="text-[12px] font-semibold text-[#111827] leading-snug">{headline}</p>
        <p className="text-[10.5px] text-[#9CA3AF] mt-0.5">{format}</p>
      </div>
    </div>
  )
}

export default function AdStudioPage() {
  const [activeTab, setActiveTab] = useState<Tab>("generate")
  const [prompt, setPrompt] = useState("")
  const [format, setFormat] = useState("Social image")
  const [ratio, setRatio] = useState("1:1 Square")
  const [generating, setGenerating] = useState(false)
  const [creatives, setCreatives] = useState<typeof SAMPLE_CREATIVES>([])
  const [library, setLibrary] = useState<typeof SAMPLE_CREATIVES>([])

  const handleGenerate = async () => {
    if (!prompt.trim() || generating) return
    setGenerating(true)
    setCreatives([])
    await new Promise((r) => setTimeout(r, 2200))
    const PALETTE = [
      ["#1a1a2e", "#e94560"],
      ["#0f3460", "#533483"],
      ["#2d6a4f", "#95d5b2"],
      ["#b5838d", "#ffcdb2"],
    ]
    setCreatives(
      PALETTE.map((colors, i) => ({
        colors,
        headline: `Creative variant ${i + 1} — ${format}`,
        body: prompt.slice(0, 60) + (prompt.length > 60 ? "…" : ""),
      }))
    )
    setGenerating(false)
  }

  const handleSaveToLibrary = () => {
    setLibrary((prev) => [...prev, ...creatives.filter((c) => !prev.some((p) => p.headline === c.headline))])
    setActiveTab("library")
  }

  return (
    <Shell title="Ad Studio">
      <div className="p-5 space-y-4">
        {/* Tabs */}
        <div
          className="flex gap-0.5 p-0.5 rounded-[10px] self-start w-fit"
          style={{
            background: 'linear-gradient(145deg, #e0e3e8 0%, #eaecef 100%)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1) inset',
          }}
        >
          {(["generate", "library"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "h-7 px-4 rounded-[8px] text-[12.5px] font-semibold capitalize transition-all",
                activeTab === tab
                  ? "bg-white text-[#111827] shadow-sm"
                  : "text-[#6B7280] hover:text-[#374151]"
              )}
            >
              {tab}
              {tab === "library" && library.length > 0 && (
                <span className="ml-1.5 text-[10px] font-bold text-[#1F57F5] bg-[#EAF0FE] px-1.5 py-0.5 rounded-full">
                  {library.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {activeTab === "generate" && (
          <div className="grid grid-cols-2 gap-5" style={{ height: 'calc(100vh - 200px)', minHeight: 500 }}>
            {/* Left: controls */}
            <div
              className="rounded-[14px] p-5 flex flex-col gap-4 overflow-y-auto"
              style={{
                background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fb 100%)',
                boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.06)',
              }}
            >
              <div className="flex items-center gap-2">
                <Wand2 size={15} className="text-[#1F57F5]" />
                <p className="text-[14px] font-semibold text-[#111827]">Generate Ad Creative</p>
              </div>
              <span className="text-[11px] font-bold text-[#2E9E5B] bg-[#E6F4EC] px-2 py-0.5 rounded-full self-start">
                Using My Brand context ✓
              </span>

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
                  <div className="relative">
                    <select
                      value={format}
                      onChange={(e) => setFormat(e.target.value)}
                      className="w-full h-9 pl-3 pr-8 text-[12.5px] text-[#111827] outline-none appearance-none rounded-[8px] sku-input"
                    >
                      {FORMATS.map((f) => <option key={f}>{f}</option>)}
                    </select>
                    <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">Aspect ratio</label>
                  <div className="relative">
                    <select
                      value={ratio}
                      onChange={(e) => setRatio(e.target.value)}
                      className="w-full h-9 pl-3 pr-8 text-[12.5px] text-[#111827] outline-none appearance-none rounded-[8px] sku-input"
                    >
                      {RATIOS.map((r) => <option key={r}>{r}</option>)}
                    </select>
                    <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
                  </div>
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
                {generating ? (
                  <>
                    <span className="w-4 h-4 border-2 border-[#9CA3AF]/30 border-t-[#9CA3AF] rounded-full animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    Generate ad creative
                  </>
                )}
              </button>
            </div>

            {/* Right: preview grid */}
            <div
              className="rounded-[14px] p-5 overflow-y-auto"
              style={{
                background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fb 100%)',
                boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.06)',
              }}
            >
              {creatives.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
                    style={{
                      background: 'linear-gradient(145deg, #e8eaed 0%, #f4f5f7 100%)',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.08) inset',
                    }}
                  >
                    <Sparkles size={20} className="text-[#D1D5DB]" />
                  </div>
                  <p className="text-[13px] font-semibold text-[#374151]">Preview appears here</p>
                  <p className="text-[11.5px] text-[#9CA3AF] mt-1 max-w-[220px]">
                    Describe the ad you want and click Generate to see a live preview.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[13px] font-semibold text-[#111827]">4 creatives generated</p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleGenerate}
                        className="flex items-center gap-1 text-[12px] font-semibold text-[#1F57F5] hover:text-[#1849d6] transition-colors"
                      >
                        <RefreshCw size={12} /> Regenerate
                      </button>
                      <button
                        onClick={handleSaveToLibrary}
                        className="flex items-center gap-1 text-[12px] font-semibold text-[#374151] hover:text-[#111827] transition-colors"
                      >
                        Save to library
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {creatives.map((c, i) => (
                      <CreativePreview
                        key={i}
                        bg={c.colors[0]}
                        accent={c.colors[1]}
                        headline={c.headline}
                        body={c.body}
                        format={format}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "library" && (
          library.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
                style={{
                  background: 'linear-gradient(145deg, #e8eaed 0%, #f4f5f7 100%)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08) inset',
                }}
              >
                <Grid size={20} className="text-[#D1D5DB]" />
              </div>
              <p className="text-[14px] font-semibold text-[#374151]">No saved creatives yet</p>
              <p className="text-[12.5px] text-[#9CA3AF] mt-1 max-w-[260px]">
                Generate an ad and save it to your library to reuse it across campaigns.
              </p>
              <button
                onClick={() => setActiveTab("generate")}
                className="mt-4 flex items-center gap-1.5 h-8 px-4 text-white text-[12.5px] font-semibold rounded-[8px] sku-btn-primary"
              >
                <Sparkles size={13} />
                Generate creatives
              </button>
            </div>
          ) : (
            <div>
              <p className="text-[13.5px] font-semibold text-[#111827] mb-3">{library.length} saved creative{library.length > 1 ? "s" : ""}</p>
              <div className="grid grid-cols-4 gap-4">
                {library.map((c, i) => (
                  <CreativePreview
                    key={i}
                    bg={c.colors[0]}
                    accent={c.colors[1]}
                    headline={c.headline}
                    body={c.body}
                    format="Social image"
                  />
                ))}
              </div>
            </div>
          )
        )}
      </div>
    </Shell>
  )
}
