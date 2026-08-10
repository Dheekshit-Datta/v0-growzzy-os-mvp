"use client"

import { useState, useEffect, useRef } from "react"
import { Shell } from "@/components/dashboard-v2/shell"
import { Upload, Check, ChevronDown, Loader2, Sparkles, Wand2, Globe, Palette, Type, ShieldCheck } from "lucide-react"

function FormField({ label, helper, children }: { label: string; helper?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[13px] font-medium text-[#374151]">{label}</label>
      {children}
      {helper && <p className="text-[11.5px] text-[#9CA3AF]">{helper}</p>}
    </div>
  )
}

type BrandMemory = {
  brandName?: string
  tagline?: string
  archetype?: string
  brandStory?: string
  toneOfVoice?: string
  voiceProfile?: { attribute: string; intensity: string }[]
  colorPalette?: {
    primaryHex?: string
    secondaryHex?: string
    accentHex?: string
    backgroundHex?: string
    description?: string
  }
  typography?: {
    headingFont?: string
    bodyFont?: string
  }
  productDescription?: string
}

type BrandData = {
  logo: string | null
  name: string
  websiteUrl: string | null
  industry: string | null
  toneOfVoice: string | null
  productDescription: string | null
  defaultLandingPageUrl: string | null
}

export default function BrandPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState("")
  const [saveError, setSaveError] = useState("")
  const [data, setData] = useState<Partial<BrandData>>({})
  const [brandMemory, setBrandMemory] = useState<BrandMemory | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch("/api/workspaces", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const w = json?.workspaces?.[0]
        if (w) setData(w)
      })
      .finally(() => setLoading(false))
  }, [])

  const set = (patch: Partial<BrandData>) => setData((prev) => ({ ...prev, ...patch }))

  const handleLogoFile = (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      alert("Logo must be under 2MB")
      return
    }
    const reader = new FileReader()
    reader.onload = () => set({ logo: reader.result as string })
    reader.readAsDataURL(file)
  }

  const analyzeWebsite = async () => {
    if (!data.websiteUrl || analyzing) return
    setAnalyzing(true)
    setAnalyzeError("")
    try {
      const res = await fetch("/api/brand/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteUrl: data.websiteUrl }),
      })
      const json = await res.json()
      if (!res.ok || !json?.ok) throw new Error(json?.error?.message || "Failed to analyze website brand")
      const memory = json.data?.brandMemory
      if (memory) {
        setBrandMemory(memory)
        set({
          name: memory.brandName || data.name,
          productDescription: memory.productDescription || data.productDescription,
          toneOfVoice: memory.toneOfVoice || data.toneOfVoice,
        })
      }
    } catch (err: any) {
      setAnalyzeError(err?.message || "Brand analysis failed. Please check the URL.")
    } finally {
      setAnalyzing(false)
    }
  }

  const save = async () => {
    setSaving(true)
    setSaveError("")
    try {
      const res = await fetch("/api/workspaces", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name || undefined,
          websiteUrl: data.websiteUrl || "",
          industry: data.industry || "",
          toneOfVoice: data.toneOfVoice || "",
          productDescription: data.productDescription || "",
          defaultLandingPageUrl: data.defaultLandingPageUrl || "",
          logo: data.logo || "",
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Could not save brand context")
      window.dispatchEvent(new Event("growzzy:workspace-updated"))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save brand context")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Shell title="My Brand">
      <div className="p-6 max-w-[840px] space-y-5">
        {/* Helper banner */}
        <div className="bg-[#EAF0FE] rounded-[10px] px-4 py-3 text-[12.5px] text-[#1F57F5] font-medium flex items-center justify-between">
          <span>Every campaign & AI ad creative Growzzy generates uses this brand context.</span>
        </div>

        {loading ? (
          <div className="bg-white rounded-[14px] border border-[#E9EBEF] p-10 flex items-center justify-center text-[#9CA3AF]">
            <Loader2 className="animate-spin" size={20} />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Empty State Website Intake Hero Banner */}
            {(!data.websiteUrl || !data.productDescription) && (
              <div className="bg-gradient-to-br from-[#EAF0FE] via-white to-[#F0F4FF] rounded-[16px] border-2 border-[#1F57F5]/30 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={18} className="text-[#1F57F5]" />
                  <h2 className="text-[16px] font-bold text-[#111827]">Auto-Build Brand Memory from Website</h2>
                </div>
                <p className="text-[13px] text-[#4B5563] mb-4 leading-relaxed">
                  Enter your website URL below. Growzzy will deeply analyze your business, extract your brand story, color palette, typography, and tone of voice so every AI campaign, ad copy, and graphic is automatically personalized for your business.
                </p>
                <div className="flex gap-2 max-w-[560px]">
                  <input
                    type="url"
                    placeholder="https://yourwebsite.com"
                    value={data.websiteUrl || ""}
                    onChange={(e) => set({ websiteUrl: e.target.value })}
                    className="w-full h-10 px-3.5 bg-white border border-[#D1D5DB] rounded-[10px] text-[13.5px] text-[#111827] placeholder-[#9CA3AF] outline-none focus:border-[#1F57F5] focus:ring-2 focus:ring-[#1F57F5]/10 shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={analyzeWebsite}
                    disabled={analyzing || !data.websiteUrl}
                    className="flex items-center gap-2 h-10 px-5 bg-[#1F57F5] text-white text-[13.5px] font-semibold rounded-[10px] hover:bg-[#1849d6] transition-colors disabled:opacity-50 whitespace-nowrap shadow-sm"
                  >
                    {analyzing ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                    {analyzing ? "Analyzing Website…" : "✨ Build Brand Memory"}
                  </button>
                </div>
                {analyzeError && <p className="text-[12px] text-[#D3564C] mt-2 font-medium">{analyzeError}</p>}
              </div>
            )}

            {/* Main Form */}
            <div className="bg-white rounded-[14px] border border-[#E9EBEF] p-6 space-y-5">
              {/* Logo upload */}
              <FormField label="Brand logo">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 bg-[#F6F7F9] rounded-[10px] border-2 border-dashed border-[#E9EBEF] flex items-center justify-center overflow-hidden">
                    {data.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={data.logo} alt="Brand logo" className="w-full h-full object-cover" />
                    ) : (
                      <Upload size={18} className="text-[#D1D5DB]" />
                    )}
                  </div>
                  <div>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleLogoFile(e.target.files[0])}
                    />
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="flex items-center gap-1.5 h-8 px-3 bg-white border border-[#E9EBEF] rounded-[8px] text-[12.5px] font-medium text-[#374151] hover:border-[#D1D5DB] transition-colors"
                    >
                      <Upload size={13} />
                      Upload logo
                    </button>
                    <p className="text-[11px] text-[#9CA3AF] mt-1">PNG, JPG or SVG · Max 2MB</p>
                  </div>
                </div>
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Business name">
                  <input
                    placeholder="Your business name"
                    value={data.name || ""}
                    onChange={(e) => set({ name: e.target.value })}
                    className="w-full h-9 px-3 bg-[#F6F7F9] border border-[#E9EBEF] rounded-[8px] text-[13px] text-[#111827] placeholder-[#9CA3AF] outline-none focus:border-[#1F57F5] focus:ring-2 focus:ring-[#1F57F5]/10 transition-colors"
                  />
                </FormField>
                <FormField label="Website URL">
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://yoursite.com"
                      value={data.websiteUrl || ""}
                      onChange={(e) => set({ websiteUrl: e.target.value })}
                      className="w-full h-9 px-3 bg-[#F6F7F9] border border-[#E9EBEF] rounded-[8px] text-[13px] text-[#111827] placeholder-[#9CA3AF] outline-none focus:border-[#1F57F5] focus:ring-2 focus:ring-[#1F57F5]/10 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={analyzeWebsite}
                      disabled={analyzing || !data.websiteUrl}
                      className="flex items-center gap-1.5 h-9 px-3 bg-[#EAF0FE] text-[#1F57F5] text-[12px] font-semibold rounded-[8px] hover:bg-[#dbe6fe] transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                      {analyzing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                      {analyzing ? "Analyzing…" : "Analyze Website"}
                    </button>
                  </div>
                  {analyzeError && <p className="text-[11px] text-[#D3564C] mt-1">{analyzeError}</p>}
                </FormField>
                <FormField label="Industry">
                  <div className="relative">
                    <select
                      value={data.industry || ""}
                      onChange={(e) => set({ industry: e.target.value })}
                      className="w-full h-9 pl-3 pr-8 bg-[#F6F7F9] border border-[#E9EBEF] rounded-[8px] text-[13px] text-[#111827] outline-none focus:border-[#1F57F5] focus:ring-2 focus:ring-[#1F57F5]/10 transition-colors appearance-none"
                    >
                      <option value="">Select industry</option>
                      <option>E-commerce / Retail</option>
                      <option>Real Estate</option>
                      <option>Healthcare</option>
                      <option>Finance</option>
                      <option>Education</option>
                      <option>Technology / SaaS</option>
                      <option>Fashion & Apparel</option>
                      <option>Food & Beverage</option>
                      <option>Travel & Hospitality</option>
                      <option>Other</option>
                    </select>
                    <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
                  </div>
                </FormField>
                <FormField label="Tone of voice">
                  <div className="relative">
                    <select
                      value={data.toneOfVoice || "Professional"}
                      onChange={(e) => set({ toneOfVoice: e.target.value })}
                      className="w-full h-9 pl-3 pr-8 bg-[#F6F7F9] border border-[#E9EBEF] rounded-[8px] text-[13px] text-[#111827] outline-none focus:border-[#1F57F5] focus:ring-2 focus:ring-[#1F57F5]/10 transition-colors appearance-none"
                    >
                      <option>Professional</option>
                      <option>Friendly & casual</option>
                      <option>Luxury & premium</option>
                      <option>Bold & direct</option>
                      <option>Empathetic</option>
                      <option>Playful</option>
                    </select>
                    <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
                  </div>
                </FormField>
                <div className="col-span-2">
                  <FormField
                    label="Product / service description"
                    helper="What do you sell, who buys it, and what makes you different? The AI uses this for every campaign."
                  >
                    <textarea
                      rows={4}
                      placeholder="Describe your product or service in detail..."
                      value={data.productDescription || ""}
                      onChange={(e) => set({ productDescription: e.target.value })}
                      className="w-full px-3 py-2.5 bg-[#F6F7F9] border border-[#E9EBEF] rounded-[8px] text-[13px] text-[#111827] placeholder-[#9CA3AF] outline-none focus:border-[#1F57F5] focus:ring-2 focus:ring-[#1F57F5]/10 transition-colors resize-none leading-relaxed"
                    />
                  </FormField>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2 border-t border-[#E9EBEF]">
                {saveError && <p className="text-[11.5px] text-[#D3564C]">{saveError}</p>}
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex items-center gap-1.5 h-9 px-5 bg-[#1F57F5] text-white text-[13px] font-semibold rounded-[8px] hover:bg-[#1849d6] transition-colors disabled:opacity-60"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {saving ? "Saving…" : saved ? "Saved!" : "Save brand kit"}
                </button>
              </div>
            </div>

            {/* Extracted Brand Memory Units Card */}
            {brandMemory && (
              <div className="bg-white rounded-[14px] border border-[#E9EBEF] p-6 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-[#E9EBEF] pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-[#1F57F5]" />
                    <h3 className="text-[14px] font-semibold text-[#111827]">Extracted Brand Memory Units</h3>
                  </div>
                  <span className="text-[11px] font-bold text-[#10B981] bg-[#ECFDF5] px-2 py-0.5 rounded-full flex items-center gap-1">
                    <ShieldCheck size={12} /> 100% Extracted
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Archetype & Tagline */}
                  <div className="bg-[#F8F9FA] rounded-[10px] p-3.5 border border-[#E9EBEF]">
                    <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Brand Archetype & Tagline</p>
                    <p className="text-[13px] font-bold text-[#111827] mt-1">{brandMemory.archetype || "The Innovator"}</p>
                    {brandMemory.tagline && <p className="text-[12px] italic text-[#4B5563] mt-0.5">"{brandMemory.tagline}"</p>}
                    {brandMemory.brandStory && <p className="text-[11.5px] text-[#6B7280] mt-2 line-clamp-2">{brandMemory.brandStory}</p>}
                  </div>

                  {/* Color Palette Swatches */}
                  <div className="bg-[#F8F9FA] rounded-[10px] p-3.5 border border-[#E9EBEF]">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Palette size={13} className="text-[#1F57F5]" />
                      <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Brand Color Palette</p>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {[
                        { label: "Primary", hex: brandMemory.colorPalette?.primaryHex || "#0B0B0B" },
                        { label: "Secondary", hex: brandMemory.colorPalette?.secondaryHex || "#1F57F5" },
                        { label: "Accent", hex: brandMemory.colorPalette?.accentHex || "#10B981" },
                        { label: "Bg", hex: brandMemory.colorPalette?.backgroundHex || "#F9FAFB" },
                      ].map((item, idx) => (
                        <div key={idx} className="flex-1 text-center">
                          <div className="w-full h-8 rounded-[6px] border border-black/10 shadow-inner" style={{ backgroundColor: item.hex }} />
                          <p className="text-[10px] font-mono text-[#374151] mt-1">{item.hex}</p>
                          <p className="text-[9.5px] text-[#9CA3AF]">{item.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Voice Profile Intensity */}
                  <div className="bg-[#F8F9FA] rounded-[10px] p-3.5 border border-[#E9EBEF]">
                    <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-2">Brand Voice Intensity</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(brandMemory.voiceProfile || [
                        { attribute: "Professional", intensity: "High" },
                        { attribute: "Confident", intensity: "High" },
                        { attribute: "Direct", intensity: "Moderate" },
                      ]).map((item, i) => (
                        <span key={i} className="text-[11px] font-medium bg-white text-[#374151] border border-[#E9EBEF] px-2.5 py-1 rounded-full">
                          {item.attribute} <span className="text-[10px] text-[#1F57F5] font-bold">({item.intensity})</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Typography */}
                  <div className="bg-[#F8F9FA] rounded-[10px] p-3.5 border border-[#E9EBEF]">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Type size={13} className="text-[#1F57F5]" />
                      <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Extracted Typography</p>
                    </div>
                    <p className="text-[12px] text-[#374151]">
                      <span className="font-semibold">Headings:</span> {brandMemory.typography?.headingFont || "Inter, sans-serif"}
                    </p>
                    <p className="text-[12px] text-[#374151] mt-1">
                      <span className="font-semibold">Body:</span> {brandMemory.typography?.bodyFont || "Roboto, sans-serif"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Shell>
  )
}
