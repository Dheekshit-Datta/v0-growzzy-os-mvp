"use client"

import { useState, useEffect, useRef } from "react"
import { Shell } from "@/components/dashboard-v2/shell"
import { Upload, Check, ChevronDown, Loader2 } from "lucide-react"

function FormField({ label, helper, children }: { label: string; helper?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[13px] font-medium text-[#374151]">{label}</label>
      {children}
      {helper && <p className="text-[11.5px] text-[#9CA3AF]">{helper}</p>}
    </div>
  )
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
  const [saveError, setSaveError] = useState("")
  const [data, setData] = useState<Partial<BrandData>>({})
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
      <div className="p-6 max-w-[720px]">
        {/* Helper banner */}
        <div className="bg-[#EAF0FE] rounded-[10px] px-4 py-3 mb-5 text-[12.5px] text-[#1F57F5] font-medium">
          Every campaign Growzzy writes uses this information. Keep it accurate and detailed for the best results.
        </div>

        {loading ? (
          <div className="bg-white rounded-[14px] border border-[#E9EBEF] p-10 flex items-center justify-center text-[#9CA3AF]">
            <Loader2 className="animate-spin" size={20} />
          </div>
        ) : (
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
              <FormField label="Website">
                <input
                  type="url"
                  placeholder="https://yoursite.com"
                  value={data.websiteUrl || ""}
                  onChange={(e) => set({ websiteUrl: e.target.value })}
                  className="w-full h-9 px-3 bg-[#F6F7F9] border border-[#E9EBEF] rounded-[8px] text-[13px] text-[#111827] placeholder-[#9CA3AF] outline-none focus:border-[#1F57F5] focus:ring-2 focus:ring-[#1F57F5]/10 transition-colors"
                />
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
                    rows={5}
                    placeholder="Describe your product or service in detail..."
                    value={data.productDescription || ""}
                    onChange={(e) => set({ productDescription: e.target.value })}
                    className="w-full px-3 py-2.5 bg-[#F6F7F9] border border-[#E9EBEF] rounded-[8px] text-[13px] text-[#111827] placeholder-[#9CA3AF] outline-none focus:border-[#1F57F5] focus:ring-2 focus:ring-[#1F57F5]/10 transition-colors resize-none leading-relaxed"
                  />
                </FormField>
              </div>
              <div className="col-span-2">
                <FormField label="Default landing page URL" helper="Optional — the AI will suggest this as a destination when building campaigns.">
                  <input
                    type="url"
                    placeholder="https://yoursite.com/landing-page"
                    value={data.defaultLandingPageUrl || ""}
                    onChange={(e) => set({ defaultLandingPageUrl: e.target.value })}
                    className="w-full h-9 px-3 bg-[#F6F7F9] border border-[#E9EBEF] rounded-[8px] text-[13px] text-[#111827] placeholder-[#9CA3AF] outline-none focus:border-[#1F57F5] focus:ring-2 focus:ring-[#1F57F5]/10 transition-colors"
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
        )}
      </div>
    </Shell>
  )
}
