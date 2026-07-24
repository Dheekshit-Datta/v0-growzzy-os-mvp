"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import {
  Bell,
  Check,
  ChevronsUpDown,
  FolderKanban,
  LogOut,
  Menu,
  Monitor,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { BetaFeedbackWidget } from "@/components/BetaFeedbackWidget"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type WorkspaceItem = {
  id: string
  name: string
  slug: string
  role: string
}

type NotificationItem = {
  id: string
  title: string
  body: string
  isRead: boolean
  createdAt: string
}

const ACTIVE_WORKSPACE_COOKIE = "growzzy_active_workspace_id"
const WORKSPACES_CACHE_KEY = "growzzy_workspaces_cache_v1"
const WORKSPACES_CACHE_TTL_MS = 5 * 60 * 1000

const primaryNav = [
  { title: "All Campaigns", href: "/dashboard/campaigns/new", icon: Sparkles },
  { title: "My brand", href: "/dashboard/settings?tab=general", icon: Monitor },
  { title: "Projects", href: "/dashboard/campaigns", icon: FolderKanban },
]

export default function DashboardLayout({ children, immersive = false }: { children: React.ReactNode; immersive?: boolean }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null)
  const router = useRouter()
  const pathname = usePathname()
  const { data: session } = useSession()
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) || workspaces[0]

  useEffect(() => {
    let cancelled = false
    const loadWorkspaces = async () => {
      try {
        const cached = window.sessionStorage.getItem(WORKSPACES_CACHE_KEY)
        if (cached) {
          const value = JSON.parse(cached) as { at: number; items: WorkspaceItem[] }
          if (Date.now() - value.at < WORKSPACES_CACHE_TTL_MS) setWorkspaces(value.items)
        }
        const response = await fetch("/api/workspaces", { cache: "no-store" })
        if (!response.ok) return
        const data = await response.json()
        if (cancelled) return
        const items = data.workspaces || []
        const saved = window.localStorage.getItem(ACTIVE_WORKSPACE_COOKIE)
        const next = items.find((workspace: WorkspaceItem) => workspace.id === saved)?.id || items[0]?.id || null
        setWorkspaces(items)
        setActiveWorkspaceId(next)
        window.sessionStorage.setItem(WORKSPACES_CACHE_KEY, JSON.stringify({ at: Date.now(), items }))
        if (next) selectWorkspace(next, false)
      } catch {
        if (!cancelled) setWorkspaces([])
      }
    }
    void loadWorkspaces()
    window.addEventListener("growzzy:workspace-updated", loadWorkspaces)
    return () => {
      cancelled = true
      window.removeEventListener("growzzy:workspace-updated", loadWorkspaces)
    }
  }, [])

  const selectWorkspace = (workspaceId: string, refresh = true) => {
    setActiveWorkspaceId(workspaceId)
    window.localStorage.setItem(ACTIVE_WORKSPACE_COOKIE, workspaceId)
    document.cookie = `${ACTIVE_WORKSPACE_COOKIE}=${workspaceId}; path=/; max-age=31536000; samesite=lax`
    window.dispatchEvent(new Event("growzzy:workspace-changed"))
    if (refresh) router.refresh()
  }

  const loadNotifications = async () => {
    setNotificationsOpen((open) => !open)
    if (notifications.length) return
    const response = await fetch("/api/notifications").catch(() => null)
    if (!response?.ok) return
    const data = await response.json()
    setNotifications(data.notifications || [])
  }

  const isActive = (href: string) => {
    const cleanHref = href.split("?")[0]
    if (cleanHref === "/dashboard") return pathname === cleanHref
    if (cleanHref === "/dashboard/campaigns/new") return pathname === cleanHref
    return pathname.startsWith(cleanHref)
  }

  const NavGroup = ({ label, items }: { label: string; items: typeof primaryNav }) => (
    <div className="mb-5">
      {!collapsed && <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-faint)]">{label}</p>}
      <div className="space-y-1">
        {items.map((item) => {
          const active = isActive(item.href)
          return (
            <button
              key={item.title}
              title={item.title}
              onClick={() => {
                router.push(item.href)
                setMobileSidebarOpen(false)
              }}
              className={cn(
                "flex h-9 w-full items-center rounded-[8px] px-3 text-[12px] font-medium transition-colors",
                collapsed ? "justify-center" : "gap-2.5",
                active
                  ? "bg-[var(--accent-weak)] text-[var(--accent)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.title}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )

  const Sidebar = () => (
    <div className="flex h-full flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-surface)]">
      <div className={cn("flex h-14 items-center border-b border-[var(--border-subtle)] px-3", collapsed ? "justify-center" : "gap-2.5")}>
        <Image src="/growzzy-logo.png" alt="Growzzy" width={26} height={26} className="h-[26px] w-[26px] rounded-[6px]" priority />
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-bold text-[var(--text-primary)]">Growzzy</span>
              <span className="rounded-full bg-[var(--status-warn-bg)] px-1.5 py-0.5 text-[8px] font-bold text-[var(--status-warn-text)]">BETA</span>
            </div>
            <p className="text-[9px] text-[var(--text-muted)]">Campaign operating system</p>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-4">
        <NavGroup label="" items={primaryNav} />

        {!collapsed && (
          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between px-3">
              <p className="text-[10px] font-semibold text-[var(--text-secondary)]">Recent Searches</p>
              <button onClick={() => router.push("/dashboard/campaigns/new")} title="New prompt" className="grid h-5 w-5 place-items-center rounded text-[var(--accent)] hover:bg-[var(--accent-weak)]">
                <Plus className="h-3 w-3" />
              </button>
            </div>
            <button onClick={() => router.push("/dashboard/campaigns/new")} className="w-full rounded-[8px] px-3 py-2 text-left text-[11px] leading-4 text-[var(--text-muted)] hover:bg-[var(--bg-hover)]">
              Your saved campaign prompts appear here after you build a plan.
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-[var(--border-subtle)] p-2">
        {!collapsed && (
          <div className="mb-2 rounded-[10px] bg-[var(--bg-inset)] p-3">
            <div className="mb-2 flex items-center justify-between text-[10px] font-medium text-[var(--text-secondary)]">
              <span>Getting started</span><span>75%</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-[var(--border-strong)]"><div className="h-full w-3/4 rounded-full bg-[var(--accent)]" /></div>
          </div>
        )}
        <button onClick={() => router.push("/dashboard/campaigns")} title="Quick Find" className={cn("mb-1 flex h-9 w-full items-center rounded-[8px] px-3 text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]", collapsed ? "justify-center" : "gap-2.5")}>
          <Search className="h-4 w-4" />{!collapsed && <><span className="flex-1 text-left">Quick Find</span><kbd className="rounded border px-1 text-[9px]">Ctrl K</kbd></>}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn("flex w-full items-center rounded-[10px] p-2 hover:bg-[var(--bg-hover)]", collapsed ? "justify-center" : "gap-2")}>
              <Avatar className="h-7 w-7"><AvatarFallback className="bg-[var(--accent-weak)] text-[10px] font-bold text-[var(--accent)]">{(session?.user?.name || "G").slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
              {!collapsed && <><div className="min-w-0 flex-1 text-left"><p className="truncate text-[11px] font-semibold">{session?.user?.name || "Growzzy user"}</p><p className="truncate text-[9px] text-[var(--text-muted)]">{activeWorkspace?.name || "Growzzy workspace"}</p></div><ChevronsUpDown className="h-3 w-3 text-[var(--text-muted)]" /></>}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>Workspace</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {workspaces.map((workspace) => <DropdownMenuItem key={workspace.id} onClick={() => selectWorkspace(workspace.id)} className="justify-between"><span className="truncate">{workspace.name}</span>{workspace.id === activeWorkspaceId && <Check className="h-3.5 w-3.5 text-[var(--accent)]" />}</DropdownMenuItem>)}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/auth" })}><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )

  if (immersive) return <div className="min-h-screen bg-white">{children}<BetaFeedbackWidget /></div>

  return (
    <div className="flex h-screen bg-[var(--bg-app)] text-[var(--text-primary)]">
      <aside className={cn("fixed inset-y-0 left-0 z-40 hidden transition-[width] lg:block", collapsed ? "w-[64px]" : "w-[250px]")}><Sidebar /></aside>
      <div className={cn("flex min-w-0 flex-1 flex-col transition-[padding]", collapsed ? "lg:pl-[64px]" : "lg:pl-[250px]")}>
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--border-subtle)] bg-white px-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setMobileSidebarOpen(true)} className="grid h-8 w-8 place-items-center rounded-[8px] hover:bg-[var(--bg-hover)] lg:hidden"><Menu className="h-4 w-4" /></button>
            <button onClick={() => setCollapsed((value) => !value)} className="hidden h-8 w-8 place-items-center rounded-[8px] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] lg:grid">{collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}</button>
            <button onClick={() => router.push("/dashboard/campaigns")} className="hidden items-center gap-2 rounded-[8px] px-2 py-1.5 text-[11px] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] md:flex"><Search className="h-3.5 w-3.5" />Quick find <kbd className="rounded border px-1 text-[9px]">Ctrl K</kbd></button>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => window.dispatchEvent(new Event("growzzy:open-feedback"))} className="h-8 rounded-[8px] px-2 text-[10px] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]">Feedback</button>
            <div className="relative"><button onClick={loadNotifications} title="Notifications" className="grid h-8 w-8 place-items-center rounded-[8px] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"><Bell className="h-4 w-4" /></button>{notificationsOpen && <div className="absolute right-0 z-50 mt-2 w-72 rounded-[12px] border bg-white p-2 shadow-[var(--shadow-popover)]">{notifications.length ? notifications.map((item) => <div key={item.id} className="rounded-[8px] p-2 hover:bg-[var(--bg-hover)]"><p className="text-[11px] font-semibold">{item.title}</p><p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{item.body}</p></div>) : <p className="p-3 text-[11px] text-[var(--text-muted)]">You are up to date.</p>}</div>}</div>
            <button onClick={() => router.push("/dashboard/campaigns/new")} className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-[8px] bg-[var(--accent)] px-3 text-[11px] font-semibold text-white shadow-sm"><Plus className="h-3.5 w-3.5" />New campaign</button>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto"><div className="mx-auto w-full max-w-[1440px]">{children}</div></main>
        <BetaFeedbackWidget />
      </div>
      {mobileSidebarOpen && <div className="fixed inset-0 z-[1000] lg:hidden"><button className="absolute inset-0 bg-black/30" onClick={() => setMobileSidebarOpen(false)} aria-label="Close navigation" /><div className="absolute inset-y-0 left-0 w-[240px]"><Sidebar /><button onClick={() => setMobileSidebarOpen(false)} className="absolute right-[-42px] top-2 grid h-9 w-9 place-items-center text-white"><X className="h-5 w-5" /></button></div></div>}
    </div>
  )
}
