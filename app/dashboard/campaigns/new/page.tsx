"use client"

import { type ReactNode, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ExternalLink,
  Loader2,
  MapPin,
  Play,
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

const flowSteps = ["Brief", "Goal", "Targeting", "Keywords", "Ads", "Budget", "Publish"]
const goals = ["Leads", "Sales", "Website Traffic", "Brand Awareness"]

export default function NewCampaignPage() {
  const router = useRouter()
  const [activeStep, setActiveStep] = useState("Brief")
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
      { label: "Product or offer", done: brief.offer.trim().length > 10 },
      { label: "Target audience", done: brief.targetCustomer.trim().length > 4 },
      { label: "Location", done: brief.location.trim().length > 2 },
      { label: "Budget", done: Number(brief.budget) > 0 },
      { label: "Landing page", done: /^https?:\/\//.test(brief.landingPageUrl) },
    ],
    [brief]
  )
  const readyToGenerate = checklist.slice(0, 5).every((item) => item.done)
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
        body: JSON.stringify({ ...brief, budget: Number(brief.budget) }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.ok) throw new Error(data.error || "AI Campaign Builder failed")
      setPlan(data.plan)
      setCampaignPlanId(data.campaignPlanId)
      setSelectedGroupIndex(0)
      setActiveStep("Goal")
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
    <DashboardLayout>
      <div className="min-h-screen bg-[var(--color-bg)] px-5 py-6">
        <button
          onClick={() => router.push("/dashboard/campaigns")}
          className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-muted)] hover:text-[var(--color-text)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Campaigns
        </button>

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
          <div className="grid gap-5 xl:grid-cols-[240px_minmax(0,1fr)_420px]">
            <aside className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-soft)]">
              <div className="mb-3 px-2 text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-muted)]">
                Campaign flow
              </div>
              <div className="space-y-2">
                {flowSteps.map((step) => (
                  <button
                    key={step}
                    onClick={() => setActiveStep(step)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-bold",
                      activeStep === step
                        ? "bg-[var(--color-text)] text-white"
                        : "text-[var(--color-text)] hover:bg-[var(--color-soft)]"
                    )}
                  >
                    {step}
                    {step !== "Publish" && <Check className="h-4 w-4 opacity-70" />}
                  </button>
                ))}
              </div>
              <div className="mt-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)] p-3 text-xs leading-5 text-[var(--color-muted)]">
                AI proposes. You edit. Every change saves back to the persisted launch plan.
              </div>
            </aside>

            <main className="min-w-0 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)]">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border)] p-5">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                    Google Search
                    <span className="rounded-full bg-[var(--color-soft)] px-2 py-1">starts paused</span>
                  </div>
                  <input
                    value={plan.campaignName}
                    onChange={(event) => updatePlan({ campaignName: event.target.value })}
                    className="mt-2 w-full min-w-[280px] bg-transparent text-2xl font-black text-[var(--color-text)] outline-none"
                  />
                  <p className="mt-1 text-sm text-[var(--color-muted)]">
                    {isSaving ? "Saving..." : "Saved plan"} {campaignPlanId ? `- ${campaignPlanId}` : ""}
                  </p>
                </div>
                <div className="rounded-full border border-[var(--color-border)] px-3 py-2 text-sm font-bold">
                  Score {plan.launchReadinessScore || 70}/100
                </div>
              </div>

              <div className="p-5">
                {activeStep === "Brief" && (
                  <Section title="AI brief" subtitle="This is the source context for the plan.">
                    <div className="grid gap-3 md:grid-cols-2">
                      <ReadOnly label="Offer" value={brief.offer} />
                      <ReadOnly label="Audience" value={brief.targetCustomer} />
                      <ReadOnly label="Goal" value={brief.goal} />
                      <ReadOnly label="Original budget" value={`$${brief.budget}/day`} />
                    </div>
                    <Rationale title="What AI understood" value={plan.rationale?.whyThisStructure} />
                  </Section>
                )}

                {activeStep === "Goal" && (
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

                {activeStep === "Targeting" && (
                  <Section title="Targeting" subtitle="Google first: location and language only for this pass.">
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
                  </Section>
                )}

                {activeStep === "Keywords" && selectedGroup && (
                  <Section title="Keywords and negatives" subtitle="Select an ad group, then edit keyword chips.">
                    <GroupTabs groups={plan.adGroups} selected={selectedGroupIndex} onSelect={setSelectedGroupIndex} />
                    <Field label="Keywords">
                      <KeywordEditor group={selectedGroup} onChange={(keywords) => updateAdGroup(selectedGroupIndex, { keywords })} />
                    </Field>
                    <Field label="Negative keywords">
                      <ChipEditor
                        values={selectedGroup.negativeKeywords || []}
                        placeholder="Add waste keyword"
                        onChange={(negativeKeywords) => updateAdGroup(selectedGroupIndex, { negativeKeywords })}
                      />
                    </Field>
                  </Section>
                )}

                {activeStep === "Ads" && selectedGroup && (
                  <Section title="Responsive search ad" subtitle="Google rotates these. Keep headlines under 30 characters.">
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
                    <Field label="Final URL">
                      <input
                        value={plan.finalUrl || ""}
                        onChange={(event) => updatePlan({ finalUrl: event.target.value })}
                        className="input"
                        placeholder="https://example.com"
                      />
                    </Field>
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

            <aside className="xl:sticky xl:top-5 xl:self-start">
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
    <div className="mx-auto max-w-4xl pt-8">
      <div className="mb-6 flex justify-center">
        <div className="inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-[var(--shadow-soft)]">
          {["Campaign", "Boolean search", "Create image", "Launch ads"].map((tab, index) => (
            <button
              key={tab}
              disabled={index !== 0}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-bold",
                index === 0 ? "bg-[var(--color-text)] text-white" : "text-[var(--color-muted)] opacity-50"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[28px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-soft)]">
        <div className="text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-[var(--color-text)] text-white">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-black text-[var(--color-text)]">What do you want to launch?</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--color-muted)]">
            Describe your offer once. Growzzy turns it into an editable Google campaign plan with live ad preview.
          </p>
        </div>

        <div className="mt-6">
          <textarea
            value={brief.offer}
            onChange={(event) => onChange("offer", event.target.value)}
            rows={6}
            className="w-full resize-none rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-5 py-4 text-base outline-none focus:border-[var(--color-text)] focus:bg-white"
            placeholder="Example: Online yoga classes for busy professionals. First class free, then $25/month. I want local leads."
          />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <input value={brief.targetCustomer} onChange={(event) => onChange("targetCustomer", event.target.value)} className="input" placeholder="Target audience" />
          <input value={brief.location} onChange={(event) => onChange("location", event.target.value)} className="input" placeholder="Location" />
          <input value={brief.budget} onChange={(event) => onChange("budget", event.target.value)} className="input" type="number" min="1" placeholder="Daily budget" />
          <select value={brief.goal} onChange={(event) => onChange("goal", event.target.value)} className="input">
            {goals.map((goal) => <option key={goal}>{goal}</option>)}
          </select>
        </div>
        <input
          value={brief.landingPageUrl}
          onChange={(event) => onChange("landingPageUrl", event.target.value)}
          className="input mt-3"
          placeholder="Landing page URL, optional until launch"
        />

        <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {checklist.map((item) => (
            <div key={item.label} className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-bold">
              <span className={cn("grid h-6 w-6 place-items-center rounded-full", item.done ? "bg-[var(--color-text)] text-white" : "bg-[var(--color-soft)] text-[var(--color-muted)]")}>
                {item.done ? <Check className="h-4 w-4" /> : ""}
              </span>
              {item.label}
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-center">
          <button onClick={onGenerate} disabled={!readyToGenerate || isGenerating} className="btn btn-primary h-12 px-6 disabled:opacity-50">
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            AI enhance and build plan
          </button>
        </div>
      </div>
    </div>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-5">
        <h2 className="text-xl font-black text-[var(--color-text)]">{title}</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">{subtitle}</p>
      </div>
      <div className="space-y-5">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-[var(--color-text)]">{label}</span>
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
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4">
      <div className="flex items-center gap-2 text-sm font-black text-[var(--color-text)]">
        <Sparkles className="h-4 w-4" />
        {title}
      </div>
      <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">{value || "Growzzy will explain the recommendation once the plan is generated."}</p>
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
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-muted)]">Live preview</div>
          <h3 className="mt-1 font-black text-[var(--color-text)]">Google Search ad</h3>
        </div>
        <Search className="h-5 w-5 text-[var(--color-muted)]" />
      </div>
      <div className="rounded-2xl border border-[var(--color-border)] bg-white p-4">
        <div className="mb-4 rounded-full border border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-muted)]">
          {group?.keywords?.[0]?.text || plan.campaignName}
        </div>
        <div className="text-xs text-[var(--color-muted)]">Sponsored</div>
        <div className="mt-1 flex items-center gap-2 text-sm text-[var(--color-text)]">
          {host}
          <ExternalLink className="h-3 w-3" />
        </div>
        <div className="mt-2 text-xl font-semibold leading-7 text-[#1a0dab]">
          {headlines.length ? headlines.join(" | ") : plan.campaignName}
        </div>
        <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
          {descriptions[0] || "Your description will appear here as you edit the responsive search ad."}
        </p>
        {descriptions[1] && <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">{descriptions[1]}</p>}
      </div>
      <div className="mt-4 rounded-xl bg-[var(--color-soft)] p-4">
        <div className="flex items-center justify-between text-sm font-bold">
          <span>Budget</span>
          <span>${plan.dailyBudget}/day</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm font-bold">
          <span>Publish state</span>
          <span className="text-amber-700">Paused</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm font-bold">
          <span>Policy</span>
          <span>{plan.policyCheck?.status || "Not checked"}</span>
        </div>
      </div>
      <button className="mt-4 flex w-full items-center justify-between rounded-xl border border-[var(--color-border)] px-4 py-3 text-left text-sm font-bold">
        Preview combinations
        <ChevronDown className="h-4 w-4" />
      </button>
    </div>
  )
}
