"use client"

import { useEffect, useState, type FormEvent } from "react"
import Image from "next/image"
import { useRouter, usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  Megaphone,
  Plug,
  Sparkles,
  Zap,
  FileBarChart,
  Settings,
  LogOut,
  ChevronDown,
  Bell,
  Check,
  Menu,
  X,
  Search,
  Plus,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronsUpDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useSession, signOut } from "next-auth/react"
import { useTheme } from "next-themes"
import { BetaFeedbackWidget } from "@/components/BetaFeedbackWidget"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  children?: { title: string; href: string }[]
}

type NotificationItem = {
  id: string
  title: string
  body: string
  type: string
  isRead: boolean
  createdAt: string
}

type WorkspaceItem = {
  id: string
  name: string
  slug: string
  logo?: string | null
  role: string
  _count?: { members?: number; adAccounts?: number; campaigns?: number }
}

const navItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Campaigns", href: "/dashboard/campaigns", icon: Megaphone },
  { title: "Ad Accounts", href: "/dashboard/accounts", icon: Plug },
  { title: "Creative Studio", href: "/dashboard/creatives/generate", icon: Sparkles },
  { title: "Leads", href: "/dashboard/leads", icon: Users },
  { title: "Automations", href: "/dashboard/automations", icon: Zap },
  { title: "AI Advisor", href: "/dashboard/ai-advisor", icon: Sparkles },
  { title: "Reports", href: "/dashboard/reports", icon: FileBarChart },
  { title: "Settings", href: "/dashboard/settings", icon: Settings },
]

const ACTIVE_WORKSPACE_COOKIE = "growzzy_active_workspace_id"
const WORKSPACES_CACHE_KEY = "growzzy_workspaces_cache_v1"
const WORKSPACES_CACHE_TTL_MS = 5 * 60 * 1000
const ONBOARDING_CHECK_CACHE_KEY = "growzzy_onboarding_checked_at"
const ONBOARDING_CHECK_TTL_MS = 3 * 60 * 1000

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [expandedItems, setExpandedItems] = useState<string[]>(["Analytics"])
  const [collapsed, setCollapsed] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notificationsLoaded, setNotificationsLoaded] = useState(false)
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null)
  const [globalSearch, setGlobalSearch] = useState("")
  const router = useRouter()
  const pathname = usePathname()
  const { data: session } = useSession()
  const { theme, setTheme } = useTheme()
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) || workspaces[0]

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === href
    return pathname.startsWith(href)
  }

  const toggleExpand = (title: string) => {
    setExpandedItems((prev) => (prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]))
  }

  useEffect(() => {
    if (!notificationsOpen) return
    let cancelled = false
    const loadNotifications = async () => {
      try {
        const response = await fetch("/api/notifications")
        if (!response.ok) return
        const data = await response.json()
        if (!cancelled) {
          setNotifications(data.notifications || [])
          setUnreadCount(Number(data.unreadCount || 0))
          setNotificationsLoaded(true)
        }
      } catch {
        if (!cancelled) {
          setNotifications([])
          setUnreadCount(0)
          setNotificationsLoaded(true)
        }
      }
    }
    void loadNotifications()
    const interval = window.setInterval(loadNotifications, 120_000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [notificationsOpen])

  useEffect(() => {
    let cancelled = false
    const hydrateCachedWorkspaces = () => {
      try {
        const raw = window.sessionStorage.getItem(WORKSPACES_CACHE_KEY)
        if (!raw) return false
        const cached = JSON.parse(raw) as { at: number; items: WorkspaceItem[] }
        if (!Array.isArray(cached?.items) || Date.now() - Number(cached.at || 0) > WORKSPACES_CACHE_TTL_MS) return false
        const savedWorkspaceId = window.localStorage.getItem(ACTIVE_WORKSPACE_COOKIE)
        const nextActive =
          cached.items.find((workspace) => workspace.id === savedWorkspaceId)?.id ||
          cached.items[0]?.id ||
          null
        setWorkspaces(cached.items)
        setActiveWorkspaceId(nextActive)
        return true
      } catch {
        return false
      }
    }
    const loadWorkspaces = async () => {
      try {
        const response = await fetch("/api/workspaces", { cache: "no-store" })
        if (!response.ok) return
        const data = await response.json()
        if (!cancelled) {
          const loadedWorkspaces = data.workspaces || []
          try {
            window.sessionStorage.setItem(WORKSPACES_CACHE_KEY, JSON.stringify({ at: Date.now(), items: loadedWorkspaces }))
          } catch {}
          const savedWorkspaceId = window.localStorage.getItem(ACTIVE_WORKSPACE_COOKIE)
          const nextActive =
            loadedWorkspaces.find((workspace: WorkspaceItem) => workspace.id === savedWorkspaceId)?.id ||
            loadedWorkspaces[0]?.id ||
            null
          setWorkspaces(loadedWorkspaces)
          setActiveWorkspaceId(nextActive)
          if (nextActive) {
            window.localStorage.setItem(ACTIVE_WORKSPACE_COOKIE, nextActive)
            document.cookie = `${ACTIVE_WORKSPACE_COOKIE}=${nextActive}; path=/; max-age=31536000; samesite=lax`
          }
        }
      } catch {
        if (!cancelled) setWorkspaces([])
      }
    }
    hydrateCachedWorkspaces()
    void loadWorkspaces()
    window.addEventListener("growzzy:workspace-updated", loadWorkspaces)
    return () => {
      cancelled = true
      window.removeEventListener("growzzy:workspace-updated", loadWorkspaces)
    }
  }, [])

  const selectWorkspace = (workspaceId: string) => {
    setActiveWorkspaceId(workspaceId)
    window.localStorage.setItem(ACTIVE_WORKSPACE_COOKIE, workspaceId)
    document.cookie = `${ACTIVE_WORKSPACE_COOKIE}=${workspaceId}; path=/; max-age=31536000; samesite=lax`
    window.dispatchEvent(new Event("growzzy:workspace-changed"))
    router.refresh()
  }

  useEffect(() => {
    if (!session?.user?.id || pathname === "/dashboard/onboarding") return
    try {
      const lastCheckedAt = Number(window.sessionStorage.getItem(ONBOARDING_CHECK_CACHE_KEY) || 0)
      if (Date.now() - lastCheckedAt < ONBOARDING_CHECK_TTL_MS) return
      window.sessionStorage.setItem(ONBOARDING_CHECK_CACHE_KEY, String(Date.now()))
    } catch {}
    let cancelled = false

    const checkOnboarding = async () => {
      try {
        const response = await fetch("/api/onboarding")
        if (!response.ok) return
        const data = await response.json()
        if (!cancelled && data.shouldShowOnboarding) {
          router.replace("/dashboard/onboarding")
        }
      } catch {
        // Onboarding checks should never block the app shell.
      }
    }

    checkOnboarding()
    return () => {
      cancelled = true
    }
  }, [pathname, router, session?.user?.id])

  const markNotificationRead = async (id: string) => {
    setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)))
    setUnreadCount((prev) => Math.max(0, prev - 1))
    await fetch(`/api/notifications/${id}`, { method: "PATCH" }).catch(() => undefined)
  }

  const submitGlobalSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const query = globalSearch.trim()
    if (!query) return
    router.push(`/dashboard/campaigns?search=${encodeURIComponent(query)}`)
  }

  const createWorkspace = async () => {
    const name = window.prompt("Workspace name")
    if (!name) return
    await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
    window.dispatchEvent(new Event("growzzy:workspace-updated"))
  }

  const WorkspaceMenu = ({ align = "start", children }: { align?: "start" | "end"; children: React.ReactNode }) => {
    const workspaceList = workspaces.length ? workspaces : [{ id: "default", name: "Growzzy Workspace", slug: "growzzy", role: "ADMIN" }]
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="w-60">
          <DropdownMenuLabel>Switch workspace</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {workspaceList.map((workspace) => (
            <DropdownMenuItem key={workspace.id} className="justify-between" onClick={() => selectWorkspace(workspace.id)}>
              <span className="truncate">{workspace.name}</span>
              {workspace.id === activeWorkspace?.id && <Check className="h-3.5 w-3.5 text-[#1F57F5]" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={createWorkspace}>+ Create workspace</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white border-r border-border font-satoshi">
      <div className="h-14 flex items-center gap-3 px-3 border-b border-border">
        <div className="w-7 h-7 rounded-[6px] overflow-hidden border border-[#1F57F5]/20 shadow-sm bg-[#1F57F5]">
          <Image src="/growzzy-logo.png" alt="Growzzy OS" width={28} height={28} className="h-full w-full object-cover" priority />
        </div>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <h2 className="text-[13px] font-bold tracking-tight text-text-primary leading-none">GROWZZY OS</h2>
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[8px] font-black tracking-wider text-amber-700">BETA</span>
          </div>
        )}
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const active = isActive(item.href)
          const isExpanded = expandedItems.includes(item.title)
          return (
            <div key={item.title}>
              <button
                onClick={() => {
                  if (collapsed) {
                    router.push(item.href)
                    return
                  }
                  if (item.children) toggleExpand(item.title)
                  else router.push(item.href)
                }}
                title={item.title}
                className={cn(
                  "w-full flex items-center justify-between px-2.5 py-2 rounded-[8px] text-[12px] font-medium transition-all group",
                  active ? "bg-[#1F57F5]/10 text-[#1F57F5]" : "text-text-secondary hover:bg-gray-50 hover:text-text-primary"
                )}
              >
                <div className={cn("flex items-center", collapsed ? "justify-center w-full" : "gap-2.5")}>
                  <item.icon className={cn("w-4 h-4", active ? "text-[#1F57F5]" : "text-text-tertiary")} />
                  {!collapsed && <span>{item.title}</span>}
                </div>
                {!collapsed && item.children && <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", isExpanded ? "rotate-180" : "")} />}
              </button>
              {!collapsed && item.children && isExpanded && (
                <div className="ml-7 space-y-0.5 my-0.5">
                  {item.children.map((child) => {
                    const childActive = pathname === child.href
                    return (
                      <button
                        key={child.href}
                        onClick={() => router.push(child.href)}
                        className={cn(
                          "w-full text-left py-1.5 px-2 rounded-[4px] text-[11px] transition-all font-medium block border-l-2",
                          childActive ? "border-[#1F57F5] text-[#1F57F5] bg-gray-50" : "border-transparent text-text-secondary hover:text-text-primary hover:bg-gray-50"
                        )}
                      >
                        {child.title}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      <div className="p-2 border-t border-border">
        <WorkspaceMenu align="end">
          <button className={cn("w-full rounded-[8px] p-2 transition-colors hover:bg-gray-50", collapsed ? "flex justify-center" : "flex items-center gap-2")}>
            <div className="w-7 h-7 rounded-full bg-[#1F57F5]/10 flex items-center justify-center text-[#1F57F5] font-bold text-xs flex-shrink-0">
              {(activeWorkspace?.name || session?.user?.name || "G")[0]}
            </div>
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[12px] font-medium text-text-primary truncate">{activeWorkspace?.name || session?.user?.name || "Growzzy Workspace"}</p>
                </div>
                <ChevronsUpDown className="h-3.5 w-3.5 text-slate-400" />
              </>
            )}
          </button>
        </WorkspaceMenu>
        {!collapsed && (
          <button onClick={() => signOut({ callbackUrl: "/auth" })} className="mt-1 flex w-full items-center justify-center gap-2 rounded-[8px] px-2 py-1.5 text-[11px] font-medium text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600">
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-gray-50 font-satoshi selection:bg-[#1F57F5]/20">
      <aside className={cn("hidden lg:flex flex-col fixed left-0 top-0 bottom-0 z-20 transition-all", collapsed ? "w-[68px]" : "w-[210px]")}>
        <SidebarContent />
      </aside>
      <div className={cn("flex-1 flex flex-col min-w-0 relative transition-all", collapsed ? "lg:pl-[68px]" : "lg:pl-[210px]")}>
        <header className="h-14 bg-white border-b border-border flex items-center justify-between gap-3 px-4 sticky top-0 z-30">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button onClick={() => setMobileSidebarOpen(true)} className="lg:hidden p-1.5 hover:bg-gray-100 rounded-md text-text-secondary">
              <Menu className="w-5 h-5" />
            </button>
            <button onClick={() => setCollapsed((prev) => !prev)} className="hidden lg:inline-flex p-1.5 hover:bg-gray-100 rounded-md text-text-secondary">
              {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>

            <form onSubmit={submitGlobalSearch} className="relative hidden w-full max-w-md md:flex">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
              <input
                value={globalSearch}
                onChange={(event) => setGlobalSearch(event.target.value)}
                placeholder="Search campaigns, accounts, creatives..."
                className="h-9 w-full rounded-lg border border-border bg-white pl-8 pr-10 text-[13px] shadow-sm outline-none focus:border-[#1F57F5] focus:ring-1 focus:ring-[#1F57F5]"
              />
              <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-400">⌘K</kbd>
            </form>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="text-text-tertiary hover:text-text-primary transition-colors p-2">
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <div className="relative">
              <button onClick={() => setNotificationsOpen((prev) => !prev)} className="text-text-tertiary hover:text-text-primary transition-colors relative p-1">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 bg-red-500 rounded-full border-2 border-white text-[9px] leading-[11px] font-bold text-white text-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-[280px] rounded-xl border border-border bg-white shadow-xl p-2 z-50">
                  <p className="px-2 py-1 text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Notifications</p>
                  {!notificationsLoaded ? (
                    <div className="rounded-lg border border-border px-3 py-4 text-[12px] text-text-secondary">
                      Loading notifications...
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="rounded-lg border border-border px-3 py-4 text-[12px] text-text-secondary">
                      You are up to date. New sync, audit, and automation events will appear here.
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {notifications.map((item) => (
                      <button key={item.id} onClick={() => markNotificationRead(item.id)} className="w-full text-left rounded-lg border border-border px-2 py-2 hover:bg-gray-50">
                        <p className="text-[12px] font-semibold text-text-primary">{item.title}</p>
                        <p className="text-[11px] text-text-secondary mt-0.5">{item.body}</p>
                        <p className="text-[10px] text-text-tertiary mt-1">{new Date(item.createdAt).toLocaleString()}</p>
                      </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <button onClick={() => router.push("/dashboard/campaigns/new")} className="btn btn-primary h-8 px-3 text-[11px] font-bold shadow-sm">
              <Plus className="w-3.5 h-3.5 mr-1" /> Create
            </button>
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-[#1F57F5]/10 text-xs font-bold text-[#1F57F5]">
                {(session?.user?.name || session?.user?.email || "MP").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto px-3 py-3 scroll-smooth">
          <div className="max-w-[1240px] mx-auto">{children}</div>
        </main>
        <BetaFeedbackWidget />
      </div>
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-[1000] lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setMobileSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-[240px] bg-white shadow-xl flex flex-col">
            <SidebarContent />
            <button onClick={() => setMobileSidebarOpen(false)} className="absolute top-2 right-[-44px] w-10 h-10 flex items-center justify-center text-white">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
