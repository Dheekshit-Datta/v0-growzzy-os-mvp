"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Shell } from "@/components/dashboard-v2/shell"
import { Button } from "@/components/ui/button"
import { AgentComposer } from "@/components/growzzy/agent-composer"
import { AgentMessageBlock, TextBlock } from "@/components/growzzy/agent-message"
import { StatusPill } from "@/components/growzzy/status-pill"
import {
  loadBrand,
  brandIsReady,
  brandContextText,
  type BrandProfile,
  emptyBrand,
} from "@/lib/brand-store"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  ChevronDown,
  Copy,
  Check,
  Download,
  RefreshCcw,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Target,
  Megaphone,
  Wand2,
  Rocket,
} from "lucide-react"
import type {
  AgentResponseBlock,
  ExecutionPlan,
  SearchResultCitation,
} from "@/app/api/chat/route"

/* ─────────────── Types ─────────────── */

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  blocks?: AgentResponseBlock[]
  timestamp: string
}

interface ChatError {
  kind: "credits" | "rate-limit" | "timeout" | "unknown"
  message: string
}

function buildSuggestions(brand: BrandProfile) {
  const name = brand.businessName.trim() || "my business"
  if (!brandIsReady(brand)) {
    return [
      {
        icon: Target,
        title: "Set up my brand from my site",
        text: "Analyse my website and learn my business, audience and competitors",
        prompt: "Analyse my website and learn my business, audience and competitors before we plan any campaign.",
      },
      {
        icon: Megaphone,
        title: "Plan my first campaign",
        text: "I want to launch my first ad campaign — ask me what you need to know",
        prompt: "I want to launch my first ad campaign — ask me what you need to know to build a high-converting plan.",
      },
      {
        icon: Wand2,
        title: "Ask about ads",
        text: "How should I split budget between Google Ads and Meta Ads?",
        prompt: "How should I split budget between Google Ads and Meta Ads for our business?",
      },
      {
        icon: Rocket,
        title: "Research my market",
        text: "Research my market and tell me what my competitors are advertising",
        prompt: "Research my market and tell me what my competitors are advertising right now.",
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
      text: `Build a lead-gen campaign for ${name}${offer ? ` promoting ${offer}` : ""}${segment ? ` targeting ${segment}` : ""}`,
      prompt: `Build a lead-gen campaign for ${name}${offer ? ` promoting ${offer}` : ""}${segment ? ` targeting ${segment}` : ""}`,
    },
    {
      icon: Rocket,
      title: keyword ? `Own "${keyword}"` : "Capture high-intent search",
      text: keyword
        ? `Build a Google Ads campaign for ${name} around "${keyword}" and similar high-intent searches`
        : `Find the highest-intent search terms for ${name} and build a Google Ads campaign around them`,
      prompt: keyword
        ? `Build a Google Ads campaign for ${name} around "${keyword}" and similar high-intent searches`
        : `Find the highest-intent search terms for ${name} and build a Google Ads campaign around them`,
    },
    {
      icon: Wand2,
      title: "Creative + copy pack",
      text: `Create ad copy and a visual for ${name} in our ${brand.tone || "professional"} tone${segment ? ` for ${segment}` : ""}`,
      prompt: `Create ad copy and a visual for ${name} in our ${brand.tone || "professional"} tone${segment ? ` for ${segment}` : ""}`,
    },
    {
      icon: Megaphone,
      title: competitor ? `Beat ${competitor}` : "Study my competitors",
      text: competitor
        ? `Research who competes with ${name} and how we should position against them`
        : `Research who competes with ${name} and how we should position against them`,
      prompt: competitor
        ? `Research who competes with ${name} and how we should position against them`
        : `Research who competes with ${name} and how we should position against them`,
    },
  ]
}

/* ─────────────── Main Page ─────────────── */

export default function NewCampaignPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [prompt, setPrompt] = useState("")
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState("auto")
  const [brand, setBrand] = useState<BrandProfile>(emptyBrand)
  const [hydrated, setHydrated] = useState(false)
  const [threadTitle, setThreadTitle] = useState<string | null>(null)
  const [chatError, setChatError] = useState<ChatError | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [planApprovals, setPlanApprovals] = useState<Record<string, boolean>>({})
  const [activePlan, setActivePlan] = useState<ExecutionPlan | null>(null)
  const [activeSources, setActiveSources] = useState<SearchResultCitation[]>([])
  const [previewStatus, setPreviewStatus] = useState<string>("Ready")
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastSubmission = useRef<string>("")

  // Load brand profile
  useEffect(() => {
    const sync = () => setBrand(loadBrand())
    sync()
    setHydrated(true)
    window.addEventListener("growzzy:brand-updated", sync)
    return () => window.removeEventListener("growzzy:brand-updated", sync)
  }, [])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  const brandReady = brandIsReady(brand)
  const greetingName = brandReady ? brand.businessName : "there"
  const suggestions = useMemo(() => buildSuggestions(brand), [brand])

  /* ─── Send message ─── */
  const sendMessage = useCallback(
    async (textToSend?: string) => {
      const text = (textToSend || prompt).trim()
      if (!text || loading) return

      lastSubmission.current = text
      setChatError(null)

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }

      const nextMessages = [...messages, userMsg]
      setMessages(nextMessages)
      setPrompt("")
      setLoading(true)

      if (/competitor|research|benchmark|compare/i.test(text)) {
        setPreviewStatus("Researching")
      } else {
        setPreviewStatus("Analyzing")
      }

      const controller = new AbortController()
      setAbortController(controller)

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: nextMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            brandContext: brandContextText(loadBrand()),
            threadTitle,
          }),
          signal: controller.signal,
        })

        const data = await res.json()

        if (!res.ok || data.error) {
          throw Object.assign(new Error(data.error || "Failed to get AI response"), {
            errorKind: data.errorKind,
            status: res.status,
          })
        }

        if (data.threadTitle && !threadTitle) {
          setThreadTitle(data.threadTitle)
        }

        if (data.sources && Array.isArray(data.sources) && data.sources.length > 0) {
          setActiveSources(data.sources)
          setPreviewStatus("Researching")
        }

        const blocks: AgentResponseBlock[] = data.blocks || []

        // Check if a plan was proposed
        const planBlock = blocks.find((b) => b.type === "plan") as any
        if (planBlock && planBlock.plan) {
          setActivePlan(planBlock.plan)
          setPreviewStatus("Awaiting approval")
        }

        const botMsg: ChatMessage = {
          id: `bot-${Date.now()}`,
          role: "assistant",
          content: "",
          blocks,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        }

        if (blocks.length > 0) {
          botMsg.content = blocks
            .filter((b) => b.type === "text")
            .map((b: any) => b.content)
            .join("\n\n")
        }

        setMessages([...nextMessages, botMsg])
      } catch (err: any) {
        if (err.name === "AbortError") {
          setMessages(nextMessages)
          return
        }

        const kind =
          err.errorKind ||
          (err.status === 429
            ? "rate-limit"
            : /credit|billing|quota/i.test(err.message)
              ? "credits"
              : /timeout|abort/i.test(err.message)
                ? "timeout"
                : "unknown")
        setChatError({ kind, message: err.message || "Failed to reach AI assistant." })
      } finally {
        setLoading(false)
        setAbortController(null)
      }
    },
    [messages, prompt, loading, threadTitle]
  )

  const stopGeneration = () => {
    abortController?.abort()
  }

  const retry = () => {
    if (!lastSubmission.current) return
    setChatError(null)
    sendMessage(lastSubmission.current)
  }

  const handleQuestionAnswer = (messageId: string, answers: Record<string, string>) => {
    const answerText = Object.entries(answers)
      .map(([, answer]) => answer)
      .join(". ")
    sendMessage(answerText)
  }

  const handlePlanApprove = (messageId: string) => {
    setPlanApprovals((prev) => ({ ...prev, [messageId]: true }))
    setPreviewStatus("Plan approved")
    sendMessage("Approved. Proceed with the plan.")
  }

  const handlePlanDecline = (messageId: string) => {
    sendMessage("I want to adjust the plan. Here are my changes:")
  }

  const copyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const downloadTranscript = () => {
    const lines: string[] = [
      `# Growzzy Chat Transcript`,
      `Thread: ${threadTitle || "Untitled"}`,
      `Date: ${new Date().toLocaleString()}`,
      `Brand: ${brand.businessName || "Not set"}`,
      "",
      "---",
      "",
    ]

    for (const msg of messages) {
      const role = msg.role === "user" ? "**You**" : "**Growzzy**"
      lines.push(`${role} (${msg.timestamp}):`)

      if (msg.blocks && msg.blocks.length > 0) {
        for (const block of msg.blocks) {
          switch (block.type) {
            case "text":
              lines.push(block.content)
              break
            case "research":
              lines.push(`\n**Research: ${block.topic}**`)
              for (const r of block.results || []) {
                lines.push(`- [${r.title}](${r.url}): ${r.snippet}`)
              }
              break
            case "questions":
              lines.push(`\n**Questions asked:**`)
              for (const q of block.questions) {
                lines.push(`- ${q.question}`)
              }
              break
            case "plan":
              lines.push(`\n**Execution Plan: ${block.plan.title}**`)
              for (const s of block.plan.steps) {
                lines.push(`${s.stepNumber}. ${s.title}: ${s.detail}`)
              }
              break
            case "creative":
              lines.push(`\n**Creative:**`)
              lines.push(`Headlines: ${block.creative.headlines.join(" | ")}`)
              lines.push(`CTA: ${block.creative.cta}`)
              break
            case "campaign":
              lines.push(`\n**Campaign: ${block.campaign.name}**`)
              lines.push(`Platform: ${block.campaign.platform}`)
              lines.push(`Objective: ${block.campaign.objective}`)
              break
          }
        }
      } else {
        lines.push(msg.content)
      }
      lines.push("")
      lines.push("---")
      lines.push("")
    }

    const blob = new Blob([lines.join("\n")], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `growzzy-transcript-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.md`
    document.body.append(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const newThread = () => {
    setMessages([])
    setThreadTitle(null)
    setChatError(null)
    setPlanApprovals({})
    setActivePlan(null)
    setActiveSources([])
    setPreviewStatus("Ready")
    setPrompt("")
  }

  const hasMessages = messages.length > 0
  const hasSideRail = activeSources.length > 0 || activePlan !== null

  return (
    <Shell>
      <div className="mx-auto flex h-[calc(100vh-116px)] max-w-[1240px] flex-col px-2 py-2">
        {/* Top Header */}
        {hasMessages && (
          <div className="flex items-center justify-between px-2 pb-3 border-b border-border mb-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[14px] font-semibold text-foreground truncate max-w-[420px]">
                {threadTitle || "New Campaign Strategy"}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-[12px] cursor-pointer"
                onClick={downloadTranscript}
              >
                <Download className="h-3.5 w-3.5" />
                Download transcript
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-[12px] cursor-pointer"
                onClick={newThread}
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                New thread
              </Button>
            </div>
          </div>
        )}

        {/* Main Area: Split Screen when Live Preview Rail is Active */}
        <div className="flex-1 flex gap-6 overflow-hidden">
          {/* Main Chat Thread */}
          <div className="flex-1 flex flex-col min-w-0 h-full">
            {hasMessages ? (
              <div className="flex-1 overflow-y-auto space-y-5 pb-4 pt-1 pr-1">
                {messages.map((msg) => (
                  <div key={msg.id}>
                    {msg.role === "user" ? (
                      /* User Message Bubble */
                      <div className="flex justify-end">
                        <div className="max-w-[85%] rounded-[18px] rounded-br-xs bg-[#f0f2f5] dark:bg-muted/70 text-foreground px-4 py-3 text-[13.5px] leading-relaxed shadow-2xs">
                          {msg.content}
                        </div>
                      </div>
                    ) : (
                      /* AI Message Blocks */
                      <div className="space-y-4 max-w-[92%]">
                        {msg.blocks && msg.blocks.length > 0 ? (
                          msg.blocks.map((block, i) => (
                            <div key={i}>
                              <AgentMessageBlock
                                block={block}
                                onQuestionAnswer={(answers) =>
                                  handleQuestionAnswer(msg.id, answers)
                                }
                                onPlanApprove={() => handlePlanApprove(msg.id)}
                                onPlanDecline={() => handlePlanDecline(msg.id)}
                                planApproved={planApprovals[msg.id]}
                              />
                            </div>
                          ))
                        ) : msg.content ? (
                          <TextBlock content={msg.content} />
                        ) : null}

                        {/* Footer info */}
                        <div className="flex items-center gap-3 pt-1 text-[11px] text-muted-foreground">
                          <span>{msg.timestamp}</span>
                          <button
                            type="button"
                            onClick={() =>
                              copyMessage(
                                msg.id,
                                msg.content ||
                                  msg.blocks
                                    ?.map((b) => (b.type === "text" ? b.content : ""))
                                    .join("\n") ||
                                  ""
                              )
                            }
                            className="flex items-center gap-1 hover:text-foreground cursor-pointer"
                          >
                            {copiedId === msg.id ? (
                              <Check className="h-3 w-3 text-emerald-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                            {copiedId === msg.id ? "Copied" : "Copy"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {loading && (
                  <div className="flex items-center gap-2 text-[13px] text-muted-foreground pt-1">
                    <div className="h-2 w-2 rounded-full bg-[#1F57F5] animate-ping" />
                    <span>Growzzy is thinking & formulating strategy…</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            ) : (
              /* Welcome Screen */
              <div className="flex flex-1 flex-col items-center justify-center px-4 my-auto">
                <div className="mb-4 h-11 w-11 rounded-[14px] bg-black text-white flex items-center justify-center font-black text-xl shadow-xs">
                  G<span className="text-[#1F57F5] text-xs -mt-2 ml-0.5">7</span>
                </div>

                <h1 className="text-[32px] sm:text-[36px] font-semibold tracking-tight text-foreground text-center">
                  Hello, {hydrated ? greetingName : "there"}
                </h1>
                <p className="mt-2 max-w-lg text-center text-[14px] text-muted-foreground leading-relaxed">
                  {hydrated && brandReady
                    ? `I already know ${brand.businessName} — your offer, audience and competitors. Ask me anything, or tell me what to launch.`
                    : "Ask me anything about your ads and market. If I need your business, I'll ask for your website right here and analyse it live."}
                </p>

                {hydrated && !brandReady && (
                  <div className="mt-5 flex w-full max-w-xl items-center justify-between gap-3 rounded-[12px] border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-3.5">
                    <span className="text-[12.5px] text-amber-900 dark:text-amber-300">
                      No brand context yet — I&apos;ll ask for your website in the chat when I need it, or set it up once in My Brand.
                    </span>
                    <Link
                      href="/dashboard/brand"
                      className="shrink-0 rounded-full bg-[#1F57F5] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#1845C2] transition-colors"
                    >
                      Set up My Brand
                    </Link>
                  </div>
                )}

                <div className="mt-8 grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2">
                  {suggestions.map((s) => {
                    const Icon = s.icon
                    return (
                      <button
                        key={s.title}
                        type="button"
                        onClick={() => sendMessage(s.prompt)}
                        className="group flex items-start gap-3 rounded-[14px] border border-border bg-card p-4 text-left transition-all hover:border-[#1F57F5]/40 hover:shadow-xs cursor-pointer"
                      >
                        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#EAF0FE] text-[#1F57F5] group-hover:scale-105 transition-transform">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span>
                          <span className="block text-[13.5px] font-medium text-foreground group-hover:text-[#1F57F5] transition-colors">
                            {s.title}
                          </span>
                          <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground line-clamp-2">
                            {s.text}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Sticky Right Preview Rail (Screenshots 3 & 5) */}
          {hasSideRail && (
            <div className="hidden lg:flex w-[320px] flex-col shrink-0 border-l border-border pl-5 py-1 space-y-4 overflow-y-auto">
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-bold tracking-wider text-muted-foreground uppercase">
                  Live Campaign Preview
                </span>
                <StatusPill variant={previewStatus === "Plan approved" ? "success" : "warn"}>
                  • {previewStatus}
                </StatusPill>
              </div>

              {/* Execution Plan preview */}
              {activePlan && (
                <div className="rounded-[14px] border border-border bg-card p-4 space-y-3 shadow-2xs">
                  <h5 className="text-[13px] font-semibold text-foreground leading-snug">
                    {activePlan.title}
                  </h5>
                  <div className="space-y-2 pt-1">
                    {activePlan.steps.map((step) => (
                      <div key={step.stepNumber} className="flex items-start gap-2.5 text-[12px]">
                        <span className="h-4 w-4 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold shrink-0 mt-0.5">
                          {step.stepNumber}
                        </span>
                        <span className="text-foreground/90 font-medium leading-tight">
                          {step.title}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sources Read (Screenshot 5) */}
              {activeSources.length > 0 && (
                <div className="rounded-[14px] border border-border bg-card p-4 space-y-2.5 shadow-2xs">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Sources Read ({activeSources.length})
                  </span>
                  <div className="space-y-2">
                    {activeSources.map((source, i) => (
                      <div key={i} className="text-[12px]">
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#1F57F5] hover:underline font-medium block truncate"
                        >
                          {source.site || "web"} — {source.title}
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error Banner */}
        {chatError && (
          <div className="my-2 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <div>
                <p className="text-[12.5px] font-medium text-amber-900 dark:text-amber-300">
                  {chatError.kind === "credits"
                    ? "AI credits exhausted"
                    : chatError.kind === "rate-limit"
                      ? "Rate limited — try again in a moment"
                      : "Couldn't reach Growzzy"}
                </p>
                <p className="text-[11px] text-amber-800 dark:text-amber-400">{chatError.message}</p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" onClick={retry} disabled={loading} className="gap-1.5 bg-[#1F57F5] text-white">
                <RefreshCw className="h-3.5 w-3.5" /> Retry
              </Button>
              <Button size="sm" variant="outline" onClick={() => setChatError(null)}>
                Dismiss
              </Button>
            </div>
          </div>
        )}

        {/* Bottom Composer */}
        <div className={cn("mt-auto pt-2 shrink-0", !hasMessages && "mx-auto w-full max-w-3xl")}>
          <AgentComposer
            value={prompt}
            onChange={setPrompt}
            onSend={() => sendMessage()}
            onStop={stopGeneration}
            loading={loading}
            mode={mode}
            onModeChange={setMode}
            placeholder={hasMessages ? "Ask anything…" : "Ask anything, or describe what to launch…"}
          />
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Growzzy can make mistakes. Review every campaign before launching.
          </p>
        </div>
      </div>
    </Shell>
  )
}