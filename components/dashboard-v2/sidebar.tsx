"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  ChevronDown,
  ChevronRight,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  Megaphone,
  FolderKanban,
  Sparkles,
  History,
  LayoutDashboard,
  MonitorPlay,
  BarChart3,
  Zap,
  Palette,
  Settings,
  FileText,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
}

const CREATE_NAV: NavItem[] = [
  { href: "/dashboard/campaigns/new", label: "New Campaign", icon: Megaphone },
  { href: "/dashboard/projects",      label: "Projects",      icon: FolderKanban },
  { href: "/dashboard/brand",         label: "My Brand",       icon: Sparkles },
  { href: "/dashboard/prompts",       label: "Recent Prompts", icon: History },
]

const MANAGE_NAV: NavItem[] = [
  { href: "/dashboard",              label: "Dashboard",      icon: LayoutDashboard },
  { href: "/dashboard/ads",          label: "Ads Manager",    icon: MonitorPlay },
  { href: "/dashboard/analytics",    label: "Analytics",      icon: BarChart3 },
  { href: "/dashboard/optimization", label: "AI Optimization",icon: Zap },
  { href: "/dashboard/reports",      label: "Reports",        icon: FileText },
  { href: "/dashboard/studio",       label: "Ad Studio",      icon: Palette },
]

const SETTINGS_ITEM: NavItem = { href: "/dashboard/settings", label: "Settings", icon: Settings }

function readSessionValue<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const value = window.sessionStorage.getItem(key)
    return value ? (JSON.parse(value) as T) : fallback
  } catch {
    return fallback
  }
}

function writeSessionValue(key: string, value: unknown) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

interface SidebarProps {
  collapsed?: boolean
  onToggle?: () => void
}

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [promptsExpanded, setPromptsExpanded] = useState(true)
  const [progress, setProgress] = useState<number | null>(() => readSessionValue("growzzy_sidebar_progress", null))
  const [workspaceName, setWorkspaceName] = useState(() => readSessionValue("growzzy_sidebar_workspace", "Growzzy Workspace"))
  const [profile, setProfile] = useState<{ name: string; email: string; image: string | null } | null>(() =>
    readSessionValue("growzzy_sidebar_profile", null)
  )
  const [recentPrompts, setRecentPrompts] = useState<{ id: string; campaignName: string }[]>(() =>
    readSessionValue("growzzy_sidebar_prompts", [])
  )

  useEffect(() => {
    const loadProgress = () => {
      fetch("/api/onboarding-progress", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => {
          if (typeof json?.progress === "number") {
            setProgress(json.progress)
            writeSessionValue("growzzy_sidebar_progress", json.progress)
          }
        })
        .catch(() => {})
    }
    loadProgress()
    window.addEventListener("growzzy:onboarding-progress-updated", loadProgress)
    window.addEventListener("growzzy:workspace-updated", loadProgress)
    return () => {
      window.removeEventListener("growzzy:onboarding-progress-updated", loadProgress)
      window.removeEventListener("growzzy:workspace-updated", loadProgress)
    }
  }, [])

  useEffect(() => {
    const loadProfile = () => {
      fetch("/api/auth/me", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => {
          if (json?.user) {
            setProfile(json.user)
            writeSessionValue("growzzy_sidebar_profile", json.user)
          }
        })
        .catch(() => {})
    }
    loadProfile()
    window.addEventListener("growzzy:profile-updated", loadProfile)
    return () => window.removeEventListener("growzzy:profile-updated", loadProfile)
  }, [])

  useEffect(() => {
    const loadPrompts = () => {
      fetch("/api/ai/campaign-plans", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => {
          const items = Array.isArray(json?.plans) ? json.plans : []
          const prompts = items.slice(0, 3).map((item: { id: string; campaignName: string }) => ({ id: item.id, campaignName: item.campaignName }))
          setRecentPrompts(prompts)
          writeSessionValue("growzzy_sidebar_prompts", prompts)
        })
        .catch(() => {})
    }
    loadPrompts()
    window.addEventListener("growzzy:prompt-history-updated", loadPrompts)
    return () => window.removeEventListener("growzzy:prompt-history-updated", loadPrompts)
  }, [])

  useEffect(() => {
    fetch("/api/workspaces", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const workspaces = json?.workspaces ?? []
        const activeId = window.localStorage.getItem("growzzy_active_workspace_id")
        const active = workspaces.find((workspace: { id: string }) => workspace.id === activeId) || workspaces[0]
        if (active?.name) {
          setWorkspaceName(active.name)
          writeSessionValue("growzzy_sidebar_workspace", active.name)
        }
      })
      .catch(() => {})
  }, [])

  const isActive = (href: string) => {
    if (href === "/dashboard/campaigns/new") return pathname === "/dashboard/campaigns/new"
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname.startsWith(href)
  }

  const navLink = (item: NavItem) => {
    const active = isActive(item.href)
    const Icon = item.icon
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "flex items-center gap-2.5 px-2 py-1.5 rounded-[9px] text-[13px] transition-colors",
          active
            ? "bg-white text-[#111827] shadow-[0_1px_4px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.05)]"
            : "text-[#4B5563] hover:bg-white/60 hover:text-[#111827]"
        )}
      >
        <Icon
          size={15}
          strokeWidth={active ? 2.2 : 1.8}
          className={cn("shrink-0", active ? "text-[#1F57F5]" : "text-[#6B7280]")}
        />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </Link>
    )
  }

  return (
    <aside
      className={cn(
        "sku-sidebar flex flex-col h-screen border-r border-[#DDE1E7] transition-all duration-200 shrink-0",
        collapsed ? "w-[52px]" : "w-[224px]"
      )}
    >
      {/* Logo header */}
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-[#DDE1E7]">
        <div className="flex items-center gap-2.5 min-w-0">
          <Image
            src="/growzzy-logo.png"
            alt="Growzzy OS"
            width={28}
            height={28}
            className="shrink-0"
            unoptimized
          />
          {!collapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold text-[14px] text-[#111827] tracking-tight leading-none truncate">
                Growzzy OS
              </span>
              <span
                className="text-[9px] font-bold text-[#1F57F5] px-1.5 py-0.5 rounded-full uppercase tracking-wider leading-none shrink-0"
                style={{ background: "#EAF0FE" }}
              >
                BETA
              </span>
            </div>
          )}
        </div>
        <button
          onClick={onToggle}
          className="w-6 h-6 flex items-center justify-center rounded-[6px] text-[#9CA3AF] hover:text-[#374151] hover:bg-black/5 transition-colors shrink-0"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">

        {/* CREATE group */}
        {!collapsed && (
          <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-[0.1em] px-2 pt-1 pb-1.5 select-none">
            Create
          </p>
        )}

        {CREATE_NAV.map((item) => {
          if (item.href === "/dashboard/prompts") {
            const active = isActive(item.href)
            const Icon = item.icon
            return (
              <div key={item.href}>
                <div className="flex items-center gap-0.5">
                  <Link
                    href={item.href}
                    className={cn(
                      "flex-1 flex items-center gap-2.5 px-2 py-1.5 rounded-[9px] text-[13px] transition-colors",
                      active
                        ? "bg-white text-[#111827] shadow-[0_1px_4px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.05)]"
                        : "text-[#4B5563] hover:bg-white/60 hover:text-[#111827]"
                    )}
                  >
                    <Icon
                      size={15}
                      strokeWidth={active ? 2.2 : 1.8}
                      className={cn("shrink-0", active ? "text-[#1F57F5]" : "text-[#6B7280]")}
                    />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                  {!collapsed && (
                    <>
                      <button
                        onClick={() => setPromptsExpanded(!promptsExpanded)}
                        className="p-1.5 rounded text-[#9CA3AF] hover:text-[#374151] transition-colors"
                        aria-label={promptsExpanded ? "Collapse prompts" : "Expand prompts"}
                      >
                        {promptsExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      </button>
                      <button
                        className="p-1.5 rounded text-[#9CA3AF] hover:text-[#1F57F5] transition-colors"
                        aria-label="New prompt"
                      >
                        <Plus size={12} />
                      </button>
                    </>
                  )}
                </div>
                {!collapsed && promptsExpanded && (
                  <div className="ml-7 mt-0.5">
                    {recentPrompts.length ? (
                      <div className="space-y-0.5">
                        {recentPrompts.map((prompt) => (
                          <Link
                            key={prompt.id}
                            href={{ pathname: "/dashboard/campaigns/new", query: { reuse: prompt.id } }}
                            className="block px-2 py-1.5 rounded-[8px] text-[11px] text-[#6B7280] hover:bg-white/60 hover:text-[#111827] truncate"
                            title={prompt.campaignName}
                          >
                            {prompt.campaignName}
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-[#9CA3AF] px-2 py-1.5 italic">No saved prompts yet</p>
                    )}
                  </div>
                )}
              </div>
            )
          }
          return navLink(item)
        })}

        {/* MANAGE group */}
        {!collapsed && (
          <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-[0.1em] px-2 pt-3 pb-1.5 select-none">
            Manage
          </p>
        )}
        {collapsed && <div className="my-2 mx-2 border-t border-[#DDE1E7]" />}

        {MANAGE_NAV.map((item) => navLink(item))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-[#DDE1E7] px-2 py-2.5 space-y-1">

        {/* Getting Started progress */}
        {!collapsed && (
          <div className="px-2 pt-1 pb-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11.5px] font-semibold text-[#374151]">Getting Started</span>
              <span className="text-[11px] font-bold text-[#9CA3AF] tabular">{progress === null ? "..." : `${progress}%`}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden bg-[#E5E7EB]">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress ?? 0}%`, background: "#1F57F5" }}
              />
            </div>
          </div>
        )}

        {/* Settings */}
        {navLink(SETTINGS_ITEM)}

        {/* User card */}
        <Link
          href="/dashboard/settings?tab=profile"
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-[9px] hover:bg-white/60 cursor-pointer transition-colors"
          aria-label="Account menu"
        >
          <span
            className="w-[26px] h-[26px] rounded-full overflow-hidden flex items-center justify-center text-white text-[10px] font-bold shrink-0"
            style={{ background: "#1F57F5" }}
          >
            {profile?.image ? <img src={profile.image} alt="" className="w-full h-full object-cover" /> : (profile?.name || session?.user?.name || profile?.email || session?.user?.email || "G").charAt(0).toUpperCase()}
          </span>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[12px] font-semibold text-[#111827] truncate leading-tight">{profile?.name || session?.user?.name || profile?.email || session?.user?.email || "Growzzy user"}</p>
                <p className="text-[10.5px] text-[#9CA3AF] truncate leading-tight">{workspaceName}</p>
              </div>
              <ChevronDown size={12} className="text-[#9CA3AF] shrink-0" />
            </>
          )}
        </Link>
      </div>
    </aside>
  )
}
