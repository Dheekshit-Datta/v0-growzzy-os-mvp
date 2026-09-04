"use client"

import { useEffect, useState } from "react"
import { Shell } from "@/components/dashboard-v2/shell"
import { Calendar, Download, Eye, FileText, Plus, Loader2 } from "lucide-react"
import { toast } from "sonner"

type ReportType = "monthly-performance" | "campaign-efficiency"

type ReportTemplate = {
  id: ReportType
  name: string
  description: string
}

type Schedule = {
  id: string
  name: string
  frequency: string
  templateType: ReportType
  dayOfWeek: number | null
  sendTo: string
  lastSent: string | null
  isActive: boolean
}

type ReportHistoryItem = {
  id: string
  name: string
  type: ReportType
  createdAt: string
  status: string
  platforms: string[]
  html: string
}

const filenameByType: Record<ReportType, string> = {
  "monthly-performance": "growzzy-monthly-performance",
  "campaign-efficiency": "growzzy-campaign-efficiency",
}

export default function ReportsPage() {
  const [templates, setTemplates] = useState<ReportTemplate[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [history, setHistory] = useState<ReportHistoryItem[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: "",
    templateType: "monthly-performance" as ReportType,
    frequency: "WEEKLY",
    dayOfWeek: "1",
    sendTo: "",
  })

  const loadTemplates = async () => {
    const res = await fetch("/api/reports/templates")
    const json = await res.json()
    if (res.ok && json.ok) setTemplates(json.templates || [])
  }

  const loadSchedules = async () => {
    const res = await fetch("/api/reports/schedule")
    const json = await res.json()
    if (res.ok && json.ok) setSchedules(json.schedules || [])
  }

  const loadHistory = async () => {
    const res = await fetch("/api/reports/history")
    const json = await res.json()
    if (res.ok && json.ok) setHistory(json.reports || [])
  }

  useEffect(() => {
    loadTemplates()
    loadSchedules()
    loadHistory()
  }, [])

  const renderTemplate = async (type: ReportType, persist: boolean) => {
    const res = await fetch(`/api/reports/generate${persist ? "" : `?type=${type}`}`, {
      method: persist ? "POST" : "GET",
      headers: persist ? { "Content-Type": "application/json" } : undefined,
      body: persist ? JSON.stringify({ type }) : undefined,
    })
    const json = await res.json()
    if (!res.ok || !json.ok) throw new Error(json.error || "Failed to render report")
    return json as { html: string; reportId?: string }
  }

  const previewTemplate = async (type: ReportType) => {
    try {
      setLoadingAction(`${type}:preview`)
      const { html } = await renderTemplate(type, false)
      const blob = new Blob([html], { type: "text/html" })
      const url = URL.createObjectURL(blob)
      const win = window.open(url, "_blank", "noopener,noreferrer")
      if (!win) toast.error("Popup blocked. Please allow popups to preview the report.")
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
    } catch (error: any) {
      toast.error(error.message || "Failed to preview report")
    } finally {
      setLoadingAction(null)
    }
  }

  const exportTemplate = async (type: ReportType) => {
    let iframe: HTMLIFrameElement | null = null
    try {
      setLoadingAction(`${type}:export`)
      const { html } = await renderTemplate(type, true)
      const [{ jsPDF }, html2canvasModule] = await Promise.all([import("jspdf"), import("html2canvas")])
      const html2canvas = html2canvasModule.default

      iframe = document.createElement("iframe")
      iframe.style.position = "fixed"
      iframe.style.left = "-10000px"
      iframe.style.top = "0"
      iframe.style.width = "1200px"
      iframe.style.height = "1600px"
      iframe.setAttribute("aria-hidden", "true")
      document.body.appendChild(iframe)

      await new Promise<void>((resolve) => {
        if (!iframe) return resolve()
        iframe.onload = () => resolve()
        iframe.srcdoc = html
      })

      await iframe.contentDocument?.fonts?.ready
      await new Promise((resolve) => window.setTimeout(resolve, 250))

      const page = iframe.contentDocument?.querySelector(".page") as HTMLElement | null
      if (!page) throw new Error("Report template did not render a page")

      const canvas = await html2canvas(page, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        windowWidth: page.scrollWidth,
        windowHeight: page.scrollHeight,
      })
      const imgData = canvas.toDataURL("image/png")
      const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = pageWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let remainingHeight = imgHeight
      let y = 0

      pdf.addImage(imgData, "PNG", 0, y, imgWidth, imgHeight)
      remainingHeight -= pageHeight

      while (remainingHeight > 0) {
        y -= pageHeight
        pdf.addPage()
        pdf.addImage(imgData, "PNG", 0, y, imgWidth, imgHeight)
        remainingHeight -= pageHeight
      }

      pdf.save(`${filenameByType[type]}-${new Date().toISOString().slice(0, 10)}.pdf`)
      toast.success("Report downloaded")
      loadHistory()
    } catch (error: any) {
      toast.error(error.message || "Failed to export report")
    } finally {
      iframe?.remove()
      setLoadingAction(null)
    }
  }

  const openScheduleModal = (templateType: ReportType) => {
    setForm((prev) => ({
      ...prev,
      templateType,
      name: prev.name || templates.find((template) => template.id === templateType)?.name || "Scheduled report",
    }))
    setModalOpen(true)
  }

  const createSchedule = async () => {
    try {
      setLoadingAction("schedule:create")
      const res = await fetch("/api/reports/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          templateType: form.templateType,
          frequency: form.frequency,
          dayOfWeek: form.frequency === "WEEKLY" ? Number(form.dayOfWeek) : null,
          sendTo: form.sendTo,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || "Failed to create schedule")
      setSchedules((prev) => [json.schedule, ...prev])
      setModalOpen(false)
      setForm({ name: "", templateType: "monthly-performance", frequency: "WEEKLY", dayOfWeek: "1", sendTo: "" })
      toast.success("Report schedule created")
    } catch (error: any) {
      toast.error(error.message || "Failed to create schedule")
    } finally {
      setLoadingAction(null)
    }
  }

  const removeSchedule = async (id: string) => {
    const res = await fetch(`/api/reports/schedule?id=${id}`, { method: "DELETE" })
    const json = await res.json()
    if (!res.ok || !json.ok) {
      toast.error(json.error || "Failed to delete schedule")
      return
    }
    setSchedules((prev) => prev.filter((schedule) => schedule.id !== id))
  }

  const previewHistory = (report: ReportHistoryItem) => {
    if (!report.html) {
      toast.error("This report was created before template previews were stored.")
      return
    }
    const blob = new Blob([report.html], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    window.open(url, "_blank", "noopener,noreferrer")
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }

  return (
    <Shell title="Reports">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[13px] text-slate-500">Generate branded client-ready reports from real synced campaign data.</p>
          </div>
          <button className="btn btn-secondary h-10" onClick={() => setModalOpen(true)}>
            <Calendar className="w-4 h-4 mr-2" />
            Schedule Report
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {templates.map((template) => (
            <div key={template.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-900">{template.name}</h3>
              <p className="text-xs text-slate-500 mt-2 min-h-[48px]">{template.description}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  className="btn btn-secondary h-9"
                  onClick={() => previewTemplate(template.id)}
                  disabled={loadingAction === `${template.id}:preview`}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  {loadingAction === `${template.id}:preview` ? "Opening..." : "Preview HTML"}
                </button>
                <button
                  className="btn h-9 border-0 text-white sku-btn-primary"
                  onClick={() => exportTemplate(template.id)}
                  disabled={loadingAction === `${template.id}:export`}
                >
                  <Download className="w-4 h-4 mr-2" />
                  {loadingAction === `${template.id}:export` ? "Exporting..." : "Export PDF"}
                </button>
                <button className="btn btn-secondary h-9" onClick={() => openScheduleModal(template.id)}>
                  <Calendar className="w-4 h-4 mr-2" />
                  Schedule
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-900 mb-3">Past Reports</h3>
          <div className="space-y-2">
            {history.map((report) => (
              <div key={report.id} className="rounded-lg border border-slate-100 p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">{report.name}</p>
                  <p className="text-xs text-slate-500">
                    {report.type.replace(/-/g, " ")} - {new Date(report.createdAt).toLocaleString()} -{" "}
                    {report.platforms.length ? report.platforms.join(", ") : "No connected platforms"}
                  </p>
                </div>
                <button className="btn btn-secondary h-8" onClick={() => previewHistory(report)}>
                  Preview
                </button>
              </div>
            ))}
            {!history.length ? <p className="text-sm text-slate-500">No reports generated yet. Export one of the templates above to create history.</p> : null}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-900 mb-3">Scheduled Reports</h3>
          <div className="space-y-2">
            {schedules.map((schedule) => (
              <div key={schedule.id} className="rounded-lg border border-slate-100 p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">{schedule.name}</p>
                  <p className="text-xs text-slate-500">
                    {schedule.templateType?.replace(/-/g, " ") || "monthly performance"} - {schedule.frequency} - {schedule.sendTo} - Last sent:{" "}
                    {schedule.lastSent ? new Date(schedule.lastSent).toLocaleString() : "Never"}
                  </p>
                </div>
                <button className="btn btn-secondary h-8" onClick={() => removeSchedule(schedule.id)}>
                  Delete
                </button>
              </div>
            ))}
            {!schedules.length ? <p className="text-sm text-slate-500">No scheduled reports yet.</p> : null}
          </div>
        </div>
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="w-[500px] max-w-[95vw] rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-slate-900">Schedule Report</h3>
              <button onClick={() => setModalOpen(false)}>
                <Plus className="w-4 h-4 rotate-45 text-slate-400" />
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500">Report name</label>
              <input className="input h-10" placeholder="Report name" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
              <label className="text-xs font-semibold text-slate-500">Template</label>
              <select className="input h-10" value={form.templateType} onChange={(event) => setForm((prev) => ({ ...prev, templateType: event.target.value as ReportType }))}>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
              <label className="text-xs font-semibold text-slate-500">Frequency</label>
              <select className="input h-10" value={form.frequency} onChange={(event) => setForm((prev) => ({ ...prev, frequency: event.target.value }))}>
                <option value="DAILY">DAILY</option>
                <option value="WEEKLY">WEEKLY</option>
                <option value="MONTHLY">MONTHLY</option>
              </select>
              {form.frequency === "WEEKLY" ? (
                <>
                  <label className="text-xs font-semibold text-slate-500">Day</label>
                  <select className="input h-10" value={form.dayOfWeek} onChange={(event) => setForm((prev) => ({ ...prev, dayOfWeek: event.target.value }))}>
                    <option value="1">Monday</option>
                    <option value="2">Tuesday</option>
                    <option value="3">Wednesday</option>
                    <option value="4">Thursday</option>
                    <option value="5">Friday</option>
                    <option value="6">Saturday</option>
                    <option value="0">Sunday</option>
                  </select>
                </>
              ) : null}
              <label className="text-xs font-semibold text-slate-500">Recipient email</label>
              <input className="input h-10" placeholder="Recipient email" value={form.sendTo} onChange={(event) => setForm((prev) => ({ ...prev, sendTo: event.target.value }))} />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button className="btn btn-secondary h-9" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button className="btn h-9 border-0 text-white sku-btn-primary" onClick={createSchedule} disabled={loadingAction === "schedule:create"}>
                {loadingAction === "schedule:create" ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </Shell>
  )
}
