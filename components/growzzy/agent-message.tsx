"use client"

import React, { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  HelpCircle,
  ListOrdered,
  Loader2,
  Search,
  Send,
  Sparkles,
  CircleStop,
  ArrowRight,
  Briefcase,
  Smartphone,
  Globe,
} from "lucide-react"
import {
  ArtifactPill,
  ArtifactModal,
  type ArtifactData,
} from "@/components/growzzy/artifact-modal"
import { ParallelWorkersCard } from "@/components/growzzy/parallel-workers"

export interface AgentQuestionOption {
  label: string
  description?: string
  recommended?: boolean
}

export interface AgentQuestion {
  id: string
  question: string
  why?: string
  options?: AgentQuestionOption[]
}

export interface ExecutionPlanStep {
  stepNumber: number
  title: string
  detail?: string
  isParallel?: boolean
}

export interface ExecutionPlan {
  title?: string
  summary?: string
  steps?: ExecutionPlanStep[]
}

export interface CreativeOutput {
  caption?: string
  imageUrl?: string | null
  error?: string
  headlines: string[]
  descriptions?: string[]
  primaryText?: string
  cta: string
}

export interface CampaignDeliverable {
  name: string
  platform: string
  objective: string
  budgetDaily: number
  currency: string
  bidding?: string
  schedule: string
  landingPage: string
  headlines?: (string | { text: string })[]
  descriptions?: string[]
  primaryText?: string
  cta: string
  targeting?: { setting: string; value: string }[]
}

export interface SearchResultCitation {
  url: string
  title: string
  snippet?: string
}

export type AgentResponseBlock =
  | { type: "research"; topic?: string; subQueries?: string[]; results?: SearchResultCitation[] }
  | { type: "questions"; title?: string; questions: AgentQuestion[] }
  | { type: "plan"; plan: ExecutionPlan }
  | { type: "creative"; creative: CreativeOutput }
  | { type: "campaign"; campaign: CampaignDeliverable }
  | { type: "text"; content: string }

/* ──────────────────── Thinking / Research Block ──────────────────── */

export function ResearchBlock({
  topic,
  subQueries,
  results,
}: {
  topic?: string
  subQueries?: string[]
  results?: SearchResultCitation[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-[16px] border border-border bg-card p-4 shadow-2xs space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-full bg-[#EAF0FE] text-[#1F57F5] flex items-center justify-center">
            <Search className="h-3.5 w-3.5" />
          </div>
          <span className="text-[13.5px] font-medium text-foreground">
            {topic || "Researching market & competitor positioning..."}
          </span>
        </div>
        {results && results.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1 text-[11.5px] text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <span>{results.length} sources</span>
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
          </button>
        )}
      </div>

      {subQueries && subQueries.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {subQueries?.map((q, i) => (
            <span
              key={i}
              className="inline-flex items-center rounded-full border border-border bg-muted/40 px-3 py-1 text-[11.5px] text-muted-foreground"
            >
              {q}
            </span>
          ))}
        </div>
      )}

      {open && results && results.length > 0 && (
        <div className="mt-2 space-y-2 border-t border-border pt-3">
          {results?.map((r, i) => (
            <div key={i} className="rounded-lg border border-border bg-muted/20 p-2.5 text-[12px]">
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[#1F57F5] hover:underline flex items-center gap-1"
              >
                {r.title}
                <ExternalLink className="h-3 w-3" />
              </a>
              <p className="mt-0.5 text-muted-foreground line-clamp-2 text-[11px]">{r.snippet}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ──────────────────── Questions Card ──────────────────── */

export function QuestionsCard({
  title,
  questions,
  onAnswer,
}: {
  title?: string
  questions: AgentQuestion[]
  onAnswer: (answers: Record<string, string>) => void
}) {
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [freeText, setFreeText] = useState("")
  const [submitted, setSubmitted] = useState(false)

  const q = questions[current]
  if (!q) return null

  const handleSelectOption = (label: string) => {
    const next = { ...answers, [q.id]: label }
    setAnswers(next)
    setFreeText("")
    if (current < questions.length - 1) {
      setCurrent(current + 1)
    } else {
      setSubmitted(true)
      onAnswer(next)
    }
  }

  const handleFreeTextSubmit = () => {
    if (!freeText.trim()) return
    const next = { ...answers, [q.id]: freeText.trim() }
    setAnswers(next)
    setFreeText("")
    if (current < questions.length - 1) {
      setCurrent(current + 1)
    } else {
      setSubmitted(true)
      onAnswer(next)
    }
  }

  const getOptionIcon = (label: string) => {
    const l = label.toLowerCase()
    if (l.includes("linkedin")) return <Briefcase className="h-4 w-4" />
    if (l.includes("meta") || l.includes("facebook") || l.includes("instagram"))
      return <Smartphone className="h-4 w-4" />
    if (l.includes("google") || l.includes("search")) return <Search className="h-4 w-4" />
    if (l.includes("multiple") || l.includes("multi")) return <Globe className="h-4 w-4" />
    return <Sparkles className="h-4 w-4" />
  }

  if (submitted) {
    return (
      <div className="flex items-center gap-2 text-[12.5px] font-medium text-emerald-600 dark:text-emerald-400 py-1 px-1">
        <Check className="h-4 w-4" />
        <span>Answers sent</span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Waiting for input status indicator */}
      <div className="flex items-center gap-2 text-[12.5px] text-amber-500 pl-1 font-medium animate-pulse">
        <span className="h-2 w-2 rounded-full bg-amber-500" />
        <span>Waiting for user to give input..</span>
      </div>

      <div className="rounded-[16px] border border-border bg-card overflow-hidden shadow-2xs">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
          <span className="text-[13.5px] font-semibold text-foreground truncate pr-2">
            {current + 1}. {q.question}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11.5px] font-mono font-medium text-muted-foreground">
              &lt; {current + 1}/{questions.length} &gt;
            </span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setCurrent(Math.max(0, current - 1))}
                disabled={current === 0}
                className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setCurrent(Math.min(questions.length - 1, current + 1))}
                disabled={current === questions.length - 1}
                className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Question Body */}
        <div className="p-4 space-y-3">
          {q.why && <p className="text-[12px] text-muted-foreground">{q.why}</p>}

          {/* Options list */}
          {Array.isArray(q.options) && q.options.length > 0 && (
            <div className="space-y-2 pt-1">
              {q.options.map((opt: AgentQuestionOption) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => handleSelectOption(opt.label)}
                  className={cn(
                    "w-full p-3 rounded-[12px] border text-left transition-all cursor-pointer flex items-start gap-3",
                    answers[q.id] === opt.label
                      ? "border-[#1F57F5] bg-[#EAF0FE]/40"
                      : "border-border hover:border-[#1F57F5]/40 hover:bg-muted/30"
                  )}
                >
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-muted text-foreground shrink-0 mt-0.5">
                    {getOptionIcon(opt.label)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-foreground">{opt.label}</span>
                      {opt.recommended && (
                        <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-mono text-[9.5px] font-bold uppercase tracking-wider">
                          RECOMMENDED
                        </span>
                      )}
                    </div>
                    {opt.description && (
                      <p className="mt-0.5 text-[12px] text-muted-foreground leading-snug">
                        {opt.description}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Free text custom answer input */}
          <div className="relative pt-1">
            <Input
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleFreeTextSubmit()
                }
              }}
              placeholder="Or type your own answer..."
              className="h-10 text-[12.5px] pr-10 rounded-[10px]"
            />
            <button
              type="button"
              onClick={handleFreeTextSubmit}
              disabled={!freeText.trim()}
              className="absolute right-2 top-2.5 h-7 w-7 rounded-md bg-foreground text-background flex items-center justify-center disabled:opacity-30 cursor-pointer"
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ──────────────────── Execution Plan Card ──────────────────── */

export function PlanCard({
  plan,
  onApprove,
  onDecline,
  approved,
}: {
  plan: ExecutionPlan
  onApprove: () => void
  onDecline: () => void
  approved?: boolean
}) {
  return (
    <div className="space-y-2">
      <div className="rounded-[16px] border border-border bg-card overflow-hidden shadow-2xs">
        {/* Header: ≡ Execution Plan and 0/N Steps */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/20">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded bg-primary-tint text-primary text-sm font-bold">
              ≡
            </span>
            <span className="text-[13px] font-semibold text-foreground">
              {plan.title || "Execution Plan"}
            </span>
          </div>
          <span className="text-[12px] font-mono font-medium text-muted-foreground">
            {approved ? `${plan.steps?.length || 0}/${plan.steps?.length || 0} Steps` : `0/${plan.steps?.length || 0} Steps`}
          </span>
        </div>

        {/* Steps list with circle bullets and parallel tagging */}
        <div className="p-4 space-y-3.5">
          {Array.isArray(plan.steps) && plan.steps.map((step: ExecutionPlanStep) => (
            <div key={step.stepNumber} className="flex items-start gap-3">
              <div
                className={cn(
                  "mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 text-[10px]",
                  approved
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-muted-foreground/60 text-transparent"
                )}
              >
                {approved && <Check className="h-2.5 w-2.5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-foreground">
                  {step.title}
                </div>
                {step.detail && (
                  <p className="mt-0.5 text-[12px] text-muted-foreground leading-relaxed">
                    {step.detail}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {!approved && (
        <div className="space-y-3 pt-1">
          <p className="text-[12.5px] text-muted-foreground pl-1 leading-relaxed">
            Does this look right? Steps 1 and 2 run simultaneously so this moves fast. Proceeding in 10 seconds unless you want to adjust.
          </p>

          <div className="flex justify-end pr-1">
            <Button
              className="gap-1.5 bg-foreground text-background hover:bg-foreground/90 rounded-full px-5 text-[13px] cursor-pointer"
              onClick={onApprove}
            >
              Proceed with plan
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ──────────────────── Creative Output Card ──────────────────── */

export function CreativeCard({
  creative,
  generating,
  onCancel,
}: {
  creative: CreativeOutput
  generating?: boolean
  onCancel?: () => void
}) {
  const [copied, setCopied] = useState(false)

  const copyAll = () => {
    const text = [
      `Headlines:`,
      ...creative.headlines.map((h: string, i: number) => `  ${String.fromCharCode(65 + i)}. "${h}"`),
      `\nDescriptions:`,
      ...(creative.descriptions ?? []).map((d: string, i: number) => `  ${String.fromCharCode(65 + i)}. "${d}"`),
      `\nPrimary text: "${creative.primaryText}"`,
      `CTA: ${creative.cta}`,
    ].join("\n")
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-3">
      {/* Parallel specialists worker card */}
      <ParallelWorkersCard
        completedCount={generating ? 0 : 2}
        totalCount={2}
        isComplete={!generating}
      />

      <div className="rounded-[16px] border border-border bg-card overflow-hidden shadow-2xs space-y-4">
        {generating ? (
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <p className="text-[13px] font-medium text-foreground">Rendering ad creative & copy…</p>
            </div>
            {onCancel && (
              <Button variant="outline" size="sm" onClick={onCancel} className="gap-1.5 cursor-pointer">
                <CircleStop className="h-3.5 w-3.5" />
                Cancel
              </Button>
            )}
          </div>
        ) : (
          <>
            {creative.imageUrl && (
              <div className="relative bg-foreground/5 p-4 flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={creative.imageUrl}
                  alt="Generated ad creative"
                  className="max-h-[300px] rounded-lg object-contain shadow-xs"
                />
                <a
                  href={creative.imageUrl}
                  download="growzzy-ad-creative.png"
                  className="absolute top-3 right-3 rounded-full bg-card/80 backdrop-blur p-2 hover:bg-card transition-colors shadow-2xs"
                >
                  <Download className="h-4 w-4 text-foreground" />
                </a>
              </div>
            )}

            <div className="p-5 space-y-4 pt-1">
              <div className="flex items-center justify-between">
                <h4 className="text-[15px] font-bold text-foreground">Ad copy</h4>
                <button
                  type="button"
                  onClick={copyAll}
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  {copied ? "Copied" : "Copy all"}
                </button>
              </div>

              <div className="space-y-1.5">
                {creative.headlines.map((h: string, i: number) => (
                  <p key={i} className="text-[13px] text-foreground">
                    <span className="font-semibold text-muted-foreground">Headline {String.fromCharCode(65 + i)} — </span>
                    <code className="rounded bg-muted/80 px-2 py-0.5 font-mono text-[12px] text-foreground">
                      &ldquo;{h}&rdquo;
                    </code>
                  </p>
                ))}
              </div>

              {creative.primaryText && (
                <div>
                  <span className="text-[11.5px] font-semibold text-muted-foreground block mb-1">Primary text:</span>
                  <blockquote className="rounded-lg border-l-2 border-primary/60 bg-muted/30 p-3 italic text-[12.5px] text-foreground leading-relaxed space-y-2">
                    {creative.primaryText}
                  </blockquote>
                </div>
              )}

              {creative.descriptions && creative.descriptions.length > 0 && (
                <div>
                  <span className="text-[12px] font-medium text-muted-foreground">Descriptions:</span>
                  {creative.descriptions.map((d: string, i: number) => (
                    <p key={i} className="mt-1 text-[12.5px] text-foreground">
                      {String.fromCharCode(65 + i)}. {d}
                    </p>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <span className="text-[11.5px] text-muted-foreground">Call to action:</span>
                <code className="rounded bg-muted/80 px-2 py-0.5 font-mono text-[12px] font-semibold text-foreground">
                  {creative.cta}
                </code>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ──────────────────── Campaign Deliverable Card ──────────────────── */

export function CampaignCard({
  campaign,
  onOpenArtifact,
}: {
  campaign: CampaignDeliverable
  onOpenArtifact?: (data: ArtifactData) => void
}) {
  const [modalOpen, setModalOpen] = useState(false)

  const artifactData: ArtifactData = {
    title: campaign.name,
    brandName: campaign.name.split("—")[0]?.trim() || "MARKITX",
    platform: campaign.platform,
    headlines: Array.isArray(campaign.headlines) && campaign.headlines.length > 0
      ? campaign.headlines.map((h: string | { text: string }) => typeof h === "string" ? h : h?.text ?? "")
      : [
          "Your AI stack has a performance leak.",
          "Most AI builds fail ops. Audit yours.",
          "Free AI audit for engineering leaders",
        ],
    primaryText: campaign.primaryText,
    cta: campaign.cta,
    targeting: campaign.targeting,
  }

  const handleOpen = () => {
    if (onOpenArtifact) {
      onOpenArtifact(artifactData)
    } else {
      setModalOpen(true)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted-foreground pl-1">
        Both are done. Here&apos;s your full {campaign.platform || "campaign"} package.
      </p>

      <ArtifactPill
        data={artifactData}
        onOpen={handleOpen}
      />

      <div className="rounded-[16px] border border-border bg-card overflow-hidden shadow-2xs">
        <div className="px-5 py-3.5 border-b border-border bg-muted/20 flex items-center justify-between">
          <div>
            <h4 className="text-[14px] font-bold text-foreground">{campaign.name}</h4>
            <span className="text-[11.5px] text-muted-foreground">
              {campaign.platform} · {campaign.objective}
            </span>
          </div>
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600">
            Launch ready
          </span>
        </div>

        <div className="p-5 grid grid-cols-2 gap-4 text-[12.5px]">
          <div>
            <span className="text-muted-foreground block text-[11px]">Daily budget</span>
            <p className="font-semibold text-foreground mt-0.5">
              {campaign.currency} {campaign.budgetDaily}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">Schedule</span>
            <p className="font-semibold text-foreground mt-0.5">{campaign.schedule}</p>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">Landing page</span>
            <p className="font-semibold text-foreground mt-0.5 truncate">{campaign.landingPage}</p>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">Call to action</span>
            <p className="font-semibold text-foreground mt-0.5">{campaign.cta}</p>
          </div>
        </div>

        {Array.isArray(campaign.targeting) && campaign.targeting.length > 0 && (
          <div className="px-5 pb-4 border-t border-border pt-3">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Targeting Setup
            </span>
            <div className="mt-2 space-y-1">
              {campaign.targeting.map((t: { setting: string; value: string }, i: number) => (
                <div key={i} className="flex justify-between text-[12px]">
                  <span className="text-muted-foreground">{t.setting}</span>
                  <span className="text-foreground font-medium">{t.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <ArtifactModal
        data={artifactData}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  )
}

/* ──────────────────── Formatted Text Block ──────────────────── */

export function TextBlock({ content }: { content: string }) {
  const lines = content.split("\n")
  return (
    <div className="space-y-2 text-[13.5px] leading-relaxed text-foreground">
      {lines.map((line, i) => {
        const trimmed = line.trim()
        if (!trimmed) return <br key={i} />

        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={i} className="text-[14.5px] font-bold text-foreground mt-4 mb-1">
              {formatInline(trimmed.slice(4))}
            </h4>
          )
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={i} className="text-[16px] font-bold text-foreground mt-5 mb-1.5">
              {formatInline(trimmed.slice(3))}
            </h3>
          )
        }
        if (trimmed.startsWith("# ")) {
          return (
            <h2 key={i} className="text-[18px] font-bold text-foreground mt-6 mb-2">
              {formatInline(trimmed.slice(2))}
            </h2>
          )
        }

        if (/^[-*•]\s/.test(trimmed)) {
          return (
            <li key={i} className="ml-4 list-disc text-[13px] text-foreground/90">
              {formatInline(trimmed.slice(2))}
            </li>
          )
        }

        return <p key={i}>{formatInline(trimmed)}</p>
      })}
    </div>
  )
}

function formatInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    const boldMatch = /\*\*(.+?)\*\*/.exec(remaining)
    const codeMatch = /`([^`]+)`/.exec(remaining)
    const linkMatch = /\[([^\]]+)\]\(([^)]+)\)/.exec(remaining)

    const matches = [
      boldMatch ? { type: "bold", index: boldMatch.index, match: boldMatch } : null,
      codeMatch ? { type: "code", index: codeMatch.index, match: codeMatch } : null,
      linkMatch ? { type: "link", index: linkMatch.index, match: linkMatch } : null,
    ].filter(Boolean) as { type: string; index: number; match: RegExpExecArray }[]

    if (matches.length === 0) {
      parts.push(remaining)
      break
    }

    const earliest = matches.sort((a, b) => a.index - b.index)[0]

    if (earliest.index > 0) {
      parts.push(remaining.slice(0, earliest.index))
    }

    if (earliest.type === "bold") {
      parts.push(<strong key={key++} className="font-semibold text-foreground">{earliest.match[1]}</strong>)
      remaining = remaining.slice(earliest.index + earliest.match[0].length)
    } else if (earliest.type === "code") {
      parts.push(
        <code key={key++} className="rounded bg-muted px-1.5 py-0.5 text-[12px] font-mono text-foreground">
          {earliest.match[1]}
        </code>
      )
      remaining = remaining.slice(earliest.index + earliest.match[0].length)
    } else if (earliest.type === "link") {
      parts.push(
        <a
          key={key++}
          href={earliest.match[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#1F57F5] hover:underline inline-flex items-center gap-0.5"
        >
          {earliest.match[1]}
        </a>
      )
      remaining = remaining.slice(earliest.index + earliest.match[0].length)
    }
  }

  return <>{parts}</>
}

/* ──────────────────── Master Message Block Dispatcher ──────────────────── */

export function AgentMessageBlock({
  block,
  onQuestionAnswer,
  onPlanApprove,
  onPlanDecline,
  planApproved,
  generating,
  onCancelGeneration,
}: {
  block: AgentResponseBlock
  onQuestionAnswer?: (answers: Record<string, string>) => void
  onPlanApprove?: () => void
  onPlanDecline?: () => void
  planApproved?: boolean
  generating?: boolean
  onCancelGeneration?: () => void
}) {
  switch (block.type) {
    case "text":
      return <TextBlock content={block.content} />

    case "research":
      return (
        <ResearchBlock
          topic={block.topic}
          subQueries={block.subQueries}
          results={block.results}
        />
      )

    case "questions":
      return (
        <QuestionsCard
          title={block.title}
          questions={block.questions}
          onAnswer={onQuestionAnswer || (() => {})}
        />
      )

    case "plan":
      return (
        <PlanCard
          plan={block.plan}
          onApprove={onPlanApprove || (() => {})}
          onDecline={onPlanDecline || (() => {})}
          approved={planApproved}
        />
      )

    case "creative":
      return (
        <CreativeCard
          creative={block.creative}
          generating={generating}
          onCancel={onCancelGeneration}
        />
      )

    case "campaign":
      return <CampaignCard campaign={block.campaign} />

    default:
      return null
  }
}
