"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Shell } from "@/components/dashboard-v2/shell"
import {
  Compass, Rocket, Wand2, Megaphone, Paperclip, ChevronDown,
  CornerDownLeft, Loader2, Sparkles, User, Bot, ArrowRight,
  RefreshCw, Copy, Check, ExternalLink, Globe
} from "lucide-react"
import { cn } from "@/lib/utils"

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string
}

export default function NewCampaignPage() {
  const router = useRouter()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [prompt, setPrompt] = useState("")
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<"Standard" | "Direct Response" | "Fast Draft" | "Deep Strategy">("Standard")
  const [modeMenuOpen, setModeMenuOpen] = useState(false)
  const [brandName, setBrandName] = useState("MARKITX")
  const [brandContext, setBrandContext] = useState("")
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Read from localStorage brand memory if available
    try {
      const stored = localStorage.getItem("growzzy_brand_name")
      if (stored) setBrandName(stored)
      const full = localStorage.getItem("growzzy_brand_context_full")
      if (full) {
        setBrandContext(full)
        const parsed = JSON.parse(full)
        if (parsed.businessName) setBrandName(parsed.businessName)
      }
    } catch {}

    fetch("/api/workspaces")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const w = json?.workspaces?.[0]
        if (w?.name) setBrandName(w.name)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

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
          brandContext,
        }),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to get AI response")
      }

      const botMsg: ChatMessage = {
        id: String(Date.now() + 1),
        role: "assistant",
        content: data.message?.content || "I have analyzed your request.",
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

  const quickPrompts = [
    {
      id: "launch",
      icon: Compass,
      title: `Launch a campaign for ${brandName}`,
      description: `Build a lead-gen campaign for ${brandName} promoting AI infrastructure solutions, including multi-agent systems, automated AI workflows, and custom AI agents. targeting Operations-Heavy Businesses`,
      prompt: `Build a high-converting lead-gen Google Ads campaign for ${brandName} promoting AI infrastructure solutions, multi-agent systems, and automated AI workflows targeting Operations-Heavy Businesses.`,
    },
    {
      id: "own_keyword",
      icon: Rocket,
      title: `Own "AI infrastructure for businesses"`,
      description: `Build a Google Ads campaign for ${brandName} around "AI infrastructure for businesses" and similar high-intent searches`,
      prompt: `Build a Google Ads campaign for ${brandName} around "AI infrastructure for businesses", "enterprise AI workflows", and high-intent commercial keywords.`,
    },
    {
      id: "creative_pack",
      icon: Wand2,
      title: "Creative + copy pack",
      description: `Create ad copy and a visual for ${brandName} in our professional tone for Operations-Heavy Businesses`,
      prompt: `Create direct-response ad copy headlines, descriptions, and high-CTR visual banner prompts for ${brandName} targeting Operations-Heavy Businesses.`,
    },
    {
      id: "competitors",
      icon: Megaphone,
      title: "Study my competitors",
      description: `Research who competes with ${brandName} and how we should position against them`,
      prompt: `Perform competitive positioning analysis for ${brandName} vs legacy automation agencies and formulate direct-response counter-angles.`,
    },
  ]

  return (
    <Shell>
      <div className="max-w-[920px] mx-auto min-h-[calc(100vh-140px)] flex flex-col justify-between py-6 px-4">
        {/* Messages Stream OR Welcome Cards */}
        {messages.length === 0 ? (
          <div className="my-auto py-8">
            {/* Brand Logo & Greeting Header */}
            <div className="text-center space-y-3">
              <div className="w-11 h-11 rounded-[14px] bg-black text-white flex items-center justify-center font-black text-xl mx-auto shadow-sm tracking-tight">
                G<span className="text-[#1F57F5] text-xs -mt-2 ml-0.5">7</span>
              </div>

              <h1 className="text-[32px] sm:text-[36px] font-extrabold text-[#111827] tracking-tight">
                Hello, {brandName}
              </h1>

              <div className="text-[14px] sm:text-[14.5px] text-[#6B7280] max-w-[540px] mx-auto leading-relaxed">
                <p>I already know {brandName} — your offer, audience and competitors.</p>
                <p>Ask me anything, or tell me what to launch.</p>
              </div>
            </div>

            {/* 2x2 Quick Action Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
              {quickPrompts.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSendMessage(item.prompt)}
                    className="p-5 bg-white border border-[#E5E7EB] rounded-[16px] text-left hover:border-[#1F57F5]/50 hover:shadow-md transition-all group relative flex flex-col justify-between cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center gap-3 mb-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#EAF0FE] text-[#1F57F5] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                          <Icon size={16} />
                        </div>
                        <h3 className="text-[14px] font-bold text-[#111827] group-hover:text-[#1F57F5] transition-colors leading-snug">
                          {item.title}
                        </h3>
                      </div>
                      <p className="text-[12px] text-[#6B7280] leading-relaxed line-clamp-3">
                        {item.description}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          /* Multi-Turn Chat Stream */
          <div className="flex-1 space-y-6 overflow-y-auto pb-6 pt-2">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold">
                  G
                </div>
                <span className="text-[13px] font-bold text-[#111827]">Growzzy Growth Agent</span>
              </div>
              <button
                onClick={() => setMessages([])}
                className="text-[12px] text-[#6B7280] hover:text-[#111827] flex items-center gap-1"
              >
                <RefreshCw size={12} /> New Thread
              </button>
            </div>

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-3",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-[#1F57F5] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-1 shadow-2xs">
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
                          {copiedId === msg.id ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
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
                  <div className="w-8 h-8 rounded-full bg-[#111827] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-1">
                    <User size={15} />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-3 items-start">
                <div className="w-8 h-8 rounded-full bg-[#1F57F5] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-1">
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
        )}

        {/* Bottom AI Search / Chat Input Box */}
        <div className="mt-4 relative">
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

            {/* Input Controls Bar */}
            <div className="flex items-center justify-between pt-3 border-t border-[#F3F4F6] mt-2">
              {/* Left Controls: Paperclip & Mode Selector */}
              <div className="flex items-center gap-2 relative">
                <button
                  type="button"
                  className="w-8 h-8 rounded-full text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] flex items-center justify-center transition-colors"
                  title="Attach website or reference file"
                >
                  <Paperclip size={15} />
                </button>

                {/* Mode Selector Pill */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setModeMenuOpen(!modeMenuOpen)}
                    className="h-7 px-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-full text-[11.5px] font-semibold text-[#374151] hover:bg-[#F3F4F6] flex items-center gap-1.5 transition-colors"
                  >
                    <span>{mode}</span>
                    <ChevronDown size={12} className="text-[#9CA3AF]" />
                  </button>

                  {modeMenuOpen && (
                    <div className="absolute bottom-full mb-1 left-0 w-44 bg-white border border-[#E5E7EB] rounded-[12px] shadow-lg py-1.5 z-20">
                      {(["Standard", "Direct Response", "Fast Draft", "Deep Strategy"] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => {
                            setMode(m)
                            setModeMenuOpen(false)
                          }}
                          className={cn(
                            "w-full px-3 py-1.5 text-left text-[12px] hover:bg-[#F9FAFB] flex items-center justify-between",
                            mode === m ? "font-bold text-[#1F57F5] bg-[#EAF0FE]/50" : "text-[#374151]"
                          )}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Control: Submit Circle Button */}
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!prompt.trim() || loading}
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center transition-all",
                  prompt.trim() && !loading
                    ? "bg-[#1F2937] hover:bg-black text-white shadow-2xs cursor-pointer"
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
