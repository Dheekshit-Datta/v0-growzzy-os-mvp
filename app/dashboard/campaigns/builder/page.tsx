'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Shell } from '@/components/dashboard-v2/shell'
import {
  ArrowLeft, Check, X, Plus, Trash2, AlertCircle, CheckCircle2,
  Eye, EyeOff, ChevronRight, Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Step = 'goal' | 'plan' | 'keywords' | 'ads' | 'budget' | 'policy' | 'publish'

const STEPS: { id: Step; label: string; desc: string }[] = [
  { id: 'goal', label: 'Goal', desc: 'Campaign objective' },
  { id: 'plan', label: 'Plan Review', desc: 'Ad groups' },
  { id: 'keywords', label: 'Keywords', desc: 'Keyword list' },
  { id: 'ads', label: 'Ads', desc: 'Headlines & copy' },
  { id: 'budget', label: 'Budget', desc: 'Spend settings' },
  { id: 'policy', label: 'Policy Check', desc: 'Verify compliance' },
  { id: 'publish', label: 'Publish', desc: 'Final review' },
]

interface CampaignData {
  prompt: string
  detectedChips: string[]
  goal?: string
  keywords?: { keyword: string; type: 'broad' | 'phrase' | 'exact'; isNegative?: boolean }[]
  headline?: string
  description?: string
  dailyBudget?: number
  currency?: string
  duration?: number
}

export default function CampaignBuilderPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState<Step>('goal')
  const [data, setData] = useState<CampaignData>({
    prompt: '',
    detectedChips: [],
    goal: 'Sales',
    keywords: [],
    headline: 'Transform Your Business Today',
    description: 'Discover premium solutions designed for you.',
    dailyBudget: 50,
    currency: 'USD',
    duration: 30,
  })
  const [newKeyword, setNewKeyword] = useState('')
  const [keywordType, setKeywordType] = useState<'broad' | 'phrase' | 'exact'>('broad')
  const [isNegative, setIsNegative] = useState(false)
  const headlineRef = useRef<HTMLInputElement>(null)
  const descRef = useRef<HTMLTextAreaElement>(null)

  const [planId, setPlanId] = useState<string | null>(null)
  const [launching, setLaunching] = useState(false)
  const [launchError, setLaunchError] = useState('')
  const [launched, setLaunched] = useState<{ externalCampaignId?: string } | null>(null)

  // Load a real persisted plan by id, or fall back to legacy base64 ?data=
  useEffect(() => {
    const id = searchParams.get('id')
    if (id) {
      setPlanId(id)
      fetch(`/api/ai/campaign-plan/${id}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => {
          const plan = json?.data?.plan
          if (!plan) return
          const group = Array.isArray(plan.adGroups) && plan.adGroups[0] ? plan.adGroups[0] : {}
          const keywords = [
            ...((group.keywords || []) as any[]).map((k: any) => ({
              keyword: String(k?.text || k || ''),
              type: (String(k?.matchType || 'broad').toLowerCase() as 'broad' | 'phrase' | 'exact'),
              isNegative: false,
            })),
            ...((group.negativeKeywords || []) as any[]).map((k: any) => ({
              keyword: String(k?.text || k || ''),
              type: 'broad' as const,
              isNegative: true,
            })),
          ].filter((k) => k.keyword)
          setData((prev) => ({
            ...prev,
            prompt: plan.campaignName || prev.prompt,
            goal: plan.objective || plan.goal || prev.goal,
            keywords,
            headline: (group.headlines && group.headlines[0]) || prev.headline,
            description: (group.descriptions && group.descriptions[0]) || prev.description,
            dailyBudget: Number(plan.dailyBudget) || prev.dailyBudget,
          }))
        })
        .catch(() => {})
      return
    }
    const encoded = searchParams.get('data')
    if (encoded) {
      try {
        setData(JSON.parse(atob(encoded)))
      } catch {
        /* ignore malformed legacy payload */
      }
    }
  }, [searchParams])

  const stepIndex = STEPS.findIndex((s) => s.id === step)
  const completedSteps = stepIndex

  const handleAddKeyword = () => {
    if (newKeyword.trim()) {
      setData({
        ...data,
        keywords: [
          ...(data.keywords || []),
          { keyword: newKeyword.trim(), type: keywordType, isNegative },
        ],
      })
      setNewKeyword('')
    }
  }

  const handleRemoveKeyword = (index: number) => {
    setData({
      ...data,
      keywords: data.keywords?.filter((_, i) => i !== index),
    })
  }

  const handleNextStep = () => {
    if (stepIndex < STEPS.length - 1) {
      setStep(STEPS[stepIndex + 1].id)
    }
  }

  const handlePrevStep = () => {
    if (stepIndex > 0) {
      setStep(STEPS[stepIndex - 1].id)
    }
  }

  const handlePublish = async () => {
    if (launching) return
    if (!planId) {
      setLaunchError("This plan can't be launched — start from New Campaign so it's saved first.")
      return
    }
    setLaunching(true)
    setLaunchError('')
    try {
      const res = await fetch(`/api/ai/campaign-plan/${planId}/launch`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || 'Launch failed. Please review the plan and try again.')
      }
      setLaunched({ externalCampaignId: json?.data?.externalCampaignId })
      setTimeout(() => router.push('/dashboard/ads'), 1400)
    } catch (err: any) {
      setLaunchError(err?.message || 'Launch failed.')
      setLaunching(false)
    }
  }

  // Policy check logic
  const getPolicyStatus = () => {
    const headline = data.headline || ''
    const description = data.description || ''
    const fullText = headline + ' ' + description

    if (fullText.length > 200) {
      return { status: 'WARN', message: 'Content exceeds recommended length', flag: 'Length warning' }
    }
    if (/[A-Z]{5,}/.test(fullText)) {
      return { status: 'WARN', message: 'Excessive capitalization detected', flag: 'Caps warning' }
    }
    if (/[!]{2,}/.test(fullText)) {
      return { status: 'FAIL', message: 'Multiple exclamation marks not allowed', flag: 'Punctuation violation' }
    }
    return { status: 'PASS', message: 'All policies passed', flag: null }
  }

  const policyStatus = getPolicyStatus()
  const headlineChars = (data.headline || '').length
  const descChars = (data.description || '').length

  return (
    <Shell>
      <div className="flex h-screen bg-[#F6F7F9] overflow-hidden">
        {/* LEFT RAIL: Step progress */}
        <div className="w-[240px] bg-white border-r border-[#DDE1E7] p-4 flex flex-col overflow-y-auto">
          <h3 className="text-[12px] font-semibold text-[#6B7280] mb-4 uppercase tracking-wider">Campaign Flow</h3>
          <div className="space-y-3 flex-1">
            {STEPS.map((s, idx) => {
              const isActive = s.id === step
              const isCompleted = idx < stepIndex
              return (
                <button
                  key={s.id}
                  onClick={() => setStep(s.id)}
                  className={cn(
                    'w-full flex items-start gap-3 p-3 rounded-[10px] transition-all text-left',
                    isActive
                      ? 'bg-[#EAF0FE] border border-[#1F57F5]'
                      : isCompleted
                        ? 'bg-[#E6F4EC] hover:bg-[#E6F4EC]/80'
                        : 'hover:bg-[#F0F2F5]'
                  )}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {isCompleted ? (
                      <Check size={18} className="text-[#2E9E5B]" />
                    ) : (
                      <div
                        className={cn(
                          'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold',
                          isActive ? 'bg-[#1F57F5] text-white' : 'bg-[#DDE1E7] text-[#6B7280]'
                        )}
                      >
                        {idx + 1}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-[12px] font-semibold', isActive ? 'text-[#1F57F5]' : 'text-[#111827]')}>
                      {s.label}
                    </p>
                    <p className="text-[10px] text-[#9CA3AF] truncate">{s.desc}</p>
                  </div>
                </button>
              )
            })}
          </div>
          {/* Vertical connector line (pseudo-element in CSS) */}
          <div className="text-[11px] text-[#9CA3AF] mt-2 pt-2 border-t border-[#DDE1E7]">
            Step {stepIndex + 1} of {STEPS.length}
          </div>
        </div>

        {/* MIDDLE: Form editing */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-[500px] mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <button onClick={handlePrevStep} className="p-2 hover:bg-[#F0F2F5] rounded-[8px]">
                <ArrowLeft size={18} className="text-[#374151]" />
              </button>
              <div>
                <h2 className="text-[20px] font-bold text-[#111827]">{STEPS[stepIndex].label}</h2>
                <p className="text-[12px] text-[#6B7280]">{STEPS[stepIndex].desc}</p>
              </div>
            </div>

            {/* GOAL STEP */}
            {step === 'goal' && (
              <div className="space-y-4 sku-card p-4">
                <div>
                  <label className="block text-[12px] font-semibold text-[#111827] mb-2">Campaign Goal</label>
                  <select
                    value={data.goal || 'Sales'}
                    onChange={(e) => setData({ ...data, goal: e.target.value })}
                    className="sku-input w-full"
                  >
                    <option>Sales</option>
                    <option>Leads</option>
                    <option>Website Traffic</option>
                    <option>App Installs</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#111827] mb-2">Campaign Brief</label>
                  <p className="text-[12px] text-[#6B7280] p-3 bg-[#F0F2F5] rounded-[8px]">{data.prompt}</p>
                </div>
                {data.detectedChips && data.detectedChips.length > 0 && (
                  <div>
                    <label className="block text-[12px] font-semibold text-[#111827] mb-2">Detected targeting</label>
                    <div className="flex flex-wrap gap-2">
                      {data.detectedChips.map((chip) => (
                        <span key={chip} className="inline-block px-2 py-1 bg-[#EAF0FE] text-[#1F57F5] text-[11px] font-medium rounded-[5px]">
                          {chip}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* PLAN REVIEW STEP */}
            {step === 'plan' && (
              <div className="space-y-4 sku-card p-4">
                <div className="p-4 bg-[#E6F4EC] border border-[#2E9E5B] rounded-[10px]">
                  <p className="text-[12px] text-[#2E9E5B]">
                    <strong>Ad Group Summary</strong>: Based on your brief, we recommend 1 ad group focused on your primary goal.
                  </p>
                </div>
                <div>
                  <p className="text-[12px] font-semibold text-[#111827]">Ad Group 1: Core Campaign</p>
                  <p className="text-[11px] text-[#6B7280] mt-1">Targeting: {data.goal || 'Sales-focused'} | Keywords: {(data.keywords || []).length || 'Not set yet'}</p>
                </div>
              </div>
            )}

            {/* KEYWORDS STEP */}
            {step === 'keywords' && (
              <div className="space-y-4">
                <div className="sku-card p-4 space-y-3">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder="Add keyword..."
                        value={newKeyword}
                        onChange={(e) => setNewKeyword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
                        className="sku-input w-full"
                      />
                    </div>
                    <select value={keywordType} onChange={(e) => setKeywordType(e.target.value as any)} className="sku-input w-[100px]">
                      <option value="broad">Broad</option>
                      <option value="phrase">Phrase</option>
                      <option value="exact">Exact</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsNegative(!isNegative)}
                      className={cn('px-3 py-1.5 rounded-[6px] text-[11px] font-medium border transition-all', isNegative ? 'bg-[#FBE7E5] border-[#D3564C] text-[#D3564C]' : 'bg-white border-[#DDE1E7] text-[#6B7280] hover:border-[#1F57F5]')}
                    >
                      {isNegative ? '⊖ Negative' : '+ Positive'}
                    </button>
                    <button onClick={handleAddKeyword} className="sku-btn-primary px-4 py-1.5 text-[11px] font-medium">
                      Add
                    </button>
                  </div>
                </div>

                {/* Positive keywords */}
                {(data.keywords || []).filter((k) => !k.isNegative).length > 0 && (
                  <div className="sku-card p-4">
                    <p className="text-[11px] font-semibold text-[#111827] mb-2">Positive Keywords</p>
                    <div className="space-y-1.5">
                      {(data.keywords || [])
                        .filter((k) => !k.isNegative)
                        .map((k, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-[#F0F2F5] rounded-[6px]">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] px-1.5 py-0.5 bg-white rounded-[3px] text-[#6B7280] font-medium">{k.type}</span>
                              <span className="text-[12px] text-[#111827]">{k.keyword}</span>
                            </div>
                            <button onClick={() => handleRemoveKeyword(idx)} className="text-[#D3564C] hover:bg-[#FBE7E5] p-1 rounded">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Negative keywords */}
                {(data.keywords || []).filter((k) => k.isNegative).length > 0 && (
                  <div className="sku-card p-4">
                    <p className="text-[11px] font-semibold text-[#111827] mb-2">Negative Keywords</p>
                    <div className="space-y-1.5">
                      {(data.keywords || [])
                        .filter((k) => k.isNegative)
                        .map((k, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-[#FBE7E5] rounded-[6px]">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] px-1.5 py-0.5 bg-white rounded-[3px] text-[#D3564C] font-medium">−{k.type}</span>
                              <span className="text-[12px] text-[#111827] line-through">{k.keyword}</span>
                            </div>
                            <button onClick={() => handleRemoveKeyword(idx)} className="text-[#D3564C] hover:bg-white p-1 rounded">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ADS STEP */}
            {step === 'ads' && (
              <div className="space-y-4 sku-card p-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[12px] font-semibold text-[#111827]">Headline</label>
                    <span className={cn('text-[10px] font-medium', headlineChars > 30 ? 'text-[#D3564C]' : 'text-[#6B7280]')}>
                      {headlineChars}/30
                    </span>
                  </div>
                  <input
                    ref={headlineRef}
                    type="text"
                    maxLength={30}
                    value={data.headline || ''}
                    onChange={(e) => setData({ ...data, headline: e.target.value })}
                    className={cn('sku-input w-full', headlineChars > 30 ? 'border-[#D3564C]' : '')}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[12px] font-semibold text-[#111827]">Description</label>
                    <span className={cn('text-[10px] font-medium', descChars > 90 ? 'text-[#D3564C]' : 'text-[#6B7280]')}>
                      {descChars}/90
                    </span>
                  </div>
                  <textarea
                    ref={descRef}
                    maxLength={90}
                    value={data.description || ''}
                    onChange={(e) => setData({ ...data, description: e.target.value })}
                    className={cn('sku-input w-full h-[80px] resize-none', descChars > 90 ? 'border-[#D3564C]' : '')}
                  />
                </div>
              </div>
            )}

            {/* BUDGET STEP */}
            {step === 'budget' && (
              <div className="space-y-4 sku-card p-4">
                <div>
                  <label className="block text-[12px] font-semibold text-[#111827] mb-2">Daily Budget</label>
                  <div className="flex gap-2">
                    <select value={data.currency || 'USD'} onChange={(e) => setData({ ...data, currency: e.target.value })} className="sku-input w-[100px]">
                      <option value="USD">USD</option>
                      <option value="INR">INR</option>
                      <option value="EUR">EUR</option>
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={data.dailyBudget || 50}
                      onChange={(e) => setData({ ...data, dailyBudget: parseFloat(e.target.value) })}
                      className="sku-input flex-1"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#111827] mb-2">Campaign Duration (days)</label>
                  <input
                    type="number"
                    min="1"
                    value={data.duration || 30}
                    onChange={(e) => setData({ ...data, duration: parseInt(e.target.value) })}
                    className="sku-input w-full"
                  />
                </div>
                <div className="p-3 bg-[#EAF0FE] rounded-[8px]">
                  <p className="text-[11px] text-[#1F57F5]">
                    <strong>Estimated total:</strong> {data.currency} {((data.dailyBudget || 50) * (data.duration || 30)).toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            {/* POLICY CHECK STEP */}
            {step === 'policy' && (
              <div className="space-y-4">
                <div
                  className={cn(
                    'sku-card p-4 border-l-4',
                    policyStatus.status === 'PASS'
                      ? 'border-l-[#2E9E5B] bg-[#E6F4EC]/30'
                      : policyStatus.status === 'WARN'
                        ? 'border-l-[#B8892B] bg-[#FBF0DA]/30'
                        : 'border-l-[#D3564C] bg-[#FBE7E5]/30'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {policyStatus.status === 'PASS' ? (
                        <CheckCircle2 size={20} className="text-[#2E9E5B]" />
                      ) : policyStatus.status === 'WARN' ? (
                        <AlertCircle size={20} className="text-[#B8892B]" />
                      ) : (
                        <AlertCircle size={20} className="text-[#D3564C]" />
                      )}
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold text-[#111827]">{policyStatus.status}</p>
                      <p className="text-[11px] text-[#6B7280] mt-0.5">{policyStatus.message}</p>
                      {policyStatus.flag && <p className="text-[10px] text-[#6B7280] mt-1 italic">Flagged: {policyStatus.flag}</p>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* PUBLISH STEP */}
            {step === 'publish' && (
              <div className="space-y-4">
                <div className="sku-card p-4 space-y-3">
                  <p className="text-[12px] font-semibold text-[#111827]">Campaign Summary</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-[#6B7280]">Goal:</span>
                      <span className="font-medium text-[#111827]">{data.goal}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-[#6B7280]">Keywords:</span>
                      <span className="font-medium text-[#111827]">{(data.keywords || []).filter((k) => !k.isNegative).length}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-[#6B7280]">Budget:</span>
                      <span className="font-medium text-[#111827]">
                        {data.currency} {((data.dailyBudget || 50) * (data.duration || 30)).toLocaleString()} ({data.duration} days)
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-[#6B7280]">Policy:</span>
                      <span
                        className={cn(
                          'font-medium',
                          policyStatus.status === 'PASS' ? 'text-[#2E9E5B]' : policyStatus.status === 'WARN' ? 'text-[#B8892B]' : 'text-[#D3564C]'
                        )}
                      >
                        {policyStatus.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex gap-2 mt-8">
              {stepIndex > 0 && (
                <button onClick={handlePrevStep} className="sku-btn flex-1 py-2.5 text-[12px] font-medium">
                  ← Back
                </button>
              )}
              {stepIndex < STEPS.length - 1 && (
                <button onClick={handleNextStep} className="sku-btn-primary flex-1 py-2.5 text-[12px] font-medium flex items-center justify-center gap-2">
                  Next <ChevronRight size={16} />
                </button>
              )}
              {stepIndex === STEPS.length - 1 && (
                <button
                  onClick={handlePublish}
                  disabled={launching || !!launched}
                  className="sku-btn-primary flex-1 py-2.5 text-[12px] font-medium disabled:opacity-70"
                >
                  {launching ? "Launching…" : launched ? "✓ Launched (paused)" : "🚀 Launch (starts paused)"}
                </button>
              )}
            </div>
            {launchError && (
              <div className="mt-3 p-3 rounded-[10px] border border-[#D3564C]/30 bg-[#FBE7E5]">
                <p className="text-[12px] font-medium text-[#D3564C]">{launchError}</p>
              </div>
            )}
            {launched && (
              <div className="mt-3 p-3 rounded-[10px] border border-[#2E9E5B]/30 bg-[#E6F4EC]">
                <p className="text-[12px] font-medium text-[#2E9E5B]">
                  Campaign published to Google Ads in paused state{launched.externalCampaignId ? ` (ID ${launched.externalCampaignId})` : ""}. Enable it from Ads Manager when ready.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SIDE: Live Google SERP Preview */}
        <div className="w-[300px] bg-white border-l border-[#DDE1E7] p-6 overflow-y-auto hidden lg:flex flex-col">
          <h3 className="text-[12px] font-semibold text-[#6B7280] mb-4 uppercase">Google Search Preview</h3>

          <div className="flex-1 space-y-4">
            {/* Sponsored label */}
            <div className="inline-block px-2 py-1 bg-[#E6F4EC] text-[#2E9E5B] text-[10px] font-bold rounded-[3px]">
              Sponsored
            </div>

            {/* Blue headline */}
            <h4 className="text-[14px] font-bold text-[#1F57F5] break-words leading-snug">
              {data.headline || 'Your ad headline will appear here'}
            </h4>

            {/* Green URL */}
            <p className="text-[13px] text-[#1F57F5] break-all">
              www.yoursite.com › {(data.keywords || [])[0]?.keyword || 'campaign'}
            </p>

            {/* Grey description */}
            <p className="text-[13px] text-[#6B7280] leading-snug break-words">
              {data.description || 'Your ad description will appear here'}
            </p>

            {/* Character count indicators */}
            <div className="mt-4 pt-4 border-t border-[#DDE1E7] space-y-2">
              <div className="text-[10px]">
                <div className="flex justify-between mb-1">
                  <span className="text-[#6B7280]">Headline length</span>
                  <span className={cn('font-medium', headlineChars > 30 ? 'text-[#D3564C]' : 'text-[#2E9E5B]')}>
                    {headlineChars}/30
                  </span>
                </div>
                <div className="h-1 bg-[#DDE1E7] rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full transition-all',
                      headlineChars > 30 ? 'bg-[#D3564C]' : headlineChars > 25 ? 'bg-[#B8892B]' : 'bg-[#2E9E5B]'
                    )}
                    style={{ width: `${Math.min((headlineChars / 30) * 100, 100)}%` }}
                  />
                </div>
              </div>
              <div className="text-[10px]">
                <div className="flex justify-between mb-1">
                  <span className="text-[#6B7280]">Description length</span>
                  <span className={cn('font-medium', descChars > 90 ? 'text-[#D3564C]' : 'text-[#2E9E5B]')}>
                    {descChars}/90
                  </span>
                </div>
                <div className="h-1 bg-[#DDE1E7] rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full transition-all',
                      descChars > 90 ? 'bg-[#D3564C]' : descChars > 75 ? 'bg-[#B8892B]' : 'bg-[#2E9E5B]'
                    )}
                    style={{ width: `${Math.min((descChars / 90) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Keyword summary */}
            <div className="mt-4 pt-4 border-t border-[#DDE1E7]">
              <p className="text-[10px] font-semibold text-[#6B7280] mb-2">Keywords ({(data.keywords || []).filter((k) => !k.isNegative).length})</p>
              <div className="space-y-1">
                {(data.keywords || [])
                  .filter((k) => !k.isNegative)
                  .slice(0, 5)
                  .map((k, idx) => (
                    <p key={idx} className="text-[10px] text-[#374151] truncate">
                      • {k.keyword} <span className="text-[#9CA3AF]">({k.type})</span>
                    </p>
                  ))}
                {(data.keywords || []).filter((k) => !k.isNegative).length > 5 && (
                  <p className="text-[10px] text-[#9CA3AF] italic">+ {(data.keywords || []).filter((k) => !k.isNegative).length - 5} more</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  )
}
