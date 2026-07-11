"use client"

import { useCallback, useState } from "react"

export type CampaignLauncherData = {
  platform?: "GOOGLE" | "META"
  campaignName?: string
  name?: string
  goal?: string
  campaignType?: string
  type?: string
  objective?: string
  budget?: number
  dailyBudget?: number
  budgetType?: "DAILY" | "TOTAL"
  biddingStrategy?: string
  targetCpa?: number
  targetRoas?: number
  targetShare?: number
  startDate?: string
  endDate?: string
  noEndDate?: boolean
  networks?: Record<string, boolean>
  locations?: string[]
  locationTargetingType?: "presence" | "interest"
  languages?: string[]
  adSchedule?: Record<string, unknown>
  allDaySchedule?: boolean
  audiences: string[]
  creatives: string[]
}

const initialData: CampaignLauncherData = {
  platform: "GOOGLE",
  audiences: [],
  creatives: [],
  networks: { search: true, display: false, partners: true },
  locations: [],
  languages: ["English"],
  budgetType: "DAILY",
  biddingStrategy: "MAXIMIZE_CONVERSIONS",
  startDate: new Date().toISOString().slice(0, 10),
  noEndDate: true,
  locationTargetingType: "presence",
  allDaySchedule: true,
}

export function useCampaignLauncher(initial?: Partial<CampaignLauncherData>) {
  const [currentStep, setCurrentStep] = useState(1)
  const [data, setData] = useState<CampaignLauncherData>({ ...initialData, ...initial })

  const updateField = useCallback(<K extends keyof CampaignLauncherData>(key: K, value: CampaignLauncherData[K]) => {
    setData((previous) => ({ ...previous, [key]: value }))
  }, [])

  const update = useCallback((partial: Partial<CampaignLauncherData>) => {
    setData((previous) => ({ ...previous, ...partial }))
  }, [])

  const nextStep = useCallback(() => setCurrentStep((step) => Math.min(8, step + 1)), [])
  const prevStep = useCallback(() => setCurrentStep((step) => Math.max(1, step - 1)), [])
  const goToStep = useCallback((step: number) => setCurrentStep(Math.min(8, Math.max(1, step))), [])

  const reset = useCallback(() => {
    setCurrentStep(1)
    setData(initialData)
  }, [])

  return {
    currentStep,
    data,
    formData: data,
    update,
    updateField,
    nextStep,
    prevStep,
    goToStep,
    reset,
  }
}

export default useCampaignLauncher
