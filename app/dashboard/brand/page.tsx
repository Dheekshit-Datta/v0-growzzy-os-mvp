"use client"

import { useState, useEffect } from "react"
import { Shell } from "@/components/dashboard-v2/shell"
import {
  Globe, Sparkles, Plus, Trash2, X, Check, Loader2, Download,
  ExternalLink, Zap, Building2, Users, Target, ShieldCheck, ArrowRight
} from "lucide-react"
import { cn } from "@/lib/utils"

export interface AudienceSegment {
  id: string
  title: string
  painPoints: string
}

export interface Competitor {
  id: string
  name: string
  description: string
}

const TONES = [
  {
    id: "Friendly",
    name: "Friendly",
    example: "Hey! Grab yours before they're gone ⚡",
  },
  {
    id: "Professional",
    name: "Professional",
    example: "Trusted by 10,000+ businesses worldwide.",
  },
  {
    id: "Playful",
    name: "Playful",
    example: "Warning: dangerously good products inside 💎",
  },
  {
    id: "Premium",
    name: "Premium",
    example: "Crafted for those who notice the details.",
  },
]

const COLOR_PALETTES = [
  { id: "Growzzy", name: "Growzzy", hex: "#1F57F5" },
  { id: "Ember", name: "Ember", hex: "#F97316" },
  { id: "Forest", name: "Forest", hex: "#10B981" },
  { id: "Rose", name: "Rose", hex: "#F43F5E" },
  { id: "Slate", name: "Slate", hex: "#0F172A" },
]

export default function BrandPage() {
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  // Brand Core State
  const [websiteUrl, setWebsiteUrl] = useState("https://markitxai.vercel.app/")
  const [lastAnalysed, setLastAnalysed] = useState<string>("8/17/2026, 7:37:53 PM")
  const [sourcesRead, setSourcesRead] = useState<string[]>(["https://markitxai.vercel.app/"])

  const [businessName, setBusinessName] = useState("MARKITX")
  const [industry, setIndustry] = useState("Artificial Intelligence / Business Software")
  const [businessModel, setBusinessModel] = useState("B2B Software/Service")
  const [defaultLandingPage, setDefaultLandingPage] = useState("https://markitxai.vercel.app/")

  const [whatYouSell, setWhatYouSell] = useState(
    "AI infrastructure solutions, including multi-agent systems, automated AI workflows, and custom AI agents."
  )
  const [productDescription, setProductDescription] = useState(
    "MARKITX provides advanced AI infrastructure designed to automate and run business operations. Their offerings include multi-agent systems for complex tasks, automated workflows to streamline processes, and custom-built AI agents tailored to specific operational needs, aiming to reduce direct human intervention in daily operations."
  )
  const [positioning, setPositioning] = useState(
    "MARKITX positions itself as an essential infrastructure provider for businesses seeking to automate and optimize their operations through sophisticated AI multi-agent systems and custom AI solutions."
  )
  const [idealCustomer, setIdealCustomer] = useState(
    "Businesses looking to automate and optimize their operations using advanced AI technology."
  )

  // Differentiators
  const [differentiators, setDifferentiators] = useState<string[]>([
    "Focus on 'infrastructure' for AI rather than just applications",
    "Specialization in multi-agent systems",
    "Custom AI agent development for specific operational needs",
    "Goal of running operations 'without you in every process' highlighting high automation potential",
  ])
  const [newDiffInput, setNewDiffInput] = useState("")

  // Audience Segments
  const [audienceSegments, setAudienceSegments] = useState<AudienceSegment[]>([
    {
      id: "1",
      title: "Operations-Heavy Businesses",
      painPoints:
        "Inefficient manual processes, high operational costs, bottlenecks in workflows, desire for scalability without proportional headcount increase.\n\nSeeking significant operational efficiency improvements, facing competitive pressure to innovate, needing to reduce human error in repetitive tasks.",
    },
    {
      id: "2",
      title: "Forward-Thinking Enterprises",
      painPoints:
        "Struggling to integrate advanced AI into existing systems, lack of internal expertise for custom AI development, desire to leverage cutting-edge AI for strategic advantage.\n\nStrategic initiatives to become AI-first, exploring new technologies for competitive differentiation, looking for robust and scalable AI solutions.",
    },
    {
      id: "3",
      title: "Businesses with Complex Workflows",
      painPoints:
        "Difficulty coordinating multiple interdependent processes, challenges in automating nuanced decision-making, need for intelligent automation beyond simple RPA.\n\nIdentifying multi-step, dynamic processes that could benefit from intelligent agents, seeking solutions that can learn and adapt, aiming for higher levels of operational autonomy.",
    },
  ])

  // Competitors
  const [competitors, setCompetitors] = useState<Competitor[]>([])

  // Search & Creative Signals
  const [highIntentKeywords, setHighIntentKeywords] = useState<string[]>([
    "AI infrastructure for businesses",
    "multi-agent systems for operations",
    "automated AI workflows",
    "custom AI agents for business",
    "AI business automation solutions",
    "enterprise AI infrastructure",
    "AI for operational efficiency",
    "business process automation AI",
    "AI agent development services",
    "intelligent automation for businesses",
    "AI solutions for workflow optimization",
    "no-code AI business automation",
  ])
  const [newKeywordInput, setNewKeywordInput] = useState("")

  const [creativeAngles, setCreativeAngles] = useState<string[]>([
    "Imagine your business running itself: Automate operations with MARKITX AI infrastructure.",
    "Unlock true efficiency: MARKITX builds custom AI agents that manage your critical workflows.",
    "Beyond automation: Leverage multi-agent AI systems to transform your business operations with MARKITX.",
    "Free up your team for innovation. MARKITX AI handles the heavy lifting, autonomously.",
    "Future-proof your business: Implement advanced AI infrastructure designed for intelligent, self-running operations.",
  ])
  const [newAngleInput, setNewAngleInput] = useState("")

  // Voice & Colors
  const [selectedTone, setSelectedTone] = useState("Professional")
  const [selectedColor, setSelectedColor] = useState("Growzzy")

  // Load from workspace / LocalStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("growzzy_brand_context_full")
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.websiteUrl) setWebsiteUrl(parsed.websiteUrl)
        if (parsed.businessName) setBusinessName(parsed.businessName)
        if (parsed.industry) setIndustry(parsed.industry)
        if (parsed.businessModel) setBusinessModel(parsed.businessModel)
        if (parsed.defaultLandingPage) setDefaultLandingPage(parsed.defaultLandingPage)
        if (parsed.whatYouSell) setWhatYouSell(parsed.whatYouSell)
        if (parsed.productDescription) setProductDescription(parsed.productDescription)
        if (parsed.positioning) setPositioning(parsed.positioning)
        if (parsed.idealCustomer) setIdealCustomer(parsed.idealCustomer)
        if (parsed.differentiators) setDifferentiators(parsed.differentiators)
        if (parsed.audienceSegments) setAudienceSegments(parsed.audienceSegments)
        if (parsed.competitors) setCompetitors(parsed.competitors)
        if (parsed.highIntentKeywords) setHighIntentKeywords(parsed.highIntentKeywords)
        if (parsed.creativeAngles) setCreativeAngles(parsed.creativeAngles)
        if (parsed.selectedTone) setSelectedTone(parsed.selectedTone)
        if (parsed.selectedColor) setSelectedColor(parsed.selectedColor)
        if (parsed.sourcesRead) setSourcesRead(parsed.sourcesRead)
        if (parsed.lastAnalysed) setLastAnalysed(parsed.lastAnalysed)
      }
    } catch {}

    fetch("/api/workspaces")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const w = json?.workspaces?.[0]
        if (w) {
          if (w.name) setBusinessName(w.name)
          if (w.websiteUrl) setWebsiteUrl(w.websiteUrl)
          if (w.industry) setIndustry(w.industry)
          if (w.productDescription) setProductDescription(w.productDescription)
          if (w.toneOfVoice) setSelectedTone(w.toneOfVoice)
          if (w.defaultLandingPageUrl) setDefaultLandingPage(w.defaultLandingPageUrl)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  // Deep Analyse Action
  const handleDeepAnalyse = async () => {
    if (!websiteUrl || analyzing) return
    setAnalyzing(true)
    setErrorMsg("")
    try {
      const res = await fetch("/api/brand/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteUrl }),
      })
      const json = await res.json()
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message || "Failed to analyze website brand")
      }
      const mem = json.data?.brandMemory
      if (mem) {
        if (mem.brandName) setBusinessName(mem.brandName)
        if (mem.industry) setIndustry(mem.industry)
        if (mem.businessModel) setBusinessModel(mem.businessModel)
        if (mem.whatYouSell) setWhatYouSell(mem.whatYouSell)
        if (mem.productDescription) setProductDescription(mem.productDescription)
        if (mem.positioning) setPositioning(mem.positioning)
        if (mem.idealCustomer) setIdealCustomer(mem.idealCustomer)
        if (Array.isArray(mem.differentiators) && mem.differentiators.length > 0) {
          setDifferentiators(mem.differentiators)
        }
        if (Array.isArray(mem.audienceSegments) && mem.audienceSegments.length > 0) {
          setAudienceSegments(
            mem.audienceSegments.map((s: any, idx: number) => ({
              id: String(idx + 1),
              title: s.title || `Segment ${idx + 1}`,
              painPoints: s.painPoints || "",
            }))
          )
        }
        if (Array.isArray(mem.highIntentKeywords) && mem.highIntentKeywords.length > 0) {
          setHighIntentKeywords(mem.highIntentKeywords)
        }
        if (Array.isArray(mem.creativeAngles) && mem.creativeAngles.length > 0) {
          setCreativeAngles(mem.creativeAngles)
        }
        if (mem.toneOfVoice) setSelectedTone(mem.toneOfVoice)
        if (mem.colorTheme) setSelectedColor(mem.colorTheme)
        if (mem.sourcesRead) setSourcesRead(mem.sourcesRead)

        const nowStr = new Date().toLocaleString()
        setLastAnalysed(nowStr)
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Error analyzing website")
    } finally {
      setAnalyzing(false)
    }
  }

  // Save Brand Context Action
  const handleSaveBrandContext = async () => {
    setSaving(true)
    setErrorMsg("")
    try {
      const fullContext = {
        websiteUrl,
        businessName,
        industry,
        businessModel,
        defaultLandingPage,
        whatYouSell,
        productDescription,
        positioning,
        idealCustomer,
        differentiators,
        audienceSegments,
        competitors,
        highIntentKeywords,
        creativeAngles,
        selectedTone,
        selectedColor,
        sourcesRead,
        lastAnalysed,
      }

      localStorage.setItem("growzzy_brand_context_full", JSON.stringify(fullContext))
      localStorage.setItem("growzzy_brand_name", businessName)
      localStorage.setItem("growzzy_brand_offer", whatYouSell)

      // Persist to Workspace DB
      await fetch("/api/workspaces", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: businessName,
          websiteUrl,
          industry,
          productDescription,
          toneOfVoice: selectedTone,
          defaultLandingPageUrl: defaultLandingPage,
        }),
      })

      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to save brand context")
    } finally {
      setSaving(false)
    }
  }

  // Export PDF / Print
  const handleExportPDF = () => {
    window.print()
  }

  // Helper Adders & Removers
  const addDifferentiator = () => {
    if (!newDiffInput.trim()) return
    setDifferentiators([...differentiators, newDiffInput.trim()])
    setNewDiffInput("")
  }

  const removeDifferentiator = (index: number) => {
    setDifferentiators(differentiators.filter((_, i) => i !== index))
  }

  const addKeyword = () => {
    if (!newKeywordInput.trim()) return
    setHighIntentKeywords([...highIntentKeywords, newKeywordInput.trim()])
    setNewKeywordInput("")
  }

  const removeKeyword = (index: number) => {
    setHighIntentKeywords(highIntentKeywords.filter((_, i) => i !== index))
  }

  const addAngle = () => {
    if (!newAngleInput.trim()) return
    setCreativeAngles([...creativeAngles, newAngleInput.trim()])
    setNewAngleInput("")
  }

  const removeAngle = (index: number) => {
    setCreativeAngles(creativeAngles.filter((_, i) => i !== index))
  }

  const addAudienceSegment = () => {
    const newId = String(audienceSegments.length + 1)
    setAudienceSegments([
      ...audienceSegments,
      {
        id: newId,
        title: "New Target Audience Segment",
        painPoints: "Describe the primary pain points, challenges, and motivations for this customer segment.",
      },
    ])
  }

  const removeAudienceSegment = (id: string) => {
    setAudienceSegments(audienceSegments.filter((s) => s.id !== id))
  }

  const addCompetitor = () => {
    const newId = String(competitors.length + 1)
    setCompetitors([
      ...competitors,
      {
        id: newId,
        name: "Competitor Brand",
        description: "Competitor positioning and difference in market strategy.",
      },
    ])
  }

  const removeCompetitor = (id: string) => {
    setCompetitors(competitors.filter((c) => c.id !== id))
  }

  return (
    <Shell>
      <div className="max-w-[1340px] mx-auto pb-20 space-y-6">
        {/* Top Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <div>
            <h1 className="text-[26px] font-bold text-[#111827] tracking-tight">My Brand</h1>
            <p className="text-[13px] text-[#6B7280] mt-0.5">
              Growzzy reads your live website so it never has to ask what your business is.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportPDF}
              className="h-10 px-4 bg-white border border-[#D1D5DB] rounded-[10px] text-[13px] font-semibold text-[#374151] hover:bg-[#F9FAFB] flex items-center gap-2 transition-colors shadow-2xs"
            >
              <Download size={15} className="text-[#6B7280]" />
              Export PDF
            </button>
            <button
              onClick={handleSaveBrandContext}
              disabled={saving}
              className="h-10 px-5 bg-[#1F57F5] rounded-[10px] text-[13px] font-bold text-white hover:bg-[#1849D6] flex items-center gap-2 transition-colors shadow-2xs"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              {saved ? "Saved successfully!" : "Save brand context"}
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-[13px] rounded-[10px]">
            {errorMsg}
          </div>
        )}

        {/* 2-Column Main Layout */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Left Main Form Column */}
          <div className="flex-1 w-full space-y-6">
            {/* 1. Website analysis Card */}
            <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 space-y-4 shadow-2xs">
              <h3 className="text-[16px] font-bold text-[#111827]">Website analysis</h3>

              <div className="space-y-2">
                <label className="block text-[12px] font-semibold text-[#374151]">Your website URL</label>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="relative flex-1 w-full">
                    <Globe size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                    <input
                      type="url"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      placeholder="https://yourwebsite.com"
                      className="w-full h-11 pl-10 pr-3.5 bg-white border border-[#D1D5DB] rounded-[10px] text-[13.5px] text-[#111827] outline-none focus:border-[#1F57F5]"
                    />
                  </div>
                  <button
                    onClick={handleDeepAnalyse}
                    disabled={analyzing || !websiteUrl}
                    className="w-full sm:w-auto h-11 px-5 bg-[#1F57F5] text-white text-[13px] font-bold rounded-[10px] hover:bg-[#1849D6] transition-colors flex items-center justify-center gap-2 shrink-0 shadow-2xs"
                  >
                    {analyzing ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
                    {analyzing ? "Analyzing live website…" : "Deep-analyse my business"}
                  </button>
                </div>
                <p className="text-[12px] text-[#6B7280] leading-relaxed pt-1">
                  Growzzy reads your real pages, searches the live web for your category and competitors, then builds the brand context every campaign is written from.
                </p>
                <p className="text-[11px] text-[#9CA3AF] pt-1">
                  Last analysed {lastAnalysed} · {sourcesRead.length} live sources read
                </p>
              </div>
            </div>

            {/* 2. Business Card */}
            <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 space-y-5 shadow-2xs">
              <h3 className="text-[16px] font-bold text-[#111827]">Business</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">Business name</label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-[10px] text-[13px] text-[#111827] outline-none focus:border-[#1F57F5]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">Industry</label>
                  <input
                    type="text"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-[10px] text-[13px] text-[#111827] outline-none focus:border-[#1F57F5]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">Business model</label>
                  <input
                    type="text"
                    value={businessModel}
                    onChange={(e) => setBusinessModel(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-[10px] text-[13px] text-[#111827] outline-none focus:border-[#1F57F5]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">Default landing page</label>
                  <input
                    type="url"
                    value={defaultLandingPage}
                    onChange={(e) => setDefaultLandingPage(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-[10px] text-[13px] text-[#111827] outline-none focus:border-[#1F57F5]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">What you sell</label>
                <textarea
                  rows={2}
                  value={whatYouSell}
                  onChange={(e) => setWhatYouSell(e.target.value)}
                  className="w-full p-3 bg-white border border-[#D1D5DB] rounded-[10px] text-[13px] text-[#111827] outline-none focus:border-[#1F57F5] leading-relaxed resize-y"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">Product description</label>
                <textarea
                  rows={4}
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  className="w-full p-3 bg-white border border-[#D1D5DB] rounded-[10px] text-[13px] text-[#111827] outline-none focus:border-[#1F57F5] leading-relaxed resize-y"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">Positioning</label>
                <textarea
                  rows={3}
                  value={positioning}
                  onChange={(e) => setPositioning(e.target.value)}
                  className="w-full p-3 bg-white border border-[#D1D5DB] rounded-[10px] text-[13px] text-[#111827] outline-none focus:border-[#1F57F5] leading-relaxed resize-y"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">Ideal customer</label>
                <input
                  type="text"
                  value={idealCustomer}
                  onChange={(e) => setIdealCustomer(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-[10px] text-[13px] text-[#111827] outline-none focus:border-[#1F57F5]"
                />
              </div>

              {/* Differentiators */}
              <div className="space-y-2 pt-2">
                <label className="block text-[12px] font-semibold text-[#374151]">Differentiators</label>
                <div className="flex flex-wrap gap-2">
                  {differentiators.map((d, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 bg-[#F3F4F6] text-[#374151] text-[12px] font-medium rounded-full flex items-center gap-1.5 border border-[#E5E7EB]"
                    >
                      {d}
                      <button onClick={() => removeDifferentiator(i)} className="text-[#9CA3AF] hover:text-[#111827]">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1.5">
                  <input
                    type="text"
                    value={newDiffInput}
                    onChange={(e) => setNewDiffInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addDifferentiator()}
                    placeholder="Add a differentiator and press Enter"
                    className="flex-1 h-9 px-3 bg-white border border-[#D1D5DB] rounded-[8px] text-[12.5px] text-[#111827] outline-none focus:border-[#1F57F5]"
                  />
                  <button
                    onClick={addDifferentiator}
                    type="button"
                    className="h-9 px-4 bg-white border border-[#D1D5DB] text-[#374151] text-[12px] font-semibold rounded-[8px] hover:bg-[#F9FAFB] flex items-center gap-1"
                  >
                    <Plus size={13} /> Add
                  </button>
                </div>
              </div>
            </div>

            {/* 3. Audience Segments Card */}
            <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <h3 className="text-[16px] font-bold text-[#111827]">Audience segments</h3>
                <button
                  onClick={addAudienceSegment}
                  className="h-8 px-3.5 bg-white border border-[#D1D5DB] rounded-[8px] text-[12px] font-semibold text-[#374151] hover:bg-[#F9FAFB] flex items-center gap-1.5"
                >
                  <Plus size={13} /> Add segment
                </button>
              </div>

              <div className="space-y-4">
                {audienceSegments.map((segment) => (
                  <div key={segment.id} className="p-4 bg-[#F9FAFB] rounded-[12px] border border-[#E5E7EB] space-y-2 relative">
                    <div className="flex items-center justify-between">
                      <input
                        type="text"
                        value={segment.title}
                        onChange={(e) =>
                          setAudienceSegments(
                            audienceSegments.map((s) => (s.id === segment.id ? { ...s, title: e.target.value } : s))
                          )
                        }
                        className="font-bold text-[13.5px] text-[#111827] bg-transparent border-b border-transparent focus:border-[#1F57F5] outline-none flex-1 mr-2"
                      />
                      <button
                        onClick={() => removeAudienceSegment(segment.id)}
                        className="text-[#9CA3AF] hover:text-red-500 transition-colors p-1"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={segment.painPoints}
                      onChange={(e) =>
                        setAudienceSegments(
                          audienceSegments.map((s) => (s.id === segment.id ? { ...s, painPoints: e.target.value } : s))
                        )
                      }
                      className="w-full p-2.5 bg-white border border-[#D1D5DB] rounded-[8px] text-[12.5px] text-[#374151] leading-relaxed outline-none focus:border-[#1F57F5]"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Competitors Card */}
            <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <h3 className="text-[16px] font-bold text-[#111827]">Competitors</h3>
                <button
                  onClick={addCompetitor}
                  className="h-8 px-3.5 bg-white border border-[#D1D5DB] rounded-[8px] text-[12px] font-semibold text-[#374151] hover:bg-[#F9FAFB] flex items-center gap-1.5"
                >
                  <Plus size={13} /> Add competitor
                </button>
              </div>

              {competitors.length === 0 ? (
                <p className="text-[12.5px] text-[#9CA3AF] py-2">
                  No competitors yet — analyse your website or add one manually.
                </p>
              ) : (
                <div className="space-y-3">
                  {competitors.map((comp) => (
                    <div key={comp.id} className="p-3.5 bg-[#F9FAFB] rounded-[10px] border border-[#E5E7EB] flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-1">
                        <input
                          type="text"
                          value={comp.name}
                          onChange={(e) =>
                            setCompetitors(competitors.map((c) => (c.id === comp.id ? { ...c, name: e.target.value } : c)))
                          }
                          className="font-bold text-[13px] text-[#111827] bg-transparent border-b border-transparent focus:border-[#1F57F5] outline-none w-full"
                        />
                        <textarea
                          rows={2}
                          value={comp.description}
                          onChange={(e) =>
                            setCompetitors(
                              competitors.map((c) => (c.id === comp.id ? { ...c, description: e.target.value } : c))
                            )
                          }
                          className="w-full p-2 bg-white border border-[#D1D5DB] rounded-[6px] text-[12px] text-[#374151]"
                        />
                      </div>
                      <button
                        onClick={() => removeCompetitor(comp.id)}
                        className="text-[#9CA3AF] hover:text-red-500 p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 5. Search & Creative Signals Card */}
            <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 space-y-5 shadow-2xs">
              <h3 className="text-[16px] font-bold text-[#111827]">Search & creative signals</h3>

              {/* Keywords */}
              <div className="space-y-2">
                <label className="block text-[12px] font-semibold text-[#374151]">High-intent keywords</label>
                <div className="flex flex-wrap gap-2">
                  {highIntentKeywords.map((kw, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 bg-[#F3F4F6] text-[#374151] text-[12px] font-medium rounded-full flex items-center gap-1.5 border border-[#E5E7EB]"
                    >
                      {kw}
                      <button onClick={() => removeKeyword(i)} className="text-[#9CA3AF] hover:text-[#111827]">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1.5">
                  <input
                    type="text"
                    value={newKeywordInput}
                    onChange={(e) => setNewKeywordInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addKeyword()}
                    placeholder="Add a keyword and press Enter"
                    className="flex-1 h-9 px-3 bg-white border border-[#D1D5DB] rounded-[8px] text-[12.5px] text-[#111827] outline-none focus:border-[#1F57F5]"
                  />
                  <button
                    onClick={addKeyword}
                    type="button"
                    className="h-9 px-4 bg-white border border-[#D1D5DB] text-[#374151] text-[12px] font-semibold rounded-[8px] hover:bg-[#F9FAFB] flex items-center gap-1"
                  >
                    <Plus size={13} /> Add
                  </button>
                </div>
              </div>

              {/* Creative Angles */}
              <div className="space-y-2 pt-2 border-t border-[#F3F4F6]">
                <label className="block text-[12px] font-semibold text-[#374151]">Creative angles</label>
                <div className="flex flex-wrap gap-2">
                  {creativeAngles.map((angle, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 bg-[#F3F4F6] text-[#374151] text-[12px] font-medium rounded-[10px] flex items-center gap-2 border border-[#E5E7EB] max-w-full"
                    >
                      <span className="truncate">{angle}</span>
                      <button onClick={() => removeAngle(i)} className="text-[#9CA3AF] hover:text-[#111827] shrink-0">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1.5">
                  <input
                    type="text"
                    value={newAngleInput}
                    onChange={(e) => setNewAngleInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addAngle()}
                    placeholder="Add a creative angle and press Enter"
                    className="flex-1 h-9 px-3 bg-white border border-[#D1D5DB] rounded-[8px] text-[12.5px] text-[#111827] outline-none focus:border-[#1F57F5]"
                  />
                  <button
                    onClick={addAngle}
                    type="button"
                    className="h-9 px-4 bg-white border border-[#D1D5DB] text-[#374151] text-[12px] font-semibold rounded-[8px] hover:bg-[#F9FAFB] flex items-center gap-1"
                  >
                    <Plus size={13} /> Add
                  </button>
                </div>
              </div>
            </div>

            {/* 6. Voice & Colors Card */}
            <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6 space-y-5 shadow-2xs">
              <h3 className="text-[16px] font-bold text-[#111827]">Voice & colors</h3>

              {/* Tone of Voice */}
              <div>
                <label className="block text-[12px] font-semibold text-[#374151] mb-2.5">Tone of voice</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {TONES.map((tone) => (
                    <button
                      key={tone.id}
                      type="button"
                      onClick={() => setSelectedTone(tone.name)}
                      className={cn(
                        "p-3.5 rounded-[12px] border text-left transition-all",
                        selectedTone === tone.name
                          ? "bg-[#EAF0FE] border-[#1F57F5] ring-2 ring-[#1F57F5]/20 shadow-xs"
                          : "bg-white border-[#E5E7EB] hover:border-[#D1D5DB]"
                      )}
                    >
                      <p className="text-[13px] font-bold text-[#111827]">{tone.name}</p>
                      <p className="text-[11px] text-[#6B7280] mt-1 leading-snug">{tone.example}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Palettes */}
              <div className="pt-2 border-t border-[#F3F4F6]">
                <label className="block text-[12px] font-semibold text-[#374151] mb-2.5">Palette theme</label>
                <div className="flex items-center gap-3">
                  {COLOR_PALETTES.map((pal) => (
                    <button
                      key={pal.id}
                      type="button"
                      onClick={() => setSelectedColor(pal.name)}
                      className={cn(
                        "flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-[12px] font-semibold transition-all",
                        selectedColor === pal.name
                          ? "border-[#1F57F5] bg-[#EAF0FE] text-[#1F57F5] ring-1 ring-[#1F57F5]"
                          : "border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F9FAFB]"
                      )}
                    >
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: pal.hex }} />
                      {pal.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar Column */}
          <div className="w-full lg:w-[380px] space-y-6 shrink-0 lg:sticky lg:top-6">
            {/* Live Preview Card */}
            <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-5 space-y-4 shadow-2xs">
              <h3 className="text-[15px] font-bold text-[#111827]">Live preview</h3>

              {/* Header profile */}
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#1F57F5] text-white flex items-center justify-center text-xs font-bold shadow-2xs">
                  {businessName.charAt(0).toUpperCase() || "M"}
                </div>
                <p className="text-[13px] font-bold text-[#111827]">{businessName || "MARKITX"}</p>
              </div>

              {/* Ad Card Mockup */}
              <div className="bg-white rounded-[12px] border border-[#E5E7EB] p-4 space-y-2.5 shadow-xs">
                <div>
                  <span className="text-[10px] font-extrabold text-[#6B7280] uppercase tracking-wider block mb-0.5">
                    Sponsored
                  </span>
                  <h4 className="text-[13.5px] font-bold text-[#111827]">
                    {businessName || "MARKITX"} — {selectedTone} ad
                  </h4>
                </div>

                <p className="text-[12px] text-[#4B5563] leading-relaxed line-clamp-6">
                  {productDescription || whatYouSell || "AI infrastructure solutions, including multi-agent systems, automated AI workflows, and custom AI agents."}
                </p>

                <button className="h-7 px-4 bg-[#1F57F5] text-white text-[11.5px] font-bold rounded-full hover:bg-[#1849D6] transition-colors flex items-center gap-1.5">
                  <Zap size={11} /> Shop now
                </button>
              </div>

              <p className="text-[11.5px] text-[#9CA3AF] leading-relaxed">
                Growzzy only advertises on Google Ads and Meta Ads — this is how your ads will feel.
              </p>
            </div>

            {/* Sources read Card */}
            <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-5 space-y-3 shadow-2xs">
              <h3 className="text-[15px] font-bold text-[#111827]">Sources read</h3>
              <div className="space-y-2">
                {sourcesRead.map((source, i) => (
                  <a
                    key={i}
                    href={source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12px] text-[#1F57F5] hover:underline flex items-center gap-1.5 truncate"
                  >
                    <ExternalLink size={12} className="shrink-0 text-[#9CA3AF]" />
                    <span className="truncate">{source}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  )
}
