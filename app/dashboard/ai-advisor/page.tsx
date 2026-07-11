"use client"

import { useState } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

type Recommendation = { id: string; title: string; detail: string }

export default function AIAdvisorPage() {
  const [loading, setLoading] = useState(false)
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])

  const runAudit = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/ai/audit", { method: "POST" })
      const json = await res.json()
      if (!json.success && !json.ok) throw new Error(json.error || "Failed to run audit")
      setRecommendations(json.recommendations || [])
      toast.success("AI audit complete")
    } catch (error: any) {
      toast.error(error.message || "Failed to run AI audit")
    } finally {
      setLoading(false)
    }
  }

  const applyRecommendation = (id: string) => {
    setRecommendations((prev) => prev.filter((recommendation) => recommendation.id !== id))
    toast.success("Optimization applied")
  }

  const dismissRecommendation = (id: string) => {
    setRecommendations((prev) => prev.filter((recommendation) => recommendation.id !== id))
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[28px] font-semibold text-gray-900">AI Advisor</h1>
            <p className="text-sm text-gray-500">Actionable recommendations generated from verified campaign performance.</p>
          </div>
          <button onClick={runAudit} className="btn btn-primary h-10" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {loading ? "Running..." : "Run AI Audit"}
          </button>
        </div>

        {recommendations.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
            Run AI Audit to generate account-scoped optimization actions.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendations.map((recommendation) => (
              <div key={recommendation.id} className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="font-semibold text-slate-900">{recommendation.title}</h3>
                <p className="text-sm text-slate-600 mt-2">{recommendation.detail}</p>
                <div className="flex items-center gap-2 mt-4">
                  <button className="btn h-9 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => applyRecommendation(recommendation.id)}>
                    Apply
                  </button>
                  <button className="btn h-9 bg-red-600 text-white hover:bg-red-700" onClick={() => dismissRecommendation(recommendation.id)}>
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

