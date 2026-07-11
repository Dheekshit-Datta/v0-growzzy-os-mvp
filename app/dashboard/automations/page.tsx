"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import DashboardLayout from "@/components/dashboard-layout"
import { Plus, X } from "lucide-react"
import { toast } from "sonner"

type RuleLog = {
  id: string
  result: string
  details: string
  triggeredAt: string
}

type Rule = {
  id: string
  name: string
  description: string | null
  type: string
  isActive: boolean
  conditions: any
  actions: any
  lastTriggered: string | null
  triggerCount: number
  logs: RuleLog[]
}

type AutomationOverview = {
  summary: {
    activeRules: number
    totalRules: number
    totalActions: number
    pauseActions: number
    budgetIncreaseActions: number
    budgetDecreaseActions: number
    alertsSent: number
    estimatedSaved: number
    estimatedWon: number
    automationCoveragePct: number
  }
}

export default function AutomationsPage() {
  const [rules, setRules] = useState<Rule[]>([])
  const [overview, setOverview] = useState<AutomationOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [logsModalRule, setLogsModalRule] = useState<Rule | null>(null)
  const [mounted, setMounted] = useState(false)
  const [form, setForm] = useState({
    name: "",
    description: "",
    type: "LOW_ROAS_ALERT",
    metric: "roas",
    operator: "lt",
    value: "2.0",
    actionType: "email",
  })

  const loadRules = async () => {
    setLoading(true)
    try {
      const [rulesRes, overviewRes] = await Promise.all([
        fetch("/api/automations"),
        fetch("/api/automation/overview"),
      ])
      const json = await rulesRes.json()
      if (!rulesRes.ok || !json.ok) throw new Error(json.error || "Failed to fetch automations")
      setRules(json.rules || [])
      const overviewJson = await overviewRes.json().catch(() => null)
      if (overviewRes.ok && overviewJson?.ok) setOverview(overviewJson)
    } catch (error: any) {
      toast.error(error.message || "Failed to load automations")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setMounted(true)
    loadRules()
  }, [])

  const toggleRule = async (rule: Rule) => {
    try {
      const res = await fetch(`/api/automations/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !rule.isActive }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || "Failed to toggle rule")
      setRules((prev) => prev.map((item) => (item.id === rule.id ? { ...item, ...json.rule } : item)))
    } catch (error: any) {
      toast.error(error.message || "Failed to toggle automation")
    }
  }

  const createRule = async () => {
    try {
      const payload = {
        name: form.name,
        description: form.description,
        type: form.type,
        conditions: {
          metric: form.metric,
          operator: form.operator,
          value: Number(form.value),
        },
        actions: {
          type: form.actionType,
          config: {},
        },
      }
      const res = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || "Failed to create automation")
      setRules((prev) => [{ ...json.rule, logs: [] }, ...prev])
      setModalOpen(false)
      setForm({
        name: "",
        description: "",
        type: "LOW_ROAS_ALERT",
        metric: "roas",
        operator: "lt",
        value: "2.0",
        actionType: "email",
      })
      toast.success("Automation created")
    } catch (error: any) {
      toast.error(error.message || "Failed to create automation")
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[28px] font-semibold text-slate-900">Automations</h1>
            <p className="text-sm text-slate-500">Live rule engine with execution logs and persistent settings.</p>
          </div>
          <button className="btn btn-primary h-10" onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Automation
          </button>
        </div>

        {loading ? (
          <div className="text-sm text-slate-500">Loading automations...</div>
        ) : (
          <div className="grid gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">What your automations did for you</h2>
                  <p className="text-sm text-slate-500">Real rule logs only. Destructive actions stay approval-safe.</p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  {overview?.summary.automationCoveragePct || 0}% coverage
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-5">
                <AutomationStat label="Pause" value={overview?.summary.pauseActions || 0} helper="pause actions" />
                <AutomationStat label="Increase budget" value={overview?.summary.budgetIncreaseActions || 0} helper="budget increases" />
                <AutomationStat label="Decrease budget" value={overview?.summary.budgetDecreaseActions || 0} helper="budget decreases" />
                <AutomationStat label="Alerts sent" value={overview?.summary.alertsSent || 0} helper="notifications" />
                <AutomationStat label="Total actions" value={overview?.summary.totalActions || 0} helper={`${overview?.summary.activeRules || 0} active rules`} />
              </div>
            </div>
            {rules.map((rule) => (
              <div key={rule.id} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">{rule.name}</h3>
                    <p className="text-sm text-slate-600 mt-1">{rule.description || rule.type}</p>
                    <p className="text-xs text-slate-500 mt-2">
                      Last triggered: {rule.lastTriggered ? new Date(rule.lastTriggered).toLocaleString() : "Never"} - Trigger count: {rule.triggerCount}
                    </p>
                  </div>
                  <button
                    className={`w-11 h-6 rounded-full relative ${rule.isActive ? "bg-emerald-500" : "bg-slate-300"}`}
                    onClick={() => toggleRule(rule)}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${rule.isActive ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <button className="btn btn-secondary h-8" onClick={() => setLogsModalRule(rule)}>
                    View Log
                  </button>
                </div>
              </div>
            ))}
            {!rules.length ? <p className="text-sm text-slate-500">No automation rules yet.</p> : null}
          </div>
        )}
      </div>

      {mounted && modalOpen ? createPortal(
        <div className="fixed inset-0 bg-black/45 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-[480px] max-w-[95vw] rounded-xl border border-slate-200 bg-white p-5 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Create Automation</h3>
              <button onClick={() => setModalOpen(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <input className="input h-10" placeholder="Rule name" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
            <input className="input h-10" placeholder="Description" value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
            <select className="input h-10" value={form.type} onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}>
              <option value="LOW_ROAS_ALERT">LOW_ROAS_ALERT</option>
              <option value="BUDGET_PACING">BUDGET_PACING</option>
              <option value="WEEKLY_REPORT">WEEKLY_REPORT</option>
              <option value="CONVERSION_DROP">CONVERSION_DROP</option>
            </select>
            <div className="grid grid-cols-3 gap-2">
              <input className="input h-10" value={form.metric} onChange={(event) => setForm((prev) => ({ ...prev, metric: event.target.value }))} />
              <select className="input h-10" value={form.operator} onChange={(event) => setForm((prev) => ({ ...prev, operator: event.target.value }))}>
                <option value="lt">{"<"}</option>
                <option value="gt">{">"}</option>
                <option value="lte">{"<="}</option>
                <option value="gte">{">="}</option>
              </select>
              <input className="input h-10" value={form.value} onChange={(event) => setForm((prev) => ({ ...prev, value: event.target.value }))} />
            </div>
            <select className="input h-10" value={form.actionType} onChange={(event) => setForm((prev) => ({ ...prev, actionType: event.target.value }))}>
              <option value="email">Email alert</option>
              <option value="pause_campaign">Pause campaign</option>
              <option value="send_report">Send report</option>
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn btn-secondary h-9" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary h-9" onClick={createRule}>Save</button>
            </div>
          </div>
        </div>,
        document.body
      ) : null}

      {mounted && logsModalRule ? createPortal(
        <div className="fixed inset-0 bg-black/45 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-[560px] max-w-[95vw] rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">{logsModalRule.name} - Logs</h3>
              <button onClick={() => setLogsModalRule(null)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="space-y-2 max-h-[320px] overflow-y-auto">
              {logsModalRule.logs.map((log) => (
                <div key={log.id} className="rounded-lg border border-slate-100 p-3">
                  <div className="text-xs text-slate-500">{new Date(log.triggeredAt).toLocaleString()}</div>
                  <div className="text-sm font-semibold text-slate-800">{log.result}</div>
                  <div className="text-sm text-slate-600">{log.details}</div>
                </div>
              ))}
              {!logsModalRule.logs.length ? <p className="text-sm text-slate-500">No logs yet.</p> : null}
            </div>
          </div>
        </div>,
        document.body
      ) : null}
    </DashboardLayout>
  )
}

function AutomationStat({ label, value, helper }: { label: string; value: number; helper: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="text-sm font-semibold text-slate-900">{label}</div>
      <div className="mt-2 font-mono text-xl font-semibold text-slate-950">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{helper}</div>
    </div>
  )
}
