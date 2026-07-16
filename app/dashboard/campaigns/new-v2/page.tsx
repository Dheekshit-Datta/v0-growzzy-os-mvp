"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Shell } from "@/components/shell"
import {
  Sparkles, Mic, Plus, CheckCircle2, Circle, ArrowRight,
  Image as ImageIcon, Search, Rocket, ChevronDown, RefreshCw,
  Download, Copy, Wand2, X, Check,
} from "lucide-react"
import { cn } from "@/lib/utils"

const CHIPS = [
  { id: "objective", label: "Ad Objective" },
  { id: "audience", label: "Target Audience" },
  { id: "age", label: "Age" },
  { id: "location", label: "Location" },
  { id: "budget", label: "Budget" },
]

const KEYWORD_MAP: Record<string, RegExp> = {
  objective: /sell|promote|generate leads?|drive|awareness|install/i,
  audience: /women|men|audience|people|customers?|target/i,
  age: /\b\d{2}\s*[-–]\s*\d{2}\b|\bage\b|\byears?\b/i,
  location: /india|us|uk|city|cities|tier|country|region|location/i,
  budget: /\$|\b\d+\s*(?:\/day|per day|daily|budget)\b|budget/i,
}


const AD_STYLES = ["Luxury", "Bold", "Minimal", "Festive", "Corporate", "Playful"]
const ASPECT_RATIOS = [
  { label: "1:1", desc: "Square" },
  { label: "4:5", desc: "Portrait" },
  { label: "16:9", desc: "Landscape" },
  { label: "9:16", desc: "Story" },
]

type Tab = "campaign" | "boolean" | "creatives" | "launch"

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "campaign", label: "Campaign", icon: Sparkles },
  { id: "boolean", label: "Boolean search", icon: Search },
  { id: "creatives", label: "AI Creatives", icon: ImageIcon },
  { id: "launch", label: "Launch Ads", icon: Rocket },
]

/* Placeholder creative card component */
function CreativeCard({
  index,
  style,
  ratio,
  headline,
  onCopy,
  onDownload,
}: {
  index: number
  style: string
  ratio: string
  headline: string
  onCopy: () => void
  onDownload: () => void
}) {
  const [copied, setCopied] = useState(false)
  const colors = [
    ["#1a1a2e", "#e94560"],
    ["#0f3460", "#533483"],
    ["#2d6a4f", "#95d5b2"],
    ["#b5838d", "#ffcdb2"],
  ]
  const [bg, accent] = colors[index % colors.length]

  const handleCopy = () => {
    onCopy()
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="sku-card overflow-hidden group">
      {/* Ad visual preview */}
      <div
        className="w-full relative overflow-hidden"
        style={{
          aspectRatio: ratio === "16:9" ? "16/9" : ratio === "4:5" ? "4/5" : ratio === "9:16" ? "9/16" : "1/1",
          background: `linear-gradient(135deg, ${bg} 0%, ${accent}99 100%)`,
          maxHeight: 200,
        }}
      >
        {/* Simulated ad layout */}
        <div className="absolute inset-0 flex flex-col justify-end p-4">
          <div className="mb-2">
            <div className="h-2 w-20 rounded-full mb-1.5" style={{ background: 'rgba(255,255,255,0.4)' }} />
            <div className="h-3 w-36 rounded-full mb-1" style={{ background: 'rgba(255,255,255,0.85)' }} />
            <div className="h-2 w-28 rounded-full" style={{ background: 'rgba(255,255,255,0.5)' }} />
          </div>
          <div
            className="self-start px-3 py-1.5 rounded-[6px] text-[11px] font-bold"
            style={{ background: accent, color: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.25)' }}
          >
            Shop Now
          </div>
        </div>
        {/* Style + ratio badge */}
        <div className="absolute top-2 right-2 flex gap-1">
          <span className="text-[9.5px] font-semibold text-white bg-black/40 backdrop-blur-sm px-1.5 py-0.5 rounded-full">{style}</span>
          <span className="text-[9.5px] font-semibold text-white bg-black/40 backdrop-blur-sm px-1.5 py-0.5 rounded-full">{ratio}</span>
        </div>
        {/* Overlay actions on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
          <button
            onClick={handleCopy}
            className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-[#374151] hover:bg-[#F0F2F5] transition-colors shadow"
            aria-label="Copy headline"
          >
            {copied ? <Check size={14} className="text-[#2E9E5B]" /> : <Copy size={14} />}
          </button>
          <button
            onClick={onDownload}
            className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-[#374151] hover:bg-[#F0F2F5] transition-colors shadow"
            aria-label="Download creative"
          >
            <Download size={14} />
          </button>
        </div>
      </div>
      {/* Caption */}
      <div className="px-3 py-2.5">
        <p className="text-[12px] font-semibold text-[#111827] leading-tight line-clamp-2">{headline}</p>
        <p className="text-[10.5px] text-[#9CA3AF] mt-0.5">Ad creative #{index + 1}</p>
      </div>
    </div>
  )
}

export default function NewCampaignPage() {
  const [activeTab, setActiveTab] = useState<Tab>("campaign")
  const [prompt, setPrompt] = useState("")
  const [detected, setDetected] = useState<Set<string>>(new Set())
  const [enhancing, setEnhancing] = useState(false)
  const [building, setBuilding] = useState(false)
  const [built, setBuilt] = useState(false)

  // Creatives state
  const [creativesPrompt, setCreativesPrompt] = useState("")
  const [selectedStyle, setSelectedStyle] = useState("Luxury")
  const [selectedRatio, setSelectedRatio] = useState("1:1")
  const [generatingCreatives, setGeneratingCreatives] = useState(false)
  const [generatedCreatives, setGeneratedCreatives] = useState<string[]>([])
  const [creativesCount, setCreativesCount] = useState(4)

  // Boolean search
  const [booleanQuery, setBooleanQuery] = useState("")

  const router = useRouter()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const s = new Set<string>()
    for (const [k, r] of Object.entries(KEYWORD_MAP)) {
      if (r.test(prompt)) s.add(k)
    }
    setDetected(s)
  }, [prompt])

  const handleEnhance = async () => {
    if (!prompt.trim() || enhancing) return
    setEnhancing(true)
    await new Promise((r) => setTimeout(r, 2200))
    const enhancements = [
      "\n\nTarget audience: Primary ICP includes decision-makers with mid-to-high disposable income, interested in premium offerings. Secondary audience: gift-givers and enthusiasts seeking quality products.",
      "\n\nProposed marketing angle: Highlight exclusivity, craftsmanship, and limited availability. Emphasize seasonal urgency and social proof through testimonials and user-generated content.",
      "\n\nKey messaging: Quality, reliability, exclusivity. Support with 3-5 visual assets showing product in lifestyle context.",
    ]
    const randomEnhancement = enhancements[Math.floor(Math.random() * enhancements.length)]
    setPrompt((p) => p + randomEnhancement)
    setEnhancing(false)
  }

  const handleBuild = async () => {
    if (!prompt.trim() || building) return
    setBuilding(true)
    await new Promise((r) => setTimeout(r, 2200))
    
    // Prepare campaign data
    const campaignData = {
      prompt,
      detectedChips: Array.from(detected),
      audience: { ageMin: 25, ageMax: 55, location: 'Global', description: '' },
      creative: { style: undefined, aspectRatio: undefined, variants: 4 },
      budget: { dailyAmount: 50, currency: 'USD ($)', totalDays: 30 },
    }
    
    // Navigate to builder with encoded data
    const encoded = btoa(JSON.stringify(campaignData))
    router.push(`/campaigns/builder?data=${encoded}`)
  }

  const handleGenerateCreatives = async () => {
    if (generatingCreatives) return
    setGeneratingCreatives(true)
    setGeneratedCreatives([])
    await new Promise((r) => setTimeout(r, 2500))
    const headlines = Array.from({ length: creativesCount }, (_, i) => `AI Creative #${i + 1} — based on your campaign brief`)
    setGeneratedCreatives(headlines)
    setGeneratingCreatives(false)
  }

  return (
    <Shell title="">
      <div className="flex h-full">
        {/* Sidebar panel — recent searches */}
        <div
          className="w-[200px] shrink-0 border-r border-[#DDE1E7] flex flex-col overflow-y-auto"
          style={{ background: 'linear-gradient(180deg, #f8f9fb 0%, #f3f5f7 100%)' }}
        >
          <div className="px-3 pt-4 pb-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10.5px] font-semibold text-[#9CA3AF] uppercase tracking-[0.08em]">
                Recent
              </span>
              <button
                className="w-5 h-5 flex items-center justify-center rounded-[5px] text-[#9CA3AF] hover:text-[#1F57F5] hover:bg-[#EAF0FE] transition-colors"
                aria-label="New search"
              >
                <Plus size={12} />
              </button>
            </div>
            <p className="text-[11px] text-[#9CA3AF] italic px-2 py-1">No recent searches yet.</p>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 py-10 min-h-0 overflow-y-auto">
          {/* Hero */}
          <div className="w-full max-w-[680px] text-center mb-8">
            <h1 className="text-[30px] text-[#111827] leading-tight mb-2 tracking-tight text-balance" style={{ fontWeight: 500 }}>
              {built ? "Campaign plan ready." : "Run ad campaigns in minutes."}
            </h1>
            <p className="text-[14px] text-[#6B7280] leading-relaxed">
              {built
                ? "Your AI campaign strategy, targeting and ad creatives are ready to review."
                : "Tell Growzzy what you want to promote. AI builds the strategy, targeting and ads for you."}
            </p>
          </div>

          {/* Tab bar */}
          <div className="flex items-center gap-1.5 mb-6">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  "flex items-center gap-1.5 h-8 px-3.5 rounded-full text-[12.5px] transition-colors",
                  activeTab === id
                    ? "bg-[#EAF0FE] text-[#1F57F5] font-semibold"
                    : "text-[#6B7280] hover:text-[#374151] sku-btn"
                )}
                style={activeTab === id ? {
                  boxShadow: '0 1px 0 rgba(255,255,255,0.8) inset, 0 1px 3px rgba(31,87,245,0.15), 0 0 0 1px rgba(31,87,245,0.2)',
                } : {}}
              >
                <Icon size={12} className="shrink-0" />
                {label}
              </button>
            ))}
          </div>

          {/* ── Campaign tab ── */}
          {activeTab === "campaign" && (
            <div className="w-full max-w-[680px]">
              <div
                className="bg-white rounded-[16px] overflow-hidden"
                style={{
                  border: '2px solid #1F57F5',
                  boxShadow: '0 0 0 4px rgba(31,87,245,0.08), 0 4px 20px rgba(0,0,0,0.08)',
                }}
              >
                <textarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="I want to sell artificial jewelry on my Shopify store to women aged 30-50 in India's Tier 1 cities..."
                  rows={6}
                  className="w-full px-4 pt-4 pb-2 text-[13.5px] text-[#111827] placeholder-[#9CA3AF] bg-transparent resize-none outline-none leading-relaxed"
                />
                {/* Enhance */}
                <div className="flex justify-end px-4 pb-2">
                  <button
                    onClick={handleEnhance}
                    disabled={!prompt.trim() || enhancing}
                    className="flex items-center gap-1 text-[12px] font-semibold text-[#1F57F5] hover:text-[#1849d6] disabled:opacity-40 transition-colors"
                  >
                    {enhancing ? (
                      <>
                        <RefreshCw size={11} className="animate-spin" />
                        Enhancing…
                      </>
                    ) : (
                      <>
                        <Wand2 size={11} />
                        AI Enhance
                      </>
                    )}
                  </button>
                </div>
                {/* Bottom bar */}
                <div className="flex items-center justify-between px-3 pb-3 pt-1 border-t border-[#E9EBEF]">
                  <div className="flex items-center gap-1 flex-wrap">
                    {CHIPS.map((chip) => {
                      const active = detected.has(chip.id)
                      return (
                        <span
                          key={chip.id}
                          className={cn(
                            "flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full transition-colors",
                            active ? "text-[#2E9E5B] font-semibold" : "text-[#9CA3AF] font-medium"
                          )}
                        >
                          {active
                            ? <CheckCircle2 size={11} className="text-[#2E9E5B]" />
                            : <Circle size={11} className="text-[#D1D5DB]" />}
                          {chip.label}
                        </span>
                      )
                    })}
                  </div>
                  <div className="flex items-center gap-1.5 ml-2">
                    <button
                      className="w-8 h-8 flex items-center justify-center rounded-full text-[#9CA3AF] hover:text-[#374151] transition-colors sku-btn"
                      aria-label="Attach file"
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      className="w-8 h-8 flex items-center justify-center rounded-full text-[#9CA3AF] hover:text-[#374151] transition-colors sku-btn"
                      aria-label="Voice input"
                    >
                      <Mic size={14} />
                    </button>
                    <button
                      onClick={handleBuild}
                      disabled={!prompt.trim() || building}
                      className={cn(
                        "flex items-center gap-1.5 h-8 px-4 rounded-full text-[12.5px] font-semibold transition-colors",
                        prompt.trim() && !building
                          ? "text-white sku-btn-primary"
                          : "bg-[#E9EBEF] text-[#9CA3AF] cursor-not-allowed"
                      )}
                    >
                      {building ? (
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Building…
                        </span>
                      ) : built ? (
                        <span className="flex items-center gap-1.5">
                          <Check size={12} />
                          Plan ready
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <Sparkles size={12} />
                          Build plan
                          <ArrowRight size={12} />
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
              {built && (
                <div className="mt-4 p-4 rounded-[12px] border border-[#2E9E5B]/30 bg-[#E6F4EC]">
                  <p className="text-[13px] font-semibold text-[#2E9E5B] mb-1 flex items-center gap-1.5">
                    <Check size={14} /> Campaign plan generated
                  </p>
                  <p className="text-[12px] text-[#374151]">
                    Your campaign strategy and targeting have been prepared. Review each step before launching.
                  </p>
                  <button
                    onClick={() => setActiveTab("creatives")}
                    className="mt-3 flex items-center gap-1.5 text-[12.5px] font-semibold text-[#1F57F5] hover:text-[#1849d6] transition-colors"
                  >
                    Generate AI creatives <ArrowRight size={12} />
                  </button>
                </div>
              )}
              <p className="text-center text-[11px] text-[#9CA3AF] mt-3">
                AI can make mistakes. Check important info.{" "}
                <button className="underline hover:text-[#6B7280] transition-colors">See cookie preferences.</button>
              </p>
            </div>
          )}

          {/* ── Boolean search tab ── */}
          {activeTab === "boolean" && (
            <div className="w-full max-w-[680px]">
              <div className="sku-card p-5">
                <p className="text-[14px] font-semibold text-[#111827] mb-1">Boolean Audience Search</p>
                <p className="text-[12.5px] text-[#6B7280] mb-4">
                  Build precise LinkedIn / Google audience queries using AND, OR, NOT operators.
                </p>
                <div className="space-y-3">
                  <textarea
                    value={booleanQuery}
                    onChange={(e) => setBooleanQuery(e.target.value)}
                    rows={4}
                    placeholder={`e.g. (women OR female) AND (fashion OR jewelry) AND (India OR Mumbai) AND age:30-50`}
                    className="w-full px-3 py-2.5 text-[13px] text-[#111827] placeholder-[#9CA3AF] resize-none outline-none leading-relaxed rounded-[8px] sku-input"
                  />
                  <div className="flex gap-2">
                    {["AND", "OR", "NOT", "( )", "age:", "location:"].map((op) => (
                      <button
                        key={op}
                        onClick={() => setBooleanQuery((q) => q + (q ? " " : "") + op)}
                        className="h-7 px-2.5 text-[11.5px] font-semibold text-[#374151] rounded-[6px] sku-btn"
                      >
                        {op}
                      </button>
                    ))}
                  </div>
                  <button
                    disabled={!booleanQuery.trim()}
                    className={cn(
                      "flex items-center gap-1.5 h-9 px-5 rounded-[8px] text-[13px] font-semibold transition-colors",
                      booleanQuery.trim() ? "text-white sku-btn-primary" : "bg-[#E9EBEF] text-[#9CA3AF] cursor-not-allowed"
                    )}
                  >
                    <Search size={13} />
                    Search audience
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── AI Creatives tab ── */}
          {activeTab === "creatives" && (
            <div className="w-full max-w-[720px]">
              {/* Controls card */}
              <div className="sku-card p-5 mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <ImageIcon size={15} className="text-[#1F57F5]" />
                  <p className="text-[14px] font-semibold text-[#111827]">AI Ad Creatives</p>
                  <span className="text-[10px] font-bold text-[#2E9E5B] bg-[#E6F4EC] px-2 py-0.5 rounded-full uppercase tracking-wide">
                    High-performing
                  </span>
                </div>
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">Describe the ad visual</label>
                    <textarea
                      value={creativesPrompt}
                      onChange={(e) => setCreativesPrompt(e.target.value)}
                      rows={3}
                      placeholder="A luxury jewelry ad showing a woman at a festive wedding event, warm gold tones, elegant and premium feel..."
                      className="w-full px-3 py-2.5 text-[13px] text-[#111827] placeholder-[#9CA3AF] resize-none outline-none leading-relaxed rounded-[8px] sku-input"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {/* Style */}
                    <div>
                      <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">Ad Style</label>
                      <div className="flex flex-wrap gap-1.5">
                        {AD_STYLES.map((s) => (
                          <button
                            key={s}
                            onClick={() => setSelectedStyle(s)}
                            className={cn(
                              "h-7 px-2.5 text-[11.5px] rounded-[6px] transition-colors",
                              selectedStyle === s
                                ? "bg-[#EAF0FE] text-[#1F57F5] font-semibold"
                                : "text-[#4B5563] font-medium sku-btn"
                            )}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Aspect ratio */}
                    <div>
                      <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">Aspect Ratio</label>
                      <div className="flex gap-1.5">
                        {ASPECT_RATIOS.map(({ label, desc }) => (
                          <button
                            key={label}
                            onClick={() => setSelectedRatio(label)}
                            className={cn(
                              "flex flex-col items-center px-2 py-1.5 rounded-[6px] transition-colors",
                              selectedRatio === label
                                ? "bg-[#EAF0FE] text-[#1F57F5]"
                                : "text-[#4B5563] sku-btn"
                            )}
                          >
                            <span className="text-[11.5px] font-bold leading-none">{label}</span>
                            <span className="text-[9.5px] text-[#9CA3AF] leading-none mt-0.5">{desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Count */}
                    <div>
                      <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">No. of variants</label>
                      <div className="relative">
                        <select
                          value={creativesCount}
                          onChange={(e) => setCreativesCount(Number(e.target.value))}
                          className="w-full h-9 pl-3 pr-8 text-[12.5px] text-[#111827] outline-none appearance-none rounded-[8px] sku-input"
                        >
                          {[1, 2, 3, 4].map((n) => (
                            <option key={n} value={n}>{n} variant{n > 1 ? "s" : ""}</option>
                          ))}
                        </select>
                        <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleGenerateCreatives}
                    disabled={generatingCreatives}
                    className={cn(
                      "flex items-center justify-center gap-2 h-10 w-full rounded-[10px] text-[13.5px] font-semibold transition-colors",
                      !generatingCreatives ? "text-white sku-btn-primary" : "bg-[#E9EBEF] text-[#9CA3AF] cursor-not-allowed"
                    )}
                  >
                    {generatingCreatives ? (
                      <>
                        <span className="w-4 h-4 border-2 border-[#9CA3AF]/30 border-t-[#9CA3AF] rounded-full animate-spin" />
                        Generating creatives…
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        Generate {creativesCount} AI creative{creativesCount > 1 ? "s" : ""}
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Generated creatives grid */}
              {generatedCreatives.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[13.5px] font-semibold text-[#111827]">
                      {generatedCreatives.length} creative{generatedCreatives.length > 1 ? "s" : ""} generated
                    </p>
                    <button
                      onClick={handleGenerateCreatives}
                      className="flex items-center gap-1 text-[12px] font-semibold text-[#1F57F5] hover:text-[#1849d6] transition-colors"
                    >
                      <RefreshCw size={12} />
                      Regenerate
                    </button>
                  </div>
                  <div className={cn(
                    "grid gap-4",
                    generatedCreatives.length === 1 ? "grid-cols-1 max-w-[280px]" :
                    generatedCreatives.length === 2 ? "grid-cols-2" :
                    "grid-cols-2 lg:grid-cols-4"
                  )}>
                    {generatedCreatives.map((headline, i) => (
                      <CreativeCard
                        key={i}
                        index={i}
                        style={selectedStyle}
                        ratio={selectedRatio}
                        headline={headline}
                        onCopy={() => navigator.clipboard.writeText(headline).catch(() => {})}
                        onDownload={() => {}}
                      />
                    ))}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => setActiveTab("launch")}
                      className="flex items-center gap-1.5 h-9 px-5 text-white text-[13px] font-semibold rounded-[8px] sku-btn-primary"
                    >
                      <Rocket size={13} />
                      Continue to Launch
                      <ArrowRight size={13} />
                    </button>
                    <button className="flex items-center gap-1.5 h-9 px-4 text-[13px] font-semibold text-[#374151] rounded-[8px] sku-btn">
                      <Download size={13} />
                      Download all
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Launch Ads tab ── */}
          {activeTab === "launch" && (
            <div className="w-full max-w-[680px]">
              <div className="sku-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Rocket size={16} className="text-[#1F57F5]" />
                  <p className="text-[14px] font-semibold text-[#111827]">Launch to Google Ads</p>
                </div>
                <div className="space-y-3">
                  {[
                    { step: 1, label: "Campaign strategy", done: built },
                    { step: 2, label: "AI creatives generated", done: generatedCreatives.length > 0 },
                    { step: 3, label: "Target audience configured", done: detected.has("audience") },
                    { step: 4, label: "Budget set", done: detected.has("budget") },
                    { step: 5, label: "Google Ads connected", done: false },
                  ].map(({ step, label, done }) => (
                    <div
                      key={step}
                      className="flex items-center gap-3 p-3 rounded-[10px]"
                      style={{ background: done ? '#E6F4EC' : 'linear-gradient(145deg, #f8f9fb 0%, #f0f2f5 100%)' }}
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11.5px] font-bold"
                        style={done ? {
                          background: 'linear-gradient(135deg, #34c471 0%, #2E9E5B 100%)',
                          color: 'white',
                          boxShadow: '0 1px 0 rgba(255,255,255,0.3) inset, 0 2px 4px rgba(46,158,91,0.3)',
                        } : {
                          background: 'linear-gradient(145deg, #e8eaed 0%, #f4f5f7 100%)',
                          color: '#9CA3AF',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.08) inset',
                        }}
                      >
                        {done ? <Check size={13} /> : step}
                      </div>
                      <span className={cn("text-[13px]", done ? "font-semibold text-[#2E9E5B]" : "font-medium text-[#4B5563]")}>
                        {label}
                      </span>
                      {!done && step < 5 && (
                        <button
                          onClick={() => {
                            if (step === 1) setActiveTab("campaign")
                            if (step === 2) setActiveTab("creatives")
                          }}
                          className="ml-auto text-[11.5px] font-semibold text-[#1F57F5] hover:text-[#1849d6] transition-colors"
                        >
                          Complete →
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  disabled={!built || generatedCreatives.length === 0}
                  className={cn(
                    "mt-5 flex items-center justify-center gap-2 h-11 w-full rounded-[10px] text-[14px] font-semibold transition-colors",
                    built && generatedCreatives.length > 0
                      ? "text-white sku-btn-primary"
                      : "bg-[#E9EBEF] text-[#9CA3AF] cursor-not-allowed"
                  )}
                >
                  <Rocket size={15} />
                  Publish to Google Ads
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Shell>
  )
}
