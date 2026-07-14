"use client"

import { type ReactNode, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ExternalLink,
  Loader2,
  MapPin,
  Mic,
  Play,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import { toast } from "sonner"
import DashboardLayout from "@/components/dashboard-layout"
import { cn } from "@/lib/utils"

type Keyword = {
  text: string
  matchType: "BROAD" | "PHRASE" | "EXACT"
  intent?: string
}

type AdGroup = {
  name: string
  theme?: string
  keywords: Keyword[]
  negativeKeywords: string[]
  headlines: string[]
  descriptions: string[]
}

type CampaignPlan = {
  campaignName: string
  campaignType: string
  objective: string
  biddingStrategy: "MAXIMIZE_CONVERSIONS" | "MAXIMIZE_CLICKS" | "TARGET_CPA"
  dailyBudget: number
  finalUrl?: string
  locations: string[]
  languages?: string[]
  adGroups: AdGroup[]
  rationale?: {
    whyThisStructure?: string
    whyTheseKeywords?: string
    whyThisBidding?: string
    expectedResultsRange?: string
  }
  risks?: string[]
  launchReadinessScore?: number
  policyCheck?: {
    status: "PASS" | "WARN" | "FAIL"
    flags?: Array<{ text: string; reason: string; suggestion?: string }>
  }
}

const flowSteps = ["Set Goal", "Creative", "Audience", "Website", "Placements", "Budget", "Publish"]
const goals = ["Leads", "Sales", "Website Traffic", "Brand Awareness"]

export default function NewCampaignPage() {
  const router = useRouter()
  const [activeStep, setActiveStep] = useState("Set Goal")
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(0)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isCheckingPolicy, setIsCheckingPolicy] = useState(false)
  const [isLaunching, setIsLaunching] = useState(false)
  const [campaignPlanId, setCampaignPlanId] = useState("")
  const [plan, setPlan] = useState<CampaignPlan | null>(null)
  const [brief, setBrief] = useState({
    offer: "",
    landingPageUrl: "",
    targetCustomer: "",
    budget: "1",
    location: "United States",
    goal: "Leads",
  })

  const checklist = useMemo(
    () => [
      { label: "Ad objective", done: Boolean(brief.goal) },
      { label: "Target audience", done: brief.targetCustomer.trim().length > 4 || brief.offer.trim().length > 24 },
      { label: "Age", done: /\b(?:1[89]|[2-6]\d)(?:\s*[-–]\s*(?:1[89]|[2-6]\d))?\b/.test(brief.offer) },
      { label: "Location", done: brief.location.trim().length > 2 },
      { label: "Budget", done: Number(brief.budget) > 0 },
    ],
    [brief]
  )
  const readyToGenerate = brief.offer.trim().length > 10
  const selectedGroup = plan?.adGroups?.[selectedGroupIndex] || plan?.adGroups?.[0]

  useEffect(() => {
    if (!campaignPlanId || !plan) return
    const timeout = window.setTimeout(async () => {
      setIsSaving(true)
      try {
        const response = await fetch(`/api/ai/campaign-plan/${campaignPlanId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaignName: plan.campaignName,
            dailyBudget: plan.dailyBudget,
            biddingStrategy: plan.biddingStrategy,
            finalUrl: plan.finalUrl,
            locations: plan.locations,
            adGroups: plan.adGroups,
          }),
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok || data.ok === false) throw new Error(data.error || "Could not save plan")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not save plan")
      } finally {
        setIsSaving(false)
      }
    }, 800)
    return () => window.clearTimeout(timeout)
  }, [campaignPlanId, plan])

  const updateBrief = (key: keyof typeof brief, value: string) => {
    setBrief((previous) => ({ ...previous, [key]: value }))
  }

  const updatePlan = (updates: Partial<CampaignPlan>) => {
    setPlan((previous) => (previous ? { ...previous, ...updates, policyCheck: undefined } : previous))
  }

  const updateAdGroup = (index: number, updates: Partial<AdGroup>) => {
    setPlan((previous) => {
      if (!previous) return previous
      const adGroups = previous.adGroups.map((group, groupIndex) =>
        groupIndex === index ? { ...group, ...updates } : group
      )
      return { ...previous, adGroups, policyCheck: undefined }
    })
  }

  const generatePlan = async () => {
    if (!readyToGenerate) {
      toast.error("Add the offer, audience, location, budget, and goal first")
      return
    }
    setIsGenerating(true)
    try {
      const response = await fetch("/api/ai/campaign-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...brief, targetCustomer: brief.targetCustomer || "Infer the target customer from the offer", budget: Number(brief.budget) }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.ok) throw new Error(data.error || "AI Campaign Builder failed")
      setPlan(data.plan)
      setCampaignPlanId(data.campaignPlanId)
      setSelectedGroupIndex(0)
      setActiveStep("Set Goal")
      toast.success("Campaign plan generated and saved")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate campaign plan")
    } finally {
      setIsGenerating(false)
    }
  }

  const checkPolicy = async () => {
    if (!campaignPlanId) return
    setIsCheckingPolicy(true)
    try {
      const response = await fetch("/api/ai/policy-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignPlanId }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || data.ok === false) throw new Error(data.error || "Policy check failed")
      setPlan((previous) => (previous ? { ...previous, policyCheck: data.data } : previous))
      toast.success(`Policy check: ${data.data.status}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Policy check failed")
    } finally {
      setIsCheckingPolicy(false)
    }
  }

  const launchPlan = async () => {
    if (!campaignPlanId || !plan) return
    if (!plan.finalUrl) {
      toast.error("Add a final URL before launch")
      return
    }
    if (plan.policyCheck?.status === "FAIL") {
      toast.error("Policy check failed. Fix blocked copy before launch.")
      return
    }
    setIsLaunching(true)
    try {
      if (!plan.policyCheck) await checkPolicy()
      const response = await fetch(`/api/ai/campaign-plan/${campaignPlanId}/launch`, { method: "POST" })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.ok) throw new Error(data.error || "Google Ads launch failed")
      toast.success(`Campaign ${data.data.externalCampaignId} created paused in Google Ads`)
      router.push("/dashboard/campaigns")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not launch campaign")
    } finally {
      setIsLaunching(false)
    }
  }

  return (
    <DashboardLayout immersive={Boolean(plan)}>
      <div className={cn("min-h-screen bg-[var(--color-bg)]", plan ? "" : "px-4 py-4")}>
        {plan && (
          <header className="flex h-14 items-center justify-between border-b border-[var(--color-border)] bg-white px-5">
            <button onClick={() => setPlan(null)} className="inline-flex items-center gap-2 text-[12px] font-semibold text-[var(--color-text)]">
              <ArrowLeft className="h-4 w-4" /> Create Campaign
            </button>
            <div className="flex items-center gap-4 text-[11px] text-[var(--color-muted)]"><span>Help</span><span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--accent)] font-bold text-white">G</span></div>
          </header>
        )}

        {!plan ? (
          <PromptIntake
            brief={brief}
            checklist={checklist}
            readyToGenerate={readyToGenerate}
            isGenerating={isGenerating}
            onChange={updateBrief}
            onGenerate={generatePlan}
          />
        ) : (
          <div className="grid min-h-[calc(100vh-56px)] overflow-hidden bg-white xl:grid-cols-[286px_minmax(520px,634px)_minmax(520px,1fr)]">
            <aside className="border-b border-[var(--color-border)] bg-[var(--bg-inset)] p-5 xl:border-b-0 xl:border-r">
              <div className="mb-4 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-faint)]">
                Campaign flow
              </div>
              <div className="space-y-0.5">
                {flowSteps.map((step, index) => (
                  <button
                    key={step}
                    onClick={() => setActiveStep(step)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-[8px] px-2 py-2 text-left text-[11px] font-medium",
                      activeStep === step
                        ? "bg-[var(--accent-weak)] text-[var(--accent)]"
                        : "text-[var(--text-secondary)] hover:bg-white"
                    )}
                  >
                    <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[9px] font-bold", activeStep === step ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border-strong)] bg-white")}>{index + 1}</span>
                    <span className="flex-1">{step === "Website" ? "Website or Product Page" : step}</span>
                    {step !== "Publish" && <Check className="h-3 w-3 opacity-60" />}
                  </button>
                ))}
              </div>
              <div className="mt-5 rounded-[8px] border border-[var(--color-border)] bg-white p-3 text-[10px] leading-4 text-[var(--color-muted)]">
                AI proposes. You edit. Every change saves back to the persisted launch plan.
              </div>
            </aside>

            <main className="min-w-0 overflow-y-auto border-b border-[var(--color-border)] bg-white xl:max-h-[calc(100vh-56px)] xl:border-b-0 xl:border-r">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border)] p-4">
                <div>
                  <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-muted)]">
                    Google Search
                    <span className="rounded-full bg-[var(--color-soft)] px-2 py-1">starts paused</span>
                  </div>
                  <input
                    value={plan.campaignName}
                    onChange={(event) => updatePlan({ campaignName: event.target.value })}
                    className="mt-1 w-full min-w-[280px] bg-transparent text-[20px] font-semibold text-[var(--color-text)] outline-none"
                  />
                  <p className="mt-1 text-[10px] text-[var(--color-muted)]">
                    {isSaving ? "Saving..." : "Saved plan"} {campaignPlanId ? `- ${campaignPlanId}` : ""}
                  </p>
                </div>
                <div className="rounded-full border border-[var(--color-border)] px-2.5 py-1.5 text-[10px] font-semibold">
                  Score {plan.launchReadinessScore || 70}/100
                </div>
              </div>

              <div className="p-4">
                {activeStep === "Website" && (
                  <Section title="Website or Product Page" subtitle="Review the offer and choose where the ad sends people.">
                    <div className="grid gap-3 md:grid-cols-2">
                      <ReadOnly label="Offer" value={brief.offer} />
                      <ReadOnly label="Audience" value={brief.targetCustomer} />
                      <ReadOnly label="Goal" value={brief.goal} />
                      <ReadOnly label="Original budget" value={`$${brief.budget}/day`} />
                    </div>
                    <Field label="Final URL">
                      <input value={plan.finalUrl || ""} onChange={(event) => updatePlan({ finalUrl: event.target.value })} className="input" placeholder="https://example.com" />
                    </Field>
                    <Rationale title="What AI understood" value={plan.rationale?.whyThisStructure} />
                  </Section>
                )}

                {activeStep === "Set Goal" && (
                  <Section title="Goal and bidding" subtitle="Choose what Google should optimize toward.">
                    <div className="grid gap-3 md:grid-cols-2">
                      <Field label="Objective">
                        <select
                          value={plan.objective}
                          onChange={(event) => updatePlan({ objective: event.target.value })}
                          className="input"
                        >
                          <option value="LEADS">Leads</option>
                          <option value="SALES">Sales</option>
                          <option value="TRAFFIC">Website traffic</option>
                          <option value="AWARENESS">Brand awareness</option>
                        </select>
                      </Field>
                      <Field label="Bidding">
                        <select
                          value={plan.biddingStrategy}
                          onChange={(event) => updatePlan({ biddingStrategy: event.target.value as CampaignPlan["biddingStrategy"] })}
                          className="input"
                        >
                          <option value="MAXIMIZE_CONVERSIONS">Maximize conversions</option>
                          <option value="MAXIMIZE_CLICKS">Maximize clicks</option>
                          <option value="TARGET_CPA">Target CPA</option>
                        </select>
                      </Field>
                    </div>
                    <Rationale title="Why this bidding" value={plan.rationale?.whyThisBidding} />
                  </Section>
                )}

                {activeStep === "Audience" && (
                  <Section title="Audience" subtitle="Review locations and the search intent Growzzy selected.">
                    <Field label="Locations">
                      <ChipEditor
                        values={plan.locations || []}
                        placeholder="Add city, region, or country"
                        onChange={(locations) => updatePlan({ locations })}
                      />
                    </Field>
                    <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4">
                      <div className="flex items-center gap-2 text-sm font-bold">
                        <MapPin className="h-4 w-4" />
                        Targeting rationale
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
                        {plan.rationale?.whyTheseKeywords || "Targeting is based on your prompt and selected location."}
                      </p>
                    </div>
                    {selectedGroup && <><GroupTabs groups={plan.adGroups} selected={selectedGroupIndex} onSelect={setSelectedGroupIndex} /><Field label="Keywords"><KeywordEditor group={selectedGroup} onChange={(keywords) => updateAdGroup(selectedGroupIndex, { keywords })} /></Field><Field label="Negative keywords"><ChipEditor values={selectedGroup.negativeKeywords || []} placeholder="Add waste keyword" onChange={(negativeKeywords) => updateAdGroup(selectedGroupIndex, { negativeKeywords })} /></Field></>}
                  </Section>
                )}

                {activeStep === "Creative" && selectedGroup && (
                  <Section title="Creative" subtitle="Google rotates this responsive search ad copy automatically.">
                    <GroupTabs groups={plan.adGroups} selected={selectedGroupIndex} onSelect={setSelectedGroupIndex} />
                    <TextList
                      label="Headlines"
                      maxLength={30}
                      values={selectedGroup.headlines || []}
                      onChange={(headlines) => updateAdGroup(selectedGroupIndex, { headlines })}
                    />
                    <TextList
                      label="Descriptions"
                      maxLength={90}
                      values={selectedGroup.descriptions || []}
                      onChange={(descriptions) => updateAdGroup(selectedGroupIndex, { descriptions })}
                    />
                  </Section>
                )}

                {activeStep === "Placements" && (
                  <Section title="Placements" subtitle="This first launch path is Google Search only.">
                    <div className="rounded-[10px] border border-[var(--accent)] bg-[var(--accent-weak)] p-4"><div className="flex items-center gap-3"><span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--accent)] text-white"><Check className="h-3 w-3" /></span><div><p className="text-[12px] font-semibold">Google Search results</p><p className="mt-0.5 text-[10px] text-[var(--color-muted)]">Responsive search ads on Google search pages.</p></div></div></div>
                  </Section>
                )}

                {activeStep === "Budget" && (
                  <Section title="Budget safety" subtitle="New campaigns publish paused. Enable delivery only after review.">
                    <Field label="Daily budget">
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-black">$</span>
                        <input
                          type="number"
                          min="1"
                          value={plan.dailyBudget}
                          onChange={(event) => updatePlan({ dailyBudget: Number(event.target.value) })}
                          className="input max-w-[220px]"
                        />
                        <span className="text-sm font-semibold text-[var(--color-muted)]">per day</span>
                      </div>
                    </Field>
                    <Rationale title="Expected results" value={plan.rationale?.expectedResultsRange} />
                  </Section>
                )}

                {activeStep === "Publish" && (
                  <Section title="Review and launch paused" subtitle="This creates the real Google campaign hierarchy in PAUSED state.">
                    <div className="grid gap-3 md:grid-cols-2">
                      <Summary label="Ad groups" value={String(plan.adGroups.length)} />
                      <Summary label="Keywords" value={String(plan.adGroups.reduce((sum, group) => sum + group.keywords.length, 0))} />
                      <Summary label="Budget" value={`$${plan.dailyBudget}/day`} />
                      <Summary label="Status" value="Paused on launch" />
                    </div>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <button onClick={checkPolicy} disabled={isCheckingPolicy} className="btn btn-secondary h-11 px-4">
                        {isCheckingPolicy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                        Run policy check
                      </button>
                      <button onClick={launchPlan} disabled={isLaunching || isSaving} className="btn btn-primary h-11 px-5">
                        {isLaunching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                        Launch paused
                      </button>
                    </div>
                    {plan.policyCheck && (
                      <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4">
                        <div className="font-bold">Policy check: {plan.policyCheck.status}</div>
                        {!!plan.policyCheck.flags?.length && (
                          <ul className="mt-2 space-y-2 text-sm text-[var(--color-muted)]">
                            {plan.policyCheck.flags.slice(0, 4).map((flag, index) => (
                              <li key={`${flag.text}-${index}`}>{flag.text}: {flag.reason}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </Section>
                )}
              </div>
            </main>

            <aside className="min-w-0 bg-[#EEF7F1] p-8 xl:sticky xl:top-0 xl:h-[calc(100vh-56px)] xl:self-start">
              <GooglePreview plan={plan} group={selectedGroup} />
            </aside>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

function PromptIntake({
  brief,
  checklist,
  readyToGenerate,
  isGenerating,
  onChange,
  onGenerate,
}: {
  brief: { offer: string; landingPageUrl: string; targetCustomer: string; budget: string; location: string; goal: string }
  checklist: Array<{ label: string; done: boolean }>
  readyToGenerate: boolean
  isGenerating: boolean
  onChange: (key: keyof typeof brief, value: string) => void
  onGenerate: () => void
}) {
  return (
    <div className="mx-auto max-w-[900px] pt-[6vh]">
      <div className="mb-8 flex justify-center">
        <div className="inline-flex rounded-full border border-[var(--color-border)] bg-white p-1">
          {["Campaign", "Boolean search", "Create image", "Launch ads"].map((tab, index) => (
            <button
              key={tab}
              disabled={index !== 0}
              className={cn(
                "rounded-full px-4 py-1.5 text-[11px] font-medium",
                index === 0 ? "bg-[var(--accent-weak)] text-[var(--accent)]" : "text-[var(--color-muted)] opacity-50"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-center">
          <h1 className="text-[26px] font-semibold leading-tight text-[var(--color-text)]">Run ad campaigns in minutes.</h1>
          <p className="mx-auto mt-2 max-w-xl text-[12px] leading-5 text-[var(--color-muted)]">
            Tell Growzzy what you want to promote. AI builds the strategy, targeting and ads for you.
          </p>
        </div>

        <div className="mt-7 rounded-[12px] border border-[var(--accent)] bg-white p-2 shadow-[0_0_0_3px_var(--accent-weak)]">
          <textarea
            value={brief.offer}
            onChange={(event) => onChange("offer", event.target.value)}
            rows={5}
            className="w-full resize-none border-0 bg-white px-3 py-3 text-[13px] leading-5 outline-none"
            placeholder="Example: Online yoga classes for busy professionals. First class free, then $25/month. I want local leads."
          />
          <div className="flex items-end justify-between gap-3 border-t border-[var(--color-border)] px-2 pt-2">
            <div className="flex min-w-0 flex-wrap items-center gap-3 py-1">
              {checklist.map((item) => (
                <span key={item.label} className={cn("inline-flex items-center gap-1 text-[10px] font-medium", item.done ? "text-[var(--accent)]" : "text-[var(--color-muted)]")}>
                  <span className={cn("grid h-3.5 w-3.5 place-items-center rounded-full border", item.done ? "border-[var(--accent)]" : "border-[var(--border-strong)]")}>{item.done && <Check className="h-2.5 w-2.5" />}</span>{item.label}
                </span>
              ))}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button onClick={onGenerate} disabled={!readyToGenerate || isGenerating} className="h-8 rounded-[8px] px-3 text-[11px] font-semibold italic text-[var(--accent)] hover:bg-[var(--accent-weak)] disabled:opacity-50">AI Enhance</button>
              <details className="relative">
                <summary title="Campaign details" className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded-full border border-[var(--border-strong)] text-[var(--accent)]"><Plus className="h-4 w-4" /></summary>
                <div className="absolute bottom-11 right-0 z-20 grid w-[520px] max-w-[80vw] gap-2 rounded-[10px] border bg-white p-3 shadow-[var(--shadow-popover)] md:grid-cols-2">
                  <input value={brief.targetCustomer} onChange={(event) => onChange("targetCustomer", event.target.value)} className="input" placeholder="Target audience" />
                  <input value={brief.location} onChange={(event) => onChange("location", event.target.value)} className="input" placeholder="Location" />
                  <input value={brief.budget} onChange={(event) => onChange("budget", event.target.value)} className="input" type="number" min="1" placeholder="Daily budget" />
                  <select value={brief.goal} onChange={(event) => onChange("goal", event.target.value)} className="input">{goals.map((goal) => <option key={goal}>{goal}</option>)}</select>
                  <input value={brief.landingPageUrl} onChange={(event) => onChange("landingPageUrl", event.target.value)} className="input md:col-span-2" placeholder="Landing page URL, optional until launch" />
                </div>
              </details>
              <button disabled title="Voice input is not enabled yet" className="grid h-8 w-8 place-items-center rounded-full border border-[var(--border-strong)] text-[var(--accent)] opacity-50"><Mic className="h-4 w-4" /></button>
              <button onClick={onGenerate} disabled={!readyToGenerate || isGenerating} title="Build campaign" className="grid h-9 w-9 place-items-center rounded-full bg-[var(--accent)] text-white shadow-sm disabled:opacity-40">{isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-4">
        <h2 className="text-[16px] font-semibold text-[var(--color-text)]">{title}</h2>
        <p className="mt-1 text-[11px] text-[var(--color-muted)]">{subtitle}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold text-[var(--color-text)]">{label}</span>
      {children}
    </label>
  )
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4">
      <div className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">{label}</div>
      <div className="mt-2 text-sm font-semibold text-[var(--color-text)]">{value || "Not provided"}</div>
    </div>
  )
}

function Rationale({ title, value }: { title: string; value?: string }) {
  return (
    <div className="rounded-[9px] border border-[var(--color-border)] bg-[var(--color-soft)] p-3">
      <div className="flex items-center gap-2 text-[11px] font-semibold text-[var(--color-text)]">
        <Sparkles className="h-4 w-4" />
        {title}
      </div>
      <p className="mt-2 text-[11px] leading-5 text-[var(--color-muted)]">{value || "Growzzy will explain the recommendation once the plan is generated."}</p>
    </div>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4">
      <div className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">{label}</div>
      <div className="mt-2 text-lg font-black text-[var(--color-text)]">{value}</div>
    </div>
  )
}

function GroupTabs({ groups, selected, onSelect }: { groups: AdGroup[]; selected: number; onSelect: (index: number) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {groups.map((group, index) => (
        <button
          key={`${group.name}-${index}`}
          onClick={() => onSelect(index)}
          className={cn(
            "rounded-full border px-4 py-2 text-sm font-bold",
            selected === index ? "border-[var(--color-text)] bg-[var(--color-text)] text-white" : "border-[var(--color-border)]"
          )}
        >
          {group.name}
        </button>
      ))}
    </div>
  )
}

function ChipEditor({
  values,
  placeholder,
  onChange,
}: {
  values: string[]
  placeholder: string
  onChange: (values: string[]) => void
}) {
  const [draft, setDraft] = useState("")
  const add = () => {
    const value = draft.trim()
    if (!value) return
    onChange([...values, value])
    setDraft("")
  }
  return (
    <div className="rounded-xl border border-[var(--color-border)] p-3">
      <div className="flex flex-wrap gap-2">
        {values.map((value, index) => (
          <button
            key={`${value}-${index}`}
            onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}
            className="rounded-full bg-[var(--color-soft)] px-3 py-2 text-sm font-semibold"
            title="Click to remove"
          >
            {value}
          </button>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => event.key === "Enter" && add()} className="input" placeholder={placeholder} />
        <button onClick={add} className="btn btn-secondary h-11 px-4">Add</button>
      </div>
    </div>
  )
}

function KeywordEditor({ group, onChange }: { group: AdGroup; onChange: (keywords: Keyword[]) => void }) {
  const [draft, setDraft] = useState("")
  const [matchType, setMatchType] = useState<Keyword["matchType"]>("PHRASE")
  const add = () => {
    const value = draft.trim()
    if (!value) return
    onChange([...group.keywords, { text: value, matchType }])
    setDraft("")
  }
  return (
    <div className="rounded-xl border border-[var(--color-border)] p-3">
      <div className="flex flex-wrap gap-2">
        {group.keywords.map((keyword, index) => (
          <button
            key={`${keyword.text}-${index}`}
            onClick={() => onChange(group.keywords.filter((_, itemIndex) => itemIndex !== index))}
            className="rounded-full bg-[var(--color-soft)] px-3 py-2 text-sm font-semibold"
            title="Click to remove"
          >
            {keyword.text} <span className="text-[var(--color-muted)]">{keyword.matchType}</span>
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-[1fr_140px_auto]">
        <input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => event.key === "Enter" && add()} className="input" placeholder="Add keyword" />
        <select value={matchType} onChange={(event) => setMatchType(event.target.value as Keyword["matchType"])} className="input">
          <option value="BROAD">Broad</option>
          <option value="PHRASE">Phrase</option>
          <option value="EXACT">Exact</option>
        </select>
        <button onClick={add} className="btn btn-secondary h-11 px-4">Add</button>
      </div>
    </div>
  )
}

function TextList({
  label,
  values,
  maxLength,
  onChange,
}: {
  label: string
  values: string[]
  maxLength: number
  onChange: (values: string[]) => void
}) {
  return (
    <Field label={label}>
      <div className="space-y-2">
        {values.map((value, index) => (
          <div key={index} className="grid gap-2 md:grid-cols-[1fr_70px_auto]">
            <input
              value={value}
              onChange={(event) => {
                const next = [...values]
                next[index] = event.target.value.slice(0, maxLength)
                onChange(next)
              }}
              className="input"
            />
            <div className={cn("grid h-11 place-items-center rounded-xl bg-[var(--color-soft)] text-xs font-bold", value.length >= maxLength ? "text-red-600" : "text-[var(--color-muted)]")}>
              {value.length}/{maxLength}
            </div>
            <button onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))} className="btn btn-secondary h-11 px-3">Remove</button>
          </div>
        ))}
        <button onClick={() => onChange([...values, ""])} className="btn btn-secondary h-10 px-4">Add {label.toLowerCase()}</button>
      </div>
    </Field>
  )
}

function GooglePreview({ plan, group }: { plan: CampaignPlan; group?: AdGroup }) {
  const headlines = group?.headlines?.filter(Boolean).slice(0, 3) || []
  const descriptions = group?.descriptions?.filter(Boolean).slice(0, 2) || []
  const url = plan.finalUrl || "https://your-site.com"
  const host = url.replace(/^https?:\/\//, "").split("/")[0] || "your-site.com"

  return (
    <div className="mx-auto max-w-[720px]">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex gap-2"><span className="rounded-full bg-[var(--accent)] px-4 py-2 text-[11px] font-semibold text-white">Ad group 1</span><button disabled className="rounded-full border bg-white px-4 py-2 text-[11px] text-[var(--color-muted)]">+ Add more ad groups</button></div>
        <span className="rounded-[8px] bg-[var(--accent)] px-4 py-2 text-[11px] font-semibold text-white">Ad combinations</span>
      </div>
      <div className="mb-5 flex gap-6 border-b border-[var(--color-border)] text-[12px]"><span className="border-b-2 border-[var(--accent)] px-1 pb-2 font-semibold text-[var(--accent)]">Google Search</span><span className="px-1 pb-2 text-[var(--color-muted)]">Search partners</span></div>
      <div className="mx-auto max-w-[580px] rounded-[16px] bg-[#DCEFE2] p-8 md:p-12">
        <div className="rounded-[12px] border border-[var(--color-border)] bg-white p-5 shadow-sm">
        <div className="mb-4 rounded-full border border-[var(--color-border)] px-4 py-2.5 text-[11px] text-[var(--color-muted)]">
          {group?.keywords?.[0]?.text || plan.campaignName}
        </div>
        <div className="text-[10px] text-[var(--color-muted)]">Sponsored</div>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--color-text)]">
          {host}
          <ExternalLink className="h-3 w-3" />
        </div>
        <div className="mt-2 text-[18px] font-medium leading-6 text-[#1a0dab]">
          {headlines.length ? headlines.join(" | ") : plan.campaignName}
        </div>
        <p className="mt-2 text-[11px] leading-5 text-[var(--color-muted)]">
          {descriptions[0] || "Your description will appear here as you edit the responsive search ad."}
        </p>
        {descriptions[1] && <p className="mt-1 text-[11px] leading-5 text-[var(--color-muted)]">{descriptions[1]}</p>}
        </div>
      </div>
      <div className="mx-auto mt-4 max-w-[580px] rounded-[10px] bg-white p-4">
        <div className="flex items-center justify-between text-[11px] font-semibold">
          <span>Budget</span>
          <span>${plan.dailyBudget}/day</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] font-semibold">
          <span>Publish state</span>
          <span className="text-amber-700">Paused</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] font-semibold">
          <span>Policy</span>
          <span>{plan.policyCheck?.status || "Not checked"}</span>
        </div>
      </div>
      <button className="mx-auto mt-3 flex w-full max-w-[580px] items-center justify-between rounded-[9px] border border-[var(--color-border)] bg-white px-4 py-3 text-left text-[11px] font-semibold">
        Preview combinations
        <ChevronDown className="h-4 w-4" />
      </button>
    </div>
  )
}
