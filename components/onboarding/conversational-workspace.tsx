"use client"

import { useRef, useState } from "react"
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react"

export type WorkspaceAnswers = {
  businessName: string
  websiteUrl: string
  productDescription: string
  idealCustomer: string
  differentiator: string
  marketingHistory: string
  tone: string
  primaryGoal: string
  currency: string
  timezone: string
  dailyBudget: string
}

type SiteData = { title?: string | null; description?: string | null; brandName?: string | null; headings?: string[]; priceHints?: string[] }

const QUESTIONS = [
  "What should we call your business?",
  "Do you have a website we can learn from?",
  "What does your business actually sell?",
  "Who is your ideal customer, and what are they trying to solve?",
  "Why do customers choose you instead of an alternative?",
  "What has worked or failed in your marketing so far?",
  "How should Growzzy operate for your business?",
]

export function ConversationalWorkspace({ value, onChange, onComplete }: {
  value: WorkspaceAnswers
  onChange: (patch: Partial<WorkspaceAnswers>) => void
  onComplete: (summary: string) => Promise<void>
}) {
  const [question, setQuestion] = useState(0)
  const [summary, setSummary] = useState("")
  const [summarizing, setSummarizing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [scrapeStatus, setScrapeStatus] = useState<"idle" | "loading" | "done" | "failed">("idle")
  const scrapePromise = useRef<Promise<SiteData | null> | null>(null)

  const startScrape = () => {
    let url = value.websiteUrl.trim()
    if (!url) return
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`
    onChange({ websiteUrl: url })
    setScrapeStatus("loading")
    scrapePromise.current = fetch("/api/ai/scrape-site", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (!json?.ok) throw new Error("Site unavailable")
        setScrapeStatus("done")
        return json.data as SiteData
      })
      .catch(() => { setScrapeStatus("failed"); return null })
  }

  const generateSummary = async () => {
    setSummarizing(true)
    setError("")
    try {
      const siteData = scrapePromise.current ? await scrapePromise.current : null
      const res = await fetch("/api/ai/business-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: value, siteData }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.summary) throw new Error(json.error || "Couldn't summarize your business")
      setSummary(json.summary)
    } catch (err: any) {
      setError(err?.message || "Couldn't summarize your business")
    } finally {
      setSummarizing(false)
    }
  }

  const confirmSummary = async () => {
    setSaving(true)
    setError("")
    try {
      await onComplete(summary.trim())
    } catch (err: any) {
      setError(err?.message || "Couldn't save your business context")
    } finally {
      setSaving(false)
    }
  }

  const next = () => {
    setError("")
    if (question === 1 && value.websiteUrl.trim() && !scrapePromise.current) startScrape()
    if (question < QUESTIONS.length - 1) setQuestion((q) => q + 1)
    else void generateSummary()
  }

  const canContinue = question === 0
    ? Boolean(value.businessName.trim())
    : question === 2
      ? Boolean(value.productDescription.trim())
      : question === 6
        ? Boolean(value.primaryGoal && value.currency && value.timezone && Number(value.dailyBudget) > 0)
        : true

  if (summary || summarizing) {
    return (
      <div className="p-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#1F57F5]">Your business context</p>
        <h2 className="mt-2 text-[22px] font-semibold text-[#111827]">Here&apos;s what I understood</h2>
        <p className="mt-1 text-[12.5px] text-[#6B7280]">Edit anything that feels wrong before Growzzy uses this in future AI work.</p>
        {summarizing ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-[#6B7280]"><Loader2 size={16} className="animate-spin" /> Building your business context...</div>
        ) : (
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={7} className="mt-5 w-full resize-none rounded-[10px] sku-input px-4 py-3 text-[14px] leading-relaxed text-[#111827] outline-none" />
        )}
        {error && <p className="mt-3 text-[12px] text-[#D3564C]">{error}</p>}
        <div className="mt-5 flex justify-between">
          <button type="button" onClick={() => setSummary("")} className="sku-btn h-9 rounded-[8px] px-4 text-[12.5px] font-semibold"><ArrowLeft size={13} className="mr-1 inline" /> Back</button>
          <button type="button" disabled={!summary.trim() || summarizing || saving} onClick={confirmSummary} className="sku-btn-primary h-9 rounded-[8px] px-5 text-[12.5px] font-semibold text-white disabled:opacity-50">{saving ? <Loader2 size={13} className="mr-1 inline animate-spin" /> : <Check size={13} className="mr-1 inline" />} Confirm context</button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && e.target instanceof HTMLInputElement && canContinue) { e.preventDefault(); next() } }}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#1F57F5]">Question {question + 1} of {QUESTIONS.length}</p>
        {scrapeStatus === "loading" && <span className="text-[11px] text-[#6B7280]"><Loader2 size={11} className="mr-1 inline animate-spin" /> Looking at your site...</span>}
        {scrapeStatus === "done" && <span className="text-[11px] text-[#2E9E5B]"><Check size={11} className="mr-1 inline" /> Site understood</span>}
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-[#E5E7EB]"><div className="h-full rounded-full bg-[#1F57F5] transition-all" style={{ width: `${((question + 1) / QUESTIONS.length) * 100}%` }} /></div>
      {question > 0 && <p className="mt-5 text-[12px] font-medium text-[#1F57F5]">Got it. Let&apos;s sharpen the next piece.</p>}
      <h2 className="mt-2 text-[22px] font-semibold text-[#111827]">{QUESTIONS[question]}</h2>
      <div className="mt-5 min-h-[150px]">{renderQuestion(question, value, onChange)}</div>
      {error && <p className="mt-3 text-[12px] text-[#D3564C]">{error}</p>}
      <div className="mt-5 flex items-center justify-between">
        <button type="button" disabled={question === 0} onClick={() => setQuestion((q) => Math.max(0, q - 1))} className="sku-btn h-9 rounded-[8px] px-4 text-[12.5px] font-semibold disabled:opacity-40"><ArrowLeft size={13} className="mr-1 inline" /> Back</button>
        <div className="flex items-center gap-3">
          {[1, 4, 5].includes(question) && <button type="button" onClick={next} className="h-9 px-2 text-[12px] font-semibold text-[#6B7280] hover:text-[#111827]">Skip</button>}
          <button type="button" disabled={!canContinue} onClick={next} className="sku-btn-primary h-9 rounded-[8px] px-5 text-[12.5px] font-semibold text-white disabled:opacity-40">{question === QUESTIONS.length - 1 ? "Review summary" : "Next"} <ArrowRight size={13} className="ml-1 inline" /></button>
        </div>
      </div>
    </div>
  )
}

function renderQuestion(index: number, value: WorkspaceAnswers, onChange: (patch: Partial<WorkspaceAnswers>) => void) {
  const input = (key: keyof WorkspaceAnswers, placeholder: string, type = "text") => <input autoFocus type={type} value={value[key]} onChange={(e) => onChange({ [key]: e.target.value })} placeholder={placeholder} className="h-12 w-full rounded-[9px] sku-input px-4 text-[15px] text-[#111827] outline-none" />
  const textarea = (key: keyof WorkspaceAnswers, placeholder: string) => <textarea autoFocus rows={5} value={value[key]} onChange={(e) => onChange({ [key]: e.target.value })} placeholder={placeholder} className="w-full resize-none rounded-[9px] sku-input px-4 py-3 text-[14px] leading-relaxed text-[#111827] outline-none" />
  if (index === 0) return input("businessName", "e.g. Northstar Yoga")
  if (index === 1) return <div>{input("websiteUrl", "yourbusiness.com (optional)", "url")}<p className="mt-2 text-[11.5px] text-[#9CA3AF]">No website yet? Skip this. It will never block setup.</p></div>
  if (index === 2) return textarea("productDescription", "Describe the product or service in your own words...")
  if (index === 3) return textarea("idealCustomer", "Who are they, and what result are they looking for?")
  if (index === 4) return textarea("differentiator", "Price, expertise, speed, experience, method, guarantee - what is genuinely different?")
  if (index === 5) return textarea("marketingHistory", "What channels, messages, or offers have you tried? What happened?")
  return <div className="grid grid-cols-2 gap-3">
    <select value={value.tone} onChange={(e) => onChange({ tone: e.target.value })} className="h-11 rounded-[8px] sku-input px-3 text-[13px]"><option value="">Ad tone</option><option>Professional</option><option>Warm</option><option>Casual</option><option>Bold</option><option>Premium</option></select>
    <select value={value.primaryGoal} onChange={(e) => onChange({ primaryGoal: e.target.value })} className="h-11 rounded-[8px] sku-input px-3 text-[13px]"><option value="">Primary goal</option><option value="LEADS">More leads</option><option value="SALES">More sales</option><option value="TRAFFIC">Website traffic</option><option value="APP_INSTALLS">App installs</option></select>
    <select value={value.currency} onChange={(e) => onChange({ currency: e.target.value })} className="h-11 rounded-[8px] sku-input px-3 text-[13px]"><option value="USD">USD</option><option value="INR">INR</option><option value="EUR">EUR</option><option value="GBP">GBP</option><option value="AUD">AUD</option></select>
    <input type="number" min="1" value={value.dailyBudget} onChange={(e) => onChange({ dailyBudget: e.target.value })} placeholder="Daily budget ceiling" className="h-11 rounded-[8px] sku-input px-3 text-[13px]" />
    <select value={value.timezone} onChange={(e) => onChange({ timezone: e.target.value })} className="col-span-2 h-11 rounded-[8px] sku-input px-3 text-[13px]"><option value="">Timezone</option><option value="America/New_York">Eastern</option><option value="America/Los_Angeles">Pacific</option><option value="Asia/Kolkata">India Standard Time</option><option value="Etc/UTC">UTC</option><option value="Europe/Paris">Central European</option></select>
  </div>
}
