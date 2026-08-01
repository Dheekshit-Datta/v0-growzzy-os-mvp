'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Shell } from '@/components/dashboard-v2/shell'
import {
  Check, Trash2, AlertCircle, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Eye, Loader2, Plus, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Section = 'goal' | 'plan' | 'keywords' | 'ads' | 'destination' | 'budget' | 'policy'

const SECTIONS: { id: Section; label: string; desc: string }[] = [
  { id: 'goal', label: 'Set Your Goal', desc: 'Campaign objective' },
  { id: 'plan', label: 'Plan Review', desc: 'Ad groups' },
  { id: 'keywords', label: 'Keywords', desc: 'Keyword list' },
  { id: 'ads', label: 'Ads', desc: 'Headlines & copy' },
  { id: 'destination', label: 'Targeting', desc: 'Location & landing page' },
  { id: 'budget', label: 'Budget', desc: 'Spend settings' },
  { id: 'policy', label: 'Policy Check', desc: 'Verify compliance' },
]

const MAX_AD_GROUPS = 6
const MIN_HEADLINES = 3
const MAX_HEADLINES = 15
const MIN_DESCRIPTIONS = 2
const MAX_DESCRIPTIONS = 4

async function readJson(res: Response) {
  try {
    return await res.json()
  } catch {
    return null
  }
}

interface KeywordEdit {
  keyword: string
  type: 'broad' | 'phrase' | 'exact'
}

interface AdGroupEdit {
  name: string
  theme: string
  keywords: KeywordEdit[]
  negativeKeywords: string[]
  headlines: string[]
  descriptions: string[]
}

interface CampaignData {
  campaignName?: string
  prompt: string
  detectedChips: string[]
  goal?: string
  adGroups: AdGroupEdit[]
  dailyBudget?: number
  currency?: string
  duration?: number
  locations?: string[]
  finalUrl?: string
  languages?: string[]
  biddingStrategy?: 'MAXIMIZE_CONVERSIONS' | 'MAXIMIZE_CLICKS' | 'TARGET_CPA' | 'TARGET_ROAS'
  targetCpa?: number | null
  rationale?: {
    whyThisStructure?: string
    whyTheseKeywords?: string
    whyThisBidding?: string
    expectedResultsRange?: string
  }
}

function emptyAdGroup(name = 'New Ad Group'): AdGroupEdit {
  return { name, theme: '', keywords: [], negativeKeywords: [], headlines: [''], descriptions: [''] }
}

type PolicyCheck = {
  status: 'PASS' | 'WARN' | 'FAIL'
  checkedAt: string
  flags: Array<{ text: string; adGroupName: string; field: string; reason: string; suggestion: string }>
}

type QualityCheck = { status: 'PASS' | 'WARN' | 'FAIL'; errors: string[]; warnings: string[] }

function apiError(json: any, fallback: string) {
  return json?.error?.message || (typeof json?.error === 'string' ? json.error : '') || json?.message || fallback
}

function displayHost(url?: string) {
  try {
    return url ? new URL(url).hostname : 'Add landing page'
  } catch {
    return 'Add landing page'
  }
}

export default function CampaignBuilderPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [openSection, setOpenSection] = useState<Section | null>('goal')
  const [data, setData] = useState<CampaignData>({
    prompt: '',
    detectedChips: [],
    goal: 'Sales',
    campaignName: '',
    adGroups: [emptyAdGroup('Core Campaign')],
    dailyBudget: 50,
    currency: 'USD',
    duration: 30,
    languages: ['English'],
    biddingStrategy: 'MAXIMIZE_CONVERSIONS',
  })
  const [activeGroupIdx, setActiveGroupIdx] = useState(0)
  const [newKeyword, setNewKeyword] = useState('')
  const [keywordType, setKeywordType] = useState<'broad' | 'phrase' | 'exact'>('broad')
  const [newNegative, setNewNegative] = useState('')

  const [planId, setPlanId] = useState<string | null>(null)
  const [loadingPlan, setLoadingPlan] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [launchError, setLaunchError] = useState('')
  const [launched, setLaunched] = useState<{ externalCampaignId?: string } | null>(null)
  const [targetingOpen, setTargetingOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [policyCheck, setPolicyCheck] = useState<PolicyCheck | null>(null)
  const [qualityCheck, setQualityCheck] = useState<QualityCheck | null>(null)
  const [policyAcknowledged, setPolicyAcknowledged] = useState(false)
  const [checkingPolicy, setCheckingPolicy] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const loadedPlanRef = useRef(false)
  const skipAutosaveRef = useRef(false)

  useEffect(() => {
    const id = searchParams.get('id') || searchParams.get('plan')
    if (!id) return
    setPlanId(id)
    loadedPlanRef.current = false
    setLoadingPlan(true)
    fetch(`/api/ai/campaign-plan/${id}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const plan = json?.data?.plan
        if (!plan || !Array.isArray(plan.adGroups) || plan.adGroups.length === 0) return
        const adGroups: AdGroupEdit[] = plan.adGroups.map((g: any, i: number) => ({
          name: String(g?.name || `Ad Group ${i + 1}`),
          theme: String(g?.theme || ''),
          keywords: (Array.isArray(g?.keywords) ? g.keywords : []).map((k: any) => ({
            keyword: String(k?.text || k || ''),
            type: (String(k?.matchType || 'broad').toLowerCase() as 'broad' | 'phrase' | 'exact'),
          })).filter((k: KeywordEdit) => k.keyword),
          negativeKeywords: (Array.isArray(g?.negativeKeywords) ? g.negativeKeywords : []).map((k: any) => String(k?.text || k || '')).filter(Boolean),
          headlines: (Array.isArray(g?.headlines) ? g.headlines : []).map((h: any) => String(h?.text || h || '')).filter(Boolean),
          descriptions: (Array.isArray(g?.descriptions) ? g.descriptions : []).map((d: any) => String(d?.text || d || '')).filter(Boolean),
        }))
        skipAutosaveRef.current = true
        setData((prev) => ({
          ...prev,
          prompt: json?.data?.briefInput?.offer || plan.campaignName || prev.prompt,
          campaignName: plan.campaignName || prev.campaignName,
          goal: plan.objective || plan.goal || prev.goal,
          adGroups,
          dailyBudget: Number(plan.dailyBudget) || prev.dailyBudget,
          locations: Array.isArray(plan.locations) ? plan.locations.map(String) : prev.locations,
          finalUrl: typeof plan.finalUrl === 'string' ? plan.finalUrl : prev.finalUrl,
          languages: Array.isArray(plan.languages) ? plan.languages.map(String) : prev.languages,
          biddingStrategy: plan.biddingStrategy || prev.biddingStrategy,
          targetCpa: plan.targetCpa ?? prev.targetCpa,
          rationale: plan.rationale || prev.rationale,
        }))
        setPolicyCheck(plan.policyCheck?.checkedAt ? plan.policyCheck : null)
        setQualityCheck(plan.qualityCheck || null)
        setPolicyAcknowledged(plan.policyAcknowledged === true)
        loadedPlanRef.current = true
      })
      .catch(() => {})
      .finally(() => setLoadingPlan(false))
  }, [searchParams])

  const activeGroup = data.adGroups[activeGroupIdx] || data.adGroups[0]
  const previewHeadlines = activeGroup.headlines.filter(Boolean)
  const previewDescriptions = activeGroup.descriptions.filter(Boolean)
  const previewCount = Math.max(1, Math.ceil(previewHeadlines.length / 3), previewDescriptions.length)
  const safePreviewIndex = previewIndex % previewCount
  const previewHeadline = previewHeadlines.slice((safePreviewIndex * 3) % Math.max(1, previewHeadlines.length), (safePreviewIndex * 3) % Math.max(1, previewHeadlines.length) + 3).join(' | ') || 'Your ad headline will appear here'
  const previewDescription = previewDescriptions[safePreviewIndex % Math.max(1, previewDescriptions.length)] || 'Your ad description will appear here'

  const updateGroup = (idx: number, patch: Partial<AdGroupEdit>) => {
    setPolicyCheck(null)
    setPolicyAcknowledged(false)
    setData((prev) => ({
      ...prev,
      adGroups: prev.adGroups.map((g, i) => (i === idx ? { ...g, ...patch } : g)),
    }))
  }

  const addAdGroup = () => {
    if (data.adGroups.length >= MAX_AD_GROUPS) return
    setPolicyCheck(null)
    setPolicyAcknowledged(false)
    setData((prev) => ({ ...prev, adGroups: [...prev.adGroups, emptyAdGroup(`Ad Group ${prev.adGroups.length + 1}`)] }))
    setActiveGroupIdx(data.adGroups.length)
  }

  const removeAdGroup = (idx: number) => {
    if (data.adGroups.length <= 1) return
    setPolicyCheck(null)
    setPolicyAcknowledged(false)
    setData((prev) => ({ ...prev, adGroups: prev.adGroups.filter((_, i) => i !== idx) }))
    setActiveGroupIdx((prev) => Math.max(0, prev >= idx ? prev - 1 : prev))
  }

  const handleAddKeyword = () => {
    if (!newKeyword.trim()) return
    updateGroup(activeGroupIdx, { keywords: [...activeGroup.keywords, { keyword: newKeyword.trim(), type: keywordType }] })
    setNewKeyword('')
  }
  const handleRemoveKeyword = (idx: number) => {
    updateGroup(activeGroupIdx, { keywords: activeGroup.keywords.filter((_, i) => i !== idx) })
  }
  const handleAddNegative = () => {
    if (!newNegative.trim()) return
    updateGroup(activeGroupIdx, { negativeKeywords: [...activeGroup.negativeKeywords, newNegative.trim()] })
    setNewNegative('')
  }
  const handleRemoveNegative = (idx: number) => {
    updateGroup(activeGroupIdx, { negativeKeywords: activeGroup.negativeKeywords.filter((_, i) => i !== idx) })
  }

  const setHeadline = (idx: number, value: string) => {
    const headlines = [...activeGroup.headlines]
    headlines[idx] = value.slice(0, 30)
    updateGroup(activeGroupIdx, { headlines })
  }
  const addHeadline = () => {
    if (activeGroup.headlines.length >= MAX_HEADLINES) return
    updateGroup(activeGroupIdx, { headlines: [...activeGroup.headlines, ''] })
  }
  const removeHeadline = (idx: number) => {
    if (activeGroup.headlines.length <= MIN_HEADLINES) return
    updateGroup(activeGroupIdx, { headlines: activeGroup.headlines.filter((_, i) => i !== idx) })
  }

  const setDescription = (idx: number, value: string) => {
    const descriptions = [...activeGroup.descriptions]
    descriptions[idx] = value.slice(0, 90)
    updateGroup(activeGroupIdx, { descriptions })
  }
  const addDescription = () => {
    if (activeGroup.descriptions.length >= MAX_DESCRIPTIONS) return
    updateGroup(activeGroupIdx, { descriptions: [...activeGroup.descriptions, ''] })
  }
  const removeDescription = (idx: number) => {
    if (activeGroup.descriptions.length <= MIN_DESCRIPTIONS) return
    updateGroup(activeGroupIdx, { descriptions: activeGroup.descriptions.filter((_, i) => i !== idx) })
  }

  const persistEdits = async (): Promise<boolean> => {
    if (!planId) return true
    const adGroups = data.adGroups.map((g) => ({
      name: g.name.slice(0, 80) || 'Ad Group',
      theme: g.theme,
      keywords: g.keywords.map((k) => ({ text: k.keyword.slice(0, 80), matchType: k.type.toUpperCase() })).filter((k) => k.text),
      negativeKeywords: g.negativeKeywords.map((k) => k.slice(0, 80)).filter(Boolean),
      headlines: g.headlines.map((h) => h.trim()).filter(Boolean).slice(0, MAX_HEADLINES),
      descriptions: g.descriptions.map((d) => d.trim()).filter(Boolean).slice(0, MAX_DESCRIPTIONS),
    }))
    const res = await fetch(`/api/ai/campaign-plan/${planId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaignName: data.campaignName,
        objective: data.goal,
        dailyBudget: data.dailyBudget && data.dailyBudget > 0 ? data.dailyBudget : undefined,
        biddingStrategy: data.biddingStrategy,
        targetCpa: data.biddingStrategy === 'TARGET_CPA' ? data.targetCpa : null,
        finalUrl: data.finalUrl || '',
        locations: data.locations,
        languages: data.languages,
        adGroups,
        policyAcknowledged,
      }),
    })
    const json = await readJson(res)
    if (!res.ok) {
      setLaunchError(apiError(json, 'Failed to save your edits.'))
    } else {
      setQualityCheck(json?.data?.plan?.qualityCheck || null)
      setPolicyCheck(json?.data?.plan?.policyCheck?.checkedAt ? json.data.plan.policyCheck : null)
    }
    return res.ok
  }

  const canPersistCurrentPlan = () =>
    !!planId &&
    !!data.dailyBudget &&
    data.dailyBudget > 0 &&
    data.adGroups.length > 0 &&
    data.adGroups.every((g) => {
      const keywords = g.keywords.filter((k) => k.keyword.trim())
      const headlines = g.headlines.filter((h) => h.trim())
      const descriptions = g.descriptions.filter((d) => d.trim())
      return g.name.trim() && keywords.length > 0 && headlines.length >= MIN_HEADLINES && descriptions.length >= MIN_DESCRIPTIONS
    })

  useEffect(() => {
    if (!planId || loadingPlan || !loadedPlanRef.current) return
    if (skipAutosaveRef.current) {
      skipAutosaveRef.current = false
      return
    }
    setSaveState('idle')
    if (!canPersistCurrentPlan()) return
    const timer = window.setTimeout(async () => {
      setSaveState('saving')
      const saved = await persistEdits()
      setSaveState(saved ? 'saved' : 'error')
    }, 900)
    return () => window.clearTimeout(timer)
  }, [data, loadingPlan, planId])

  const handlePublish = async () => {
    if (launching) return
    if (!planId) {
      setLaunchError("This plan can't be launched — start from New Campaign so it's saved first.")
      return
    }
    if (!data.finalUrl) {
      setLaunchError('Add the real landing page URL before launch.')
      setOpenSection('destination')
      return
    }
    if (!policyCheck?.checkedAt) {
      setLaunchError('Run the policy check before launch.')
      setOpenSection('policy')
      return
    }
    if (policyCheck.status === 'FAIL' || (policyCheck.status === 'WARN' && !policyAcknowledged)) {
      setLaunchError(policyCheck.status === 'FAIL' ? 'Fix the blocking policy issues before launch.' : 'Acknowledge the policy warnings before launch.')
      setOpenSection('policy')
      return
    }
    setLaunching(true)
    setLaunchError('')
    try {
      const saved = await persistEdits()
      if (!saved) throw new Error(launchError || "Couldn't save your edits. Please review the fields and try again.")
      const res = await fetch(`/api/ai/campaign-plan/${planId}/launch`, { method: 'POST' })
      const json = await readJson(res)
      if (!res.ok || !json?.ok) throw new Error(apiError(json, 'Launch failed. Please review the plan and try again.'))
      setLaunched({ externalCampaignId: json?.data?.externalCampaignId })
      setTimeout(() => router.push('/dashboard/ads'), 1400)
    } catch (err: any) {
      setLaunchError(err?.message || 'Launch failed.')
      setLaunching(false)
    }
  }

  const runPolicyCheck = async () => {
    if (!planId || checkingPolicy) return
    setCheckingPolicy(true)
    setLaunchError('')
    try {
      if (!(await persistEdits())) throw new Error('Save the plan before checking policy.')
      const res = await fetch('/api/ai/policy-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignPlanId: planId }),
      })
      const json = await readJson(res)
      if (!res.ok || !json?.ok) throw new Error(apiError(json, 'Policy check failed.'))
      setPolicyCheck(json.data)
      setPolicyAcknowledged(json.data.status === 'PASS')
    } catch (error: any) {
      setLaunchError(error?.message || 'Policy check failed.')
    } finally {
      setCheckingPolicy(false)
    }
  }

  const policyStatus = policyCheck?.status || 'NOT_CHECKED'
  const policyIssues = (policyCheck?.flags || []).map((flag) => ({
    group: Math.max(0, data.adGroups.findIndex((group) => group.name === flag.adGroupName)),
    text: flag.text,
    message: `${flag.reason} Suggested fix: ${flag.suggestion}`,
  }))

  const groupIsValidForAds = (g: AdGroupEdit) => {
    const validHeadlines = g.headlines.filter((h) => h.trim().length > 0 && h.length <= 30)
    const validDescriptions = g.descriptions.filter((d) => d.trim().length > 0 && d.length <= 90)
    return validHeadlines.length >= MIN_HEADLINES && validDescriptions.length >= MIN_DESCRIPTIONS
  }
  const totalPositiveKeywords = data.adGroups.reduce((sum, g) => sum + g.keywords.length, 0)

  const isDone = (id: Section): boolean => {
    switch (id) {
      case 'goal': return !!data.goal
      case 'plan': return data.adGroups.length > 0
      case 'keywords': return data.adGroups.every((g) => g.keywords.length > 0)
      case 'ads': return data.adGroups.every(groupIsValidForAds)
      case 'budget': return !!data.dailyBudget && data.dailyBudget > 0
      case 'destination': return !!data.finalUrl && !!data.locations?.length
      case 'policy': return policyStatus === 'PASS' || (policyStatus === 'WARN' && policyAcknowledged)
      default: return false
    }
  }

  const toggle = (id: Section) => setOpenSection((cur) => (cur === id ? null : id))

  const AccordionSection = ({ id, children }: { id: Section; children: React.ReactNode }) => {
    const meta = SECTIONS.find((s) => s.id === id)!
    const open = openSection === id
    const done = isDone(id)
    return (
      <div className="sku-card overflow-hidden">
        <button
          onClick={() => toggle(id)}
          className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-[#F8F9FB] transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className={cn('w-5 h-5 rounded-full flex items-center justify-center shrink-0', done ? 'bg-[#2E9E5B]' : open ? 'bg-[#1F57F5]' : 'bg-[#DDE1E7]')}>
              {done ? <Check size={12} className="text-white" strokeWidth={3} /> : <span className={cn('text-[10px] font-bold', open ? 'text-white' : 'text-[#6B7280]')}>{SECTIONS.findIndex((s) => s.id === id) + 1}</span>}
            </span>
            <div className="min-w-0">
              <p className={cn('text-[13px] font-semibold truncate', open ? 'text-[#1F57F5]' : 'text-[#111827]')}>{meta.label}</p>
              <p className="text-[11px] text-[#9CA3AF] truncate">{meta.desc}</p>
            </div>
          </div>
          <ChevronDown size={15} className={cn('text-[#9CA3AF] shrink-0 transition-transform', open && 'rotate-180')} />
        </button>
        {open && <div className="px-4 pb-4 border-t border-[#DDE1E7] pt-4">{children}</div>}
      </div>
    )
  }

  const AdGroupTabs = () => (
    <div className="flex items-center gap-1.5 flex-wrap mb-3">
      {data.adGroups.map((g, i) => (
        <button
          key={i}
          onClick={() => setActiveGroupIdx(i)}
          className={cn(
            'flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-semibold transition-colors',
            i === activeGroupIdx ? 'bg-[#EAF0FE] text-[#1F57F5]' : 'bg-[#F0F2F5] text-[#6B7280] hover:text-[#374151]'
          )}
        >
          {g.name || `Ad Group ${i + 1}`}
          {data.adGroups.length > 1 && (
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); removeAdGroup(i) }}
              className="text-[#9CA3AF] hover:text-[#D3564C]"
            >
              <X size={11} />
            </span>
          )}
        </button>
      ))}
      {data.adGroups.length < MAX_AD_GROUPS && (
        <button onClick={addAdGroup} className="flex items-center gap-1 h-7 px-2.5 rounded-full text-[11px] font-semibold text-[#1F57F5] hover:bg-[#EAF0FE] transition-colors">
          <Plus size={11} /> Ad group
        </button>
      )}
    </div>
  )

  return (
    <Shell>
      <div className="flex h-screen bg-[#F6F7F9] overflow-hidden">
        <div className="w-[240px] bg-white border-r border-[#DDE1E7] p-4 hidden lg:flex flex-col overflow-y-auto">
          <h3 className="text-[12px] font-semibold text-[#6B7280] uppercase tracking-wider">Campaign Flow</h3>
          <p className="text-[11px] text-[#9CA3AF] mb-4">Complete all steps before publish</p>
          <div className="space-y-1 flex-1">
            {SECTIONS.map((s, idx) => {
              const isActive = s.id === openSection
              const done = isDone(s.id)
              return (
                <button key={s.id} onClick={() => setOpenSection(s.id)} className={cn('w-full flex items-start gap-3 p-2.5 rounded-[10px] transition-all text-left', isActive ? 'bg-[#EAF0FE]' : 'hover:bg-[#F0F2F5]')}>
                  <div className="flex-shrink-0 mt-0.5">
                    {done ? (
                      <div className="w-5 h-5 rounded-full bg-[#2E9E5B] flex items-center justify-center"><Check size={12} className="text-white" strokeWidth={3} /></div>
                    ) : (
                      <div className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold', isActive ? 'bg-[#1F57F5] text-white' : 'bg-[#DDE1E7] text-[#6B7280]')}>{idx + 1}</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-[12px] font-semibold', isActive ? 'text-[#1F57F5]' : 'text-[#111827]')}>{s.label}</p>
                    <p className="text-[10px] text-[#9CA3AF] truncate">{s.desc}</p>
                  </div>
                </button>
              )
            })}
          </div>
          <div className="text-[11px] text-[#9CA3AF] mt-2 pt-2 border-t border-[#DDE1E7]">
            {SECTIONS.filter((s) => isDone(s.id)).length} of {SECTIONS.length} complete
          </div>
        </div>

        <div className="flex-1 min-w-0 overflow-y-auto p-3 sm:p-6">
          <div className="max-w-[560px] mx-auto">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
              <h2 className="text-[20px] font-bold text-[#111827]">Create Campaign</h2>
              <p className="text-[12px] text-[#6B7280]">
                {loadingPlan
                  ? 'Loading your AI plan...'
                  : saveState === 'saving'
                    ? 'Saving edits...'
                    : saveState === 'saved'
                      ? 'Saved. Safe to refresh.'
                      : saveState === 'error'
                        ? 'Could not autosave yet. Fix highlighted fields before launch.'
                        : 'AI proposes. You edit. Publish when it looks right.'}
              </p>
              </div>
              <button onClick={() => setPreviewOpen(true)} className="sku-btn xl:hidden h-9 px-3 text-[11px] font-semibold flex items-center gap-1.5"><Eye size={13} /> Preview</button>
            </div>

            <div className="space-y-3">
              <AccordionSection id="goal">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[12px] font-semibold text-[#111827] mb-2">Campaign Name</label>
                    <input value={data.campaignName || ''} onChange={(e) => setData({ ...data, campaignName: e.target.value.slice(0, 120) })} className="sku-input w-full" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-[#111827] mb-2">Campaign Goal</label>
                    <select value={data.goal || 'Sales'} onChange={(e) => setData({ ...data, goal: e.target.value })} className="sku-input w-full">
                      <option>Sales</option>
                      <option>Leads</option>
                      <option>Website Traffic</option>
                      <option>App Installs</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-[#111827] mb-2">Campaign Brief</label>
                    <p className="text-[12px] text-[#6B7280] p-3 bg-[#F0F2F5] rounded-[8px]">{data.prompt || '—'}</p>
                  </div>
                </div>
              </AccordionSection>

              <AccordionSection id="plan">
                <div className="space-y-3">
                  <div className="p-4 bg-[#E6F4EC] border border-[#2E9E5B] rounded-[10px]">
                    <p className="text-[12px] text-[#2E9E5B]">
                      <strong>{data.adGroups.length} ad group{data.adGroups.length > 1 ? 's' : ''}</strong> in this campaign.
                    </p>
                  </div>
                  {data.rationale?.whyThisStructure && (
                    <div className="p-3 bg-[#EAF0FE] rounded-[8px]">
                      <p className="text-[11px] font-semibold text-[#1F57F5] mb-1">Why this structure</p>
                      <p className="text-[11.5px] text-[#374151] leading-relaxed">{data.rationale.whyThisStructure}</p>
                    </div>
                  )}
                  {data.adGroups.map((g, i) => (
                    <div key={i} className="p-3 bg-[#F0F2F5] rounded-[8px] flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <input
                          value={g.name}
                          onChange={(e) => updateGroup(i, { name: e.target.value })}
                          className="text-[12px] font-semibold text-[#111827] bg-transparent outline-none w-full"
                        />
                        <p className="text-[11px] text-[#6B7280] mt-0.5">
                          {g.keywords.length} keywords · {g.headlines.filter(Boolean).length} headlines · {g.descriptions.filter(Boolean).length} descriptions
                        </p>
                      </div>
                      {data.adGroups.length > 1 && (
                        <button onClick={() => removeAdGroup(i)} className="text-[#D3564C] hover:bg-[#FBE7E5] p-1.5 rounded shrink-0"><Trash2 size={13} /></button>
                      )}
                    </div>
                  ))}
                  {data.adGroups.length < MAX_AD_GROUPS && (
                    <button onClick={addAdGroup} className="flex items-center gap-1.5 text-[12px] font-semibold text-[#1F57F5] hover:text-[#1849d6] transition-colors">
                      <Plus size={13} /> Add ad group
                    </button>
                  )}
                </div>
              </AccordionSection>

              <AccordionSection id="keywords">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3 p-3 bg-[#F8F9FB] rounded-[8px]">
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-[#111827]">Targeting plan</p>
                      <p className="text-[11px] text-[#6B7280] truncate">
                        {(data.locations?.join(', ') || 'Location from your brief')} · {data.adGroups.map((g) => g.theme || g.name).filter(Boolean).slice(0, 2).join(', ') || 'Keyword themes'}
                      </p>
                    </div>
                    <button onClick={() => setTargetingOpen(true)} className="sku-btn h-8 px-3 text-[11.5px] font-semibold shrink-0">
                      View rationale
                    </button>
                  </div>
                  {data.adGroups.length > 1 && <AdGroupTabs />}
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Add keyword..."
                        value={newKeyword}
                        onChange={(e) => setNewKeyword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
                        className="sku-input flex-1"
                      />
                      <select value={keywordType} onChange={(e) => setKeywordType(e.target.value as any)} className="sku-input w-[100px]">
                        <option value="broad">Broad</option>
                        <option value="phrase">Phrase</option>
                        <option value="exact">Exact</option>
                      </select>
                      <button onClick={handleAddKeyword} className="sku-btn-primary px-4 py-1.5 text-[11px] font-medium shrink-0">Add</button>
                    </div>
                  </div>

                  {activeGroup.keywords.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold text-[#111827] mb-2">Keywords ({activeGroup.keywords.length})</p>
                      <div className="space-y-1.5">
                        {activeGroup.keywords.map((k, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-[#F0F2F5] rounded-[6px]">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] px-1.5 py-0.5 bg-white rounded-[3px] text-[#6B7280] font-medium">{k.type}</span>
                              <span className="text-[12px] text-[#111827]">{k.keyword}</span>
                            </div>
                            <button onClick={() => handleRemoveKeyword(idx)} className="text-[#D3564C] hover:bg-[#FBE7E5] p-1 rounded"><Trash2 size={14} /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-[#DDE1E7]">
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        placeholder="Add negative keyword..."
                        value={newNegative}
                        onChange={(e) => setNewNegative(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddNegative()}
                        className="sku-input flex-1"
                      />
                      <button onClick={handleAddNegative} className="sku-btn px-4 py-1.5 text-[11px] font-medium shrink-0">Add</button>
                    </div>
                    {activeGroup.negativeKeywords.length > 0 && (
                      <div className="space-y-1.5">
                        {activeGroup.negativeKeywords.map((k, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-[#FBE7E5] rounded-[6px]">
                            <span className="text-[12px] text-[#111827] line-through">{k}</span>
                            <button onClick={() => handleRemoveNegative(idx)} className="text-[#D3564C] hover:bg-white p-1 rounded"><Trash2 size={14} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </AccordionSection>

              <AccordionSection id="ads">
                <div className="space-y-4">
                  {data.adGroups.length > 1 && <AdGroupTabs />}

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[12px] font-semibold text-[#111827]">
                        Headlines ({activeGroup.headlines.filter(Boolean).length}/{MIN_HEADLINES} min)
                      </label>
                      {activeGroup.headlines.length < MAX_HEADLINES && (
                        <button onClick={addHeadline} className="flex items-center gap-1 text-[11px] font-semibold text-[#1F57F5] hover:text-[#1849d6] transition-colors">
                          <Plus size={11} /> Add headline
                        </button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {activeGroup.headlines.map((h, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="flex-1 relative">
                            <input
                              type="text"
                              maxLength={30}
                              value={h}
                              onChange={(e) => setHeadline(idx, e.target.value)}
                              className={cn('sku-input w-full pr-12', h.length > 30 ? 'border-[#D3564C]' : '')}
                            />
                            <span className={cn('absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium', h.length > 30 ? 'text-[#D3564C]' : 'text-[#9CA3AF]')}>{h.length}/30</span>
                          </div>
                          {activeGroup.headlines.length > MIN_HEADLINES && (
                            <button onClick={() => removeHeadline(idx)} className="text-[#D3564C] hover:bg-[#FBE7E5] p-1.5 rounded shrink-0"><Trash2 size={13} /></button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#DDE1E7]">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[12px] font-semibold text-[#111827]">
                        Descriptions ({activeGroup.descriptions.filter(Boolean).length}/{MIN_DESCRIPTIONS} min)
                      </label>
                      {activeGroup.descriptions.length < MAX_DESCRIPTIONS && (
                        <button onClick={addDescription} className="flex items-center gap-1 text-[11px] font-semibold text-[#1F57F5] hover:text-[#1849d6] transition-colors">
                          <Plus size={11} /> Add description
                        </button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {activeGroup.descriptions.map((d, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <div className="flex-1 relative">
                            <textarea
                              maxLength={90}
                              value={d}
                              onChange={(e) => setDescription(idx, e.target.value)}
                              className={cn('sku-input w-full h-[60px] resize-none pr-2', d.length > 90 ? 'border-[#D3564C]' : '')}
                            />
                            <span className={cn('absolute right-2 bottom-1.5 text-[10px] font-medium bg-white/80 px-1 rounded', d.length > 90 ? 'text-[#D3564C]' : 'text-[#9CA3AF]')}>{d.length}/90</span>
                          </div>
                          {activeGroup.descriptions.length > MIN_DESCRIPTIONS && (
                            <button onClick={() => removeDescription(idx)} className="text-[#D3564C] hover:bg-[#FBE7E5] p-1.5 rounded shrink-0"><Trash2 size={13} /></button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </AccordionSection>

              <AccordionSection id="destination">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[12px] font-semibold text-[#111827] mb-2">Target locations</label>
                    <input value={data.locations?.join(', ') || ''} onChange={(e) => setData({ ...data, locations: e.target.value.split(',').map((value) => value.trim()).filter(Boolean) })} placeholder="e.g. Mumbai, Delhi" className="sku-input w-full" />
                    <p className="text-[10.5px] text-[#6B7280] mt-1">Separate multiple locations with commas.</p>
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-[#111827] mb-2">Language</label>
                    <input value={data.languages?.join(', ') || 'English'} onChange={(e) => setData({ ...data, languages: e.target.value.split(',').map((value) => value.trim()).filter(Boolean) })} className="sku-input w-full" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-[#111827] mb-2">Landing page URL</label>
                    <input type="url" value={data.finalUrl || ''} onChange={(e) => setData({ ...data, finalUrl: e.target.value })} placeholder="https://yourwebsite.com/offer" className="sku-input w-full" />
                    <p className="text-[10.5px] text-[#6B7280] mt-1">Required before launch. Placeholder domains are rejected.</p>
                  </div>
                </div>
              </AccordionSection>

              <AccordionSection id="budget">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[12px] font-semibold text-[#111827] mb-2">Bidding strategy</label>
                    <select value={data.biddingStrategy || 'MAXIMIZE_CONVERSIONS'} onChange={(e) => setData({ ...data, biddingStrategy: e.target.value as CampaignData['biddingStrategy'] })} className="sku-input w-full">
                      <option value="MAXIMIZE_CONVERSIONS">Maximize conversions</option>
                      <option value="MAXIMIZE_CLICKS">Maximize clicks</option>
                      <option value="TARGET_CPA">Target CPA</option>
                    </select>
                    {data.biddingStrategy === 'TARGET_CPA' && <input type="number" min="0.01" value={data.targetCpa || ''} onChange={(e) => setData({ ...data, targetCpa: Number(e.target.value) || null })} placeholder="Target CPA" className="sku-input w-full mt-2" />}
                    {data.rationale?.whyThisBidding && <p className="text-[11px] text-[#6B7280] mt-1">{data.rationale.whyThisBidding}</p>}
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-[#111827] mb-2">Daily Budget</label>
                    <div className="flex gap-2">
                      <select value={data.currency || 'USD'} onChange={(e) => setData({ ...data, currency: e.target.value })} className="sku-input w-[100px]">
                        <option value="USD">USD</option>
                        <option value="INR">INR</option>
                        <option value="EUR">EUR</option>
                      </select>
                      <input type="number" min="1" value={data.dailyBudget || 50} onChange={(e) => setData({ ...data, dailyBudget: parseFloat(e.target.value) })} className="sku-input flex-1" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-[#111827] mb-2">Campaign Duration (days)</label>
                    <input type="number" min="1" value={data.duration || 30} onChange={(e) => setData({ ...data, duration: parseInt(e.target.value) })} className="sku-input w-full" />
                  </div>
                  <div className="p-3 bg-[#EAF0FE] rounded-[8px]">
                    <p className="text-[11px] text-[#1F57F5]"><strong>Estimated total:</strong> {data.currency} {((data.dailyBudget || 50) * (data.duration || 30)).toLocaleString()}</p>
                  </div>
                </div>
              </AccordionSection>

              <AccordionSection id="policy">
                <div className={cn('p-4 border-l-4 rounded-[8px]', policyStatus === 'PASS' ? 'border-l-[#2E9E5B] bg-[#E6F4EC]/30' : 'border-l-[#B8892B] bg-[#FBF0DA]/30')}>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {policyStatus === 'PASS' ? <CheckCircle2 size={20} className="text-[#2E9E5B]" /> : <AlertCircle size={20} className="text-[#B8892B]" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-[#111827]">{policyStatus}</p>
                      {policyIssues.length === 0 ? (
                        <p className="text-[11px] text-[#6B7280] mt-0.5">{policyStatus === 'NOT_CHECKED' ? 'Run the real policy check before launch.' : 'No likely policy issues were found.'}</p>
                      ) : (
                        <div className="mt-1 space-y-1">
                          {policyIssues.map((issue, i) => (
                            <p key={i} className="text-[11px] text-[#B8892B]">
                              Ad group {issue.group + 1}: "{issue.text}" — {issue.message}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {qualityCheck?.warnings.map((warning, i) => <p key={i} className="text-[11px] text-[#B8892B] mt-2">{warning}</p>)}
                  {policyStatus === 'WARN' && (
                    <label className="flex items-center gap-2 mt-3 text-[11px] text-[#374151]">
                      <input type="checkbox" checked={policyAcknowledged} onChange={(e) => setPolicyAcknowledged(e.target.checked)} />
                      I reviewed these warnings and want to continue.
                    </label>
                  )}
                  <button onClick={runPolicyCheck} disabled={checkingPolicy} className="sku-btn mt-3 px-3 py-1.5 text-[11px] font-semibold disabled:opacity-60">
                    {checkingPolicy ? 'Checking...' : policyCheck ? 'Check again' : 'Run policy check'}
                  </button>
                </div>
              </AccordionSection>
            </div>

            <div className="sku-card p-4 mt-4 space-y-3">
              <p className="text-[12px] font-semibold text-[#111827]">Campaign Summary</p>
              <div className="space-y-2">
                <div className="flex justify-between text-[11px]"><span className="text-[#6B7280]">Goal:</span><span className="font-medium text-[#111827]">{data.goal}</span></div>
                <div className="flex justify-between text-[11px]"><span className="text-[#6B7280]">Ad groups:</span><span className="font-medium text-[#111827]">{data.adGroups.length}</span></div>
                <div className="flex justify-between text-[11px]"><span className="text-[#6B7280]">Total keywords:</span><span className="font-medium text-[#111827]">{totalPositiveKeywords}</span></div>
                <div className="flex justify-between text-[11px]"><span className="text-[#6B7280]">Budget:</span><span className="font-medium text-[#111827]">{data.currency} {((data.dailyBudget || 50) * (data.duration || 30)).toLocaleString()} ({data.duration} days)</span></div>
                <div className="flex justify-between text-[11px]"><span className="text-[#6B7280]">Policy:</span><span className={cn('font-medium', policyStatus === 'PASS' ? 'text-[#2E9E5B]' : 'text-[#B8892B]')}>{policyStatus}</span></div>
              </div>
            </div>

            <div className="flex gap-2 mt-4 mb-8">
              <button disabled title="Scheduling isn't available yet" className="sku-btn flex-1 py-2.5 text-[12px] font-medium opacity-50 cursor-not-allowed">Schedule</button>
              <button onClick={handlePublish} disabled={launching || !!launched} className="sku-btn-primary flex-1 py-2.5 text-[12px] font-medium disabled:opacity-70 flex items-center justify-center gap-2">
                {launching ? (<><Loader2 size={13} className="animate-spin" /> Launching…</>) : launched ? (<>✓ Launched (paused)</>) : (<>🚀 Launch (starts paused)</>)}
              </button>
            </div>

            {launchError && (
              <div className="mb-8 p-3 rounded-[10px] border border-[#D3564C]/30 bg-[#FBE7E5]">
                <p className="text-[12px] font-medium text-[#D3564C]">{launchError}</p>
              </div>
            )}
            {launched && (
              <div className="mb-8 p-3 rounded-[10px] border border-[#2E9E5B]/30 bg-[#E6F4EC]">
                <p className="text-[12px] font-medium text-[#2E9E5B]">
                  Campaign published to Google Ads in paused state{launched.externalCampaignId ? ` (ID ${launched.externalCampaignId})` : ''}. Enable it from Ads Manager when ready.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="w-[300px] bg-white border-l border-[#DDE1E7] p-6 overflow-y-auto hidden xl:flex flex-col">
          <h3 className="text-[12px] font-semibold text-[#6B7280] mb-4 uppercase">Google Search Preview</h3>
          <p className="text-[10px] text-[#9CA3AF] -mt-3 mb-3">Showing: {activeGroup.name || `Ad Group ${activeGroupIdx + 1}`}</p>

          <div className="flex-1 space-y-4">
            <div className="inline-block px-2 py-1 bg-[#E6F4EC] text-[#2E9E5B] text-[10px] font-bold rounded-[3px]">Sponsored</div>
            <h4 className="text-[14px] font-bold text-[#1F57F5] break-words leading-snug">{previewHeadline}</h4>
            <p className="text-[13px] text-[#1F57F5] break-all">
              {displayHost(data.finalUrl)} › {activeGroup.keywords[0]?.keyword || 'campaign'}
            </p>
            <p className="text-[13px] text-[#6B7280] leading-snug break-words">{previewDescription}</p>
            <div className="flex items-center justify-between pt-2">
              <button aria-label="Previous ad combination" onClick={() => setPreviewIndex((value) => (value - 1 + previewCount) % previewCount)} className="sku-btn w-8 h-8 flex items-center justify-center"><ChevronLeft size={14} /></button>
              <span className="text-[10px] text-[#6B7280]">{safePreviewIndex + 1} of {previewCount}</span>
              <button aria-label="Next ad combination" onClick={() => setPreviewIndex((value) => (value + 1) % previewCount)} className="sku-btn w-8 h-8 flex items-center justify-center"><ChevronRight size={14} /></button>
            </div>

            <div className="hidden">
              <p className="text-[10px] font-semibold text-[#6B7280] mb-2">All headlines ({activeGroup.headlines.filter(Boolean).length})</p>
              <div className="space-y-1">
                {activeGroup.headlines.filter(Boolean).map((h, idx) => (
                  <p key={idx} className="text-[10px] text-[#374151] truncate">• {h}</p>
                ))}
              </div>
            </div>

            <div className="hidden">
              <p className="text-[10px] font-semibold text-[#6B7280] mb-2">Keywords ({activeGroup.keywords.length})</p>
              <div className="space-y-1">
                {activeGroup.keywords.slice(0, 5).map((k, idx) => (
                  <p key={idx} className="text-[10px] text-[#374151] truncate">• {k.keyword} <span className="text-[#9CA3AF]">({k.type})</span></p>
                ))}
                {activeGroup.keywords.length > 5 && <p className="text-[10px] text-[#9CA3AF] italic">+ {activeGroup.keywords.length - 5} more</p>}
              </div>
            </div>
          </div>
        </div>
        {previewOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-label="Google Search ad preview">
            <div className="w-full max-w-[420px] bg-white rounded-[12px] border border-[#DDE1E7] shadow-xl p-5">
              <div className="flex items-center justify-between mb-5">
                <div><p className="text-[13px] font-semibold text-[#111827]">Google Search preview</p><p className="text-[10px] text-[#6B7280]">{activeGroup.name}</p></div>
                <button aria-label="Close preview" onClick={() => setPreviewOpen(false)} className="sku-btn w-8 h-8 flex items-center justify-center"><X size={14} /></button>
              </div>
              <span className="inline-block px-2 py-1 bg-[#E6F4EC] text-[#2E9E5B] text-[10px] font-bold rounded-[3px]">Sponsored</span>
              <h4 className="text-[16px] font-semibold text-[#1F57F5] mt-3 leading-snug">{previewHeadline}</h4>
              <p className="text-[12px] text-[#1F57F5] mt-2 break-all">{displayHost(data.finalUrl)}</p>
              <p className="text-[13px] text-[#6B7280] mt-2 leading-relaxed">{previewDescription}</p>
              <div className="flex items-center justify-between mt-5">
                <button aria-label="Previous ad combination" onClick={() => setPreviewIndex((value) => (value - 1 + previewCount) % previewCount)} className="sku-btn w-9 h-9 flex items-center justify-center"><ChevronLeft size={14} /></button>
                <span className="text-[11px] text-[#6B7280]">Combination {safePreviewIndex + 1} of {previewCount}</span>
                <button aria-label="Next ad combination" onClick={() => setPreviewIndex((value) => (value + 1) % previewCount)} className="sku-btn w-9 h-9 flex items-center justify-center"><ChevronRight size={14} /></button>
              </div>
            </div>
          </div>
        )}
        {targetingOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
            <div className="w-full max-w-[560px] bg-white rounded-[16px] border border-[#DDE1E7] shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#E9EBEF]">
                <div>
                  <p className="text-[15px] font-bold text-[#111827]">Targeting rationale</p>
                  <p className="text-[11.5px] text-[#6B7280]">Google Search uses keywords and location, not Meta-style audience sizes.</p>
                </div>
                <button onClick={() => setTargetingOpen(false)} className="sku-btn w-8 h-8 flex items-center justify-center rounded-full">
                  <X size={14} />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-2">Locations</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(data.locations?.length ? data.locations : ['From campaign brief']).map((location) => (
                      <span key={location} className="px-2 py-1 rounded-full bg-[#EAF0FE] text-[#1F57F5] text-[11.5px] font-semibold">{location}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-2">Keyword themes</p>
                  <div className="space-y-2">
                    {data.adGroups.map((group) => (
                      <div key={group.name} className="p-3 rounded-[8px] bg-[#F8F9FB]">
                        <p className="text-[12px] font-semibold text-[#111827]">{group.name}</p>
                        <p className="text-[11.5px] text-[#6B7280] mt-0.5">{group.theme || group.keywords.slice(0, 4).map((k) => k.keyword).join(', ') || 'Theme not specified'}</p>
                      </div>
                    ))}
                  </div>
                </div>
                {data.rationale?.whyTheseKeywords && (
                  <div className="p-3 rounded-[8px] bg-[#E6F4EC]/60">
                    <p className="text-[11px] font-semibold text-[#2E9E5B] mb-1">Why these keywords</p>
                    <p className="text-[12px] text-[#374151] leading-relaxed">{data.rationale.whyTheseKeywords}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Shell>
  )
}
