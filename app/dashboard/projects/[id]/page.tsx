"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Shell } from "@/components/dashboard-v2/shell"
import { ArrowLeft, Loader2, Trash2, FolderOpen } from "lucide-react"

type Campaign = { id: string; name: string; platform: string; status: string; spend: number | null; totalSpend: number | null; roas: number | null }
type ProjectDetail = { id: string; name: string; description: string | null }

function money(n: number | null) {
  return "$" + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!params?.id) return
    fetch(`/api/projects/${params.id}`, { cache: "no-store" })
      .then(async (r) => {
        const json = await r.json()
        if (!r.ok) throw new Error(json?.error || "Project not found")
        setProject(json.project)
        setCampaigns(json.campaigns || [])
      })
      .catch((e) => setError(e?.message || "Failed to load project"))
      .finally(() => setLoading(false))
  }, [params?.id])

  const deleteProject = async () => {
    if (deleting) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/projects/${params.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Couldn't delete project")
      router.push("/dashboard/projects")
    } catch (e: any) {
      setError(e?.message || "Couldn't delete project")
      setDeleting(false)
    }
  }

  return (
    <Shell title="Project">
      <div className="p-5 space-y-4 max-w-[800px]">
        <button
          onClick={() => router.push("/dashboard/projects")}
          className="flex items-center gap-1.5 text-[12.5px] font-medium text-[#6B7280] hover:text-[#374151] transition-colors"
        >
          <ArrowLeft size={14} /> Back to Projects
        </button>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#9CA3AF]"><Loader2 className="animate-spin" size={20} /></div>
        ) : error || !project ? (
          <div className="bg-white rounded-[14px] border border-[#E9EBEF] p-16 flex flex-col items-center text-center">
            <p className="text-[13px] font-semibold text-[#374151]">{error || "Project not found"}</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-[14px] border border-[#E9EBEF] p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[10px] bg-[#EAF0FE] flex items-center justify-center">
                    <FolderOpen size={16} className="text-[#1F57F5]" />
                  </div>
                  <div>
                    <h1 className="text-[16px] font-semibold text-[#111827]">{project.name}</h1>
                    {project.description && <p className="text-[12px] text-[#6B7280] mt-0.5">{project.description}</p>}
                  </div>
                </div>
                <button
                  onClick={deleteProject}
                  disabled={deleting}
                  className="flex items-center gap-1.5 h-8 px-3 text-[11.5px] font-semibold text-[#D3564C] rounded-[8px] sku-btn disabled:opacity-60"
                >
                  <Trash2 size={13} /> {deleting ? "Deleting…" : "Delete project"}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-[14px] border border-[#E9EBEF] overflow-hidden">
              <div className="px-5 py-3 border-b border-[#E9EBEF]">
                <p className="text-[13px] font-semibold text-[#111827]">{campaigns.length} campaign{campaigns.length === 1 ? "" : "s"}</p>
              </div>
              {campaigns.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="text-[12.5px] text-[#9CA3AF]">No campaigns assigned yet. Assign one from its Campaign Detail page.</p>
                </div>
              ) : (
                <div className="divide-y divide-[#F0F2F5]">
                  {campaigns.map((c) => (
                    <Link key={c.id} href={`/dashboard/campaigns/${c.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-[#F8F9FB] transition-colors">
                      <div>
                        <p className="text-[13px] font-medium text-[#111827]">{c.name}</p>
                        <p className="text-[11.5px] text-[#9CA3AF]">{c.platform} · {c.status}</p>
                      </div>
                      <div className="flex items-center gap-6 text-[12.5px] text-[#374151] tabular">
                        <span>{money(c.spend ?? c.totalSpend)}</span>
                        <span>{c.roas ? c.roas.toFixed(2) + "x" : "—"}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Shell>
  )
}
