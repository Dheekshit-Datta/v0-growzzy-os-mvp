"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Shell } from "@/components/dashboard-v2/shell"
import { Button } from "@/components/ui/button"
import {
  Compass,
  Rocket,
  Wand2,
  Megaphone,
  Paperclip,
  ChevronDown,
  CornerDownLeft,
  Loader2,
  User,
  Bot,
  ArrowRight,
  RefreshCw,
  Copy,
  Check,
  Target,
  Gauge,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { StatusPill } from "@/components/growzzy/status-pill"
import {
  loadBrand,
  brandIsReady,
  brandContextText,
  type BrandProfile,
} from "@/lib/brand-store"

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string
}

const MODES = [
  { value: "standard", label: "Standard" },
  { value: "deep", label: "Deep research" },
]

function buildSuggestions(brand: BrandProfile) {
  const name = brand.businessName.trim()
  if (!brandIsReady(brand)) {
    return [
      {
        icon: Target,
        title: "Set up my brand from my site",
        description: "Analyse my website and learn my business, audience and competitors",
        prompt:
          "Analyse my website and learn my business, audience and competitors before we plan any campaign.",
      },
      {
        icon: Megaphone,
        title: "Plan my first campaign",
        description: "I want to launch my first ad campaign — ask me what you need to know",
        prompt:
          "I want to launch my first ad campaign — ask me what you need to know to build a high-converting plan.",
      },
      {
        icon: Wand2,
        title: "Ask about ads",
        description: "How should I split budget between Google Ads and Meta Ads?",
        prompt: "How should I split budget between Google Ads and Meta Ads for a new brand?",
      },
      {
        icon: Rocket,
        title: "Research my market",
        description: "Research my market and tell me what my competitors are advertising",
        prompt:
          "Research my market and tell me what my competitors are advertising right now.",
      },
    ]
  }
  const offer = (brand.whatTheySell || brand.productDescription).trim()
  const segment = brand.segments[0]?.segment ?? brand.audience
  const competitor = brand.competitors[0]?.name
  const keyword = brand.keywords[0]

  return [
    {
      icon: Target,
      title: `Launch a campaign for ${name}`,
      description: `Build a lead-gen campaign for ${name}${offer ? ` promoting ${offer}` : ""}${segment ? ` targeting ${segment}` : ""}`,
      prompt: `Build a high-converting lead-gen Google Ads campaign for ${name}${offer ? ` promoting ${offer}` : ""}${segment ? ` targeting ${segment}` : ""}.`,
    },
    {
      icon: Rocket,
      title: keyword ? `Own "${keyword}"` : "Capture high-intent search",
      description: keyword
        ? `Build a Google Ads campaign for ${name} around "${keyword}" and similar high-intent searches`
        : `Find the highest-intent search terms for ${name} and build a Google Ads campaign around them`,
      prompt: keyword
        ? `Build a Google Ads campaign for ${name} around "${keyword}" and similar high-intent searches.`
        : `Find the highest-intent search terms for ${name} and build a Google Ads campaign around them.`,
    },
    {
      icon: Wand2,
      title: "Creative + copy pack",
      description: `Create ad copy and a visual for ${name} in our ${brand.tone || "brand"} tone${segment ? ` for ${segment}` : ""}`,
      prompt: `Create direct-response ad copy headlines, descriptions, and a high-CTR visual banner prompt for ${name} in our ${brand.tone || "brand"} tone${segment ? ` for ${segment}` : ""}.`,
    },
    {
      icon: Megaphone,
      title: competitor ? `Beat ${competitor}` : "Study my competitors",
      description: competitor
        ? `Research what ${competitor} is doing in ads and how ${name} should position against them`
        : `Research who competes with ${name} and how we should position against them`,
      prompt: competitor
        ? `Research what ${competitor} is doing in ads and how ${name} should position against them.`
        : `Research who competes with ${name} and how we should position against them.`,
    },
  ]
}

export default function NewCampaignPage() {
  const router = useRouter()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [prompt, setPrompt] = useState("")
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<"standard" | "deep">("standard")
  const [modeMenuOpen, setModeMenuOpen] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [brand, setBrand] = useState<BrandProfile | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sync = () => setBrand(loadBrand())
    sync()
    window.addEventListener("growzzy:brand-updated", sync)
    return () => window.removeEventListener("growzzy:brand-updated", sync)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const brandReady = brand ? brandIsReady(brand) : false
  const brandName = brand?.businessName || "there"
  const suggestions = useMemo(() => buildSuggestions(brand ?? {
    businessName: "",
    website: "",
    industry: "",
    businessModel: "",
    whatTheySell: "",
    productDescription: "",
    positioning: "",
    differentiators: [],
    audience: "",
    segments: [],
    competitors: [],
    keywords: [],
    creativeAngles: [],
    tone: "friendly",
    palette: { name: "Growzzy", primary: "#1F57F5", accent: "#EAF0FE" },
    defaultLandingPage: "",
  }), [brand])

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || prompt).trim()
    if (!text || loading) return

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }

    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setPrompt("")
    setLoading(true)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
          brandContext: brand ? brandContextText(brand) : "",
        }),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to get AI response")
      }

      const reply = data.message?.content || "I have analyzed your request."
      const botMsg: ChatMessage = {
        id: String(Date.now() + 1),
        role: "assistant",
        content: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }

      setMessages([...nextMessages, botMsg])
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: String(Date.now() + 1),
        role: "assistant",
        content: `Error: ${err.message || "Failed to reach AI assistant."}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }
      setMessages([...nextMessages, errorMsg])
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleOpenInBuilder = (campaignPrompt: string) => {
    router.push(`/dashboard/campaigns/builder?prompt=${encodeURIComponent(campaignPrompt)}`)
  }

  const handleDownloadTranscript = () => {
    const md = messages
      .map((m) => `**${m.role === "user" ? "You" : "Growzzy"}:** ${m.content}`)
      .join("\n\n")
    const blob = new Blob([md], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `growzzy-transcript-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.md`
    document.body.append(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const hasMessages = messages.length > 0

  return (
    <Shell>
      <div className="mx-auto flex h-[calc(100vh-140px)] max-w-[1200px] flex-col gap-4 px-2 py-4">
        {hasMessages && (
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-2">
              <StatusPill variant={brandReady ? "success" : "warn"}>
                {brandReady ? `Brand: ${brand?.businessName}` : "No brand context"}
              </StatusPill>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadTranscript}>
                Download transcript
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setMessages([])}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                New thread
              </Button>
            </div>
          </div>
        )}

        {/* Messages Stream OR Welcome Cards */}
        {hasMessages ? (
          <div className="flex-1 space-y-5 overflow-y-auto pb-6 pt-2">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-3",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === "assistant" && (
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#1F57F5] text-xs font-bold text-white mt-1">
                    <Bot size={16} />
                  </div>
                )}

                <div
                  className={cn(
                    "max-w-[85%] rounded-[18px] p-4 text-[13.5px] leading-relaxed relative group shadow-2xs",
                    msg.role === "user"
                      ? "bg-[#1F57F5] text-white rounded-br-xs"
                      : "bg-white border border-[#E5E7EB] text-[#111827] rounded-bl-xs"
                  )}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>

                  {msg.role === "assistant" && (
                    <div className="flex items-center justify-between pt-3 mt-3 border-t border-[#F0F2F5] text-[11px] text-[#9CA3AF]">
                      <span>{msg.timestamp}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="hover:text-[#111827] flex items-center gap-1"
                        >
                          {copiedId === msg.id ? (
                            <Check size={12} className="text-green-600" />
                          ) : (
                            <Copy size={12} />
                          )}
                          <span>{copiedId === msg.id ? "Copied" : "Copy"}</span>
                        </button>
                        <button
                          onClick={() => handleOpenInBuilder(msg.content.slice(0, 300))}
                          className="px-2.5 py-1 bg-[#EAF0FE] text-[#1F57F5] font-bold rounded-md hover:bg-[#D5E3FD] transition-colors flex items-center gap-1"
                        >
                          <Rocket size={11} /> Open in Builder
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {msg.role === "user" && (
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#111827] text-xs font-bold text-white mt-1">
                    <User size={15} />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-3 items-start">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#1F57F5] text-xs font-bold text-white">
                  <Bot size={16} />
                </div>
                <div className="p-4 bg-white border border-[#E5E7EB] rounded-[18px] text-[13px] text-[#6B7280] flex items-center gap-2">
                  <Loader2 size={15} className="animate-spin text-[#1F57F5]" />
                  <span>Growzzy is analyzing market data and formulating strategy…</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-4">
            <div className="w-11 h-11 rounded-[14px] bg-black text-white flex items-center justify-center font-black text-xl mx-auto shadow-sm tracking-tight">
                  G<span className="text-[#1F57F5] text-xs -mt-2 ml-0.5">7</span>
                </div>

            <h1 className="mt-4 text-center text-[34px] font-semibold tracking-tight text-foreground">
              Hello, {brandName}
            </h1>

            <p className="mt-2 max-w-md text-center text-[14px] text-muted-foreground">
              {brandReady
                ? `I already know ${brand?.businessName} — your offer, audience and competitors. Ask me anything, or tell me what to launch.`
                : "Ask me anything about your ads and market. If I need your business, I'll ask for your website right here and analyse it live."}
            </p>

            {!brandReady && (
              <div className="mt-5 flex w-full max-w-xl items-center justify-between gap-3 rounded-[12px] border border-border bg-[#FBF0DA]/50 p-3.5">
                <span className="text-[12.5px] text-foreground">
                  No brand context yet — I&apos;ll ask for your website in the chat when I need it, or
                  set it up once in My Brand.
                </span>
                <Link
                  href="/dashboard/brand"
                  className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground"
                >
                  Set up My Brand
                </Link>
              </div>
            )}

            <div className="mt-8 grid w-full max-w-3xl grid-cols-1 gap-2.5 sm:grid-cols-2">
              {suggestions.map((s) => {
                const Icon = s.icon
                return (
                  <button
                    key={s.title}
                    type="button"
                    onClick={() => handleSendMessage(s.prompt)}
                    className="group flex items-start gap-3 rounded-[12px] border border-border bg-card p-3.5 text-left transition-colors hover:border-primary/30 hover:bg-[#EAF0FE]/40"
                  >
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#EAF0FE] text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block text-[13px] font-medium text-foreground">{s.title}</span>
                      <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">
                        {s.description}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Bottom Chat Input */}
        <div className="mt-2 relative">
          <div className="border-2 border-[#3B82F6] rounded-[20px] bg-white p-4 shadow-xs focus-within:ring-4 focus-within:ring-[#3B82F6]/10 transition-all">
            <textarea
              rows={2}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
              placeholder="Ask anything, or describe what to launch..."
              className="w-full bg-transparent text-[14px] text-[#111827] placeholder:text-[#9CA3AF] outline-none resize-none leading-relaxed"
            />

            <div className="flex items-center justify-between pt-3 border-t border-[#F3F4F6] mt-2">
              <div className="flex items-center gap-2 relative">
                <button
                  type="button"
                  className="w-8 h-8 rounded-full text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] flex items-center justify-center transition-colors"
                  title="Attach (coming soon)"
                >
                  <Paperclip size={15} />
                </button>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setModeMenuOpen(!modeMenuOpen)}
                    className="h-7 px-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-full text-[11.5px] font-semibold text-[#374151] hover:bg-[#F3F4F6] flex items-center gap-1.5 transition-colors"
                  >
                    <Gauge size={12} className="text-muted-foreground" />
                    <span>{MODES.find((m) => m.value === mode)?.label}</span>
                    <ChevronDown size={12} className="text-[#9CA3AF]" />
                  </button>

                  {modeMenuOpen && (
                    <div className="absolute bottom-full mb-1 left-0 w-44 bg-white border border-[#E5E7EB] rounded-[12px] shadow-lg py-1.5 z-20">
                      {MODES.map((m) => (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => {
                            setMode(m.value as "standard" | "deep")
                            setModeMenuOpen(false)
                          }}
                          className={cn(
                            "w-full px-3 py-1.5 text-left text-[12px] hover:bg-[#F9FAFB] flex items-center justify-between",
                            mode === m.value ? "font-bold text-[#1F57F5] bg-[#EAF0FE]/50" : "text-[#374151]"
                          )}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!prompt.trim() || loading}
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center transition-all",
                  prompt.trim() && !loading
                    ? "bg-[#1F2937] hover:bg-black text-white shadow-sm cursor-pointer"
                    : "bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed"
                )}
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin text-white" />
                ) : (
                  <CornerDownLeft size={16} />
                )}
              </button>
            </div>
          </div>

          <p className="text-[11.5px] text-[#9CA3AF] text-center mt-3">
            Growzzy can make mistakes. Review every campaign before launching.
          </p>
        </div>
      </div>
    </Shell>
  )
}