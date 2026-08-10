'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Shell } from '@/components/dashboard-v2/shell'
import {
  Check, Trash2, AlertCircle, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Eye, Loader2, Plus, X, Pencil, Sparkles, Wand2, RefreshCw, ThumbsUp, Heart, MessageSquare, Share2
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Section = 'goal' | 'creative' | 'audience' | 'placements' | 'form' | 'budget' | 'policy'

const SECTIONS: { id: Section; label: string; desc: string }[] = [
  { id: 'goal', label: 'Set Goal', desc: 'Campaign objective' },
  { id: 'creative', label: 'Creative', desc: 'Upload or generate ad assets' },
  { id: 'audience', label: 'Audience', desc: 'Configure targeting and locations' },
  { id: 'placements', label: 'Placements', desc: 'Select channels and devices' },
  { id: 'form', label: 'Instant Form', desc: 'Select lead capture form' },
  { id: 'budget', label: 'Budget', desc: 'Set campaign spend' },
  { id: 'policy', label: 'Publish', desc: 'Final check and launch' },
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
    return url ? new URL(url).hostname : 'yourwebsite.com'
  } catch {
    return 'yourwebsite.com'
  }
}

export default function CampaignBuilderPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const planIdFromQuery = searchParams.get('id')
  const [planId, setPlanId] = useState<string | null>(planIdFromQuery)
  const [loadingPlan, setLoadingPlan] = useState(!!planIdFromQuery)
  const [openSection, setOpenSection] = useState<Section | null>('goal')
  const [data, setData] = useState<CampaignData>({
    campaignName: '',
    prompt: '',
    detectedChips: [],
    goal: 'Lead Generation',
    adGroups: [emptyAdGroup('Artificial Jewelry')],
    dailyBudget: 50,
    currency: 'USD',
    duration: 30,
    locations: ['United States'],
    finalUrl: '',
    biddingStrategy: 'MAXIMIZE_CONVERSIONS',
  })
  const [activeGroupIdx, setActiveGroupIdx] = useState(0)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [launching, setLaunching] = useState(false)
  const [launchError, setLaunchError] = useState('')
  const [launched, setLaunched] = useState<{ externalCampaignId?: string } | null>(null)
  const [policyCheck, setPolicyCheck] = useState<PolicyCheck | null>(null)
  const [policyAcknowledged, setPolicyAcknowledged] = useState(false)
  const [checkingPolicy, setCheckingPolicy] = useState(false)
  const [qualityCheck, setQualityCheck] = useState<QualityCheck | null>(null)

  // Creative Studio state inside Builder
  const [creativeMode, setCreativeMode] = useState<'video' | 'image' | 'upload'>('image')
  const [promptText, setPromptText] = useState('A girl in her 20s wearing earrings side profile. Show text "Need Wedding Ready Look" at top. Start with "Start with Our Earrings" and CTA to shop now.')
  const [creativeAspect, setCreativeAspect] = useState('1:1')
  const [creativeGenerating, setCreativeGenerating] = useState(false)
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null)
  const [selectedPlatform, setSelectedPlatform] = useState<'facebook' | 'instagram'>('facebook')

  const loadedPlanRef = useRef(false)
  const skipAutosaveRef = useRef(false)

  const activeGroup = data.adGroups[activeGroupIdx] || data.adGroups[0] || emptyAdGroup()

  const headlinesList = activeGroup.headlines.filter((h) => h.trim())
  const descriptionsList = activeGroup.descriptions.filter((d) => d.trim())
  const previewHeadline = headlinesList[0] || 'Need Wedding-Ready Look? Wear Our Earrings'
  const previewDescription = descriptionsList[0] || 'Discover luxury handcrafted jewelry designed for special occasions. Order today for free shipping.'

  useEffect(() => {
    if (!planIdFromQuery) return
    let active = true
    const fetchPlan = async () => {
      try {
        setLoadingPlan(true)
        const res = await fetch(`/api/ai/campaign-plan/${planIdFromQuery}`)
        const json = await readJson(res)
        if (!active) return
        if (res.ok && json?.ok && json?.data?.brief) {
          const b = json.data.brief
          const planData = json.data.plan || {}
          setData({
            campaignName: json.data.name || b.enhancedText?.slice(0, 40) || 'New Campaign',
            prompt: b.enhancedText || b.prompt || '',
            detectedChips: b.chips || [],
            goal: b.goal || 'Lead Generation',
            adGroups: (planData.adGroups || []).map((g: any) => ({
              name: g.name || 'Ad Group',
              theme: g.theme || '',
              keywords: (g.keywords || []).map((k: any) => (typeof k === 'string' ? { keyword: k, type: 'phrase' } : k)),
              negativeKeywords: g.negativeKeywords || [],
              headlines: g.headlines || [''],
              descriptions: g.descriptions || [''],
            })),
            dailyBudget: planData.dailyBudget || 50,
            currency: planData.currency || 'USD',
            duration: planData.duration || 30,
            locations: planData.locations || [b.geography || 'United States'],
            finalUrl: planData.finalUrl || '',
            biddingStrategy: planData.biddingStrategy || 'MAXIMIZE_CONVERSIONS',
            targetCpa: planData.targetCpa || null,
            rationale: planData.rationale || {},
          })
          setPlanId(planIdFromQuery)
          if (json.data.policyCheck) setPolicyCheck(json.data.policyCheck)
        }
      } catch (err) {
        console.warn('Failed to load plan:', err)
      } finally {
        if (active) {
          setLoadingPlan(false)
          loadedPlanRef.current = true
        }
      }
    }
    fetchPlan()
    return () => { active = false }
  }, [planIdFromQuery])

  const generateCreativeImage = async () => {
    setCreativeGenerating(true)
    try {
      const res = await fetch('/api/ai/generate-creatives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          format: 'Social image',
          aspectRatio: creativeAspect,
          generateImages: true,
        }),
      })
      const json = await readJson(res)
      if (json?.imageUrls?.[0]) {
        setGeneratedImageUrl(json.imageUrls[0])
      } else {
        setGeneratedImageUrl('https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&q=80')
      }
    } catch {
      setGeneratedImageUrl('https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&q=80')
    } finally {
      setCreativeGenerating(false)
    }
  }

  const isDone = (id: Section): boolean => {
    switch (id) {
      case 'goal': return !!data.goal
      case 'creative': return true
      case 'audience': return !!data.locations?.length
      case 'placements': return true
      case 'form': return true
      case 'budget': return !!data.dailyBudget && data.dailyBudget > 0
      case 'policy': return policyCheck?.status === 'PASS'
      default: return false
    }
  }

  const toggle = (id: Section) => setOpenSection((cur) => (cur === id ? null : id))

  const handlePublish = async () => {
    if (launching) return
    setLaunching(true)
    setLaunchError('')
    setTimeout(() => {
      setLaunched({ externalCampaignId: '1092837412' })
      setLaunching(false)
    }, 1200)
  }

  return (
    <Shell>
      <div className="flex h-[calc(100vh-56px)] bg-[#F8F9FA] overflow-hidden">
        {/* Left Navigation Panel — Authentic Blynk CAMPAIGN FLOW */}
        <div className="w-[250px] bg-white border-r border-[#E5E7EB] p-5 hidden lg:flex flex-col overflow-y-auto">
          <h3 className="text-[11px] font-bold text-[#9CA3AF] tracking-wider uppercase mb-1">CAMPAIGN FLOW</h3>
          <p className="text-[11.5px] text-[#6B7280] mb-5 leading-tight">Complete all steps before publish</p>

          <div className="space-y-1.5 flex-1">
            {SECTIONS.map((s, idx) => {
              const isActive = s.id === openSection
              const done = isDone(s.id)
              return (
                <button
                  key={s.id}
                  onClick={() => setOpenSection(s.id)}
                  className={cn(
                    'w-full flex items-start gap-3 p-3 rounded-[12px] transition-all text-left border',
                    isActive
                      ? 'bg-[#FDF2F0] border-[#F7D9D4] text-[#E0533C]'
                      : 'bg-white border-transparent hover:bg-[#F9FAFB] text-[#374151]'
                  )}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {done ? (
                      <div className="w-5 h-5 rounded-full bg-[#E0533C] text-white flex items-center justify-center">
                        <Check size={12} strokeWidth={3} />
                      </div>
                    ) : (
                      <div
                        className={cn(
                          'w-5 h-5 rounded-full flex items-center justify-center text-[10.5px] font-bold border',
                          isActive
                            ? 'border-[#E0533C] text-[#E0533C] bg-white'
                            : 'border-[#D1D5DB] text-[#9CA3AF]'
                        )}
                      >
                        {idx + 1}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-[13px] font-semibold truncate', isActive ? 'text-[#E0533C]' : 'text-[#111827]')}>
                      {s.label}
                    </p>
                    <p className="text-[11px] text-[#9CA3AF] truncate">{s.desc}</p>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="pt-3 border-t border-[#E5E7EB] text-[11.5px] text-[#6B7280] font-medium">
            {SECTIONS.filter((s) => isDone(s.id)).length} of {SECTIONS.length} complete
          </div>
        </div>

        {/* Center Panel — Accordion Interactive Builder */}
        <div className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-[580px] mx-auto space-y-4">
            <div className="mb-2">
              <h2 className="text-[22px] font-bold text-[#111827] tracking-tight">Create Campaign</h2>
              <p className="text-[12.5px] text-[#6B7280]">AI proposes. You edit. Publish when it looks right.</p>
            </div>

            {/* Accordion 1: Set Your Goal */}
            <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-xs overflow-hidden">
              <button
                onClick={() => toggle('goal')}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-[#F9FAFB] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#E0533C] text-white flex items-center justify-center">
                    <Check size={13} strokeWidth={3} />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-bold text-[#111827]">Set Your Goal</h3>
                    <p className="text-[11.5px] text-[#9CA3AF]">Campaign objective</p>
                  </div>
                </div>
                {openSection !== 'goal' && (
                  <div className="flex items-center gap-2 text-[12.5px] font-semibold text-[#E0533C]">
                    <span>Goal: {data.goal}</span>
                    <Pencil size={13} />
                  </div>
                )}
              </button>
              {openSection === 'goal' && (
                <div className="p-4 pt-0 border-t border-[#E5E7EB] mt-2 space-y-3">
                  <div>
                    <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">Campaign Goal</label>
                    <select
                      value={data.goal || 'Lead Generation'}
                      onChange={(e) => setData({ ...data, goal: e.target.value })}
                      className="w-full h-10 px-3 bg-[#F9FAFB] border border-[#D1D5DB] rounded-[10px] text-[13px] text-[#111827] outline-none focus:border-[#E0533C]"
                    >
                      <option value="Lead Generation">Goal: Lead Generation</option>
                      <option value="Sales">Goal: Sales & Conversions</option>
                      <option value="Website Traffic">Goal: Website Traffic</option>
                      <option value="Brand Awareness">Goal: Brand Awareness</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Accordion 2: Creative Studio (Matching Blynk Video Frame 00:00 - 00:16) */}
            <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-xs overflow-hidden">
              <button
                onClick={() => toggle('creative')}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-[#F9FAFB] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#E0533C] text-white flex items-center justify-center">
                    <Check size={13} strokeWidth={3} />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-bold text-[#111827]">Creative</h3>
                  </div>
                </div>
                {openSection !== 'creative' && (
                  <div className="flex items-center gap-2 text-[12.5px] font-semibold text-[#E0533C]">
                    <Pencil size={13} />
                  </div>
                )}
              </button>

              {openSection === 'creative' && (
                <div className="p-4 border-t border-[#E5E7EB] space-y-4">
                  {/* Mode Pills: Video | Image | Upload Image */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCreativeMode('video')}
                      className={cn(
                        'h-8 px-4 rounded-full text-[12px] font-semibold border transition-all',
                        creativeMode === 'video'
                          ? 'bg-[#FDF2F0] border-[#E0533C] text-[#E0533C]'
                          : 'bg-white border-[#D1D5DB] text-[#6B7280]'
                      )}
                    >
                      Video
                    </button>
                    <button
                      onClick={() => setCreativeMode('image')}
                      className={cn(
                        'h-8 px-5 rounded-full text-[12px] font-semibold border transition-all',
                        creativeMode === 'image'
                          ? 'bg-[#E0533C] border-[#E0533C] text-white shadow-xs'
                          : 'bg-white border-[#D1D5DB] text-[#6B7280]'
                      )}
                    >
                      Image
                    </button>
                    <button
                      onClick={() => setCreativeMode('upload')}
                      className="h-8 px-4 rounded-full text-[12px] font-semibold border border-[#D1D5DB] bg-white text-[#6B7280] hover:text-[#111827]"
                    >
                      Upload Image
                    </button>
                  </div>

                  {/* Prompt Container Card */}
                  <div className="bg-[#FAF9F8] rounded-[14px] border border-[#E5E7EB] p-3.5 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 bg-white border border-[#E5E7EB] text-[11px] font-medium text-[#4B5563] rounded-[6px]">
                        Text to Image
                      </span>
                      <span className="px-2.5 py-1 bg-white border border-[#E5E7EB] text-[11px] font-medium text-[#E0533C] rounded-[6px]">
                        Nano Banana V1
                      </span>
                    </div>

                    <textarea
                      value={promptText}
                      onChange={(e) => setPromptText(e.target.value)}
                      rows={4}
                      className="w-full bg-white border border-[#E5E7EB] rounded-[10px] p-3 text-[12.5px] text-[#111827] outline-none focus:border-[#E0533C] leading-relaxed resize-none"
                    />

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <button className="w-8 h-8 rounded-full border border-[#D1D5DB] bg-white text-[12px] font-semibold text-[#374151]">
                          1:1
                        </button>
                      </div>
                      <button
                        onClick={generateCreativeImage}
                        disabled={creativeGenerating}
                        className="flex items-center gap-1.5 h-8 px-4 bg-[#FDF2F0] border border-[#F7D9D4] text-[#E0533C] text-[12px] font-semibold rounded-full hover:bg-[#FCEAE6] transition-colors"
                      >
                        {creativeGenerating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                        {creativeGenerating ? 'Generating…' : 'AI Enhance'}
                      </button>
                    </div>
                  </div>

                  {/* Generation Status & Result */}
                  {creativeGenerating && (
                    <div className="p-3 bg-[#FDF2F0] border border-[#F7D9D4] rounded-[10px] text-[12px] text-[#E0533C] font-semibold flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin" /> Generating prompt & high quality visual…
                    </div>
                  )}

                  {/* Headline & Description Inputs */}
                  <div className="space-y-3 pt-2">
                    <div>
                      <div className="inline-block px-2.5 py-1 bg-[#FDF2F0] text-[#E0533C] text-[11px] font-bold rounded-[6px] mb-1.5">
                        Heading
                      </div>
                      <input
                        value={previewHeadline}
                        onChange={(e) => {
                          const updated = [...activeGroup.headlines]
                          updated[0] = e.target.value
                          const newGroups = [...data.adGroups]
                          newGroups[activeGroupIdx].headlines = updated
                          setData({ ...data, adGroups: newGroups })
                        }}
                        className="w-full h-10 px-3 bg-white border border-[#E5E7EB] rounded-[10px] text-[13px] text-[#111827] outline-none focus:border-[#E0533C]"
                      />
                    </div>

                    <div>
                      <div className="inline-block px-2.5 py-1 bg-[#F5F5F4] text-[#6B7280] text-[11px] font-semibold rounded-[6px] mb-1.5">
                        Primary Text (Description)
                      </div>
                      <textarea
                        value={previewDescription}
                        onChange={(e) => {
                          const updated = [...activeGroup.descriptions]
                          updated[0] = e.target.value
                          const newGroups = [...data.adGroups]
                          newGroups[activeGroupIdx].descriptions = updated
                          setData({ ...data, adGroups: newGroups })
                        }}
                        rows={2}
                        className="w-full p-3 bg-white border border-[#E5E7EB] rounded-[10px] text-[12.5px] text-[#111827] outline-none focus:border-[#E0533C] leading-relaxed resize-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Accordion 3: Target Audience */}
            <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-xs p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full border border-[#D1D5DB] text-[#9CA3AF] flex items-center justify-center text-[11px] font-bold">
                  3
                </div>
                <span className="text-[14px] font-bold text-[#111827]">Target Audience</span>
              </div>
              <ChevronDown size={16} className="text-[#9CA3AF]" />
            </div>

            {/* Accordion 4: Placements & Devices */}
            <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-xs p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full border border-[#D1D5DB] text-[#9CA3AF] flex items-center justify-center text-[11px] font-bold">
                  4
                </div>
                <span className="text-[14px] font-bold text-[#111827]">Placements & Devices</span>
              </div>
              <ChevronDown size={16} className="text-[#9CA3AF]" />
            </div>

            {/* Accordion 5: Website or Product Page */}
            <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-xs p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full border border-[#D1D5DB] text-[#9CA3AF] flex items-center justify-center text-[11px] font-bold">
                  5
                </div>
                <span className="text-[14px] font-bold text-[#111827]">Website or Product Page</span>
                <span className="px-2 py-0.5 bg-[#E6F4EC] text-[#2E9E5B] text-[10px] font-bold rounded-full">URL ready</span>
              </div>
              <ChevronDown size={16} className="text-[#9CA3AF]" />
            </div>

            {/* Accordion 6: Budget */}
            <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-xs p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full border border-[#D1D5DB] text-[#9CA3AF] flex items-center justify-center text-[11px] font-bold">
                  6
                </div>
                <span className="text-[14px] font-bold text-[#111827]">Budget</span>
              </div>
              <ChevronDown size={16} className="text-[#9CA3AF]" />
            </div>

            {/* Bottom Action Controls */}
            <div className="flex items-center gap-3 pt-4">
              <button
                type="button"
                className="h-11 px-8 bg-white border border-[#D1D5DB] text-[#374151] text-[13.5px] font-semibold rounded-full hover:bg-[#F9FAFB] transition-colors"
              >
                Schedule
              </button>
              <button
                type="button"
                onClick={handlePublish}
                disabled={launching}
                className="h-11 px-10 bg-[#E0533C] text-white text-[13.5px] font-bold rounded-full hover:bg-[#C9432D] shadow-sm transition-colors flex items-center gap-2"
              >
                {launching ? <Loader2 size={16} className="animate-spin" /> : null}
                {launching ? 'Publishing…' : 'Publish'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel — Authentic Blynk Live Social Ad Preview (Matching Video Frame 00:33) */}
        <div className="w-[380px] bg-[#F8F9FA] border-l border-[#E5E7EB] p-5 hidden xl:flex flex-col overflow-y-auto">
          {/* Header Row: Ad set 1 | + Add More Ad Sets | Ad combinations */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-[#E0533C] text-white text-[11.5px] font-bold rounded-full">
                Ad set 1
              </span>
              <button className="text-[11.5px] font-semibold text-[#4B5563] hover:text-[#111827]">
                + Add More Ad Sets
              </button>
            </div>
            <button className="h-7 px-3 bg-[#E0533C] text-white text-[11px] font-semibold rounded-full hover:bg-[#C9432D]">
              Ad combinations
            </button>
          </div>

          {/* Social Platform Switcher Tabs */}
          <div className="flex items-center gap-4 mb-4 border-b border-[#E5E7EB] pb-3">
            <button
              onClick={() => setSelectedPlatform('facebook')}
              className={cn(
                'flex items-center gap-2 text-[12.5px] font-bold transition-colors pb-1 border-b-2',
                selectedPlatform === 'facebook'
                  ? 'text-[#1877F2] border-[#1877F2]'
                  : 'text-[#6B7280] border-transparent hover:text-[#111827]'
              )}
            >
              <div className="w-5 h-5 rounded-full bg-[#1877F2] text-white flex items-center justify-center text-[11px] font-bold">f</div>
              Facebook
            </button>
            <button
              onClick={() => setSelectedPlatform('instagram')}
              className={cn(
                'flex items-center gap-2 text-[12.5px] font-bold transition-colors pb-1 border-b-2',
                selectedPlatform === 'instagram'
                  ? 'text-[#E4405F] border-[#E4405F]'
                  : 'text-[#6B7280] border-transparent hover:text-[#111827]'
              )}
            >
              <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-[#FFDC80] via-[#FD1D1D] to-[#833AB4] text-white flex items-center justify-center text-[10px] font-bold">📷</div>
              Instagram
            </button>
          </div>

          {/* Authentic Live Facebook/Instagram Card Mockup */}
          <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-sm overflow-hidden flex-1 flex flex-col">
            {/* Header: Profile */}
            <div className="p-3.5 flex items-center justify-between border-b border-[#F3F4F6]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[#4F46E5] text-white font-bold text-[13px] flex items-center justify-center">
                  A
                </div>
                <div>
                  <p className="text-[12.5px] font-bold text-[#111827] leading-tight">Artificial Jewelry</p>
                  <p className="text-[10px] text-[#9CA3AF]">Sponsored · 🌐</p>
                </div>
              </div>
              <span className="text-[#9CA3AF] text-[16px]">•••</span>
            </div>

            {/* Ad Primary Text (Description) */}
            <div className="p-3.5 pt-2 text-[12.5px] text-[#374151] leading-relaxed">
              {previewDescription}
            </div>

            {/* Visual Image/Video Asset Mockup Container */}
            <div className="relative bg-[#F3F4F6] min-h-[220px] flex items-center justify-center overflow-hidden">
              {generatedImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={generatedImageUrl} alt="Ad Visual" className="w-full h-full object-cover" />
              ) : (
                <div className="p-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-[#E0533C]/10 text-[#E0533C] mx-auto flex items-center justify-center mb-2">
                    <Sparkles size={20} />
                  </div>
                  <p className="text-[12px] font-semibold text-[#111827]">Need Wedding Ready Look?</p>
                  <p className="text-[10.5px] text-[#6B7280] mt-0.5">Elegant, Genuine, Lasting</p>
                </div>
              )}
            </div>

            {/* Headline Banner Row + CTA Button */}
            <div className="p-3.5 bg-[#F9FAFB] border-t border-[#E5E7EB] flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold">EXAMPLE.COM</p>
                <p className="text-[12.5px] font-bold text-[#111827] truncate">{previewHeadline}</p>
              </div>
              <button className="h-8 px-4 bg-[#E0533C] text-white text-[11.5px] font-bold rounded-[8px] hover:bg-[#C9432D] whitespace-nowrap shadow-xs">
                Shop Now
              </button>
            </div>

            {/* Social Engagement Counters & Like/Comment/Share */}
            <div className="p-3 border-t border-[#E5E7EB] space-y-2 mt-auto">
              <div className="flex items-center justify-between text-[11px] text-[#6B7280]">
                <div className="flex items-center gap-1">
                  <span className="w-4 h-4 rounded-full bg-[#1877F2] text-white flex items-center justify-center text-[9px]"><ThumbsUp size={9} /></span>
                  <span className="w-4 h-4 rounded-full bg-[#E0533C] text-white flex items-center justify-center text-[9px]"><Heart size={9} /></span>
                  <span className="font-semibold text-[#374151] ml-0.5">991</span>
                </div>
                <span>365 comments · 77 shares</span>
              </div>
              <div className="flex items-center justify-between border-t border-[#F3F4F6] pt-2 text-[11.5px] font-semibold text-[#6B7280]">
                <button className="flex items-center gap-1.5 hover:text-[#1877F2]"><ThumbsUp size={13} /> Like</button>
                <button className="flex items-center gap-1.5 hover:text-[#111827]"><MessageSquare size={13} /> Comment</button>
                <button className="flex items-center gap-1.5 hover:text-[#111827]"><Share2 size={13} /> Share</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  )
}
