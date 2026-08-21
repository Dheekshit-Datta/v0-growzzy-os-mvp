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
  ArrowDown,
} from "lucide-react"
import type {
  AgentResponseBlock,
  AgentQuestion,
  ExecutionPlan,
  CreativeOutput,
  CampaignDeliverable,
  SearchResultCitation,
} from "@/app/api/chat/route"

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

  if (submitted) {
    return (
      <div className="flex items-center gap-2 text-[12.5px] font-medium text-emerald-600 dark:text-emerald-400 py-1 px-1">
        <Check className="h-4 w-4" />
        <span>Answers sent</span>
      </div>
    )
  }

  return (
    <div className="rounded-[16px] border border-border bg-card overflow-hidden shadow-2xs">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/20">
        <div className="h-6 w-6 rounded-full bg-[#EAF0FE] text-[#1F57F5] flex items-center justify-center shrink-0">
          <HelpCircle className="h-3.5 w-3.5" />
        </div>
        <span className="text-[13px] font-medium text-foreground">
          {title || "A few things before I build"}
        </span>
        <span className="text-[12px] text-muted-foreground ml-1">
          • {questions.length} questions
        </span>
      </div>

      {/* Question Body */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11.5px] font-medium text-muted-foreground">
            {current + 1}/{questions.length}
          </span>
          <div className="flex items-center gap-1">
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

        <div>
          <h4 className="text-[14px] font-semibold text-foreground">{q.question}</h4>
          {q.why && <p className="mt-0.5 text-[12px] text-muted-foreground">{q.why}</p>}
        </div>

        {/* Options grid */}
        {q.options && q.options.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {q.options?.map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => handleSelectOption(opt.label)}
                className={cn(
                  "p-3 rounded-[12px] border text-left transition-all cursor-pointer flex flex-col justify-between",
                  answers[q.id] === opt.label
                    ? "border-[#1F57F5] bg-[#EAF0FE]/40"
                    : "border-border hover:border-[#1F57F5]/40 hover:bg-muted/30"
                )}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-foreground">{opt.label}</span>
                    {opt.recommended && (
                      <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9.5px] font-bold uppercase tracking-wider">
                        Recommended
                      </span>
                    )}
                  </div>
                  {opt.description && (
                    <p className="mt-1 text-[11.5px] text-muted-foreground leading-snug">
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
            className="h-10 text-[13px] pr-10 rounded-[10px]"
          />
          <button
            type="button"
            onClick={handleFreeTextSubmit}
            disabled={!freeText.trim()}
            className="absolute right-2 top-2.5 h-7 w-7 rounded-md bg-foreground text-background flex items-center justify-center disabled:opacity-30 cursor-pointer"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
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
    <div className="rounded-[16px] border border-border bg-card overflow-hidden shadow-2xs">
      <div className="p-4 border-b border-border bg-muted/20 flex items-start gap-3">
        <div className="h-8 w-8 rounded-lg bg-[#EAF0FE] text-[#1F57F5] flex items-center justify-center shrink-0 mt-0.5">
          <ListOrdered className="h-4 w-4" />
        </div>
        <div>
          <h4 className="text-[14px] font-semibold text-foreground">{plan.title}</h4>
          {plan.summary && (
            <p className="mt-0.5 text-[12px] text-muted-foreground leading-relaxed">
              {plan.summary}
            </p>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3.5">
        {plan.steps?.map((step) => (
          <div key={step.stepNumber} className="flex items-start gap-3">
            <div
              className={cn(
                "h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 text-[10.5px] font-bold",
                approved
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-[#1F57F5] text-[#1F57F5]"
              )}
            >
              {approved ? <Check className="h-3 w-3" /> : step.stepNumber}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[13px] font-medium text-foreground block">
                {step.title}
              </span>
              {step.detail && (
                <p className="text-[11.5px] text-muted-foreground leading-snug mt-0.5">
                  {step.detail}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {!approved && (
        <div className="px-4 pb-4 pt-1 flex justify-end gap-2 border-t border-border mt-1">
          <Button variant="outline" size="sm" onClick={onDecline} className="cursor-pointer">
            Adjust plan
          </Button>
          <Button size="sm" onClick={onApprove} className="gap-1.5 bg-[#1F57F5] text-white hover:bg-[#1845C2] cursor-pointer">
            <Check className="h-3.5 w-3.5" />
            Proceed with plan
          </Button>
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
      ...creative.headlines.map((h, i) => `  ${String.fromCharCode(65 + i)}. "${h}"`),
      `\nDescriptions:`,
      ...creative.descriptions.map((d, i) => `  ${String.fromCharCode(65 + i)}. "${d}"`),
      `\nPrimary text: "${creative.primaryText}"`,
      `CTA: ${creative.cta}`,
    ].join("\n")
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (generating) {
    return (
      <div className="rounded-[16px] border border-border bg-card p-5 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-[#1F57F5]" />
            <div>
              <p className="text-[13px] font-medium text-foreground">Rendering ad creative & copy…</p>
              <p className="text-[11px] text-muted-foreground">Generating production-ready creative assets</p>
            </div>
          </div>
          {onCancel && (
            <Button variant="outline" size="sm" onClick={onCancel} className="gap-1.5 cursor-pointer">
              <CircleStop className="h-3.5 w-3.5" />
              Cancel
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-[16px] border border-border bg-card overflow-hidden shadow-2xs space-y-4">
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
          {creative.headlines.map((h, i) => (
            <p key={i} className="text-[13px] text-foreground">
              <span className="font-semibold">Headline {String.fromCharCode(65 + i)}</span> —{" "}
              <span className="font-mono bg-muted/60 px-1.5 py-0.5 rounded text-[12px]">
                &ldquo;{h}&rdquo;
              </span>
            </p>
          ))}
        </div>

        {creative.primaryText && (
          <div>
            <span className="text-[12px] font-medium text-muted-foreground">Primary text:</span>
            <p className="mt-1 text-[13px] text-foreground leading-relaxed">
              {creative.primaryText}
            </p>
          </div>
        )}

        {creative.descriptions && creative.descriptions.length > 0 && (
          <div>
            <span className="text-[12px] font-medium text-muted-foreground">Descriptions:</span>
            {creative.descriptions.map((d, i) => (
              <p key={i} className="mt-1 text-[12.5px] text-foreground">
                {String.fromCharCode(65 + i)}. {d}
              </p>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <span className="text-[11.5px] text-muted-foreground">Call to action:</span>
          <span className="rounded-full bg-[#1F57F5] px-3 py-1 text-[11px] font-semibold text-white">
            {creative.cta}
          </span>
        </div>
      </div>
    </div>
  )
}

/* ──────────────────── Campaign Deliverable Card ──────────────────── */

export function CampaignCard({ campaign }: { campaign: CampaignDeliverable }) {
  return (
    <div className="rounded-[16px] border border-border bg-card overflow-hidden shadow-2xs">
      <div className="px-5 py-3.5 border-b border-border bg-[#EAF0FE]/40">
        <h4 className="text-[14px] font-bold text-foreground">{campaign.name}</h4>
        <span className="text-[11.5px] text-muted-foreground">
          {campaign.platform} · {campaign.objective}
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

      {campaign.targeting && campaign.targeting.length > 0 && (
        <div className="px-5 pb-4">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Targeting
          </span>
          <div className="mt-2 space-y-1">
            {campaign.targeting.map((t, i) => (
              <div key={i} className="flex justify-between text-[12px]">
                <span className="text-muted-foreground">{t.setting}</span>
                <span className="text-foreground font-medium">{t.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
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
