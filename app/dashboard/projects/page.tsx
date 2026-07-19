"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Shell } from "@/components/dashboard-v2/shell"
import { FolderOpen, Plus, Loader2, X } from "lucide-react"

type Project = {
  id: string
  name: string
  description: string | null
  campaignCount: number
  createdAt: string
}

export default function ProjectsPage() {
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<Project[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const load = () => {
    setLoading(true)
    fetch("/api/projects", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setProjects(json?.projects ?? []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const createProject = async () => {
    if (!name.trim() || saving) return
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined }),
      })
      const json = await res.json()
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Couldn't create project.")
      setModalOpen(false)
      setName("")
      setDescription("")
      load()
    } catch (err: any) {
      setError(err?.message || "Couldn't create project.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Shell title="Projects">
      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <p className="text-[13px] text-[#6B7280]">Organise your campaigns into folders.</p>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 h-8 px-4 bg-[#1F57F5] text-white text-[12.5px] font-semibold rounded-[8px] hover:bg-[#1849d6] transition-colors"
          >
            <Plus size={13} />
            New Project
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-[#9CA3AF]"><Loader2 className="animate-spin" size={20} /></div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-12 h-12 bg-[#F6F7F9] rounded-full flex items-center justify-center mb-4">
              <FolderOpen size={20} className="text-[#D1D5DB]" />
            </div>
            <p className="text-[14px] font-semibold text-[#374151]">No projects yet</p>
            <p className="text-[12.5px] text-[#9CA3AF] mt-1 mb-5 max-w-[280px]">
              Create a project to keep your campaigns organised by client or goal.
            </p>
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 h-8 px-4 bg-[#1F57F5] text-white text-[12.5px] font-semibold rounded-[8px] hover:bg-[#1849d6] transition-colors"
            >
              <Plus size={13} />
              Create first project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/dashboard/projects/${p.id}`}
                className="bg-white rounded-[14px] border border-[#E9EBEF] p-4 hover:border-[#D1D5DB] transition-colors"
              >
                <div className="w-9 h-9 rounded-[10px] bg-[#EAF0FE] flex items-center justify-center mb-3">
                  <FolderOpen size={16} className="text-[#1F57F5]" />
                </div>
                <p className="text-[13.5px] font-semibold text-[#111827]">{p.name}</p>
                {p.description && <p className="text-[11.5px] text-[#9CA3AF] mt-0.5 line-clamp-2">{p.description}</p>}
                <p className="text-[11px] text-[#9CA3AF] mt-2">{p.campaignCount} campaign{p.campaignCount === 1 ? "" : "s"}</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="w-[420px] max-w-[95vw] rounded-[14px] bg-white p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[14px] font-semibold text-[#111827]">New project</p>
              <button onClick={() => setModalOpen(false)}><X size={16} className="text-[#9CA3AF]" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Client A, Q3 Launch"
                  className="w-full h-9 px-3 text-[13px] outline-none rounded-[8px] sku-input"
                />
              </div>
              <div>
                <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-[13px] outline-none rounded-[8px] sku-input resize-none"
                />
              </div>
              {error && <p className="text-[11.5px] text-[#D3564C]">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setModalOpen(false)} className="h-9 px-4 text-[12.5px] font-semibold text-[#374151] rounded-[8px] sku-btn">Cancel</button>
              <button
                onClick={createProject}
                disabled={!name.trim() || saving}
                className="h-9 px-4 text-white text-[12.5px] font-semibold rounded-[8px] sku-btn-primary disabled:opacity-60"
              >
                {saving ? "Creating…" : "Create project"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  )
}
