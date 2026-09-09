"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Shell } from "@/components/dashboard-v2/shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Palette,
  Search,
  Eye,
  Download,
  Edit,
  Trash2,
  Plus,
  Grid,
  List,
  Megaphone,
  FileText,
  Image as ImageIcon,
  Sparkles,
} from "lucide-react"

export const dynamic = "force-dynamic"

type Creative = {
  id: string
  name: string
  title?: string
  headline?: string | null
  primaryText?: string | null
  bodyText?: string | null
  cta?: string | null
  imageUrl?: string | null
  platform: string
  status: string
  source: string
  createdAt: string
}

type Campaign = {
  id: string
  name: string
  platform: string
  status: string
  objective?: string
  budgetDaily?: number | null
  currency?: string | null
  createdAt: string
}

type Artifact = {
  id: string
  kind: "campaign" | "creative" | "copy"
  title: string
  platform: string
  preview: string
  source: string
  createdAt: string
}

type Library = {
  creatives: Creative[]
  campaigns: Campaign[]
  artifacts: Artifact[]
}

type Tab = "all" | "creatives" | "campaigns" | "copy" | "images"

export default function CreativesLibraryPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [data, setData] = useState<Library>({ creatives: [], campaigns: [], artifacts: [] })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterPlatform, setFilterPlatform] = useState("all")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [tab, setTab] = useState<Tab>("all")

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/me")
        if (!response.ok) {
          router.push("/auth")
          return
        }
        const d = await response.json()
        setUser(d.user)
      } catch (error) {
        console.error("[v0] Auth error:", error)
        router.push("/auth")
      }
    }

    checkAuth()
  }, [router])

  useEffect(() => {
    if (user) {
      fetchLibrary()
    }
  }, [user])

  const fetchLibrary = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/library")
      if (response.ok) {
        const d = await response.json()
        setData({ creatives: d.creatives || [], campaigns: d.campaigns || [], artifacts: d.artifacts || [] })
      }
    } catch (error) {
      console.error("[v0] Error fetching library:", error)
    } finally {
      setLoading(false)
    }
  }

  // Combined view
  const items = useMemo(() => {
    const list: Array<{
      id: string
      kind: "creative" | "campaign" | "copy" | "image"
      name: string
      preview: string
      imageUrl?: string | null
      platform: string
      status?: string
      source: string
      createdAt: string
      sourceChat?: string
    }> = []
    for (const c of data.creatives) {
      list.push({
        id: `c:${c.id}`,
        kind: c.imageUrl ? "image" : "copy",
        name: c.name || c.title || "Untitled",
        preview: c.headline || c.primaryText || c.bodyText || "—",
        imageUrl: c.imageUrl,
        platform: c.platform,
        status: c.status,
        source: c.source,
        createdAt: c.createdAt,
      })
    }
    for (const cp of data.campaigns) {
      list.push({
        id: `cp:${cp.id}`,
        kind: "campaign",
        name: cp.name || "Untitled campaign",
        preview: cp.objective || `${cp.currency || "USD"} ${cp.budgetDaily ?? "?"}/day`,
        platform: cp.platform,
        status: cp.status,
        source: "ads-manager",
        createdAt: cp.createdAt,
      })
    }
    for (const a of data.artifacts) {
      list.push({
        id: `a:${a.id}`,
        kind: a.kind === "campaign" ? "campaign" : a.kind === "creative" ? "image" : "copy",
        name: a.title,
        preview: a.preview,
        imageUrl: a.kind === "creative" ? a.preview : null,
        platform: a.platform,
        status: "draft",
        source: a.source.startsWith("chat:") ? "chat" : a.source,
        sourceChat: a.source.startsWith("chat:") ? a.source.slice(5) : undefined,
        createdAt: a.createdAt,
      })
    }
    return list
  }, [data])

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { all: 0, creatives: 0, campaigns: 0, copy: 0, images: 0 }
    for (const it of items) {
      c.all += 1
      if (it.kind === "campaign") c.campaigns += 1
      else if (it.kind === "image") c.images += 1
      else if (it.kind === "copy") c.copy += 1
      else c.creatives += 1
    }
    return c
  }, [items])

  const filtered = useMemo(() => {
    const s = searchTerm.toLowerCase()
    return items
      .filter((it) => {
        if (tab === "creatives" && (it.kind === "campaign" || it.kind === "image")) return false
        if (tab === "campaigns" && it.kind !== "campaign") return false
        if (tab === "copy" && it.kind !== "copy") return false
        if (tab === "images" && it.kind !== "image") return false
        if (filterPlatform !== "all" && it.platform !== filterPlatform) return false
        if (s && !it.name.toLowerCase().includes(s) && !it.preview.toLowerCase().includes(s)) return false
        return true
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [items, tab, filterPlatform, searchTerm])

  if (!user) return null

  return (
    <Shell>
      <div className="p-8 bg-white min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Library</h1>
              <p className="text-gray-600 mt-2">
                Every creative, campaign, and ad-copy artifact the chat has produced.
              </p>
            </div>
            <Button onClick={() => router.push("/dashboard/agent")}>
              <Sparkles className="w-4 h-4 mr-2" />
              Build in chat
            </Button>
          </div>

          {/* Tab strip */}
          <div className="flex items-center gap-1 border-b border-gray-200 mb-5 overflow-x-auto">
            <TabBtn active={tab === "all"} onClick={() => setTab("all")} label="All" count={counts.all} />
            <TabBtn active={tab === "creatives"} onClick={() => setTab("creatives")} label="Creatives" count={counts.creatives} />
            <TabBtn active={tab === "campaigns"} onClick={() => setTab("campaigns")} label="Campaigns" count={counts.campaigns} />
            <TabBtn active={tab === "copy"} onClick={() => setTab("copy")} label="Ad copy" count={counts.copy} />
            <TabBtn active={tab === "images"} onClick={() => setTab("images")} label="Images" count={counts.images} />
          </div>

          {/* Filters and Search */}
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search by name or copy…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterPlatform} onValueChange={setFilterPlatform}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All platforms</SelectItem>
                <SelectItem value="google">Google Ads</SelectItem>
                <SelectItem value="meta">Meta Ads</SelectItem>
                <SelectItem value="facebook">Facebook</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("grid")}
              >
                <Grid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("list")}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <Palette className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {tab === "all" ? "Your library is empty" : "Nothing here yet"}
              </h3>
              <p className="text-gray-600 mb-6">
                {tab === "all"
                  ? "Everything you create in the agent chat will be saved here automatically."
                  : "Build something in the chat to populate this view."}
              </p>
              <Button onClick={() => router.push("/dashboard/agent")}>
                <Sparkles className="w-4 h-4 mr-2" />
                Build in chat
              </Button>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((it) => (
                <div
                  key={it.id}
                  className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  {it.imageUrl ? (
                    <div className="aspect-video bg-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={it.imageUrl} alt={it.name} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="aspect-video bg-gray-50 flex items-center justify-center">
                      <KindIcon kind={it.kind} />
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-gray-900 truncate">{it.name}</h3>
                      <Badge variant="outline" className="text-xs shrink-0 ml-2">
                        {it.platform || "—"}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{it.preview}</p>
                    <div className="flex justify-between items-center">
                      <div className="text-xs text-gray-500">
                        {new Date(it.createdAt).toLocaleDateString()}
                        {it.source === "chat" && it.sourceChat ? (
                          <button
                            onClick={() => router.push(`/dashboard/agent?c=${it.sourceChat}`)}
                            className="ml-2 text-primary hover:underline"
                          >
                            Open in chat
                          </button>
                        ) : null}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm">
                          <Eye className="w-3 h-3" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Download className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((it) => (
                <div
                  key={it.id}
                  className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex items-start gap-4"
                >
                  <div className="h-16 w-24 rounded-md bg-gray-100 overflow-hidden shrink-0 grid place-items-center">
                    {it.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.imageUrl} alt={it.name} className="w-full h-full object-cover" />
                    ) : (
                      <KindIcon kind={it.kind} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">{it.name}</h3>
                      <Badge variant="outline">{it.platform || "—"}</Badge>
                      {it.status ? <Badge variant="secondary">{it.status}</Badge> : null}
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-1">{it.preview}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(it.createdAt).toLocaleString()}
                      {it.source === "chat" && it.sourceChat ? (
                        <button
                          onClick={() => router.push(`/dashboard/agent?c=${it.sourceChat}`)}
                          className="ml-2 text-primary hover:underline"
                        >
                          Open in chat
                        </button>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm">
                      <Eye className="w-3 h-3" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Download className="w-3 h-3" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Shell>
  )
}

function TabBtn({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors cursor-pointer whitespace-nowrap ${
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
      <span className="ml-1.5 text-[11px] text-muted-foreground">({count})</span>
    </button>
  )
}

function KindIcon({ kind }: { kind: "creative" | "campaign" | "copy" | "image" }) {
  if (kind === "campaign") return <Megaphone className="w-6 h-6 text-gray-400" />
  if (kind === "image") return <ImageIcon className="w-6 h-6 text-gray-400" />
  if (kind === "copy") return <FileText className="w-6 h-6 text-gray-400" />
  return <Palette className="w-6 h-6 text-gray-400" />
}
