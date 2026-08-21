"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  loadBrand,
  saveBrand,
  brandIsReady,
  brandContextText,
  emptyBrand,
  type BrandProfile,
} from "@/lib/brand-store";
import { useUserProfile, firstName } from "@/lib/user-store";
import {
  resolveSubmission,
  classifyChatError,
  type Submission,
  type ChatErrorKind,
} from "@/lib/chat-routing";
import { buildTranscript, downloadTranscript, type TranscriptMessage } from "@/lib/transcript";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  getToolName,
  isToolUIPart,
  type ToolUIPart,
  type UIMessage,
} from "ai";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { StatusPill } from "@/components/growzzy/status-pill";
import {
  Check,
  ChevronDown,
  Download as DownloadIcon,
  RefreshCw,
  CircleStop,
  Gauge,
  Globe,
  Image as ImageIcon,
  ListChecks,
  Megaphone,
  MessageCircleQuestion,
  Paperclip,
  Rocket,
  Search,
  Target,
  Wand2,
} from "lucide-react";

/* ------------------------------- tool payloads ------------------------------ */

type AskUserInput = {
  questions: {
    id: string;
    question: string;
    why: string;
    options: { label: string; description: string; recommended: boolean }[];
  }[];
};

type PlanInput = {
  title: string;
  summary: string;
  steps: { title: string; detail: string }[];
};

type CreativeOutput = { caption: string; imageUrl: string | null; error?: string };

type CampaignInput = {
  name: string;
  platform: string;
  objective: string;
  budgetDaily: number;
  currency: string;
  bidding: string;
  schedule: string;
  landingPage: string;
  targeting: { setting: string; value: string }[];
  keywords: string[];
  headlines: string[];
  descriptions: string[];
  primaryText: string;
  cta: string;
  kpis: { metric: string; target: string }[];
  risks: string[];
};

/** Suggestions are built from the user's own brand profile — never generic demo copy. */
function buildSuggestions(brand: BrandProfile) {
  const name = brand.businessName.trim();
  if (!brandIsReady(brand)) {
    return [
      {
        icon: Target,
        title: "Set up my brand from my site",
        text: "Analyse my website and learn my business, audience and competitors",
      },
      {
        icon: Megaphone,
        title: "Plan my first campaign",
        text: "I want to launch my first ad campaign — ask me what you need to know",
      },
      {
        icon: Wand2,
        title: "Ask about ads",
        text: "How should I split budget between Google Ads and Meta Ads?",
      },
      {
        icon: Rocket,
        title: "Research my market",
        text: "Research my market and tell me what my competitors are advertising",
      },
    ];
  }

  const offer = ((brand.whatTheySell || brand.productDescription) ?? "").trim();
  const segment = brand.segments?.[0]?.segment ?? brand.audience ?? "";
  const competitor = brand.competitors?.[0]?.name;
  const keyword = brand.keywords?.[0];

  return [
    {
      icon: Target,
      title: `Launch a campaign for ${name}`,
      text: `Build a lead-gen campaign for ${name}${offer ? ` promoting ${offer}` : ""}${segment ? ` targeting ${segment}` : ""}`,
    },
    {
      icon: Rocket,
      title: keyword ? `Own "${keyword}"` : "Capture high-intent search",
      text: keyword
        ? `Build a Google Ads campaign for ${name} around "${keyword}" and similar high-intent searches`
        : `Find the highest-intent search terms for ${name} and build a Google Ads campaign around them`,
    },
    {
      icon: Wand2,
      title: "Creative + copy pack",
      text: `Create ad copy and a visual for ${name} in our ${brand.tone || "brand"} tone${segment ? ` for ${segment}` : ""}`,
    },
    {
      icon: Megaphone,
      title: competitor ? `Beat ${competitor}` : "Study my competitors",
      text: competitor
        ? `Research what ${competitor} is doing in ads and how ${name} should position against them`
        : `Research who competes with ${name} and how we should position against them`,
    },
  ];
}

type Artifacts = {
  plan?: PlanInput;
  planApproved?: boolean;
  creative?: CreativeOutput;
  campaign?: CampaignInput;
  citations: { url: string; site: string; title: string }[];
};

function deriveArtifacts(messages: UIMessage[]): Artifacts {
  const out: Artifacts = { citations: [] };
  const seen = new Set<string>();
  for (const m of messages ?? []) {
    if (!m?.parts || !Array.isArray(m.parts)) continue;
    for (const part of m.parts) {
      if (!part || !isToolUIPart(part)) continue;
      const name = getToolName(part as ToolUIPart);
      const p = part as ToolUIPart;
      if (name === "proposePlan" && p.input) {
        out.plan = p.input as PlanInput;
        out.planApproved = (p.output as { approved?: boolean } | undefined)?.approved;
      }
      if (name === "generateCreative" && p.output) out.creative = p.output as CreativeOutput;
      if (name === "deliverCampaign" && p.input) out.campaign = p.input as CampaignInput;
      if (name === "research") {
        const cites = (p.output as { citations?: Artifacts["citations"] } | undefined)?.citations;
        for (const c of cites ?? []) {
          if (seen.has(c.url)) continue;
          seen.add(c.url);
          out.citations.push(c);
        }
      }
    }
  }
  return out;
}

const modes = [
  { value: "standard", label: "Standard" },
  { value: "deep", label: "Deep research" },
];

export interface AgentChatProps {
  threadId?: string;
}

export function AgentChat({ threadId = "growzzy-agent" }: AgentChatProps) {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("standard");
  const [brand, setBrand] = useState<BrandProfile>(emptyBrand);
  const user = useUserProfile();

  useEffect(() => {
    const sync = () => setBrand(loadBrand());
    sync();
    window.addEventListener("growzzy:brand-updated", sync);
    return () => window.removeEventListener("growzzy:brand-updated", sync);
  }, []);

  const brandReady = brandIsReady(brand);
  const suggestions = useMemo(() => buildSuggestions(brand), [brand]);
  const greetingName = firstName(user) || brand.businessName || "there";

  const [chatError, setChatError] = useState<{ kind: ChatErrorKind; message: string } | null>(null);
  const lastSubmission = useRef<Submission | null>(null);

  const { messages, sendMessage, addToolResult, status, stop } = useChat({
    id: threadId,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({ brandContext: brandContextText(loadBrand()), source: "nextjs-campaign" }),
    }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onError: (e) => {
      const info = classifyChatError(e);
      setChatError(info);
      const last = lastSubmission.current;
      if (last?.kind === "send") setInput((cur) => cur || last.text);
      if (last?.kind === "answer-question") setInput((cur) => cur || last.freeform);
      toast.error(info.message);
    },
  });

  /* When the agent analyses a website in-chat, persist it as the brand context. */
  const savedAnalysis = useRef<string | null>(null);
  useEffect(() => {
    for (const m of messages ?? []) {
      if (!m?.parts || !Array.isArray(m.parts)) continue;
      for (const part of m.parts) {
        if (!part || !isToolUIPart(part)) continue;
        if (getToolName(part as ToolUIPart) !== "analyzeWebsite") continue;
        const out = (part as ToolUIPart).output as
          | { site?: string; profile?: Partial<BrandProfile> & { sources?: string[] } }
          | undefined;
        if (!out?.profile?.businessName) continue;
        const key = (part as ToolUIPart).toolCallId;
        if (savedAnalysis.current === key) continue;
        savedAnalysis.current = key;
        const current = loadBrand();
        saveBrand({
          ...current,
          ...out.profile,
          website: out.site ?? current.website,
          defaultLandingPage: current.defaultLandingPage || out.site || "",
          analyzedAt: new Date().toISOString(),
        } as BrandProfile);
        toast.success(`Saved ${out.profile.businessName} to My Brand.`);
      }
    }
  }, [messages]);

  const busy = status === "submitted" || status === "streaming";
  const started = messages.length > 0;
  const artifacts = useMemo(() => deriveArtifacts(messages), [messages]);
  const hasPreview = Boolean(
    artifacts.campaign ||
      artifacts.plan ||
      artifacts.creative?.imageUrl ||
      artifacts.citations.length > 0,
  );

  const pendingQuestion = useMemo(() => {
    for (let mi = messages.length - 1; mi >= 0; mi -= 1) {
      const message = messages[mi];
      if (!message) continue;
      for (let pi = message.parts.length - 1; pi >= 0; pi -= 1) {
        const part = message.parts[pi];
        if (
          isToolUIPart(part) &&
          getToolName(part as ToolUIPart) === "askUser" &&
          part.state !== "output-available"
        ) {
          return part as ToolUIPart;
        }
      }
    }
    return undefined;
  }, [messages]);

  const run = (submission: Submission) => {
    if (submission.kind === "ignore") return;
    lastSubmission.current = submission;
    setChatError(null);
    if (submission.kind === "answer-question") {
      addToolResult({
        tool: "askUser",
        toolCallId: submission.toolCallId,
        output: { answers: {}, freeform: submission.freeform },
      });
      return;
    }
    void sendMessage({ text: submission.text });
  };

  const submit = (text: string) => {
    const submission = resolveSubmission({
      text,
      busy,
      mode,
      pending: pendingQuestion
        ? {
            toolName: "askUser",
            toolCallId: pendingQuestion.toolCallId,
            state: pendingQuestion.state,
          }
        : null,
    });
    if (submission.kind === "ignore") return;
    setInput("");
    run(submission);
  };

  const retry = () => {
    const last = lastSubmission.current;
    if (!last || last.kind === "ignore") return;
    setInput("");
    run(last);
  };

  /* Remembers when each turn appeared so the transcript can be timestamped. */
  const turnTimes = useRef<Record<string, string>>({});
  useEffect(() => {
    messages.forEach((m) => {
      turnTimes.current[m.id] ??= new Date().toISOString();
    });
  }, [messages]);

  const transcript = () =>
    downloadTranscript(
      buildTranscript(
        messages.map((m) => ({
          role: m.role,
          parts: m.parts as unknown as TranscriptMessage["parts"],
          at: turnTimes.current[m.id],
        })),
        { title: `Growzzy transcript — ${brand.businessName || "workspace"}` },
      ),
      `growzzy-transcript-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.md`,
    );

  const composer = (
    <div className={cn("w-full px-1 pb-2", hasPreview ? "" : "mx-auto max-w-3xl")}>
      <PromptInput
        className="rounded-[16px]"
        onSubmit={(_msg, e) => {
          e.preventDefault();
          submit(input);
        }}
      >
        <PromptInputTextarea
          value={input}
          onChange={(e) => setInput(e.currentTarget.value)}
          autoFocus
          placeholder={started ? "Ask anything…" : "Ask anything, or describe what to launch…"}
        />
        <PromptInputFooter className="justify-between">
          <PromptInputTools>
            <button
              type="button"
              onClick={() => toast.info("Attachments are coming soon.")}
              aria-label="Attach a file"
              className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setMode((m) => (m === "standard" ? "deep" : "standard"))}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[11.5px] text-foreground transition-colors hover:bg-muted cursor-pointer"
            >
              <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
              {modes.find((m) => m.value === mode)?.label}
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
          </PromptInputTools>
          <PromptInputSubmit
            className="h-9 w-9 rounded-full bg-foreground text-background hover:bg-foreground/90 cursor-pointer"
            status={status}
            onStop={stop}
            disabled={!input.trim() && !busy}
          />
        </PromptInputFooter>
      </PromptInput>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        Growzzy can make mistakes. Review every campaign before launching.
      </p>
    </div>
  );

  const thread = started ? (
    <Conversation className="flex-1">
      <ConversationContent
        className={cn("w-full px-1 pb-6", hasPreview ? "" : "mx-auto max-w-3xl")}
      >
        {messages.map((m) => (
          <AgentMessage
            key={m.id}
            message={m}
            addToolResult={addToolResult}
            onStop={stop}
          />
        ))}
        {status === "submitted" && (
          <div className="flex items-center gap-2 pl-1">
            <Shimmer className="text-[13.5px]">Growzzy is thinking…</Shimmer>
          </div>
        )}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  ) : (
    <div className="flex flex-1 flex-col items-center justify-center px-4">
      <div className="mb-5 h-11 w-11 rounded-xl bg-black text-white flex items-center justify-center font-black text-lg shadow-sm">
        G<span className="text-[#1F57F5] text-xs -mt-2">7</span>
      </div>
      <h1 className="text-[34px] font-semibold tracking-tight text-foreground">
        Hello, {greetingName}
      </h1>
      <p className="mt-2 max-w-md text-center text-[14px] text-muted-foreground">
        {brandReady
          ? `I already know ${brand.businessName} — your offer, audience and competitors. Ask me anything, or tell me what to launch.`
          : "Ask me anything about your ads and market. If I need your business, I'll ask for your website right here and analyse it live."}
      </p>
      {!brandReady && (
        <div className="mt-5 flex w-full max-w-xl items-center justify-between gap-3 rounded-[12px] border border-border bg-[#FBF3DB]/50 dark:bg-[#FBF3DB]/10 p-3.5">
          <span className="text-[12.5px] text-foreground">
            No brand context yet — I&apos;ll ask for your website in the chat when I need it, or set it
            up once in My Brand.
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
        {suggestions.map((s) => (
          <button
            key={s.title}
            onClick={() => submit(s.text)}
            className="group flex items-start gap-3 rounded-[12px] border border-border bg-card p-3.5 text-left transition-colors hover:border-primary/30 hover:bg-[#EAF0FE]/40 cursor-pointer"
          >
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#EAF0FE] dark:bg-[#EAF0FE]/20 text-primary">
              <s.icon className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-[13px] font-medium text-foreground">{s.title}</span>
              <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">
                {s.text}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 w-full gap-4 p-4 overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col">
        {started && (
          <div className="flex items-center justify-end gap-2 px-1 pb-1">
            <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer" onClick={transcript}>
              <DownloadIcon className="h-3.5 w-3.5" /> Download transcript
            </Button>
          </div>
        )}
        {thread}
        {chatError && (
          <div
            className={cn(
              "mx-1 mb-2 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border p-3",
              hasPreview ? "" : "mx-auto w-full max-w-3xl",
              chatError.kind === "credits" || chatError.kind === "blocked"
                ? "border-amber-500/40 bg-amber-500/10"
                : "border-border bg-muted/50",
            )}
          >
            <div className="min-w-0">
              <div className="text-[12.5px] font-medium text-foreground">
                {chatError.kind === "credits"
                  ? "AI credits exhausted"
                  : chatError.kind === "blocked"
                    ? "AI access blocked"
                    : chatError.kind === "rate-limit"
                      ? "Rate limited"
                      : "Couldn't reach Growzzy"}
              </div>
              <p className="text-[12px] leading-snug text-muted-foreground">{chatError.message}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" onClick={retry} disabled={busy} className="gap-1.5 cursor-pointer">
                <RefreshCw className="h-3.5 w-3.5" /> Retry
              </Button>
              <Button size="sm" variant="outline" onClick={() => setChatError(null)} className="cursor-pointer">
                Dismiss
              </Button>
            </div>
          </div>
        )}
        {composer}
      </div>
      {hasPreview && (
        <aside className="hidden w-[380px] shrink-0 flex-col overflow-y-auto rounded-[14px] border border-border bg-muted/30 p-3 lg:flex">
          <PreviewRail artifacts={artifacts} />
        </aside>
      )}
    </div>
  );
}

/* --------------------------- live preview rail ----------------------------- */

function PreviewRail({ artifacts }: { artifacts: Artifacts }) {
  const { plan, planApproved, creative, campaign, citations } = artifacts;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Live campaign preview
        </span>
        {campaign ? (
          <StatusPill variant="success">Ready</StatusPill>
        ) : plan ? (
          <StatusPill variant={planApproved ? "primary" : "warn"}>
            {planApproved ? "Building" : "Awaiting approval"}
          </StatusPill>
        ) : creative?.imageUrl ? (
          <StatusPill variant="success">Creative ready</StatusPill>
        ) : citations.length > 0 ? (
          <StatusPill variant="info">Researching</StatusPill>
        ) : null}
      </div>

      {creative?.imageUrl && (
        <div className="overflow-hidden rounded-[12px] border border-border bg-card">
          <img
            src={creative.imageUrl}
            alt={creative.caption ?? "Ad creative"}
            className="aspect-square w-full object-cover"
          />
          <div className="px-3 py-2 text-[11.5px] text-muted-foreground">{creative.caption}</div>
        </div>
      )}

      {campaign ? (
        <div className="rounded-[12px] border border-border bg-card p-3">
          <div className="text-[13px] font-semibold text-foreground">{campaign.name}</div>
          <div className="text-[11.5px] text-muted-foreground">
            {campaign.platform} · {campaign.objective}
          </div>
          <div className="mt-2 space-y-1">
            <Field label="Daily budget" value={`${campaign.currency} ${campaign.budgetDaily}`} />
            <Field label="Bidding" value={campaign.bidding} />
            <Field label="Schedule" value={campaign.schedule} />
          </div>
          {campaign.headlines?.length > 0 && (
            <div className="mt-3 border-t border-border pt-2">
              <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                Ad copy
              </div>
              {campaign.headlines.slice(0, 3).map((h) => (
                <div key={h} className="text-[12.5px] font-medium text-primary">
                  {h}
                </div>
              ))}
              <p className="mt-1 line-clamp-3 text-[12px] text-muted-foreground">
                {campaign.primaryText || campaign.descriptions?.[0]}
              </p>
            </div>
          )}
        </div>
      ) : plan ? (
        <div className="rounded-[12px] border border-border bg-card p-3">
          <div className="text-[13px] font-semibold text-foreground">{plan.title}</div>
          <ol className="mt-2 space-y-1.5">
            {plan.steps.map((s, i) => (
              <li key={i} className="flex gap-2 text-[12px] text-muted-foreground">
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-muted text-[10px]">
                  {i + 1}
                </span>
                {s.title}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {citations.length > 0 && (
        <div className="rounded-[12px] border border-border bg-card p-3">
          <div className="mb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            Sources read ({citations.length})
          </div>
          <ul className="space-y-1">
            {citations.slice(0, 10).map((c) => (
              <li key={c.url} className="truncate text-[11.5px]">
                <a
                  href={c.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-primary hover:underline"
                >
                  {c.site}
                </a>
                <span className="text-muted-foreground"> — {c.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ------------------------------- message ---------------------------------- */

type AddToolResult = ReturnType<typeof useChat>["addToolResult"];

function AgentMessage({
  message,
  addToolResult,
  onStop,
}: {
  message: UIMessage;
  addToolResult: AddToolResult;
  onStop: () => void;
}) {
  if (!message?.parts || !Array.isArray(message.parts)) return null;

  if (message.role === "user") {
    return (
      <Message from="user">
        <MessageContent>
          {message.parts.map((p, i) => (p?.type === "text" ? <span key={i}>{p.text}</span> : null))}
        </MessageContent>
      </Message>
    );
  }

  return (
    <Message from="assistant" className="[&>div]:max-w-full">
      <MessageContent className="w-full bg-transparent p-0 text-foreground">
        <div className="space-y-4">
          {message.parts.map((part, i) => {
            if (part.type === "text") {
              return part.text ? <MessageResponse key={i}>{part.text}</MessageResponse> : null;
            }
            if (!isToolUIPart(part)) return null;
            const name = getToolName(part as ToolUIPart);

            if (name === "askUser") {
              return (
                <QuestionsCard key={i} part={part as ToolUIPart} addToolResult={addToolResult} />
              );
            }
            if (name === "proposePlan") {
              return <PlanCard key={i} part={part as ToolUIPart} addToolResult={addToolResult} />;
            }
            if (name === "generateCreative") {
              return <CreativeCard key={i} part={part as ToolUIPart} onStop={onStop} />;
            }
            if (name === "deliverCampaign") {
              return <CampaignCard key={i} part={part as ToolUIPart} />;
            }
            if (name === "askBrandUrl") {
              return (
                <BrandUrlCard key={i} part={part as ToolUIPart} addToolResult={addToolResult} />
              );
            }
            if (name === "analyzeWebsite") {
              return <AnalyzeCard key={i} part={part as ToolUIPart} />;
            }
            // research + anything else
            return <ResearchCard key={i} part={part as ToolUIPart} />;
          })}
        </div>
      </MessageContent>
    </Message>
  );
}

function BrandUrlCard({ part, addToolResult }: { part: ToolUIPart; addToolResult: AddToolResult }) {
  const input = part.input as { reason?: string } | undefined;
  const done = part.state === "output-available";
  const sent = (part.output as { url?: string } | undefined)?.url;
  const [url, setUrl] = useState("");

  return (
    <div className="rounded-[12px] border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary-tint text-primary">
          <Globe className="h-3.5 w-3.5" />
        </span>
        <span className="text-[13px] font-medium text-foreground">What's your website?</span>
      </div>
      <p className="mt-1.5 text-[12.5px] text-muted-foreground">
        {input?.reason ??
          "Drop your website URL and I'll analyse your business live — offer, audience, competitors, keywords — before asking anything else."}
      </p>
      {done ? (
        <div className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-emerald-600">
          <Check className="h-3.5 w-3.5" /> {sent}
        </div>
      ) : (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const value = url.trim();
            if (!value) return;
            addToolResult({
              tool: "askBrandUrl",
              toolCallId: part.toolCallId,
              output: { url: value },
            });
          }}
        >
          <Input
            value={url}
            onChange={(e) => setUrl(e.currentTarget.value)}
            placeholder="yourbrand.com"
            className="h-9 text-[13px]"
          />
          <Button type="submit" disabled={!url.trim()} className="h-9 shrink-0 cursor-pointer">
            Analyse
          </Button>
        </form>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">
        Or set it up once in{" "}
        <Link href="/dashboard/brand" className="text-primary hover:underline">
          My Brand
        </Link>
        .
      </p>
    </div>
  );
}

function AnalyzeCard({ part }: { part: ToolUIPart }) {
  const input = part.input as { url?: string } | undefined;
  const output = part.output as
    | { site?: string; error?: string; profile?: BrandProfile }
    | undefined;
  const running = part.state !== "output-available" && part.state !== "output-error";
  const p = output?.profile;

  return (
    <div className="rounded-[12px] border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary-tint text-primary">
          <Globe className="h-3.5 w-3.5" />
        </span>
        {running ? (
          <Shimmer className="text-[13px] font-medium">{`Analysing ${input?.url ?? "your website"} — reading pages, finding competitors…`}</Shimmer>
        ) : (
          <span className="text-[13px] font-medium text-foreground">
            {p ? `Analysed ${p.businessName}` : "Analysis failed"}
          </span>
        )}
      </div>
      {output?.error && <p className="mt-2 text-[12.5px] text-red-500">{output.error}</p>}
      {p && (
        <div className="mt-3 space-y-1.5">
          <Field label="Industry" value={p.industry} />
          <Field label="Model" value={p.businessModel} />
          <Field label="Sells" value={p.whatTheySell} />
          <Field label="Audience" value={p.audience} />
          <div className="flex flex-wrap gap-1.5 pt-1">
            {(p.competitors ?? []).slice(0, 5).map((c) => (
              <span
                key={c.name}
                className="rounded-full border border-border bg-background px-2 py-0.5 text-[11.5px] text-muted-foreground"
              >
                {c.name}
              </span>
            ))}
          </div>
          <p className="pt-1 text-[11px] text-muted-foreground">Saved to My Brand.</p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------- tool cards -------------------------------- */

function ResearchCard({ part }: { part: ToolUIPart }) {
  const input = part.input as { focus?: string; topics?: string[] } | undefined;
  const output = part.output as
    | {
        notes?: string;
        queries?: string[];
        citations?: { url: string; site: string; title: string }[];
      }
    | undefined;
  const running = part.state !== "output-available" && part.state !== "output-error";

  return (
    <div className="rounded-[12px] border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary-tint text-primary">
          <Search className="h-3.5 w-3.5" />
        </span>
        {running ? (
          <Shimmer className="text-[13px] font-medium">{`Researching ${input?.focus ?? "your market"}…`}</Shimmer>
        ) : (
          <span className="text-[13px] font-medium text-foreground">
            Research complete — {input?.focus ?? "market analysis"}
          </span>
        )}
      </div>
      {input?.topics && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {input.topics.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[11.5px] text-muted-foreground"
            >
              {!running && <Check className="h-3 w-3 text-emerald-500" />}
              {t}
            </span>
          ))}
        </div>
      )}
      {output?.citations && output.citations.length > 0 && (
        <div className="mt-3 rounded-[10px] border border-border bg-background p-3">
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Sources read live ({output.citations.length})
          </div>
          <ul className="space-y-1">
            {output.citations.map((c) => (
              <li key={c.url} className="text-[11.5px] leading-snug">
                <a
                  href={c.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="font-medium text-primary hover:underline"
                >
                  {c.site}
                </a>
                <span className="text-muted-foreground"> — {c.title}</span>
              </li>
            ))}
          </ul>
          {output.queries && output.queries.length > 0 && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Searched: {output.queries.join(" · ")}
            </p>
          )}
        </div>
      )}
      {output?.notes && (
        <Tool defaultOpen={false} className="mt-3 border-0 bg-transparent">
          <ToolHeader type={`tool-${getToolName(part)}` as ToolUIPart["type"]} state={part.state} />
          <ToolContent>
            <div className="px-4 pb-3 text-[12.5px]">
              <MessageResponse>{output.notes}</MessageResponse>
            </div>
          </ToolContent>
        </Tool>
      )}
    </div>
  );
}

function QuestionsCard({
  part,
  addToolResult,
}: {
  part: ToolUIPart;
  addToolResult: AddToolResult;
}) {
  const input = part.input as AskUserInput | undefined;
  const answered = part.state === "output-available";
  const submitted = (part.output as { answers?: Record<string, string> } | undefined)?.answers;
  const [answers, setAnswers] = useState<Record<string, string>>({});

  if (!input?.questions?.length) return null;
  const total = input.questions.length;
  const complete = input.questions.every((q) => answers[q.id]);

  return (
    <div className="rounded-[12px] border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary-tint text-primary">
          <MessageCircleQuestion className="h-3.5 w-3.5" />
        </span>
        <span className="text-[13px] font-medium text-foreground">A few things before I build</span>
        <StatusPill variant="primary">{total} questions</StatusPill>
      </div>

      <div className="mt-4 space-y-4">
        {input.questions.map((q, qi) => (
          <div key={q.id} className="rounded-[10px] border border-border bg-background p-3.5">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {qi + 1} / {total}
            </div>
            <div className="mt-1 text-[13.5px] font-medium text-foreground">{q.question}</div>
            <p className="mt-0.5 text-[12px] text-muted-foreground">{q.why}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {q.options.map((o) => {
                const selected = (submitted?.[q.id] ?? answers[q.id]) === o.label;
                return (
                  <button
                    key={o.label}
                    disabled={answered}
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.label }))}
                    className={cn(
                      "rounded-[10px] border p-2.5 text-left transition-colors cursor-pointer",
                      selected
                        ? "border-primary bg-primary-tint"
                        : "border-border bg-card hover:border-primary/30",
                      answered && !selected && "opacity-60",
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="text-[12.5px] font-medium text-foreground">{o.label}</span>
                      {o.recommended && (
                        <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
                          Recommended
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-[11.5px] leading-snug text-muted-foreground">
                      {o.description}
                    </span>
                  </button>
                );
              })}
            </div>
            {!answered && (
              <Input
                value={answers[q.id] ?? ""}
                onChange={(event) =>
                  setAnswers((current) => ({ ...current, [q.id]: event.currentTarget.value }))
                }
                placeholder="Or type your own answer…"
                className="mt-2 h-9 text-[12.5px]"
              />
            )}
          </div>
        ))}
      </div>

      {!answered && (
        <Button
          className="mt-4 w-full cursor-pointer"
          disabled={!complete}
          onClick={() =>
            addToolResult({
              tool: "askUser",
              toolCallId: part.toolCallId,
              output: { answers },
            })
          }
        >
          Send answers
        </Button>
      )}
      {answered && (
        <div className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-emerald-600">
          <Check className="h-3.5 w-3.5" /> Answers sent
        </div>
      )}
    </div>
  );
}

function PlanCard({ part, addToolResult }: { part: ToolUIPart; addToolResult: AddToolResult }) {
  const input = part.input as PlanInput | undefined;
  const output = part.output as { approved?: boolean } | undefined;
  if (!input?.steps?.length) return null;
  const decided = part.state === "output-available";

  return (
    <div className="rounded-[12px] border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary-tint text-primary">
          <ListChecks className="h-3.5 w-3.5" />
        </span>
        <span className="text-[13px] font-medium text-foreground">
          {input.title || "Execution plan"}
        </span>
        {decided && (
          <StatusPill variant={output?.approved ? "success" : "warn"}>
            {output?.approved ? "Approved" : "Changes requested"}
          </StatusPill>
        )}
      </div>
      {input.summary && (
        <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">{input.summary}</p>
      )}
      <ol className="mt-4 space-y-3">
        {input.steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span
              className={cn(
                "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-medium",
                decided && output?.approved
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {decided && output?.approved ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <span>
              <span className="block text-[13px] font-medium text-foreground">{s.title}</span>
              <span className="block text-[12px] leading-snug text-muted-foreground">
                {s.detail}
              </span>
            </span>
          </li>
        ))}
      </ol>
      {!decided && (
        <div className="mt-4 flex gap-2">
          <Button
            className="flex-1 gap-1.5 cursor-pointer"
            onClick={() =>
              addToolResult({
                tool: "proposePlan",
                toolCallId: part.toolCallId,
                output: { approved: true },
              })
            }
          >
            <Rocket className="h-4 w-4" /> Approve plan
          </Button>
          <Button
            variant="outline"
            className="flex-1 cursor-pointer"
            onClick={() =>
              addToolResult({
                tool: "proposePlan",
                toolCallId: part.toolCallId,
                output: {
                  approved: false,
                  feedback: "The user wants changes — ask what to adjust before building.",
                },
              })
            }
          >
            Decline
          </Button>
        </div>
      )}
    </div>
  );
}

function CreativeCard({ part, onStop }: { part: ToolUIPart; onStop: () => void }) {
  const input = part.input as { caption?: string; prompt?: string } | undefined;
  const output = part.output as CreativeOutput | undefined;
  const running = part.state !== "output-available" && part.state !== "output-error";
  const elapsed = useElapsed(running);

  return (
    <div className="rounded-[12px] border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary-tint text-primary">
          <ImageIcon className="h-3.5 w-3.5" />
        </span>
        {running ? (
          <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
            <Shimmer className="truncate text-[13px] font-medium">
              {`Rendering your ad creative… ${elapsed}s (usually 60–120s)`}
            </Shimmer>
            <Button type="button" variant="outline" size="sm" onClick={onStop} className="shrink-0 gap-1.5 cursor-pointer">
              <CircleStop className="h-3.5 w-3.5" /> Cancel
            </Button>
          </div>
        ) : (
          <span className="text-[13px] font-medium text-foreground">
            {output?.caption ?? input?.caption ?? "Ad creative"}
          </span>
        )}
      </div>
      <div className="mt-3 overflow-hidden rounded-[10px] border border-border bg-muted">
        {output?.imageUrl ? (
          <img
            src={output.imageUrl}
            alt={output.caption ?? "Generated ad creative"}
            className="aspect-square w-full max-w-sm object-cover"
          />
        ) : (
          <div className="grid aspect-square w-full max-w-sm place-items-center text-[12px] text-muted-foreground">
            {output?.error ??
              (running
                ? `Rendering… ${elapsed}s elapsed`
                : "No creative returned — ask me to retry.")}
          </div>
        )}
      </div>
      {input?.prompt && (
        <p className="mt-2 text-[11.5px] leading-snug text-muted-foreground">{input.prompt}</p>
      )}
    </div>
  );
}

function CampaignCard({ part }: { part: ToolUIPart }) {
  const c = part.input as CampaignInput | undefined;
  if (!c?.name) return null;
  return (
    <div className="rounded-[12px] border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary-tint text-primary">
            <Megaphone className="h-3.5 w-3.5" />
          </span>
          <div>
            <div className="text-[13.5px] font-semibold text-foreground">{c.name}</div>
            <div className="text-[11.5px] text-muted-foreground">
              {c.platform} · {c.objective}
            </div>
          </div>
        </div>
        <StatusPill variant="success">Launch ready</StatusPill>
      </header>

      <div className="grid gap-x-6 gap-y-2 px-4 py-3 sm:grid-cols-2">
        <Field label="Daily budget" value={`${c.currency} ${c.budgetDaily}`} />
        <Field label="Bidding" value={c.bidding} />
        <Field label="Schedule" value={c.schedule} />
        <Field label="Landing page" value={c.landingPage} />
      </div>

      {c.targeting?.length > 0 && (
        <Block title="Targeting">
          <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {c.targeting.map((t) => (
              <Field key={t.setting} label={t.setting} value={t.value} />
            ))}
          </div>
        </Block>
      )}

      {c.keywords?.length > 0 && (
        <Block title="Keywords">
          <div className="flex flex-wrap gap-1.5">
            {c.keywords.map((k) => (
              <span
                key={k}
                className="inline-flex items-center gap-1 rounded-full bg-primary-tint px-2 py-0.5 text-[11.5px] text-primary"
              >
                <Search className="h-3 w-3" />
                {k}
              </span>
            ))}
          </div>
        </Block>
      )}

      <Block title="Ad copy">
        <div className="space-y-1.5">
          {c.headlines?.map((h) => (
            <div key={h} className="text-[13px] font-medium text-primary">
              {h}
            </div>
          ))}
          {c.descriptions?.map((d) => (
            <div key={d} className="text-[12.5px] text-foreground/80">
              {d}
            </div>
          ))}
          {c.primaryText && (
            <p className="pt-1 text-[12.5px] leading-relaxed text-muted-foreground">
              {c.primaryText}
            </p>
          )}
          {c.cta && (
            <div className="pt-1">
              <span className="rounded-md bg-primary px-2.5 py-1 text-[11.5px] font-medium text-primary-foreground">
                {c.cta}
              </span>
            </div>
          )}
        </div>
      </Block>

      {c.kpis?.length > 0 && (
        <Block title="Targets">
          <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {c.kpis.map((k) => (
              <Field key={k.metric} label={k.metric} value={k.target} />
            ))}
          </div>
        </Block>
      )}

      {c.risks?.length > 0 && (
        <Block title="Watch-outs">
          <ul className="space-y-1">
            {c.risks.map((r) => (
              <li key={r} className="text-[12.5px] text-muted-foreground">
                • {r}
              </li>
            ))}
          </ul>
        </Block>
      )}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border px-4 py-3">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  );
}

/** Seconds elapsed while `active` — used for the long image render window. */
function useElapsed(active: boolean) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) return;
    setSeconds(0);
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
  return seconds;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12.5px] text-muted-foreground">{label}</span>
      <span className="text-[12.5px] font-medium text-foreground">{value}</span>
    </div>
  );
}

export { ToolInput, ToolOutput };
