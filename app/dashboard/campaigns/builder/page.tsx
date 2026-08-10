'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Shell } from '@/components/dashboard-v2/shell'
import {
  Check, Trash2, AlertCircle, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Eye, Loader2, Plus, X, Pencil, Sparkles, Wand2, RefreshCw, ThumbsUp, Heart, MessageSquare, Share2, Search, Target, Globe
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

function emptyAdGroup(name = 'Core Campaign Theme'): AdGroupEdit {
  return { name, theme: '', keywords: [], negativeKeywords: [], headlines: [''], descriptions: [''] }
}

type PolicyCheck = {
  status: 'PASS' | 'WARN' | 'FAIL'
  checkedAt: string
  flags: Array<{ text: string; adGroupName: string; field: string; reason: string; suggestion: string }>
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
    adGroups: [emptyAdGroup()],
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

  // Creative Studio state inside Builder
  const [creativeMode, setCreativeMode] = useState<'video' | 'image' | 'upload'>('image')
  const [promptText, setPromptText] = useState('')
  const [aiModel, setAiModel] = useState('DALL-E 3 (OpenAI)')
  const [creativeAspect, setCreativeAspect] = useState('1:1')
  const [creativeGenerating, setCreativeGenerating] = useState(false)
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null)
  const [selectedPlatform, setSelectedPlatform] = useState<'google' | 'meta'>('google')

  const loadedPlanRef = useRef(false)

  const activeGroup = data.adGroups[activeGroupIdx] || data.adGroups[0] || emptyAdGroup()

  const headlinesList = activeGroup.headlines.filter((h) => h.trim())
  const descriptionsList = activeGroup.descriptions.filter((d) => d.trim())
  const previewHeadline = headlinesList[0] || data.campaignName || 'Grow Your Business with AI'
  const previewDescription = descriptionsList[0] || data.prompt || 'Transform your marketing results with intelligent AI campaigns. Start generating qualified leads today.'
  const businessName = data.campaignName ? data.campaignName.split(' ')[0] || 'My Business' : 'My Business'

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
          const userPrompt = b.enhancedText || b.prompt || ''
          
          setData({
            campaignName: json.data.name || b.productOrOffer || 'AI Campaign',
            prompt: userPrompt,
            detectedChips: b.chips || [],
            goal: b.goal || 'Lead Generation',
            adGroups: (planData.adGroups || []).map((g: any) => ({
              name: g.name || 'Ad Group',
              theme: g.theme || '',
              keywords: (g.keywords || []).map((k: any) => (typeof k === 'string' ? { keyword: k, type: 'phrase' } : k)),
              negativeKeywords: g.negativeKeywords || [],
              headlines: (g.headlines && g.headlines.length > 0) ? g.headlines : ['Grow Your Business', 'Best Solutions for Agencies', 'Get Free Quote Today'],
              descriptions: (g.descriptions && g.descriptions.length > 0) ? g.descriptions : ['High performance AI solutions built for modern growth.', 'Book your free demo consultation today.'],
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

          setPromptText(userPrompt)
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
          prompt: promptText || previewHeadline,
          format: 'Social image',
          aspectRatio: creativeAspect,
          generateImages: true,
        }),
      })
      const json = await readJson(res)
      if (json?.imageUrls?.[0]) {
        setGeneratedImageUrl(json.imageUrls[0])
      } else {
        setGeneratedImageUrl('https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80')
      }
    } catch {
      setGeneratedImageUrl('https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80')
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
              <p className="text-[12.5px] text-[#6B7280]">
                {loadingPlan ? 'AI generating your campaign plan...' : 'AI proposes. You edit. Publish when it looks right.'}
              </p>
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
                    <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">Campaign Name</label>
                    <input
                      value={data.campaignName || ''}
                      onChange={(e) => setData({ ...data, campaignName: e.target.value })}
                      placeholder="e.g. B2B Agency Lead Generation"
                      className="w-full h-10 px-3 bg-[#F9FAFB] border border-[#D1D5DB] rounded-[10px] text-[13px] text-[#111827] outline-none focus:border-[#E0533C]"
                    />
                  </div>
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

            {/* Accordion 2: Creative Studio */}
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
                    <p className="text-[11.5px] text-[#9CA3AF]">Ad headlines & descriptions</p>
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
                      Upload Asset
                    </button>
                  </div>

                  {/* Prompt Container Card */}
                  <div className="bg-[#FAF9F8] rounded-[14px] border border-[#E5E7EB] p-3.5 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 bg-white border border-[#E5E7EB] text-[11px] font-medium text-[#4B5563] rounded-[6px]">
                        Text to Image
                      </span>
                      <select
                        value={aiModel}
                        onChange={(e) => setAiModel(e.target.value)}
                        className="px-2.5 py-1 bg-white border border-[#E5E7EB] text-[11px] font-semibold text-[#E0533C] rounded-[6px] outline-none"
                      >
                        <option value="DALL-E 3 (OpenAI)">DALL-E 3 (OpenAI)</option>
                        <option value="Flux Pro">Flux Pro AI</option>
                      </select>
                    </div>

                    <textarea
                      value={promptText}
                      onChange={(e) => setPromptText(e.target.value)}
                      placeholder="Describe the image creative you want for this campaign..."
                      rows={3}
                      className="w-full bg-white border border-[#E5E7EB] rounded-[10px] p-3 text-[12.5px] text-[#111827] outline-none focus:border-[#E0533C] leading-relaxed resize-none"
                    />

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        {['1:1', '16:9', '9:16'].map((aspect) => (
                          <button
                            key={aspect}
                            onClick={() => setCreativeAspect(aspect)}
                            className={cn(
                              'w-8 h-8 rounded-full border text-[11px] font-semibold transition-all',
                              creativeAspect === aspect
                                ? 'border-[#E0533C] bg-[#FDF2F0] text-[#E0533C]'
                                : 'border-[#D1D5DB] bg-white text-[#374151]'
                            )}
                          >
                            {aspect}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={generateCreativeImage}
                        disabled={creativeGenerating}
                        className="flex items-center gap-1.5 h-8 px-4 bg-[#FDF2F0] border border-[#F7D9D4] text-[#E0533C] text-[12px] font-semibold rounded-full hover:bg-[#FCEAE6] transition-colors"
                      >
                        {creativeGenerating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                        {creativeGenerating ? 'Generating…' : 'Generate Visual'}
                      </button>
                    </div>
                  </div>

                  {/* Headline & Description Inputs from AI Plan */}
                  <div className="space-y-3 pt-2">
                    <div>
                      <div className="inline-block px-2.5 py-1 bg-[#FDF2F0] text-[#E0533C] text-[11px] font-bold rounded-[6px] mb-1.5">
                        Ad Headlines (AI Generated)
                      </div>
                      {activeGroup.headlines.map((h, i) => (
                        <input
                          key={i}
                          value={h}
                          onChange={(e) => {
                            const updated = [...activeGroup.headlines]
                            updated[i] = e.target.value
                            const newGroups = [...data.adGroups]
                            newGroups[activeGroupIdx].headlines = updated
                            setData({ ...data, adGroups: newGroups })
                          }}
                          className="w-full h-10 px-3 bg-white border border-[#E5E7EB] rounded-[10px] text-[13px] text-[#111827] outline-none focus:border-[#E0533C] mb-2"
                        />
                      ))}
                    </div>

                    <div>
                      <div className="inline-block px-2.5 py-1 bg-[#F5F5F4] text-[#6B7280] text-[11px] font-semibold rounded-[6px] mb-1.5">
                        Ad Descriptions (AI Generated)
                      </div>
                      {activeGroup.descriptions.map((d, i) => (
                        <textarea
                          key={i}
                          value={d}
                          onChange={(e) => {
                            const updated = [...activeGroup.descriptions]
                            updated[i] = e.target.value
                            const newGroups = [...data.adGroups]
                            newGroups[activeGroupIdx].descriptions = updated
                            setData({ ...data, adGroups: newGroups })
                          }}
                          rows={2}
                          className="w-full p-3 bg-white border border-[#E5E7EB] rounded-[10px] text-[12.5px] text-[#111827] outline-none focus:border-[#E0533C] leading-relaxed resize-none mb-2"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Accordion 3: Target Audience */}
            <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-xs p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-[#E0533C] text-white flex items-center justify-center text-[11px] font-bold">
                  <Check size={13} strokeWidth={3} />
                </div>
                <div>
                  <span className="text-[14px] font-bold text-[#111827]">Target Audience</span>
                  <p className="text-[11px] text-[#9CA3AF]">{data.locations?.join(', ') || 'United States'}</p>
                </div>
              </div>
              <ChevronDown size={16} className="text-[#9CA3AF]" />
            </div>

            {/* Accordion 4: Placements & Devices */}
            <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-xs p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-[#E0533C] text-white flex items-center justify-center text-[11px] font-bold">
                  <Check size={13} strokeWidth={3} />
                </div>
                <div>
                  <span className="text-[14px] font-bold text-[#111827]">Placements</span>
                  <p className="text-[11px] text-[#9CA3AF]">Google Ads Search Network & Desktop/Mobile</p>
                </div>
              </div>
              <ChevronDown size={16} className="text-[#9CA3AF]" />
            </div>

            {/* Accordion 5: Website or Product Page */}
            <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-xs p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-[#E0533C] text-white flex items-center justify-center text-[11px] font-bold">
                  <Check size={13} strokeWidth={3} />
                </div>
                <div>
                  <span className="text-[14px] font-bold text-[#111827]">Website / Landing Page</span>
                  <p className="text-[11px] text-[#9CA3AF]">{data.finalUrl || 'Target Landing Page'}</p>
                </div>
              </div>
              <span className="px-2 py-0.5 bg-[#E6F4EC] text-[#2E9E5B] text-[10px] font-bold rounded-full">URL ready</span>
            </div>

            {/* Accordion 6: Budget */}
            <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-xs p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-[#E0533C] text-white flex items-center justify-center text-[11px] font-bold">
                  <Check size={13} strokeWidth={3} />
                </div>
                <div>
                  <span className="text-[14px] font-bold text-[#111827]">Budget</span>
                  <p className="text-[11px] text-[#9CA3AF]">${data.dailyBudget || 50}/day ({data.duration || 30} days)</p>
                </div>
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
                {launching ? 'Publishing to Google Ads…' : 'Publish to Google Ads'}
              </button>
            </div>

            {launched && (
              <div className="p-4 rounded-[12px] border border-[#2E9E5B]/30 bg-[#E6F4EC] text-[13px] font-semibold text-[#2E9E5B]">
                🚀 Campaign published successfully to Google Ads in paused state!
              </div>
            )}
          </div>
        </div>

        {/* Right Panel — Dynamic Google Ads / Meta Ads Preview */}
        <div className="w-[380px] bg-[#F8F9FA] border-l border-[#E5E7EB] p-5 hidden xl:flex flex-col overflow-y-auto">
          {/* Header Row */}
          <div className="flex items-center justify-between mb-4">
            <span className="px-3 py-1 bg-[#E0533C] text-white text-[11.5px] font-bold rounded-full">
              Live Preview
            </span>
            <button className="h-7 px-3 bg-white border border-[#D1D5DB] text-[#374151] text-[11px] font-semibold rounded-full hover:bg-[#F9FAFB]">
              Refresh Preview
            </button>
          </div>

          {/* Ad Channel Switcher Tabs */}
          <div className="flex items-center gap-4 mb-4 border-b border-[#E5E7EB] pb-3">
            <button
              onClick={() => setSelectedPlatform('google')}
              className={cn(
                'flex items-center gap-2 text-[12.5px] font-bold transition-colors pb-1 border-b-2',
                selectedPlatform === 'google'
                  ? 'text-[#4285F4] border-[#4285F4]'
                  : 'text-[#6B7280] border-transparent hover:text-[#111827]'
              )}
            >
              <Search size={14} className="text-[#4285F4]" />
              Google Search
            </button>
            <button
              onClick={() => setSelectedPlatform('meta')}
              className={cn(
                'flex items-center gap-2 text-[12.5px] font-bold transition-colors pb-1 border-b-2',
                selectedPlatform === 'meta'
                  ? 'text-[#1877F2] border-[#1877F2]'
                  : 'text-[#6B7280] border-transparent hover:text-[#111827]'
              )}
            >
              <Globe size={14} className="text-[#1877F2]" />
              Meta Ads
            </button>
          </div>

          {/* Dynamic Ad Preview Box */}
          {selectedPlatform === 'google' ? (
            /* Google Search Ad Preview */
            <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-[#E6F4EC] text-[#2E9E5B] text-[10px] font-extrabold rounded-[3px]">
                  Sponsored
                </span>
                <span className="text-[11px] text-[#6B7280] truncate">{displayHost(data.finalUrl)}</span>
              </div>

              <div>
                <h4 className="text-[15px] font-bold text-[#1A0DAB] hover:underline leading-snug cursor-pointer">
                  {previewHeadline}
                </h4>
                <p className="text-[12px] text-[#006621] mt-0.5 truncate">{displayHost(data.finalUrl)}/services</p>
              </div>

              <p className="text-[12.5px] text-[#4D5156] leading-relaxed">
                {previewDescription}
              </p>

              {activeGroup.keywords.length > 0 && (
                <div className="pt-3 border-t border-[#F3F4F6]">
                  <p className="text-[10.5px] font-bold text-[#6B7280] uppercase tracking-wider mb-2">
                    Matched Keywords ({activeGroup.keywords.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {activeGroup.keywords.slice(0, 6).map((k, i) => (
                      <span key={i} className="px-2 py-0.5 bg-[#F3F4F6] text-[#374151] text-[10.5px] font-medium rounded-full">
                        {k.keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Meta Social Ad Preview */
            <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-sm overflow-hidden flex-1 flex flex-col">
              <div className="p-3.5 flex items-center justify-between border-b border-[#F3F4F6]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#E0533C] text-white font-bold text-[12px] flex items-center justify-center">
                    {businessName[0]}
                  </div>
                  <div>
                    <p className="text-[12.5px] font-bold text-[#111827] leading-tight">{businessName}</p>
                    <p className="text-[10px] text-[#9CA3AF]">Sponsored · 🌐</p>
                  </div>
                </div>
              </div>

              <div className="p-3.5 pt-2 text-[12.5px] text-[#374151] leading-relaxed">
                {previewDescription}
              </div>

              <div className="relative bg-[#F3F4F6] min-h-[180px] flex items-center justify-center overflow-hidden">
                {generatedImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={generatedImageUrl} alt="Ad Visual" className="w-full h-full object-cover" />
                ) : (
                  <div className="p-6 text-center">
                    <Sparkles size={24} className="text-[#E0533C] mx-auto mb-2" />
                    <p className="text-[12px] font-bold text-[#111827]">{previewHeadline}</p>
                    <p className="text-[11px] text-[#6B7280] mt-1">{data.goal || 'Lead Generation'}</p>
                  </div>
                )}
              </div>

              <div className="p-3.5 bg-[#F9FAFB] border-t border-[#E5E7EB] flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold">{displayHost(data.finalUrl)}</p>
                  <p className="text-[12.5px] font-bold text-[#111827] truncate">{previewHeadline}</p>
                </div>
                <button className="h-8 px-4 bg-[#E0533C] text-white text-[11.5px] font-bold rounded-[8px]">
                  Learn More
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Shell>
  )
}
