"use client"

import { useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { ArrowRight, CheckCircle2, Clock, Sparkles } from "lucide-react"

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)

  const skip = async () => {
    await fetch("/api/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboardingCompleted: true, onboardingStep: 3 }),
    }).catch(() => undefined)
    router.replace("/dashboard")
  }

  return (
    <div className="min-h-[calc(100vh-120px)] rounded-3xl border border-white/80 bg-white/80 p-8 shadow-xl">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1F57F5] shadow-lg">
          <Image src="/growzzy-logo.png" alt="Growzzy OS" width={56} height={56} className="rounded-xl" priority />
        </div>

        {step === 1 && (
          <div className="space-y-5">
            <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">Step 1 of 3</span>
            <h1 className="text-4xl font-black tracking-tight text-slate-950">Welcome to GROWZZY OS</h1>
            <p className="mx-auto max-w-xl text-sm text-slate-500">
              Let's connect your first ad account so your dashboard, AI audit, reports, and automations use real campaign data.
            </p>
            <button onClick={() => setStep(2)} className="rounded-xl bg-[#111] px-5 py-3 text-sm font-bold text-white shadow-lg">
              Get Started <ArrowRight className="ml-2 inline h-4 w-4" />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 text-left">
            <div className="text-center">
              <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">Step 2 of 3</span>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Connect your first platform</h1>
              <p className="mt-2 text-sm text-slate-500">Connect at least one platform to continue, or skip for now and use empty states.</p>
            </div>

            <div className="mx-auto grid max-w-md gap-4">
              <a href="/api/integrations/google/connect" className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-inner">
                  <span className="text-2xl font-bold text-blue-600">G</span>
                </div>
                <h3 className="font-bold text-slate-950">Google Ads</h3>
                <p className="mt-1 text-xs text-slate-500">Recommended for beta. Sync campaigns and run AI audits.</p>
                <span className="mt-4 inline-flex rounded-lg bg-[#111] px-3 py-2 text-xs font-bold text-white">Connect</span>
              </a>
            </div>

            <div className="flex items-center justify-center gap-3">
              <button onClick={() => setStep(3)} className="rounded-xl bg-[#111] px-4 py-2 text-xs font-bold text-white">I connected one</button>
              <button onClick={skip} className="text-xs font-bold text-slate-500 hover:text-slate-900">Skip for now — I'll connect later</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Step 3 of 3</span>
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
            <h1 className="text-3xl font-black tracking-tight text-slate-950">You're all set</h1>
            <p className="mx-auto max-w-lg text-sm text-slate-500">
              We're syncing your campaigns now. This usually takes 1-2 minutes. Your dashboard will stay safe with syncing and empty states while data arrives.
            </p>
            <div className="mx-auto h-2 max-w-sm overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-[#1F57F5]" />
            </div>
            <button onClick={skip} className="rounded-xl bg-[#111] px-5 py-3 text-sm font-bold text-white shadow-lg">
              Go to Dashboard <Sparkles className="ml-2 inline h-4 w-4" />
            </button>
            <p className="text-xs text-slate-400"><Clock className="mr-1 inline h-3 w-3" /> Sync can continue in the background.</p>
          </div>
        )}
      </div>
    </div>
  )
}
