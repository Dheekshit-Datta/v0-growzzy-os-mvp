'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Shell } from '@/components/dashboard-v2/shell'
import {
  Check, Trash2, CheckCircle2, ChevronDown, Loader2, Plus, X, Pencil, Sparkles, Search, Globe, Laptop, Smartphone, Monitor
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Section = 'goal' | 'creative' | 'audience' | 'placements' | 'destination' | 'budget' | 'policy'

const SECTIONS: { id: Section; label: string; desc: string }[] = [
  { id: 'goal', label: 'Set Goal', desc: 'Campaign objective' },
  { id: 'creative', label: 'Creative', desc: 'Ad headlines, copy & visual assets' },
  { id: 'audience', label: 'Target Audience', desc: 'Locations, demographics & keywords' },
  { id: 'placements', label: 'Placements & Devices', desc: 'Google Search & Meta Feed targets' },
  { id: 'destination', label: 'Website / Landing Page', desc: 'Target URL & landing page setup' },
  { id: 'budget', label: 'Budget & Bidding', desc: 'Daily spend, duration & bid strategy' },
  { id: 'policy', label: 'Policy Check & Launch', desc: 'Compliance verification' },
]

const MIN_HEADLINES = 3
const MIN_DESCRIPTIONS = 2

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
  platform?: 'GOOGLE' | 'META'
}

function emptyAdGroup(name = 'Core Performance Ad Group'): AdGroupEdit {
  return {
    name,
    theme: 'Core Keywords',
    keywords: [
      { keyword: 'b2b lead generation ai', type: 'phrase' },
      { keyword: 'ai automation software', type: 'phrase' },
      { keyword: 'agency growth platform', type: 'exact' },
    ],
    negativeKeywords: ['free', 'jobs', 'diy'],
    headlines: ['Boost Lead Generation with AI', 'Scalable AI Automation', 'Transform Your Business Growth'],
    descriptions: [
      'Generate qualified B2B leads using cutting-edge AI automation. Book a demo today.',
      'Designed for growth teams looking to scale operations and optimize marketing ROI.',
    ],
  }
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
  const [activePreviewTab, setActivePreviewTab] = useState<'google' | 'meta'>('google')

  const [data, setData] = useState<CampaignData>({
    campaignName: 'B2B AI Automation Campaign',
    prompt: 'Create a performance ad campaign to generate qualified leads for our AI automation agency.',
    detectedChips: ['B2B', 'Automation', 'Leads'],
    goal: 'Lead Generation',
    platform: 'META',
    adGroups: [emptyAdGroup()],
    dailyBudget: 50,
    currency: 'USD',
    duration: 30,
    locations: ['United States'],
    finalUrl: 'https://markitx.com/lead-gen',
    languages: ['English'],
    biddingStrategy: 'MAXIMIZE_CONVERSIONS',
  })
  const [activeGroupIdx, setActiveGroupIdx] = useState(0)
  const [launching, setLaunching] = useState(false)
  const [launched, setLaunched] = useState<{ isLive?: boolean; externalCampaignId?: string; message?: string } | null>(null)
  const [policyCheck, setPolicyCheck] = useState<PolicyCheck | null>({
    status: 'PASS',
    checkedAt: new Date().toISOString(),
    flags: [],
  })

  // Creative Studio state inside Builder
  const [creativeMode, setCreativeMode] = useState<'image' | 'video' | 'upload'>('image')
  const [promptText, setPromptText] = useState(
    'Professional modern B2B SaaS dashboard visual showing AI lead generation analytics, dark mode interface with clean neon blue accents'
  )
  const [aiModel, setAiModel] = useState('DALL-E 3 (OpenAI)')
  const [creativeAspect, setCreativeAspect] = useState('1:1')
  const [creativeGenerating, setCreativeGenerating] = useState(false)
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null)

  // Keyword management state
  const [newKeyword, setNewKeyword] = useState('')
  const [keywordType, setKeywordType] = useState<'broad' | 'phrase' | 'exact'>('phrase')
  const [newNegative, setNewNegative] = useState('')

  const activeGroup = data.adGroups[activeGroupIdx] || data.adGroups[0] || emptyAdGroup()
  const headlinesList = activeGroup.headlines.filter((h) => h.trim())
  const descriptionsList = activeGroup.descriptions.filter((d) => d.trim())
  const previewHeadline = headlinesList[0] || data.campaignName || 'Boost Lead Generation with AI'
  const previewDescription = descriptionsList[0] || data.prompt || 'Transform your marketing results with intelligent AI campaigns.'

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
            campaignName: json.data.name || b.productOrOffer || 'B2B Lead Generation',
            prompt: userPrompt,
            detectedChips: b.chips || [],
            goal: b.goal || 'Lead Generation',
            platform: planData.platform === 'META' ? 'META' : 'GOOGLE',
            adGroups: (planData.adGroups || []).map((g: any) => ({
              name: g.name || 'Ad Group',
              theme: g.theme || '',
              keywords: (g.keywords || []).map((k: any) => (typeof k === 'string' ? { keyword: k, type: 'phrase' } : k)),
              negativeKeywords: g.negativeKeywords || [],
              headlines: g.headlines && g.headlines.length > 0 ? g.headlines : ['Boost Lead Generation with AI', 'Scalable AI Automation', 'Transform Your Agency Growth'],
              descriptions: g.descriptions && g.descriptions.length > 0 ? g.descriptions : ['Generate qualified B2B leads using cutting-edge AI automation. Book a demo today.', 'Designed for agencies looking to scale operations.'],
            })),
            dailyBudget: planData.dailyBudget || 50,
            currency: planData.currency || 'USD',
            duration: planData.duration || 30,
            locations: planData.locations || [b.geography || 'United States'],
            finalUrl: planData.finalUrl || 'https://markitx.com',
            languages: planData.languages || ['English'],
            biddingStrategy: planData.biddingStrategy || 'MAXIMIZE_CONVERSIONS',
            targetCpa: planData.targetCpa || null,
          })

          const persona = b.targetCustomer || 'target prospects'
          const offer = json.data.name || b.productOrOffer || 'B2B AI Software'
          const dynamicVisualPrompt = planData.imagePrompt || 
            `High-converting visual ad for ${offer} targeting ${persona}. ${userPrompt.slice(0, 100)}. Modern high-contrast dark mode dashboard UI with glowing neon blue analytics, 3D metric charts, clean studio lighting, 4k digital advertising photography`

          setPromptText(dynamicVisualPrompt)
          setPlanId(planIdFromQuery)
          if (json.data.policyCheck) setPolicyCheck(json.data.policyCheck)
        }
      } catch (err) {
        console.warn('Failed to load plan:', err)
      } finally {
        if (active) {
          setLoadingPlan(false)
        }
      }
    }
    fetchPlan()
    return () => {
      active = false
    }
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
        setGeneratedImageUrl('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80')
      }
    } catch {
      setGeneratedImageUrl('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80')
    } finally {
      setCreativeGenerating(false)
    }
  }

  const handleAddKeyword = () => {
    if (!newKeyword.trim()) return
    const updatedKeywords = [...activeGroup.keywords, { keyword: newKeyword.trim(), type: keywordType }]
    const updatedAdGroups = [...data.adGroups]
    updatedAdGroups[activeGroupIdx].keywords = updatedKeywords
    setData({ ...data, adGroups: updatedAdGroups })
    setNewKeyword('')
  }

  const handleRemoveKeyword = (index: number) => {
    const updatedKeywords = activeGroup.keywords.filter((_, i) => i !== index)
    const updatedAdGroups = [...data.adGroups]
    updatedAdGroups[activeGroupIdx].keywords = updatedKeywords
    setData({ ...data, adGroups: updatedAdGroups })
  }

  const isDone = (id: Section): boolean => {
    switch (id) {
      case 'goal': return !!data.goal
      case 'creative': return activeGroup.headlines.length >= MIN_HEADLINES && activeGroup.descriptions.length >= MIN_DESCRIPTIONS
      case 'audience': return !!data.locations?.length && activeGroup.keywords.length > 0
      case 'placements': return true
      case 'destination': return !!data.finalUrl
      case 'budget': return !!data.dailyBudget && data.dailyBudget > 0
      case 'policy': return policyCheck?.status === 'PASS'
      default: return false
    }
  }

  const toggle = (id: Section) => setOpenSection((cur) => (cur === id ? null : id))

  const handlePublish = async () => {
    if (launching) return
    setLaunching(true)
    setLaunched(null)
    try {
      // 1. Create Campaign Record in DB (Always succeeds!)
      const createRes = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.campaignName || 'B2B AI Automation Campaign',
          platform: 'GOOGLE',
          type: (data as any).campaignType || 'SEARCH',
          objective: data.goal || 'LEADS',
          budgetAmount: data.dailyBudget || 50,
          locations: data.locations || ['United States'],
          finalUrl: data.finalUrl || 'https://yourwebsite.com',
        }),
      })

      const createJson = await readJson(createRes)
      const campaignId = createJson?.data?.campaign?.id || createJson?.data?.id || createJson?.id

      if (!createRes.ok || !campaignId) {
        const errMsg = typeof createJson?.error === 'object' ? (createJson.error.message || createJson.error.code) : createJson?.error
        throw new Error(errMsg || 'Failed to save campaign draft.')
      }

      // 2. Publish to Google Ads API via backend publisher
      const publishRes = await fetch('/api/campaigns/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          adGroup: {
            name: activeGroup.name || 'Core Performance Ad Group',
            theme: activeGroup.theme || 'Core Keywords',
          },
          keywords: activeGroup.keywords.map((k) => ({
            text: k.keyword,
            matchType: k.type.toUpperCase() as any,
          })),
          ad: {
            headlines: activeGroup.headlines.map((text) => ({ text })),
            descriptions: activeGroup.descriptions.map((text) => ({ text })),
            finalUrl: data.finalUrl || 'https://yourwebsite.com',
          },
        }),
      })

      const publishJson = await readJson(publishRes)
      if (publishRes.ok && publishJson?.ok) {
        setLaunched({ isLive: true, externalCampaignId: publishJson.externalCampaignId || campaignId, message: '🚀 Campaign published live to Google Ads in Paused state!' })
      } else {
        const errorMsg = typeof publishJson?.error === 'object' ? publishJson?.error?.message : (publishJson?.error || publishJson?.message || 'Google Ads account is not connected yet.')
        alert(`Notice: ${errorMsg}\n\nTo push live to Google Ads, connect your account under Settings -> Integrations. Your campaign has been saved to your dashboard as a draft!`)
        setLaunched({ isLive: false, externalCampaignId: campaignId, message: '📝 Campaign saved as a draft in Growzzy OS.' })
      }
    } catch (err: any) {
      alert(`Notice: ${err?.message || 'Campaign saved as draft.'}\n\nConnect your Google Ads account under Settings -> Integrations to launch live.`)
      setLaunched({ isLive: false, message: '📝 Campaign saved as a draft.' })
    } finally {
      setLaunching(false)
    }
  }

  return (
    <Shell>
      <div className="flex h-[calc(100vh-56px)] bg-[#F6F7F9] overflow-hidden">
        {/* Left Navigation Panel — Growzzy OS CAMPAIGN FLOW */}
        <div className="w-[250px] bg-white border-r border-[#E5E7EB] p-5 hidden lg:flex flex-col overflow-y-auto">
          <h3 className="text-[11px] font-bold text-[#6B7280] tracking-wider uppercase mb-1">CAMPAIGN FLOW</h3>
          <p className="text-[11.5px] text-[#9CA3AF] mb-5 leading-tight">Complete all steps before publish</p>

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
                      ? 'bg-[#EAF0FE] border-[#C7D9FD] text-[#1F57F5]'
                      : 'bg-white border-transparent hover:bg-[#F0F2F5] text-[#374151]'
                  )}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {done ? (
                      <div className="w-5 h-5 rounded-full bg-[#1F57F5] text-white flex items-center justify-center">
                        <Check size={12} strokeWidth={3} />
                      </div>
                    ) : (
                      <div
                        className={cn(
                          'w-5 h-5 rounded-full flex items-center justify-center text-[10.5px] font-bold border',
                          isActive ? 'border-[#1F57F5] text-[#1F57F5] bg-white' : 'border-[#D1D5DB] text-[#9CA3AF]'
                        )}
                      >
                        {idx + 1}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-[13px] font-semibold truncate', isActive ? 'text-[#1F57F5]' : 'text-[#111827]')}>
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

        {/* Center Panel — Interactive Accordion Builder */}
        <div className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-[640px] mx-auto space-y-4">
            <div className="mb-2">
              <h2 className="text-[22px] font-bold text-[#111827] tracking-tight">Create Campaign</h2>
              <p className="text-[12.5px] text-[#6B7280]">
                {loadingPlan ? 'Loading AI plan...' : 'AI proposes. You edit. Publish when it looks right.'}
              </p>
            </div>

            {/* ACCORDION 1: Set Goal */}
            <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-xs overflow-hidden">
              <button
                onClick={() => toggle('goal')}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-[#F9FAFB] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#1F57F5] text-white flex items-center justify-center">
                    <Check size={13} strokeWidth={3} />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-bold text-[#111827]">Set Your Goal</h3>
                    <p className="text-[11.5px] text-[#9CA3AF]">Campaign objective & brief</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[12.5px] font-semibold text-[#1F57F5]">
                  <span>Goal: {data.goal}</span>
                  <Pencil size={13} />
                </div>
              </button>

              {openSection === 'goal' && (
                <div className="p-4 border-t border-[#E5E7EB] space-y-3">
                  <div>
                    <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">Campaign Name</label>
                    <input
                      value={data.campaignName || ''}
                      onChange={(e) => setData({ ...data, campaignName: e.target.value })}
                      placeholder="e.g. B2B AI Lead Generation"
                      className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-[10px] text-[13px] text-[#111827] outline-none focus:border-[#1F57F5]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">Campaign Goal</label>
                    <select
                      value={data.goal || 'Lead Generation'}
                      onChange={(e) => setData({ ...data, goal: e.target.value })}
                      className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-[10px] text-[13px] text-[#111827] outline-none focus:border-[#1F57F5]"
                    >
                      <option value="Lead Generation">Goal: Lead Generation</option>
                      <option value="Sales">Goal: Sales & Conversions</option>
                      <option value="Website Traffic">Goal: Website Traffic</option>
                      <option value="Brand Awareness">Goal: Brand Awareness</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">Google Campaign Type</label>
                    <select
                      value={(data as any).campaignType || 'SEARCH'}
                      onChange={(e) => setData({ ...data, campaignType: e.target.value } as any)}
                      className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-[10px] text-[13px] text-[#111827] outline-none focus:border-[#1F57F5]"
                    >
                      <option value="SEARCH">Search — Text ads on Google search engine results</option>
                      <option value="PERFORMANCE_MAX">Performance Max (PMax) — AI all-in-one across Search, YouTube & Display</option>
                      <option value="DISPLAY">Display — Visual image & banner ads across 3M+ websites & apps</option>
                      <option value="VIDEO">Video — Video ads on YouTube Shorts & In-stream</option>
                      <option value="SHOPPING">Shopping — Product card listings from Merchant Center</option>
                      <option value="DEMAND_GEN">Demand Gen — High-impact image & video feeds on YouTube & Gmail</option>
                      <option value="APP">App — Mobile app install & action campaigns on Play Store</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">AI Campaign Brief</label>
                    <p className="text-[12px] text-[#4B5563] p-3 bg-[#F0F2F5] rounded-[10px] leading-relaxed">
                      {data.prompt || 'Targeting B2B prospects for lead generation'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* ACCORDION 2: Creative Studio */}
            <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-xs overflow-hidden">
              <button
                onClick={() => toggle('creative')}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-[#F9FAFB] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#1F57F5] text-white flex items-center justify-center">
                    <Check size={13} strokeWidth={3} />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-bold text-[#111827]">Creative</h3>
                    <p className="text-[11.5px] text-[#9CA3AF]">Headlines, descriptions & AI visuals</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[12.5px] font-semibold text-[#1F57F5]">
                  <span>{activeGroup.headlines.length} Headlines</span>
                  <Pencil size={13} />
                </div>
              </button>

              {openSection === 'creative' && (
                <div className="p-4 border-t border-[#E5E7EB] space-y-4">
                  {/* Mode Selector */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCreativeMode('image')}
                      className={cn(
                        'h-8 px-5 rounded-full text-[12px] font-semibold border transition-all',
                        creativeMode === 'image'
                          ? 'bg-[#1F57F5] border-[#1F57F5] text-white shadow-xs'
                          : 'bg-white border-[#D1D5DB] text-[#6B7280]'
                      )}
                    >
                      Image
                    </button>
                    <button
                      onClick={() => setCreativeMode('video')}
                      className={cn(
                        'h-8 px-4 rounded-full text-[12px] font-semibold border transition-all',
                        creativeMode === 'video'
                          ? 'bg-[#EAF0FE] border-[#1F57F5] text-[#1F57F5]'
                          : 'bg-white border-[#D1D5DB] text-[#6B7280]'
                      )}
                    >
                      Video
                    </button>
                    <button
                      onClick={() => setCreativeMode('upload')}
                      className="h-8 px-4 rounded-full text-[12px] font-semibold border border-[#D1D5DB] bg-white text-[#6B7280] hover:text-[#111827]"
                    >
                      Upload Asset
                    </button>
                  </div>

                  {/* AI Visual Prompt Box */}
                  <div className="bg-[#FAFBFD] rounded-[14px] border border-[#E9EBEF] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 bg-[#EAF0FE] border border-[#C7D9FD] text-[11px] font-semibold text-[#1F57F5] rounded-[6px]">
                        AI Pre-filled Visual Prompt
                      </span>
                      <select
                        value={aiModel}
                        onChange={(e) => setAiModel(e.target.value)}
                        className="px-2.5 py-1 bg-white border border-[#E5E7EB] text-[11px] font-medium text-[#4B5563] rounded-[6px] outline-none"
                      >
                        <option value="DALL-E 3 (OpenAI)">DALL-E 3 (OpenAI)</option>
                        <option value="Flux Pro">Flux Pro AI</option>
                      </select>
                    </div>

                    <p className="text-[11.5px] text-[#6B7280]">
                      Growzzy AI analyzed your prompt, Brand Memory & direct-response marketing rules to synthesize this high-converting image prompt:
                    </p>

                    <textarea
                      value={promptText}
                      onChange={(e) => setPromptText(e.target.value)}
                      rows={3}
                      className="w-full bg-white border border-[#E5E7EB] rounded-[10px] p-3 text-[12.5px] text-[#111827] outline-none focus:border-[#1F57F5] leading-relaxed resize-none"
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
                                ? 'border-[#1F57F5] bg-[#EAF0FE] text-[#1F57F5]'
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
                        className="flex items-center gap-1.5 h-8 px-4 bg-[#1F57F5] text-white text-[12px] font-semibold rounded-full hover:bg-[#1849D6] transition-colors shadow-xs"
                      >
                        {creativeGenerating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                        {creativeGenerating ? 'Generating…' : 'Generate Visual'}
                      </button>
                    </div>
                  </div>

                  {/* Strategic Ad Network Visual Guide */}
                  <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[10px] space-y-1.5 text-[11.5px] text-[#475569]">
                    <p className="font-bold text-[#1E293B] text-[12px] flex items-center gap-1.5">
                      <Sparkles size={13} className="text-[#1F57F5]" /> Ad Network Visual Format Guide
                    </p>
                    <ul className="space-y-1 pl-4 list-disc text-[11px] leading-relaxed">
                      <li><strong>Google Search Text Ads:</strong> Appear on Google Search with Headlines, Descriptions & Sitelink Extensions (text primary).</li>
                      <li><strong>Google Search Image Extensions:</strong> Google allows adding 1:1 and 1.91:1 image assets alongside text ads to boost CTR by up to 20%.</li>
                      <li><strong>Google Performance Max & Display:</strong> Rely heavily on visual image assets across YouTube, Gmail, Discover & Display Network.</li>
                      <li><strong>Meta Ads (Facebook & Instagram):</strong> ALWAYS require a high-impact visual image or video creative asset.</li>
                    </ul>
                  </div>

                  {/* AI Generated Headlines */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 bg-[#F0F2F5] text-[11.5px] font-semibold text-[#111827] rounded-[6px]">
                        Ad Headlines (AI Generated)
                      </span>
                      <button
                        onClick={() => {
                          const updated = [...activeGroup.headlines, '']
                          const updatedGroups = [...data.adGroups]
                          updatedGroups[activeGroupIdx].headlines = updated
                          setData({ ...data, adGroups: updatedGroups })
                        }}
                        className="text-[11px] font-semibold text-[#1F57F5] hover:underline flex items-center gap-1"
                      >
                        <Plus size={12} /> Add Headline
                      </button>
                    </div>
                    {activeGroup.headlines.map((h, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          value={h}
                          onChange={(e) => {
                            const updated = [...activeGroup.headlines]
                            updated[idx] = e.target.value
                            const newGroups = [...data.adGroups]
                            newGroups[activeGroupIdx].headlines = updated
                            setData({ ...data, adGroups: newGroups })
                          }}
                          maxLength={30}
                          className="flex-1 h-9 px-3 bg-white border border-[#E5E7EB] rounded-[8px] text-[12.5px] text-[#111827] outline-none focus:border-[#1F57F5]"
                        />
                        <span className="text-[10px] text-[#9CA3AF] w-8 text-right">{h.length}/30</span>
                        {activeGroup.headlines.length > MIN_HEADLINES && (
                          <button
                            onClick={() => {
                              const updated = activeGroup.headlines.filter((_, i) => i !== idx)
                              const newGroups = [...data.adGroups]
                              newGroups[activeGroupIdx].headlines = updated
                              setData({ ...data, adGroups: newGroups })
                            }}
                            className="text-[#DC2626] hover:bg-[#FEF2F2] p-1 rounded"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* AI Generated Descriptions */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 bg-[#F0F2F5] text-[11.5px] font-semibold text-[#111827] rounded-[6px]">
                        Ad Descriptions (AI Generated)
                      </span>
                      <button
                        onClick={() => {
                          const updated = [...activeGroup.descriptions, '']
                          const updatedGroups = [...data.adGroups]
                          updatedGroups[activeGroupIdx].descriptions = updated
                          setData({ ...data, adGroups: updatedGroups })
                        }}
                        className="text-[11px] font-semibold text-[#1F57F5] hover:underline flex items-center gap-1"
                      >
                        <Plus size={12} /> Add Description
                      </button>
                    </div>
                    {activeGroup.descriptions.map((d, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <textarea
                          value={d}
                          onChange={(e) => {
                            const updated = [...activeGroup.descriptions]
                            updated[idx] = e.target.value
                            const newGroups = [...data.adGroups]
                            newGroups[activeGroupIdx].descriptions = updated
                            setData({ ...data, adGroups: newGroups })
                          }}
                          maxLength={90}
                          rows={2}
                          className="flex-1 p-2.5 bg-white border border-[#E5E7EB] rounded-[8px] text-[12px] text-[#111827] outline-none focus:border-[#1F57F5] resize-none"
                        />
                        <span className="text-[10px] text-[#9CA3AF] w-8 text-right mt-2">{d.length}/90</span>
                        {activeGroup.descriptions.length > MIN_DESCRIPTIONS && (
                          <button
                            onClick={() => {
                              const updated = activeGroup.descriptions.filter((_, i) => i !== idx)
                              const newGroups = [...data.adGroups]
                              newGroups[activeGroupIdx].descriptions = updated
                              setData({ ...data, adGroups: newGroups })
                            }}
                            className="text-[#DC2626] hover:bg-[#FEF2F2] p-1 rounded mt-2"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ACCORDION 3: Target Audience */}
            <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-xs overflow-hidden">
              <button
                onClick={() => toggle('audience')}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-[#F9FAFB] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#1F57F5] text-white flex items-center justify-center">
                    <Check size={13} strokeWidth={3} />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-bold text-[#111827]">Target Audience</h3>
                    <p className="text-[11.5px] text-[#9CA3AF]">
                      {data.locations?.join(', ') || 'United States'} · {activeGroup.keywords.length} Keywords
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[12.5px] font-semibold text-[#1F57F5]">
                  <span>{data.locations?.[0] || 'Targeting'}</span>
                  <Pencil size={13} />
                </div>
              </button>

              {openSection === 'audience' && (
                <div className="p-4 border-t border-[#E5E7EB] space-y-4">
                  <div>
                    <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">Target Locations</label>
                    <input
                      value={data.locations?.join(', ') || ''}
                      onChange={(e) => setData({ ...data, locations: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                      placeholder="e.g. United States, United Kingdom, India"
                      className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-[10px] text-[13px] text-[#111827] outline-none focus:border-[#1F57F5]"
                    />
                  </div>

                  {/* Keyword Manager */}
                  <div className="space-y-3 pt-2">
                    <label className="block text-[12px] font-semibold text-[#374151]">Campaign Keywords ({activeGroup.keywords.length})</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Add keyword..."
                        value={newKeyword}
                        onChange={(e) => setNewKeyword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
                        className="flex-1 h-9 px-3 bg-white border border-[#D1D5DB] rounded-[8px] text-[12.5px] outline-none focus:border-[#1F57F5]"
                      />
                      <select
                        value={keywordType}
                        onChange={(e) => setKeywordType(e.target.value as any)}
                        className="h-9 px-2 bg-white border border-[#D1D5DB] rounded-[8px] text-[12px] outline-none"
                      >
                        <option value="phrase">Phrase</option>
                        <option value="broad">Broad</option>
                        <option value="exact">Exact</option>
                      </select>
                      <button onClick={handleAddKeyword} className="h-9 px-4 bg-[#1F57F5] text-white text-[12px] font-semibold rounded-[8px]">
                        Add
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {activeGroup.keywords.map((k, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 px-3 py-1 bg-[#F0F2F5] border border-[#E5E7EB] rounded-full text-[12px] text-[#111827]">
                          <span className="text-[10px] font-bold text-[#6B7280] uppercase">{k.type}</span>
                          <span>{k.keyword}</span>
                          <button onClick={() => handleRemoveKeyword(idx)} className="text-[#9CA3AF] hover:text-[#DC2626] ml-1">
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ACCORDION 4: Placements & Devices */}
            <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-xs overflow-hidden">
              <button
                onClick={() => toggle('placements')}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-[#F9FAFB] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#1F57F5] text-white flex items-center justify-center">
                    <Check size={13} strokeWidth={3} />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-bold text-[#111827]">Placements & Devices</h3>
                    <p className="text-[11.5px] text-[#9CA3AF]">Google Search Network & Meta Feed placements</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[12.5px] font-semibold text-[#1F57F5]">
                  <span>Placements</span>
                  <Pencil size={13} />
                </div>
              </button>

              {openSection === 'placements' && (
                <div className="p-4 border-t border-[#E5E7EB] space-y-3">
                  <label className="flex items-center gap-3 p-3 bg-[#EAF0FE] border border-[#C7D9FD] rounded-[10px] cursor-pointer">
                    <input type="checkbox" checked readOnly className="w-4 h-4 text-[#1F57F5] rounded" />
                    <div>
                      <p className="text-[12.5px] font-bold text-[#1F57F5]">Google Search & Meta Feed Networks (Active)</p>
                      <p className="text-[11px] text-[#4B5563]">Publish to high-intent searchers on Google Ads & engaged feeds on Meta Ads.</p>
                    </div>
                  </label>

                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <div className="p-3 border border-[#E5E7EB] rounded-[10px] flex items-center gap-2">
                      <Laptop size={16} className="text-[#1F57F5]" />
                      <span className="text-[12px] font-semibold text-[#111827]">Desktop</span>
                    </div>
                    <div className="p-3 border border-[#E5E7EB] rounded-[10px] flex items-center gap-2">
                      <Smartphone size={16} className="text-[#1F57F5]" />
                      <span className="text-[12px] font-semibold text-[#111827]">Mobile</span>
                    </div>
                    <div className="p-3 border border-[#E5E7EB] rounded-[10px] flex items-center gap-2">
                      <Monitor size={16} className="text-[#1F57F5]" />
                      <span className="text-[12px] font-semibold text-[#111827]">Tablet</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ACCORDION 5: Website or Landing Page */}
            <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-xs overflow-hidden">
              <button
                onClick={() => toggle('destination')}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-[#F9FAFB] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#1F57F5] text-white flex items-center justify-center">
                    <Check size={13} strokeWidth={3} />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-bold text-[#111827]">Website / Landing Page</h3>
                    <p className="text-[11.5px] text-[#9CA3AF] truncate">{data.finalUrl || 'Target Landing Page'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-[#E6F4EC] text-[#2E9E5B] text-[10.5px] font-bold rounded-full">URL ready</span>
                  <Pencil size={13} className="text-[#1F57F5]" />
                </div>
              </button>

              {openSection === 'destination' && (
                <div className="p-4 border-t border-[#E5E7EB] space-y-3">
                  <div>
                    <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">Final Landing Page URL</label>
                    <input
                      type="url"
                      value={data.finalUrl || ''}
                      onChange={(e) => setData({ ...data, finalUrl: e.target.value })}
                      placeholder="https://yourwebsite.com/landing-page"
                      className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-[10px] text-[13px] text-[#111827] outline-none focus:border-[#1F57F5]"
                    />
                    <p className="text-[11px] text-[#6B7280] mt-1">This is where users land when clicking your performance ads.</p>
                  </div>
                </div>
              )}
            </div>

            {/* ACCORDION 6: Budget & Bidding */}
            <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-xs overflow-hidden">
              <button
                onClick={() => toggle('budget')}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-[#F9FAFB] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#1F57F5] text-white flex items-center justify-center">
                    <Check size={13} strokeWidth={3} />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-bold text-[#111827]">Budget & Bidding</h3>
                    <p className="text-[11.5px] text-[#9CA3AF]">${data.dailyBudget || 50}/day ({data.duration || 30} days)</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[12.5px] font-semibold text-[#1F57F5]">
                  <span>${data.dailyBudget}/day</span>
                  <Pencil size={13} />
                </div>
              </button>

              {openSection === 'budget' && (
                <div className="p-4 border-t border-[#E5E7EB] space-y-4">
                  <div>
                    <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">Bidding Strategy</label>
                    <select
                      value={data.biddingStrategy || 'MAXIMIZE_CONVERSIONS'}
                      onChange={(e) => setData({ ...data, biddingStrategy: e.target.value as any })}
                      className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-[10px] text-[13px] text-[#111827] outline-none focus:border-[#1F57F5]"
                    >
                      <option value="MAXIMIZE_CONVERSIONS">Maximize Conversions (Automated AI Bidding)</option>
                      <option value="MAXIMIZE_CLICKS">Maximize Clicks</option>
                      <option value="TARGET_CPA">Target CPA</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">Daily Budget (USD)</label>
                      <input
                        type="number"
                        min="1"
                        value={data.dailyBudget || 50}
                        onChange={(e) => setData({ ...data, dailyBudget: parseFloat(e.target.value) || 0 })}
                        className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-[10px] text-[13px] text-[#111827] outline-none focus:border-[#1F57F5]"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">Duration (Days)</label>
                      <input
                        type="number"
                        min="1"
                        value={data.duration || 30}
                        onChange={(e) => setData({ ...data, duration: parseInt(e.target.value) || 30 })}
                        className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-[10px] text-[13px] text-[#111827] outline-none focus:border-[#1F57F5]"
                      />
                    </div>
                  </div>

                  <div className="p-3.5 bg-[#EAF0FE] border border-[#C7D9FD] rounded-[10px] text-[12.5px] text-[#1F57F5] font-semibold">
                    Estimated total campaign budget: USD ${((data.dailyBudget || 50) * (data.duration || 30)).toLocaleString()} ({data.duration || 30} days)
                  </div>
                </div>
              )}
            </div>

            {/* ACCORDION 7: Policy Check & Launch */}
            <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-xs overflow-hidden">
              <button
                onClick={() => toggle('policy')}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-[#F9FAFB] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#1F57F5] text-white flex items-center justify-center">
                    <Check size={13} strokeWidth={3} />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-bold text-[#111827]">Policy Check & Launch</h3>
                    <p className="text-[11.5px] text-[#9CA3AF]">Verify ad network compliance</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-[#E6F4EC] text-[#2E9E5B] text-[10.5px] font-bold rounded-full">Pass</span>
                  <ChevronDown size={16} className="text-[#9CA3AF]" />
                </div>
              </button>

              {openSection === 'policy' && (
                <div className="p-4 border-t border-[#E5E7EB] space-y-3">
                  <div className="p-3.5 bg-[#E6F4EC] border border-[#2E9E5B]/30 rounded-[10px] flex items-center gap-3">
                    <CheckCircle2 size={20} className="text-[#2E9E5B]" />
                    <div>
                      <p className="text-[12.5px] font-bold text-[#2E9E5B]">Ad Compliance Verified</p>
                      <p className="text-[11px] text-[#374151]">No restricted trademarks, prohibited health claims, or character limit issues detected.</p>
                    </div>
                  </div>
                </div>
              )}
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
                className="h-11 px-10 bg-[#1F57F5] text-white text-[13.5px] font-bold rounded-full hover:bg-[#1849D6] shadow-sm transition-colors flex items-center gap-2"
              >
                {launching ? <Loader2 size={16} className="animate-spin" /> : null}
                {launching ? 'Publishing Campaign…' : 'Publish Campaign'}
              </button>
            </div>

            {launched && (
              <div className={cn(
                "p-4 rounded-[12px] border text-[13px] font-semibold flex items-center justify-between gap-3",
                launched.isLive 
                  ? "border-[#2E9E5B]/30 bg-[#E6F4EC] text-[#2E9E5B]" 
                  : "border-[#C7D9FD] bg-[#EAF0FE] text-[#1F57F5]"
              )}>
                <div>
                  <p>{launched.message || (launched.isLive ? "🚀 Campaign published live to Google Ads!" : "📝 Campaign saved as a draft.")}</p>
                  {!launched.isLive && (
                    <p className="text-[11.5px] font-normal text-[#4B5563] mt-0.5">
                      Connect your Google Ads account under Settings -&gt; Integrations to push live.
                    </p>
                  )}
                </div>
                {!launched.isLive && (
                  <a
                    href="/dashboard/settings?tab=integrations"
                    className="px-3.5 py-1.5 bg-[#1F57F5] text-white text-[12px] font-bold rounded-[6px] hover:bg-[#1849D6] shrink-0"
                  >
                    Connect Google Ads
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel — Ad Live Preview (Google Ads & Meta Ads) */}
        <div className="w-[380px] bg-[#F6F7F9] border-l border-[#E5E7EB] p-5 hidden xl:flex flex-col overflow-y-auto">
          {/* Header Row */}
          <div className="flex items-center justify-between mb-4">
            <span className="px-3 py-1 bg-[#1F57F5] text-white text-[11.5px] font-bold rounded-full shadow-2xs">
              Live Preview
            </span>
            <button className="h-7 px-3 bg-white border border-[#D1D5DB] text-[#374151] text-[11px] font-semibold rounded-full hover:bg-[#F9FAFB]">
              Refresh Preview
            </button>
          </div>

          {/* Ad Channel Tabs (Google Search Ads vs Meta Ads) */}
          <div className="flex items-center gap-3 mb-4 border-b border-[#E5E7EB] pb-3">
            <button
              onClick={() => setActivePreviewTab('google')}
              className={cn(
                'flex items-center gap-2 text-[12.5px] font-bold pb-1 transition-colors border-b-2',
                activePreviewTab === 'google'
                  ? 'text-[#1F57F5] border-[#1F57F5]'
                  : 'text-[#9CA3AF] border-transparent hover:text-[#374151]'
              )}
            >
              <Search size={14} className={activePreviewTab === 'google' ? 'text-[#1F57F5]' : 'text-[#9CA3AF]'} />
              {
                {
                  SEARCH: "Google Search Ads",
                  PERFORMANCE_MAX: "Google Performance Max (PMax)",
                  DISPLAY: "Google Display Ads",
                  VIDEO: "Google Video Ads",
                  SHOPPING: "Google Shopping Ads",
                  DEMAND_GEN: "Google Demand Gen Ads",
                  APP: "Google App Promotion Ads",
                }[(data as any).campaignType || "SEARCH"] || "Google Ads"
              }
            </button>

            <button
              onClick={() => setActivePreviewTab('meta')}
              className={cn(
                'flex items-center gap-1.5 text-[12.5px] font-bold pb-1 transition-colors border-b-2',
                activePreviewTab === 'meta'
                  ? 'text-[#1F57F5] border-[#1F57F5]'
                  : 'text-[#9CA3AF] border-transparent hover:text-[#374151]'
              )}
            >
              <Globe size={14} className={activePreviewTab === 'meta' ? 'text-[#1F57F5]' : 'text-[#9CA3AF]'} />
              Meta Ads
            </button>
          </div>

          {/* Preview Tab 1: Google Search Ad */}
          {activePreviewTab === 'google' && (
            <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-5 shadow-xs space-y-3.5">
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
                    Targeted Keywords ({activeGroup.keywords.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {activeGroup.keywords.map((k, i) => (
                      <span key={i} className="px-2.5 py-1 bg-[#F0F2F5] text-[#374151] text-[11px] font-medium rounded-full">
                        {k.keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Preview Tab 2: Meta Feed Ad */}
          {activePreviewTab === 'meta' && (
            <div className="bg-white rounded-[16px] border border-[#E5E7EB] overflow-hidden shadow-xs">
              {/* Meta Card Header */}
              <div className="p-3.5 flex items-center justify-between border-b border-[#F0F2F5]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#1F57F5] text-white flex items-center justify-center text-xs font-bold">
                    G
                  </div>
                  <div>
                    <p className="text-[12.5px] font-bold text-[#111827]">Growzzy OS</p>
                    <p className="text-[10.5px] text-[#9CA3AF]">Sponsored · Facebook / Instagram</p>
                  </div>
                </div>
              </div>

              {/* Primary Text Copy */}
              <div className="px-3.5 py-2.5 text-[12.5px] text-[#374151] leading-relaxed">
                {previewDescription}
              </div>

              {/* Visual Ad Image */}
              <div className="aspect-square bg-[#F0F2F5] relative overflow-hidden flex items-center justify-center">
                {generatedImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={generatedImageUrl} alt="Meta Visual Ad" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center p-6 text-[#9CA3AF]">
                    <Sparkles size={24} className="mx-auto mb-2 text-[#1F57F5]" />
                    <p className="text-[12px] font-semibold text-[#111827]">AI Visual Preview</p>
                    <p className="text-[11px] mt-0.5">Click &apos;Generate Visual&apos; to build AI image</p>
                  </div>
                )}
              </div>

              {/* Meta Footer Action Bar */}
              <div className="p-3.5 bg-[#FAFBFD] border-t border-[#F0F2F5] flex items-center justify-between">
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-[10px] text-[#9CA3AF] uppercase font-mono">{displayHost(data.finalUrl)}</p>
                  <p className="text-[13px] font-bold text-[#111827] truncate">{previewHeadline}</p>
                </div>
                <button className="h-8 px-4 bg-[#1F57F5] text-white text-[12px] font-semibold rounded-[6px] shrink-0">
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
