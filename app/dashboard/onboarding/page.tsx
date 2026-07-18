'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Check, ChevronRight, ChevronLeft, Loader2, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

type Step = 1 | 2 | 3

interface OnboardingState {
  currentStep: Step
  step1: { name: string; email: string }
  step2: {
    businessName: string
    websiteUrl: string
    primaryGoal: string
    currency: string
    timezone: string
    dailyBudget: string
    productDescription: string
  }
  step3: { googleConnected: boolean; googleAccountId: string; metaConnected: boolean; syncing: boolean }
}

const DEFAULT_STATE: OnboardingState = {
  currentStep: 2,
  step1: { name: 'Your Name', email: 'you@example.com' },
  step2: {
    businessName: '',
    websiteUrl: '',
    primaryGoal: '',
    currency: 'USD ($)',
    timezone: '',
    dailyBudget: '',
    productDescription: '',
  },
  step3: { googleConnected: false, googleAccountId: '', metaConnected: false, syncing: false },
}

export default function OnboardingPage() {
  const router = useRouter()
  const [state, setState] = useState<OnboardingState>(DEFAULT_STATE)
  const [mounted, setMounted] = useState(false)
  const [storageKey, setStorageKey] = useState('growzzy_onboarding')

  // localStorage isn't scoped per-user, so it's only trusted once we know
  // which account is actually signed in — otherwise switching accounts on the
  // same browser leaks the previous user's onboarding progress/step1 identity.
  useEffect(() => {
    fetch('/api/auth/session', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((session) => {
        const name = session?.user?.name
        const email = session?.user?.email
        const key = email ? `growzzy_onboarding_${email}` : 'growzzy_onboarding'
        setStorageKey(key)
        const saved = localStorage.getItem(key)
        let restored: OnboardingState | null = null
        if (saved) {
          try {
            restored = JSON.parse(saved)
          } catch {
            restored = null
          }
        }
        setState((s) => ({
          ...(restored || s),
          step1: { name: name || s.step1.name, email: email || s.step1.email },
        }))
      })
      .catch(() => {})
      .finally(() => setMounted(true))
  }, [])

  // Persist state changes
  useEffect(() => {
    if (mounted) {
      localStorage.setItem(storageKey, JSON.stringify(state))
    }
  }, [state, mounted, storageKey])

  // Reflect the REAL Google connection (e.g. after returning from OAuth),
  // rather than trusting locally-stored optimism.
  useEffect(() => {
    if (!mounted) return
    fetch('/api/integrations/status', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const g = json?.google
        if (!g?.connected) return
        setState((s) => ({
          ...s,
          currentStep: s.currentStep < 3 ? 3 : s.currentStep,
          step3: {
            ...s.step3,
            googleConnected: true,
            googleAccountId: g.selectedAdAccountId || g.accountId || '',
            syncing: false,
          },
        }))
      })
      .catch(() => {})
  }, [mounted])

  const canContinueStep2 =
    state.step2.businessName.trim() && state.step2.primaryGoal && state.step2.dailyBudget

  const currencySymbol = (state.step2.currency || '').match(/\(([^)]+)\)/)?.[1] || '$'

  // Save the workspace details the user typed in step 2 to the database,
  // then advance. These feed the AI when it writes campaigns later.
  const handleContinueStep2 = async () => {
    const s2 = state.step2
    // currency is stored as a display label like "USD ($)" — the API wants a 3-letter code.
    const currencyCode = (s2.currency || '').match(/[A-Z]{3}/)?.[0]
    const goal = (s2.primaryGoal || '').toUpperCase().replace(/[\s-]+/g, '_')
    const validGoal = ['SALES', 'LEADS', 'TRAFFIC', 'APP_INSTALLS'].includes(goal) ? goal : undefined

    await fetch('/api/workspaces', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: s2.businessName?.trim() || undefined,
        websiteUrl: s2.websiteUrl?.trim() || '',
        primaryGoal: validGoal,
        currencyCode,
        timezone: s2.timezone || undefined,
        dailyBudgetCeiling: s2.dailyBudget ? Number(s2.dailyBudget) : undefined,
        productDescription: s2.productDescription?.trim() || '',
      }),
    }).catch(() => {})
    setState((s) => ({ ...s, currentStep: 3 }))
  }

  const handleBackStep3 = () => {
    setState((s) => ({ ...s, currentStep: 2 }))
  }

  // Real Google OAuth — full page redirect. On return the effect below
  // detects the live connection.
  const handleGoogleConnect = () => {
    window.location.href = '/api/integrations/google/connect?returnTo=/dashboard/onboarding'
  }

  // Persist completion to the database (not localStorage) so the onboarding
  // gate in the dashboard layout stops redirecting this user.
  const completeOnboarding = async () => {
    await fetch('/api/onboarding', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onboardingCompleted: true, onboardingStep: 3 }),
    }).catch(() => {})
  }

  const handleCreateCampaign = async () => {
    await completeOnboarding()
    router.push('/dashboard/campaigns/new')
  }

  const handleSkipConnect = async () => {
    await completeOnboarding()
    router.push('/dashboard')
  }

  if (!mounted) return null

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#F6F7F9' }}>
      <div className="w-full max-w-[640px]">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Image
              src="/growzzy-logo.png"
              alt="Growzzy"
              width={32}
              height={32}
            />
            <p className="text-[20px] font-bold text-[#111827]">Growzzy OS</p>
          </div>
          <p className="text-[13px] text-[#6B7280]">Set up your account in just 3 steps</p>
        </div>

        {/* Roadmap */}
        <div className="space-y-2 mb-8">
          {/* Step 1 — Completed */}
          <div className="flex gap-3 items-start sku-card p-4">
            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: '#1F57F5' }}>
              <Check size={14} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-[#111827]">Create your identity</p>
              <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                {state.step1.name} · {state.step1.email} · Authenticated
              </p>
            </div>
          </div>

          {/* Step 2 — Active or completed */}
          <div className={cn('sku-card', state.currentStep === 2 ? 'ring-2 ring-[#1F57F5]' : '')}>
            <div className="flex gap-3 items-start p-4 pb-3 border-b border-[#DDE1E7]">
              <div
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-semibold text-[12px]',
                  state.currentStep >= 2
                    ? 'bg-[#1F57F5] text-white'
                    : 'border-2 border-[#D1D5DB] text-[#9CA3AF]'
                )}
              >
                {state.currentStep > 2 ? <Check size={14} /> : '2'}
              </div>
              <p className={cn('text-[13px] font-semibold', state.currentStep >= 2 ? 'text-[#111827]' : 'text-[#9CA3AF]')}>
                Configure your workspace
              </p>
            </div>

            {state.currentStep === 2 && (
              <div className="p-4 space-y-4">
                {/* Business name */}
                <div className="space-y-1.5">
                  <label className="block text-[12.5px] font-semibold text-[#374151]">Business name *</label>
                  <input
                    type="text"
                    placeholder="Your business name"
                    value={state.step2.businessName}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        step2: { ...s.step2, businessName: e.target.value },
                      }))
                    }
                    className="w-full h-9 px-3 text-[13px] text-[#111827] placeholder-[#9CA3AF] outline-none rounded-[8px] sku-input"
                  />
                </div>

                {/* Website URL */}
                <div className="space-y-1.5">
                  <label className="block text-[12.5px] font-semibold text-[#374151]">Business website</label>
                  <input
                    type="url"
                    placeholder="https://yourwebsite.com"
                    value={state.step2.websiteUrl}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        step2: { ...s.step2, websiteUrl: e.target.value },
                      }))
                    }
                    className="w-full h-9 px-3 text-[13px] text-[#111827] placeholder-[#9CA3AF] outline-none rounded-[8px] sku-input"
                  />
                  <p className="text-[11px] text-[#9CA3AF]">We'll use this to understand your product</p>
                </div>

                {/* Primary goal */}
                <div className="space-y-1.5">
                  <label className="block text-[12.5px] font-semibold text-[#374151]">Primary goal *</label>
                  <div className="flex flex-wrap gap-2">
                    {['Sales', 'Leads', 'App installs', 'Website traffic'].map((goal) => (
                      <button
                        key={goal}
                        onClick={() => setState((s) => ({ ...s, step2: { ...s.step2, primaryGoal: goal } }))}
                        className={cn(
                          'h-9 px-4 text-[12px] font-semibold rounded-[20px] transition-all',
                          state.step2.primaryGoal === goal
                            ? 'bg-[#1F57F5] text-white'
                            : 'bg-white text-[#111827] border border-[#DDE1E7] hover:border-[#1F57F5]'
                        )}
                      >
                        {goal}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Currency & Timezone */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-[12.5px] font-semibold text-[#374151]">Currency</label>
                    <select
                      value={state.step2.currency}
                      onChange={(e) =>
                        setState((s) => ({
                          ...s,
                          step2: { ...s.step2, currency: e.target.value },
                        }))
                      }
                      className="w-full h-9 pl-3 pr-8 text-[13px] text-[#111827] outline-none appearance-none rounded-[8px] sku-input"
                    >
                      <option>USD ($)</option>
                      <option>INR (₹)</option>
                      <option>EUR (€)</option>
                      <option>GBP (£)</option>
                      <option>AUD (A$)</option>
                    </select>
                    <ChevronRight size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[12.5px] font-semibold text-[#374151]">Timezone</label>
                    <select
                      value={state.step2.timezone}
                      onChange={(e) =>
                        setState((s) => ({
                          ...s,
                          step2: { ...s.step2, timezone: e.target.value },
                        }))
                      }
                      className="w-full h-9 pl-3 pr-8 text-[13px] text-[#111827] outline-none appearance-none rounded-[8px] sku-input"
                    >
                      <option value="">Select timezone</option>
                      <option>UTC-8 (Pacific)</option>
                      <option>UTC-5 (Eastern)</option>
                      <option>UTC+0 (GMT)</option>
                      <option>UTC+1 (CET)</option>
                      <option>UTC+5:30 (IST)</option>
                    </select>
                    <ChevronRight size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
                  </div>
                </div>

                {/* Daily budget */}
                <div className="space-y-1.5">
                  <label className="block text-[12.5px] font-semibold text-[#374151]">Daily budget ceiling *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[#6B7280] select-none">{currencySymbol}</span>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={state.step2.dailyBudget}
                      onChange={(e) =>
                        setState((s) => ({
                          ...s,
                          step2: { ...s.step2, dailyBudget: e.target.value },
                        }))
                      }
                      className="w-full h-9 pl-6 pr-3 text-[13px] text-[#111827] placeholder-[#9CA3AF] outline-none rounded-[8px] sku-input"
                    />
                  </div>
                  <p className="text-[11px] text-[#9CA3AF]">
                    Growzzy will never publish or shift budget beyond this amount per day — enforced automatically.
                  </p>
                </div>

                {/* Product description */}
                <div className="space-y-1.5">
                  <label className="block text-[12.5px] font-semibold text-[#374151]">Product description</label>
                  <textarea
                    placeholder="Describe what you sell in a sentence or two — this is what AI uses to write your campaigns"
                    value={state.step2.productDescription}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        step2: { ...s.step2, productDescription: e.target.value },
                      }))
                    }
                    className="w-full h-[60px] px-3 py-2 text-[13px] text-[#111827] placeholder-[#9CA3AF] outline-none rounded-[8px] sku-input resize-none"
                  />
                </div>

                {/* Button */}
                <button
                  onClick={handleContinueStep2}
                  disabled={!canContinueStep2}
                  className={cn(
                    'w-full h-10 text-[13px] font-semibold rounded-[8px] transition-all',
                    canContinueStep2
                      ? 'sku-btn-primary text-white cursor-pointer'
                      : 'bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed'
                  )}
                >
                  Continue
                </button>
              </div>
            )}
          </div>

          {/* Step 3 — Connections */}
          <div className={cn('sku-card', state.currentStep === 3 ? 'ring-2 ring-[#1F57F5]' : '')}>
            <div className="flex gap-3 items-start p-4 pb-3 border-b border-[#DDE1E7]">
              <div
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-semibold text-[12px]',
                  state.currentStep >= 3
                    ? 'bg-[#1F57F5] text-white'
                    : 'border-2 border-[#D1D5DB] text-[#9CA3AF]'
                )}
              >
                3
              </div>
              <p className={cn('text-[13px] font-semibold', state.currentStep >= 3 ? 'text-[#111827]' : 'text-[#9CA3AF]')}>
                Connect your advertising
              </p>
            </div>

            {state.currentStep === 3 && (
              <div className="p-4 space-y-4">
                {/* Google Ads Card */}
                <div className="sku-card p-4 flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-[13px] font-semibold text-[#111827] mb-2">Google Ads</p>
                    {!state.step3.googleConnected ? (
                      <button
                        onClick={handleGoogleConnect}
                        disabled={state.step3.syncing}
                        className="inline-flex items-center gap-2 h-8 px-3 text-[12px] font-semibold text-white sku-btn-primary rounded-[6px] disabled:opacity-50"
                      >
                        {state.step3.syncing ? (
                          <>
                            <Loader2 size={13} className="animate-spin" />
                            Connecting...
                          </>
                        ) : (
                          'Connect'
                        )}
                      </button>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="inline-flex items-center gap-2 h-6 px-2 rounded-[4px] bg-[#E6F4EC]">
                          <Check size={12} className="text-[#2E9E5B]" />
                          <span className="text-[11px] font-semibold text-[#2E9E5B]">Connected</span>
                        </div>
                        <p className="text-[12px] text-[#6B7280]">Account: {state.step3.googleAccountId}</p>
                        {state.step3.syncing ? (
                          <p className="flex items-center gap-2 text-[11px] text-[#9CA3AF]">
                            <Clock size={12} />
                            Syncing your account…
                          </p>
                        ) : (
                          <p className="flex items-center gap-1 text-[11px] text-[#2E9E5B]">
                            <Check size={12} />
                            Synced
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Meta Ads Card — Disabled */}
                <div className="sku-card p-4 flex items-start justify-between gap-3 opacity-60">
                  <div className="flex-1">
                    <p className="text-[13px] font-semibold text-[#9CA3AF] mb-2">Meta Ads</p>
                    <div className="inline-flex items-center gap-2 h-6 px-2 rounded-[4px] bg-[#F3F4F6]">
                      <span className="text-[11px] font-semibold text-[#6B7280]">Coming soon</span>
                    </div>
                    <p className="text-[11px] text-[#9CA3AF] mt-2">
                      Meta Ads support is on the way. Google Ads is fully supported today.
                    </p>
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-3">
                  <button
                    onClick={handleBackStep3}
                    className="flex-1 h-10 text-[13px] font-semibold rounded-[8px] sku-btn text-[#111827]"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleCreateCampaign}
                    disabled={!state.step3.googleConnected}
                    className={cn(
                      'flex-1 h-10 text-[13px] font-semibold rounded-[8px]',
                      state.step3.googleConnected
                        ? 'sku-btn-primary text-white cursor-pointer'
                        : 'bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed'
                    )}
                  >
                    Create your first campaign
                  </button>
                </div>

                <button
                  onClick={handleSkipConnect}
                  className="w-full h-9 text-[12px] text-[#1F57F5] hover:text-[#1849d6] transition-colors"
                >
                  I'll connect later
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
