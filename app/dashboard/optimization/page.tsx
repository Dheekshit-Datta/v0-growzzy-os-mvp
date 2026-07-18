"use client"

import { useState, useEffect, useCallback } from "react"
import { Shell } from "@/components/dashboard-v2/shell"
import { Zap, Bell, CheckSquare, Cpu, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

type OTab = "recommendations" | "log" | "autopilot"

type Suggestion = {
  id: string
  title?: string
  summary?: string
  description?: string
  rationale?: string
  severity?: string
  priority?: string
  campaignName?: string
  applied?: boolean
}

type LogEntry = {
  id: string
  type: string
  previousValue: string
  appliedValue: string
  appliedAt: string
  status: string
  apiSuccess: boolean
  apiError: string | null
  campaignId: string | null
}

const AUTOMATION_MODES = [
  {
    id: "ALERT",
    title: "Alert only",
    description: "AI spots issues and tells you about them. You decide what to do.",
    bullets: ["Sends email alerts for critical issues", "Never changes anything automatically", "Full control stays with you"],
  },
  {
    id: "APPROVAL",
    title: "Approval required",
    description: "AI drafts a fix and waits for your click before applying it.",
    bullets: ["Suggestions appear in Recommendations", "One click to apply or dismiss", "Nothing runs without your OK"],
  },
  {
    id: "FULL",
    title: "Full autopilot",
    description: "AI applies optimisations automatically within your guardrails.",
    bullets: ["Applies bid and budget tweaks automatically", "Every action logged with an Undo button", "Guardrails prevent runaway spend"],
  },
] as const

export default function OptimizationPage() {
  const [activeTab, setActiveTab] = useState<OTab>("recommendations")
  const [loading, setLoading] = useState(true)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  const [logLoading, setLogLoading] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [logLoaded, setLogLoaded] = useState(false)

  const [autopilotLoading, setAutopilotLoading] = useState(false)
  const [automationMode, setAutomationMode] = useState<string>("ALERT")
  const [autopilotSaving, setAutopilotSaving] = useState(false)
  const [autopilotLoaded, setAutopilotLoaded] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/ai/recommendations", { cache: "no-store" })
      if (res.ok) {
        const json = await res.json()
        setSuggestions((json?.suggestions ?? []).filter((s: Suggestion) => !s.applied))
      }
    } catch {
      /* empty state covers */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (activeTab === "log" && !logLoaded) {
      setLogLoading(true)
      fetch("/api/ai/optimization-log", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => setLogs(json?.logs ?? []))
        .finally(() => { setLogLoading(false); setLogLoaded(true) })
    }
    if (activeTab === "autopilot" && !autopilotLoaded) {
      setAutopilotLoading(true)
      fetch("/api/workspaces", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => {
          const mode = json?.workspaces?.[0]?.defaultAutomationMode
          if (mode) setAutomationMode(mode)
        })
        .finally(() => { setAutopilotLoading(false); setAutopilotLoaded(true) })
    }
  }, [activeTab, logLoaded, autopilotLoaded])

  const selectAutomationMode = async (mode: string) => {
    if (mode === automationMode || autopilotSaving) return
    setAutopilotSaving(true)
    const prev = automationMode
    setAutomationMode(mode)
    try {
      const res = await fetch("/api/workspaces", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultAutomationMode: mode }),
      })
      if (!res.ok) setAutomationMode(prev)
    } catch {
      setAutomationMode(prev)
    } finally {
      setAutopilotSaving(false)
    }
  }

  const act = async (id: string, action: "apply" | "dismiss") => {
    setBusyId(id)
    try {
      const url = action === "apply" ? "/api/ai/recommendations/apply" : `/api/ai/recommendations`
      await fetch(url, {
        method: action === "apply" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionId: id, dismissed: action === "dismiss" }),
      }).catch(() => {})
      setSuggestions((prev) => prev.filter((s) => s.id !== id))
    } finally {
      setBusyId(null)
    }
  }

  const sevPill = (s?: string) => {
    const v = (s || "").toUpperCase()
    if (v.includes("CRIT") || v.includes("HIGH")) return "bg-[#FBE7E5] text-[#D3564C]"
    if (v.includes("MED")) return "bg-[#FBF0DA] text-[#B8892B]"
    return "bg-[#E7EFFB] text-[#4B79C7]"
  }

  return (
    <Shell title="AI Optimization">
      <div className="p-6 space-y-5">
        {/* Tabs */}
        <div className="bg-white rounded-[14px] border border-[#E9EBEF] overflow-hidden">
          <div className="border-b border-[#E9EBEF] px-5">
            <div className="flex gap-1">
              {[
                { id: "recommendations" as OTab, label: "Recommendations" },
                { id: "log" as OTab, label: "Action Log" },
                { id: "autopilot" as OTab, label: "Autopilot" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "h-11 px-4 text-[13px] font-medium border-b-2 transition-colors",
                    activeTab === tab.id
                      ? "border-[#1F57F5] text-[#1F57F5]"
                      : "border-transparent text-[#6B7280] hover:text-[#374151]"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-5">
            {activeTab === "recommendations" && (
              loading ? (
                <div className="flex items-center justify-center py-16 text-[#9CA3AF]"><Loader2 className="animate-spin" size={20} /></div>
              ) : suggestions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-12 h-12 bg-[#F6F7F9] rounded-full flex items-center justify-center mb-4">
                    <Zap size={20} className="text-[#D1D5DB]" />
                  </div>
                  <p className="text-[14px] font-semibold text-[#374151]">No recommendations yet</p>
                  <p className="text-[12.5px] text-[#9CA3AF] mt-1 max-w-[300px]">
                    Once your campaigns are live, AI will flag issues and opportunities here with plain-English suggestions.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {suggestions.map((s) => (
                    <div key={s.id} className="rounded-[12px] border border-[#E9EBEF] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {(s.severity || s.priority) && (
                              <span className={cn("inline-flex items-center h-5 px-2 rounded-full text-[10px] font-semibold uppercase", sevPill(s.severity || s.priority))}>
                                {s.severity || s.priority}
                              </span>
                            )}
                            {s.campaignName && <span className="text-[11px] text-[#9CA3AF] truncate">{s.campaignName}</span>}
                          </div>
                          <p className="text-[13px] font-semibold text-[#111827]">{s.title || s.summary || "Optimization opportunity"}</p>
                          <p className="text-[12px] text-[#6B7280] mt-1 leading-relaxed">{s.description || s.rationale || ""}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => act(s.id, "apply")}
                            disabled={busyId === s.id}
                            className="h-7 px-3 text-white text-[11.5px] font-semibold rounded-[7px] sku-btn-primary disabled:opacity-60"
                          >
                            {busyId === s.id ? "…" : "Apply"}
                          </button>
                          <button
                            onClick={() => act(s.id, "dismiss")}
                            disabled={busyId === s.id}
                            className="h-7 px-3 text-[#6B7280] text-[11.5px] font-semibold rounded-[7px] sku-btn disabled:opacity-60"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {activeTab === "log" && (
              logLoading ? (
                <div className="flex items-center justify-center py-16 text-[#9CA3AF]"><Loader2 className="animate-spin" size={20} /></div>
              ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-12 h-12 bg-[#F6F7F9] rounded-full flex items-center justify-center mb-4">
                    <CheckSquare size={20} className="text-[#D1D5DB]" />
                  </div>
                  <p className="text-[14px] font-semibold text-[#374151]">No actions taken yet</p>
                  <p className="text-[12.5px] text-[#9CA3AF] mt-1 max-w-[300px]">
                    Every AI-applied change will appear here with a full timeline and outcome.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div key={log.id} className="rounded-[10px] border border-[#E9EBEF] p-3.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn("inline-flex items-center h-5 px-2 rounded-full text-[10px] font-semibold uppercase", log.status === "APPLIED" ? "bg-[#E6F4EC] text-[#2E9E5B]" : "bg-[#FBE7E5] text-[#D3564C]")}>
                            {log.status}
                          </span>
                          <p className="text-[13px] font-semibold text-[#111827]">{log.type.replace(/_/g, " ")}</p>
                        </div>
                        <p className="text-[12px] text-[#6B7280] mt-1">
                          {log.previousValue} → {log.appliedValue}
                          {log.apiError && <span className="text-[#D3564C]"> — {log.apiError}</span>}
                        </p>
                      </div>
                      <span className="text-[11px] text-[#9CA3AF] shrink-0">{new Date(log.appliedAt).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )
            )}

            {activeTab === "autopilot" && (
              autopilotLoading ? (
                <div className="flex items-center justify-center py-16 text-[#9CA3AF]"><Loader2 className="animate-spin" size={20} /></div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  {AUTOMATION_MODES.map((mode, i) => {
                    const active = mode.id === automationMode
                    return (
                      <button
                        key={mode.id}
                        onClick={() => selectAutomationMode(mode.id)}
                        disabled={autopilotSaving}
                        className={cn(
                          "rounded-[12px] border p-5 text-left transition-all",
                          active ? "border-[#1F57F5] bg-[#EAF0FE]" : "border-[#E9EBEF] bg-white hover:border-[#D1D5DB]"
                        )}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", active ? "bg-[#1F57F5]" : "bg-[#F6F7F9]")}>
                            {i === 0 && <Bell size={14} className={active ? "text-white" : "text-[#9CA3AF]"} />}
                            {i === 1 && <CheckSquare size={14} className={active ? "text-white" : "text-[#9CA3AF]"} />}
                            {i === 2 && <Cpu size={14} className={active ? "text-white" : "text-[#9CA3AF]"} />}
                          </div>
                          {active && (
                            <span className="text-[10px] font-semibold text-[#1F57F5] bg-white px-1.5 py-0.5 rounded-full">Active</span>
                          )}
                        </div>
                        <p className="text-[13.5px] font-semibold text-[#111827] mb-1">{mode.title}</p>
                        <p className="text-[12px] text-[#6B7280] mb-3 leading-relaxed">{mode.description}</p>
                        <ul className="space-y-1.5">
                          {mode.bullets.map((b) => (
                            <li key={b} className="flex items-start gap-1.5 text-[11.5px] text-[#6B7280]">
                              <span className="w-1 h-1 rounded-full bg-[#9CA3AF] mt-1.5 shrink-0" />
                              {b}
                            </li>
                          ))}
                        </ul>
                      </button>
                    )
                  })}
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </Shell>
  )
}
