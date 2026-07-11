"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, CheckCircle2, ImageIcon, Sparkles, Target } from "lucide-react"
import { toast } from "sonner"
import DashboardLayout from "@/components/dashboard-layout"
import { PlatformIcon } from "@/components/platform-icon"
import { cn } from "@/lib/utils"

type WizardData = {
  platform: "GOOGLE" | "META"
  name: string
  objective: string
  budgetType: "DAILY" | "LIFETIME"
  budgetAmount: string
  startDate: string
  endDate: string
  biddingStrategy: string
  creativeMode: "AI" | "MANUAL"
  creativeId: string
  creativeVariant: string
  headline: string
  body: string
  cta: string
  imageUrl: string
  visualDirection: string
}

type CreativeVariation = {
  headline?: string
  body?: string
  description?: string
  cta?: string
  visualDirection?: string
}

type GeneratedCreative = {
  id: string
  selectedIndex?: number | null
  imageUrls?: string[] | null
  variations?: CreativeVariation[] | null
}

const steps = ["Setup", "Objective", "Budget", "Creative", "Review"]
const objectives = [
  { id: "AWARENESS", title: "Awareness", icon: "🎯", description: "Reach the right people and build recognition." },
  { id: "TRAFFIC", title: "Traffic", icon: "🚦", description: "Send qualified visitors to your website." },
  { id: "LEADS", title: "Leads", icon: "📋", description: "Capture form fills, calls, and signups." },
  { id: "CONVERSIONS", title: "Conversions", icon: "💰", description: "Optimize toward purchases and bookings." },
  { id: "RETARGETING", title: "Retargeting", icon: "🔄", description: "Bring warm audiences back to convert." },
]

const today = new Date().toISOString().slice(0, 10)

export default function NewCampaignPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [buildingPlan, setBuildingPlan] = useState(false)
  const [loadingCreative, setLoadingCreative] = useState(false)
  const [selectedCreative, setSelectedCreative] = useState<GeneratedCreative | null>(null)
  const [aiPlan, setAiPlan] = useState<any>(null)
  const [aiBrief, setAiBrief] = useState({
    offer: "",
    landingPageUrl: "",
    targetCustomer: "",
    budget: "50",
    location: "United States",
    goal: "Leads",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState<WizardData>({
    platform: "GOOGLE",
    name: `PROS_${today.replaceAll("-", "")}`,
    objective: "CONVERSIONS",
    budgetType: "DAILY",
    budgetAmount: "50",
    startDate: today,
    endDate: "",
    biddingStrategy: "MAXIMIZE_CONVERSIONS",
    creativeMode: "AI",
    creativeId: "",
    creativeVariant: "0",
    headline: "",
    body: "",
    cta: "Get Started",
    imageUrl: "",
    visualDirection: "",
  })

  useEffect(() => {
    const creativeId = searchParams.get("creativeId")
    const variant = Number(searchParams.get("variant") || 0)
    if (!creativeId) return

    const loadCreative = async () => {
      setLoadingCreative(true)
      try {
        const response = await fetch(`/api/generated-creatives/${creativeId}`, { cache: "no-store" })
        const data = await response.json().catch(() => ({}))
        if (!response.ok || !data.creative) throw new Error(data.error || "Selected creative could not be loaded")
        const creative = data.creative as GeneratedCreative
        const selectedVariant = creative.variations?.[variant] || creative.variations?.[creative.selectedIndex || 0] || {}
        setSelectedCreative(creative)
        setForm((previous) => ({
          ...previous,
          creativeMode: "AI",
          creativeId: creative.id,
          creativeVariant: String(variant),
          headline: selectedVariant.headline || previous.headline,
          body: selectedVariant.body || selectedVariant.description || previous.body,
          cta: selectedVariant.cta || previous.cta,
          imageUrl: creative.imageUrls?.[variant] || previous.imageUrl,
          visualDirection: selectedVariant.visualDirection || previous.visualDirection,
        }))
        setStep(3)
        toast.success("Creative loaded into campaign builder")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not load selected creative")
      } finally {
        setLoadingCreative(false)
      }
    }

    loadCreative()
  }, [searchParams])

  const score = useMemo(() => {
    let value = 55
    if (form.name.length > 6) value += 10
    if (Number(form.budgetAmount) >= 20) value += 10
    if (form.objective) value += 10
    if (form.creativeMode === "AI" || form.headline.length > 10) value += 10
    if (form.startDate) value += 5
    return Math.min(100, value)
  }, [form])

  const update = (key: keyof WizardData, value: string) => {
    setForm((previous) => ({ ...previous, [key]: value }))
    setErrors((previous) => ({ ...previous, [key]: "" }))
  }

  const validateStep = () => {
    const nextErrors: Record<string, string> = {}
    if (step === 0 && form.name.trim().length < 3) nextErrors.name = "Campaign name must be at least 3 characters."
    if (step === 2) {
      if (!form.budgetAmount || Number(form.budgetAmount) <= 0) nextErrors.budgetAmount = "Enter a valid budget."
      if (!form.startDate) nextErrors.startDate = "Start date is required."
    }
    if (step === 3 && form.creativeMode === "MANUAL") {
      if (form.headline.trim().length < 3) nextErrors.headline = "Add a headline or switch to AI creative."
      if (form.body.trim().length < 3) nextErrors.body = "Add body copy or switch to AI creative."
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const next = () => {
    if (!validateStep()) return
    setStep((current) => Math.min(steps.length - 1, current + 1))
  }

  const back = () => setStep((current) => Math.max(0, current - 1))

  const close = () => {
    if (window.confirm("Leave campaign creation? Your unsaved progress will be lost.")) {
      router.push("/dashboard/campaigns")
    }
  }

  const submit = async (draft = false) => {
    if (!validateStep()) return
    setSubmitting(true)
    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          platform: form.platform,
          objective: form.objective,
          goal: form.objective,
          campaignType: form.objective === "AWARENESS" ? "DISPLAY" : "SEARCH",
          budgetType: form.budgetType,
          budgetAmount: Number(form.budgetAmount),
          dailyBudget: Number(form.budgetAmount),
          startDate: form.startDate,
          endDate: form.endDate || null,
          biddingStrategy: form.biddingStrategy,
          status: draft ? "DRAFT" : "PAUSED",
          creative: {
            mode: form.creativeMode,
            creativeId: form.creativeId || null,
            creativeVariant: form.creativeVariant ? Number(form.creativeVariant) : null,
            headline: form.headline,
            body: form.body,
            cta: form.cta,
            imageUrl: form.imageUrl || null,
            visualDirection: form.visualDirection || null,
          },
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || data.ok === false) throw new Error(data.error || "Campaign creation failed")
      toast.success(draft ? "Campaign draft saved" : "Campaign draft created. Publish will require live platform hierarchy success.")
      router.push("/dashboard/campaigns")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create campaign")
    } finally {
      setSubmitting(false)
    }
  }

  const buildWithAi = async () => {
    setBuildingPlan(true)
    try {
      const response = await fetch("/api/ai/campaign-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...aiBrief, budget: Number(aiBrief.budget) }),
      })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.error || "AI Campaign Builder failed")
      setAiPlan(data.plan)
      setForm((previous) => ({
        ...previous,
        platform: "GOOGLE",
        name: data.plan.campaignName || previous.name,
        objective: data.plan.objective || previous.objective,
        budgetAmount: String(data.plan.dailyBudget || previous.budgetAmount),
        biddingStrategy: data.plan.biddingStrategy || previous.biddingStrategy,
      }))
      toast.success("AI campaign plan created. Review it before launch.")
    } catch (error: any) {
      toast.error(error.message || "Could not build campaign plan")
    } finally {
      setBuildingPlan(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-5xl">
          <button onClick={close} className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-950">
            <ArrowLeft className="h-4 w-4" />
            Back to campaigns
          </button>

          <div className="rounded-2xl border border-border bg-white shadow-sm">
            <div className="border-b border-border p-6">
              <h1 className="text-2xl font-bold text-slate-950">Create Campaign</h1>
              <p className="mt-1 text-sm text-slate-500">Launch a campaign with workspace-safe setup, creative, and AI pre-check.</p>
              <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-950">
                      <Sparkles className="h-4 w-4 text-[#1F57F5]" />
                      Build with AI
                    </div>
                    <p className="mt-1 text-xs text-slate-600">Tell GROWZZY what you sell. It will propose a Google campaign, ad groups, keywords, RSA copy, risks, and a launch score.</p>
                  </div>
                  <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-blue-700">Google-first beta</span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <input value={aiBrief.offer} onChange={(event) => setAiBrief({ ...aiBrief, offer: event.target.value })} placeholder="What do you sell?" className="h-10 rounded-lg border border-border bg-white px-3 text-sm" />
                  <input value={aiBrief.targetCustomer} onChange={(event) => setAiBrief({ ...aiBrief, targetCustomer: event.target.value })} placeholder="Target customer" className="h-10 rounded-lg border border-border bg-white px-3 text-sm" />
                  <input value={aiBrief.landingPageUrl} onChange={(event) => setAiBrief({ ...aiBrief, landingPageUrl: event.target.value })} placeholder="Landing page URL optional" className="h-10 rounded-lg border border-border bg-white px-3 text-sm" />
                  <input value={aiBrief.budget} onChange={(event) => setAiBrief({ ...aiBrief, budget: event.target.value })} placeholder="Daily budget" type="number" className="h-10 rounded-lg border border-border bg-white px-3 text-sm" />
                  <input value={aiBrief.location} onChange={(event) => setAiBrief({ ...aiBrief, location: event.target.value })} placeholder="Location" className="h-10 rounded-lg border border-border bg-white px-3 text-sm" />
                  <select value={aiBrief.goal} onChange={(event) => setAiBrief({ ...aiBrief, goal: event.target.value })} className="h-10 rounded-lg border border-border bg-white px-3 text-sm">
                    <option>Leads</option>
                    <option>Sales</option>
                    <option>Website Traffic</option>
                    <option>Brand Awareness</option>
                  </select>
                </div>
                <button onClick={buildWithAi} disabled={buildingPlan || !aiBrief.offer || !aiBrief.targetCustomer} className="btn btn-primary mt-3 h-10 px-4 text-sm disabled:opacity-50">
                  {buildingPlan ? "Building plan..." : "Generate AI Campaign Plan"}
                </button>
                {aiPlan && (
                  <div className="mt-4 rounded-lg border bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-slate-950">{aiPlan.campaignName}</h3>
                        <p className="text-xs text-slate-500">{aiPlan.campaignType} · {aiPlan.biddingStrategy} · ${aiPlan.dailyBudget}/day</p>
                      </div>
                      <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Launch score {aiPlan.launchReadinessScore}/100</div>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      {(aiPlan.adGroups || []).slice(0, 3).map((group: any) => (
                        <div key={group.name} className="rounded-lg border p-3">
                          <div className="font-semibold">{group.name}</div>
                          <div className="mt-1 text-xs text-slate-500">{group.keywords?.length || 0} keywords · {group.headlines?.length || 0} headlines</div>
                        </div>
                      ))}
                    </div>
                    {!!aiPlan.risks?.length && <p className="mt-3 text-xs text-amber-700">Review before launch: {aiPlan.risks[0]}</p>}
                  </div>
                )}
              </div>
              <div className="mt-5">
                <div className="mb-2 flex justify-between text-xs font-medium text-slate-500">
                  <span>Step {step + 1} of {steps.length}</span>
                  <span>{steps[step]}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-[#1F57F5] transition-all" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
                </div>
              </div>
            </div>

            <div className="min-h-[430px] p-6">
              {step === 0 && (
                <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
                  <div className="space-y-5">
                    <div>
                      <label className="text-sm font-semibold">Platform</label>
                      <div className="mt-2 grid gap-3 sm:grid-cols-2">
                        {(["GOOGLE", "META"] as const).map((platform) => (
                          <button
                            key={platform}
                            onClick={() => update("platform", platform)}
                            className={cn("flex items-center gap-3 rounded-xl border p-4 text-left", form.platform === platform ? "border-[#1F57F5] bg-[#1F57F5]/5" : "border-border hover:bg-slate-50")}
                          >
                            <PlatformIcon platform={platform} className="h-7 w-7" />
                            <div>
                              <div className="font-semibold">{platform === "GOOGLE" ? "Google Ads" : "Meta Ads"}</div>
                              <div className="text-xs text-slate-500">{platform === "GOOGLE" ? "Search, Display, Performance Max" : "Facebook and Instagram"}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-semibold">Campaign name</label>
                      <input value={form.name} onChange={(event) => update("name", event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-border bg-slate-50 px-3 outline-none focus:border-[#1F57F5] focus:bg-white" />
                      {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {["PROS", "RETG", "CONV"].map((prefix) => (
                          <button key={prefix} onClick={() => update("name", `${prefix}_${today.replaceAll("-", "")}`)} className="rounded-full border px-3 py-1 text-xs font-medium hover:bg-slate-50">
                            {prefix}_{today.replaceAll("-", "")}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <InfoCard title="Account" body="GROWZZY OS will use the primary connected ad account for the selected platform. You can change account selection later from Ad Accounts." />
                </div>
              )}

              {step === 1 && (
                <div className="grid gap-3 md:grid-cols-2">
                  {objectives.map((objective) => (
                    <button
                      key={objective.id}
                      onClick={() => update("objective", objective.id)}
                      className={cn("rounded-xl border p-5 text-left transition", form.objective === objective.id ? "border-[#1F57F5] bg-[#1F57F5]/5 shadow-sm" : "border-border hover:bg-slate-50")}
                    >
                      <div className="text-2xl">{objective.icon}</div>
                      <div className="mt-3 font-semibold">{objective.title}</div>
                      <p className="mt-1 text-sm text-slate-500">{objective.description}</p>
                    </button>
                  ))}
                </div>
              )}

              {step === 2 && (
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="space-y-4">
                    <Field label="Budget type">
                      <div className="grid grid-cols-2 rounded-lg border bg-slate-50 p-1">
                        {(["DAILY", "LIFETIME"] as const).map((type) => (
                          <button key={type} onClick={() => update("budgetType", type)} className={cn("rounded-md py-2 text-sm font-semibold", form.budgetType === type ? "bg-white shadow-sm" : "text-slate-500")}>
                            {type === "DAILY" ? "Daily Budget" : "Lifetime Budget"}
                          </button>
                        ))}
                      </div>
                    </Field>
                    <Field label="Budget amount" error={errors.budgetAmount}>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                        <input type="number" value={form.budgetAmount} onChange={(event) => update("budgetAmount", event.target.value)} className="h-11 w-full rounded-lg border border-border bg-slate-50 pl-8 pr-3 outline-none focus:border-[#1F57F5] focus:bg-white" />
                      </div>
                    </Field>
                    <Field label="Bidding strategy">
                      <select value={form.biddingStrategy} onChange={(event) => update("biddingStrategy", event.target.value)} className="h-11 w-full rounded-lg border border-border bg-slate-50 px-3">
                        <option value="MAXIMIZE_CONVERSIONS">Maximize conversions</option>
                        <option value="MAXIMIZE_CLICKS">Maximize clicks</option>
                        <option value="TARGET_CPA">Target CPA</option>
                        <option value="TARGET_ROAS">Target ROAS</option>
                      </select>
                    </Field>
                  </div>
                  <div className="space-y-4">
                    <Field label="Start date" error={errors.startDate}>
                      <input type="date" value={form.startDate} onChange={(event) => update("startDate", event.target.value)} className="h-11 w-full rounded-lg border border-border bg-slate-50 px-3" />
                    </Field>
                    <Field label="End date optional">
                      <input type="date" value={form.endDate} onChange={(event) => update("endDate", event.target.value)} className="h-11 w-full rounded-lg border border-border bg-slate-50 px-3" />
                    </Field>
                    <InfoCard title="Budget safety" body="Google may spend up to 2x your daily budget on high-traffic days, but averages it monthly. We launch paused first when live API setup needs review." />
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="grid gap-5 lg:grid-cols-2">
                  <button onClick={() => update("creativeMode", "AI")} className={cn("rounded-xl border p-6 text-left", form.creativeMode === "AI" ? "border-[#1F57F5] bg-[#1F57F5]/5" : "border-border")}>
                    <Sparkles className="h-8 w-8 text-[#1F57F5]" />
                    <h3 className="mt-4 font-bold">Generate with AI</h3>
                    <p className="mt-1 text-sm text-slate-500">Use Creative Studio to generate, save, and select copy, score, and image direction.</p>
                    <span
                      onClick={(event) => {
                        event.stopPropagation()
                        router.push("/dashboard/creatives/generate")
                      }}
                      className="mt-4 inline-flex rounded-lg bg-white px-3 py-2 text-xs font-bold text-[#1F57F5] shadow-sm"
                    >
                      Open Creative Studio
                    </span>
                  </button>
                  <button onClick={() => update("creativeMode", "MANUAL")} className={cn("rounded-xl border p-6 text-left", form.creativeMode === "MANUAL" ? "border-[#1F57F5] bg-[#1F57F5]/5" : "border-border")}>
                    <ImageIcon className="h-8 w-8 text-slate-500" />
                    <h3 className="mt-4 font-bold">Manual Creative</h3>
                    <p className="mt-1 text-sm text-slate-500">Bring your own headline, body copy, CTA, and final creative direction.</p>
                  </button>
                  {form.creativeMode === "AI" && (
                    <div className="space-y-4 lg:col-span-2">
                      <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h3 className="font-bold text-slate-950">{loadingCreative ? "Loading selected creative..." : form.creativeId ? "Selected Creative Loaded" : "No Creative Studio asset selected yet"}</h3>
                            <p className="mt-1 text-sm text-slate-600">
                              {form.creativeId
                                ? "This campaign will use the saved creative variation below."
                                : "Generate and select a creative in Creative Studio, then return here automatically."}
                            </p>
                          </div>
                          <button onClick={() => router.push("/dashboard/creatives/generate")} className="btn btn-secondary h-9 px-3 text-xs">
                            Generate / Select Creative
                          </button>
                        </div>
                        {form.creativeId && (
                          <div className="mt-4 grid gap-3 md:grid-cols-[180px_1fr]">
                            <div className="grid min-h-[130px] place-items-center overflow-hidden rounded-lg border bg-white">
                              {form.imageUrl ? <img src={form.imageUrl} alt={form.headline} className="h-full w-full object-cover" /> : <ImageIcon className="h-8 w-8 text-slate-400" />}
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="rounded-lg bg-white p-3"><span className="font-semibold">Headline:</span> {form.headline || "Not set"}</div>
                              <div className="rounded-lg bg-white p-3"><span className="font-semibold">Body:</span> {form.body || "Not set"}</div>
                              <div className="rounded-lg bg-white p-3"><span className="font-semibold">CTA:</span> {form.cta || "Not set"}</div>
                              {form.visualDirection && <div className="rounded-lg bg-white p-3"><span className="font-semibold">Visual:</span> {form.visualDirection}</div>}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {form.creativeMode === "MANUAL" && (
                    <div className="space-y-4 lg:col-span-2">
                      <Field label="Headline" error={errors.headline}>
                        <input value={form.headline} onChange={(event) => update("headline", event.target.value)} className="h-11 w-full rounded-lg border border-border bg-slate-50 px-3" />
                      </Field>
                      <Field label="Body copy" error={errors.body}>
                        <textarea value={form.body} onChange={(event) => update("body", event.target.value)} rows={4} className="w-full rounded-lg border border-border bg-slate-50 px-3 py-2" />
                      </Field>
                      <Field label="CTA">
                        <input value={form.cta} onChange={(event) => update("cta", event.target.value)} className="h-11 w-full rounded-lg border border-border bg-slate-50 px-3" />
                      </Field>
                      <Field label="Image URL or visual direction">
                        <input value={form.imageUrl || form.visualDirection} onChange={(event) => {
                          const value = event.target.value
                          if (value.startsWith("http")) update("imageUrl", value)
                          else update("visualDirection", value)
                        }} className="h-11 w-full rounded-lg border border-border bg-slate-50 px-3" placeholder="https://... or describe the visual" />
                      </Field>
                    </div>
                  )}
                </div>
              )}

              {step === 4 && (
                <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
                  <div className="space-y-3 rounded-xl border border-border p-5">
                    <Summary label="Platform" value={form.platform} />
                    <Summary label="Campaign name" value={form.name} />
                    <Summary label="Objective" value={form.objective} />
                    <Summary label="Budget" value={`$${form.budgetAmount} · ${form.budgetType.toLowerCase()}`} />
                    <Summary label="Schedule" value={`${form.startDate}${form.endDate ? ` → ${form.endDate}` : " → no end date"}`} />
                    <Summary label="Creative" value={form.creativeId ? `Selected AI creative #${Number(form.creativeVariant) + 1}` : form.creativeMode === "AI" ? "AI Creative Generator" : "Manual creative"} />
                  </div>
                  <div className="rounded-xl border border-border p-5">
                    <div className="flex items-center gap-3">
                      <div className="grid h-16 w-16 place-items-center rounded-full border-8 border-[#1F57F5]/20 text-xl font-black text-[#1F57F5]">{score}</div>
                      <div>
                        <h3 className="font-bold">AI pre-launch score</h3>
                        <p className="text-sm text-slate-500">Clarity, budget, creative, and objective readiness.</p>
                      </div>
                    </div>
                    <div className="mt-5 space-y-2 text-sm text-slate-600">
                      <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Clear objective selected</div>
                      <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Budget is ready</div>
                      <div className="flex items-center gap-2"><Target className="h-4 w-4 text-[#1F57F5]" /> Review creative before publishing</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-border p-5">
              <button onClick={back} disabled={step === 0 || submitting} className="btn btn-secondary h-10 px-4 text-sm disabled:opacity-40">Back</button>
              <div className="flex gap-2">
                {step === steps.length - 1 ? (
                  <>
                    <button onClick={() => submit(true)} disabled={submitting} className="btn btn-secondary h-10 px-4 text-sm">{submitting ? "Saving..." : "Save as Draft"}</button>
                    <button onClick={() => submit(false)} disabled={submitting} className="btn btn-primary h-10 px-4 text-sm">{submitting ? "Creating..." : "Launch Campaign"}</button>
                  </>
                ) : (
                  <button onClick={next} className="btn btn-primary h-10 px-5 text-sm">Continue</button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-800">{label}</span>
      <div className="mt-2">{children}</div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </label>
  )
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-5">
      <h3 className="font-bold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
    </div>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-5 border-b border-border py-3 last:border-b-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-right text-sm font-semibold text-slate-950">{value}</span>
    </div>
  )
}
