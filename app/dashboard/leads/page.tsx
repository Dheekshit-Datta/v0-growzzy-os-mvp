"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import { Search, Plus, X, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"

type Lead = {
  id: string
  name: string
  email: string | null
  phone: string | null
  company: string | null
  status: string
  source: string | null
  value: number | null
  notes: string | null
  createdAt: string
}

const STATUS_TABS = ["ALL", "NEW", "CONTACTED", "QUALIFIED", "CONVERTED"] as const

const badgeStyles: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700",
  CONTACTED: "bg-amber-100 text-amber-700",
  QUALIFIED: "bg-purple-100 text-purple-700",
  CONVERTED: "bg-emerald-100 text-emerald-700",
  LOST: "bg-rose-100 text-rose-700",
}

export default function LeadsPage() {
  const LEADS_CACHE_KEY = "growzzy_leads_cache_v1"
  const LEADS_CACHE_TTL_MS = 45_000
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]>("ALL")
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [noteDraft, setNoteDraft] = useState("")
  const [savingNote, setSavingNote] = useState(false)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [submittingLead, setSubmittingLead] = useState(false)
  const [aiScoreLoading, setAiScoreLoading] = useState<string | null>(null)
  const [aiScores, setAiScores] = useState<Record<string, string>>({})
  const loadStateRef = useRef({ inFlight: false, lastRunAt: 0, key: "" })
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    source: "MANUAL",
    value: "",
    notes: "",
  })

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(id)
  }, [query])

  const loadLeads = useCallback(async (force = false) => {
    const requestKey = `${status}:${debouncedQuery}`
    const now = Date.now()
    if (loadStateRef.current.inFlight && loadStateRef.current.key === requestKey) return
    if (!force && loadStateRef.current.key === requestKey && now - loadStateRef.current.lastRunAt < 6000) return
    if (!force) {
      try {
        const raw = window.sessionStorage.getItem(LEADS_CACHE_KEY)
        if (raw) {
          const cached = JSON.parse(raw) as { at: number; key: string; value: Lead[] }
          if (Array.isArray(cached?.value) && cached.key === requestKey && Date.now() - Number(cached.at || 0) <= LEADS_CACHE_TTL_MS) {
            setLeads(cached.value)
            setLoading(false)
          }
        }
      } catch {}
    }

    loadStateRef.current.inFlight = true
    loadStateRef.current.key = requestKey
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (status !== "ALL") params.set("status", status)
      if (debouncedQuery) params.set("search", debouncedQuery)

      const res = await fetch(`/api/leads?${params.toString()}`)
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || "Failed to load leads")
      setLeads(json.leads || [])
      try {
        window.sessionStorage.setItem(
          LEADS_CACHE_KEY,
          JSON.stringify({ at: Date.now(), key: requestKey, value: json.leads || [] })
        )
      } catch {}
    } catch (error: any) {
      toast.error(error.message || "Failed to load leads")
    } finally {
      loadStateRef.current.inFlight = false
      loadStateRef.current.lastRunAt = Date.now()
      setLoading(false)
    }
  }, [debouncedQuery, status])

  useEffect(() => {
    loadLeads(true)
    const onWorkspaceChanged = () => void loadLeads(true)
    const onVisible = () => {
      if (document.visibilityState === "visible") void loadLeads()
    }
    window.addEventListener("growzzy:workspace-changed", onWorkspaceChanged)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.removeEventListener("growzzy:workspace-changed", onWorkspaceChanged)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [loadLeads])

  const pipelineValue = useMemo(
    () => leads.reduce((sum, lead) => sum + Number(lead.value || 0), 0),
    [leads]
  )

  const updateLeadStatus = async (leadId: string, nextStatus: string) => {
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || "Failed to update lead")
      setLeads((prev) => prev.map((lead) => (lead.id === leadId ? json.lead : lead)))
      if (selectedLead?.id === leadId) {
        setSelectedLead(json.lead)
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to update lead status")
    }
  }

  const createLead = async () => {
    if (submittingLead) return
    setSubmittingLead(true)
    try {
      if (!form.name) {
        toast.error("Lead name is required")
        return
      }
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          status: "NEW",
          value: form.value ? Number(form.value) : null,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || "Failed to create lead")
      setLeads((prev) => [json.lead, ...prev])
      setForm({ name: "", email: "", phone: "", company: "", source: "MANUAL", value: "", notes: "" })
      setAddModalOpen(false)
      toast.success("Lead added to pipeline")
    } catch (error: any) {
      toast.error(error.message || "Failed to create lead")
    } finally {
      setSubmittingLead(false)
    }
  }

  const saveNotes = async () => {
    if (!selectedLead) return
    setSavingNote(true)
    try {
      const res = await fetch(`/api/leads/${selectedLead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: noteDraft }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || "Failed to save notes")
      setSelectedLead(json.lead)
      setLeads((prev) => prev.map((lead) => (lead.id === selectedLead.id ? json.lead : lead)))
    } catch (error: any) {
      toast.error(error.message || "Failed to save notes")
    } finally {
      setSavingNote(false)
    }
  }

  const runAiScore = async (lead: Lead) => {
    setAiScoreLoading(lead.id)
    try {
      const res = await fetch(`/api/leads/${lead.id}/score`, { method: "POST" })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || "Failed to score lead")
      setAiScores((prev) => ({ ...prev, [lead.id]: `Score: ${json.score}/100\n${json.reasoning}` }))
      setLeads((prev) => prev.map((item) => (item.id === lead.id ? json.lead : item)))
      if (selectedLead?.id === lead.id) setSelectedLead(json.lead)
    } catch (error: any) {
      toast.error(error.message || "Failed to score lead")
    } finally {
      setAiScoreLoading(null)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[28px] font-semibold text-slate-900">Leads</h1>
            <p className="text-sm text-slate-500">Pipeline Value: ${pipelineValue.toLocaleString()}</p>
          </div>
          <button className="btn btn-primary h-10" onClick={() => setAddModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Lead
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="input pl-9 h-10"
                placeholder="Search leads by name, email, company, or notes"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                className={`h-9 px-3 rounded-lg text-xs font-semibold ${
                  status === tab ? "bg-[#1F57F5] text-white" : "bg-slate-100 text-slate-600"
                }`}
                onClick={() => setStatus(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, idx) => (
                <Skeleton key={idx} className="h-11 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500">
                    <th className="py-2 text-left">Name</th>
                    <th className="py-2 text-left">Company</th>
                    <th className="py-2 text-left">Status</th>
                    <th className="py-2 text-left">Source</th>
                    <th className="py-2 text-left">Notes &amp; Keywords</th>
                    <th className="py-2 text-left">Value</th>
                    <th className="py-2 text-left">Date</th>
                    <th className="py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => { setSelectedLead(lead); setNoteDraft(lead.notes || "") }}>
                      <td className="py-3 font-medium text-slate-900">{lead.name}</td>
                      <td className="py-3 text-slate-600">{lead.company || "-"}</td>
                      <td className="py-3" onClick={(event) => event.stopPropagation()}>
                        <select
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${badgeStyles[lead.status] || "bg-slate-100 text-slate-600"}`}
                          value={String(lead.status || "").toUpperCase()}
                          onChange={(event) => updateLeadStatus(lead.id, event.target.value)}
                        >
                          <option value="NEW">NEW</option>
                          <option value="CONTACTED">CONTACTED</option>
                          <option value="QUALIFIED">QUALIFIED</option>
                          <option value="CONVERTED">CONVERTED</option>
                          <option value="LOST">LOST</option>
                        </select>
                      </td>
                      <td className="py-3 text-slate-600">{lead.source || "-"}</td>
                      <td className="max-w-[220px] truncate py-3 text-slate-500" title={lead.notes || "No notes yet"}>{lead.notes || "No notes yet"}</td>
                      <td className="py-3 text-slate-700">${Number(lead.value || 0).toLocaleString()}</td>
                      <td className="py-3 text-slate-500">{new Date(lead.createdAt).toLocaleDateString()}</td>
                      <td className="py-3" onClick={(event) => event.stopPropagation()}>
                        <button
                          className="btn btn-secondary h-8"
                          onClick={() => runAiScore(lead)}
                          disabled={aiScoreLoading === lead.id}
                        >
                          <Sparkles className="w-3.5 h-3.5 mr-1" />
                          {aiScoreLoading === lead.id ? "Scoring..." : "AI Score"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {addModalOpen ? (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-3">
          <div className="w-[480px] max-w-[95vw] max-h-[88vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Add Lead</h3>
              <button onClick={() => setAddModalOpen(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <Field label="Name *"><input className="input h-10" placeholder="Lead name" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} /></Field>
            <Field label="Email"><input className="input h-10" placeholder="name@company.com" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} /></Field>
            <Field label="Phone"><input className="input h-10" placeholder="Phone number" value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} /></Field>
            <Field label="Company"><input className="input h-10" placeholder="Company" value={form.company} onChange={(event) => setForm((prev) => ({ ...prev, company: event.target.value }))} /></Field>
            <Field label="Source"><input className="input h-10" placeholder="Manual, referral, Google Ads..." value={form.source} onChange={(event) => setForm((prev) => ({ ...prev, source: event.target.value }))} /></Field>
            <Field label="Deal value"><input className="input h-10" type="number" placeholder="0" value={form.value} onChange={(event) => setForm((prev) => ({ ...prev, value: event.target.value }))} /></Field>
            <Field label="Notes & Keywords"><textarea className="input min-h-[90px] py-2" placeholder="Needs, objections, next steps, campaign keywords..." value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} /></Field>
            <div className="flex justify-end gap-2">
              <button className="btn btn-secondary h-9" onClick={() => setAddModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary h-9" onClick={createLead} disabled={submittingLead}>{submittingLead ? "Saving..." : "Save Lead"}</button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedLead ? (
        <div className="fixed inset-y-0 right-0 w-[420px] max-w-[95vw] bg-white border-l border-slate-200 z-40 shadow-2xl p-5 overflow-y-auto">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">{selectedLead.name}</h3>
            <button onClick={() => setSelectedLead(null)}>
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <p><span className="font-semibold text-slate-800">Email:</span> {selectedLead.email || "-"}</p>
            <p><span className="font-semibold text-slate-800">Phone:</span> {selectedLead.phone || "-"}</p>
            <p><span className="font-semibold text-slate-800">Company:</span> {selectedLead.company || "-"}</p>
            <p><span className="font-semibold text-slate-800">Source:</span> {selectedLead.source || "-"}</p>
            <p><span className="font-semibold text-slate-800">Value:</span> ${Number(selectedLead.value || 0).toLocaleString()}</p>
          </div>
          {aiScores[selectedLead.id] ? (
            <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/70 p-3 text-xs text-blue-800 whitespace-pre-wrap">
              {aiScores[selectedLead.id]}
            </div>
          ) : null}
          <div className="mt-5">
            <label className="text-xs font-semibold text-slate-500">Notes &amp; Keywords</label>
            <textarea
              className="input min-h-[140px] py-2 mt-1"
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              onBlur={saveNotes}
              placeholder="Key needs, objections, next steps, or search terms for this lead..."
            />
            <div className="text-xs text-slate-400 mt-1">{savingNote ? "Saving..." : "Auto-saves on blur"}</div>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  )
}
