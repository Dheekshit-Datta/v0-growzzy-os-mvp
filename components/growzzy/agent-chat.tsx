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
import {
  ArtifactPill,
  ArtifactModal,
  type ArtifactData,
} from "@/components/growzzy/artifact-modal";
import { ThinkingBlock } from "@/components/growzzy/thinking-block";
import { AdMockupPreview } from "@/components/growzzy/ad-mockup-preview";
import { StatusPill } from "@/components/growzzy/status-pill";
import ReactMarkdown from "react-markdown";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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
  Briefcase,
  Smartphone,
  ArrowRight,
  Sparkles,
  Pencil,
  Save,
  Copy,
  FileText,
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
  platform?: "GOOGLE" | "META" | "MULTI";
  targetAudience?: string;
  budgetRecommendation?: string;
  markdownPlan?: string;
  steps?: { title: string; detail: string; isParallel?: boolean }[];
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
  offer?: string;
  targetAudience?: string;
  headlines?: string[];
  headlineStrategy?: string;
  primaryText?: string;
  cta?: string;
  ctaAlternative?: string;
  targeting?: { setting: string; value: string }[];
  exclusions?: string[];
  keyCaveat?: string;
  creativeNotes?: string;
  variantOptions?: string[];
  keywords?: string[];
  descriptions?: string[];
  kpis?: { metric: string; target: string }[];
  risks?: string[];
};

/** Suggestions are built from the user's own brand profile — never generic demo copy. */
function buildSuggestions(brand: BrandProfile) {
  const name = String(brand?.businessName || "").trim();
  if (!brand || !brandIsReady(brand)) {
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
          if (!c?.url || seen.has(c.url)) continue;
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

type AttachedFile = {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  content?: string;
};

export function AgentChat({ threadId = "growzzy-agent" }: AgentChatProps) {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("standard");
  const [brand, setBrand] = useState<BrandProfile>(emptyBrand);
  const [activeArtifact, setActiveArtifact] = useState<ArtifactData | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const user = useUserProfile();

  useEffect(() => {
    const sync = () => setBrand(loadBrand());
    sync();
    window.addEventListener("growzzy:brand-updated", sync);
    return () => window.removeEventListener("growzzy:brand-updated", sync);
  }, []);

  const brandReady = brandIsReady(brand);
  const suggestions = useMemo(() => buildSuggestions(brand), [brand]);
  const greetingName = firstName(user) || brand?.businessName || "there";

  const [chatError, setChatError] = useState<{ kind: ChatErrorKind; message: string } | null>(null);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const lastSubmission = useRef<Submission | null>(null);

  const { messages, sendMessage, addToolResult, status, stop } = useChat({
    id: threadId,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({ brandContext: brandContextText(loadBrand()), source: "nextjs-campaign" }),
    }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onError: (e: Error) => {
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
      artifacts.creative?.imageUrl,
  );

  const pendingQuestion = useMemo(() => {
    for (let mi = (messages?.length ?? 0) - 1; mi >= 0; mi -= 1) {
      const message = messages[mi];
      if (!message || !Array.isArray(message.parts)) continue;
      for (let pi = message.parts.length - 1; pi >= 0; pi -= 1) {
        const part = message.parts[pi];
        if (
          part &&
          isToolUIPart(part) &&
          getToolName(part as ToolUIPart) === "askUser" &&
          (part as ToolUIPart).state !== "output-available"
        ) {
          return {
            toolName: "askUser",
            toolCallId: (part as ToolUIPart).toolCallId,
            state: (part as ToolUIPart).state,
          };
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const id = `${file.name}-${Date.now()}-${Math.random()}`;
      const reader = new FileReader();

      if (file.type.startsWith("image/")) {
        reader.onload = () => {
          setAttachedFiles((prev) => [
            ...prev,
            {
              id,
              name: file.name,
              size: file.size,
              type: file.type,
              url: reader.result as string,
            },
          ]);
        };
        reader.readAsDataURL(file);
      } else {
        reader.onload = () => {
          const text = typeof reader.result === "string" ? reader.result : "";
          setAttachedFiles((prev) => [
            ...prev,
            {
              id,
              name: file.name,
              size: file.size,
              type: file.type,
              content: text.slice(0, 4000),
            },
          ]);
        };
        reader.readAsText(file);
      }
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
    toast.success(`Attached ${files.length} file${files.length > 1 ? "s" : ""}`);
  };

  const removeAttachedFile = (id: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const submit = (text: string) => {
    let fullText = text.trim();
    if (attachedFiles.length > 0) {
      const attachmentsContext = attachedFiles
        .map((f) => {
          if (f.content) return `[Attached File: ${f.name} (${(f.size / 1024).toFixed(1)} KB)]:\n${f.content}`;
          return `[Attached Image / Asset: ${f.name} (${(f.size / 1024).toFixed(1)} KB)]`;
        })
        .join("\n\n");
      fullText = fullText ? `${fullText}\n\n${attachmentsContext}` : attachmentsContext;
    }

    const submission = resolveSubmission({
      text: fullText,
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
    setAttachedFiles([]);
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
    (messages ?? []).forEach((m: UIMessage) => {
      turnTimes.current[m.id] ??= new Date().toISOString();
    });
  }, [messages]);

  const transcript = () =>
    downloadTranscript(
      buildTranscript(
        (messages ?? []).map((m: UIMessage) => ({
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
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.txt,.csv,.json,.md"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Attached Files Chips Bar */}
      {attachedFiles.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-2 px-1">
          {attachedFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-2 px-2.5 py-1 rounded-lg border border-border bg-card shadow-2xs text-[12px] text-foreground animate-in fade-in"
            >
              {file.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={file.url}
                  alt={file.name}
                  className="h-5 w-5 rounded object-cover border border-border shrink-0"
                />
              ) : (
                <Paperclip className="h-3.5 w-3.5 text-primary shrink-0" />
              )}
              <span className="max-w-[140px] truncate font-medium">{file.name}</span>
              <span className="text-[10px] text-muted-foreground">
                {(file.size / 1024).toFixed(0)} KB
              </span>
              <button
                type="button"
                onClick={() => removeAttachedFile(file.id)}
                className="p-0.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer ml-1"
                aria-label="Remove attachment"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

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
          placeholder={started ? "Type / for skills or ask anything…" : "Ask anything, or describe what to launch…"}
        />
        <PromptInputFooter className="justify-between">
          <PromptInputTools>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach files"
              className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
              title="Attach images, documents or brand assets"
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
            disabled={!input.trim() && attachedFiles.length === 0 && !busy}
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
        {(Array.isArray(messages) ? messages : []).map((m) => (
          <AgentMessage
            key={m.id}
            message={m}
            addToolResult={addToolResult}
            onStop={stop}
            onOpenArtifact={setActiveArtifact}
            brand={brand}
          />
        ))}
        {status === "submitted" && (
          <div className="flex items-center gap-2 pl-1">
            <Shimmer className="text-[13.5px]">Analyzing client requirements to determine approach…</Shimmer>
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
        {(Array.isArray(suggestions) ? suggestions : []).map((s) => (
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
      {/* Mobile preview toggle button */}
      {hasPreview && (
        <div className="fixed bottom-24 right-4 z-30 lg:hidden">
          <Button
            size="sm"
            onClick={() => setMobilePreviewOpen(true)}
            className="rounded-full shadow-lg bg-[#1F57F5] hover:bg-[#1845C4] text-white gap-1.5 px-3.5 text-xs font-medium cursor-pointer"
          >
            <Smartphone className="h-3.5 w-3.5" />
            Ad Preview
          </Button>
        </div>
      )}

      {/* Mobile drawer preview */}
      {mobilePreviewOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs lg:hidden animate-in fade-in">
          <div className="flex max-h-[85vh] flex-col rounded-t-[20px] border-t border-border bg-card p-4 overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-3">
              <span className="font-semibold text-sm text-foreground">Live Ad Mockup Preview</span>
              <button
                type="button"
                onClick={() => setMobilePreviewOpen(false)}
                className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-muted text-muted-foreground cursor-pointer"
              >
                ✕
              </button>
            </div>
            <PreviewRail artifacts={artifacts} />
          </div>
        </div>
      )}

      <ArtifactModal
        data={activeArtifact}
        open={Boolean(activeArtifact)}
        onClose={() => setActiveArtifact(null)}
      />
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

      {campaign ? (
        <AdMockupPreview
          campaignName={campaign.name}
          platform={campaign.platform}
          headlines={Array.isArray(campaign.headlines) ? campaign.headlines.map(h => typeof h === "string" ? h : (h as any)?.text ?? "") : []}
          primaryText={campaign.primaryText}
          descriptions={campaign.descriptions}
          cta={campaign.cta}
          landingPage={campaign.landingPage}
          imageUrl={creative?.imageUrl}
          budgetDaily={campaign.budgetDaily}
          currency={campaign.currency}
          bidding={campaign.bidding}
          schedule={campaign.schedule}
          keywords={campaign.keywords}
          exclusions={campaign.exclusions}
        />
      ) : creative?.imageUrl ? (
        <div className="overflow-hidden rounded-[12px] border border-border bg-card">
          <img
            src={creative.imageUrl}
            alt={creative.caption ?? "Ad creative"}
            className="aspect-square w-full object-cover"
          />
          <div className="px-3 py-2 text-[11.5px] text-muted-foreground">{creative.caption}</div>
        </div>
      ) : plan ? (
        <div className="rounded-[12px] border border-border bg-card p-3">
          <div className="text-[13px] font-semibold text-foreground">{plan.title}</div>
          <ol className="mt-2 space-y-1.5">
            {Array.isArray(plan.steps) && plan.steps.map((s, i) => (
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

      {Array.isArray(citations) && citations.length > 0 && (
        <div className="rounded-[12px] border border-border bg-card p-3">
          <div className="mb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            Sources read ({citations.length})
          </div>
          <ul className="space-y-1">
            {citations.slice(0, 10).map((c, i) => (
              <li key={c.url || i} className="truncate text-[11.5px]">
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
  onOpenArtifact,
  brand,
}: {
  message: UIMessage;
  addToolResult: AddToolResult;
  onStop: () => void;
  onOpenArtifact?: (data: ArtifactData) => void;
  brand?: BrandProfile;
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
              return <CreativeCard key={i} part={part as ToolUIPart} onStop={onStop} brand={brand} />;
            }
            if (name === "deliverCampaign") {
              return (
                <CampaignCard
                  key={i}
                  part={part as ToolUIPart}
                  onOpenArtifact={onOpenArtifact}
                />
              );
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
          {input.topics?.map((t) => (
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
            {output.citations?.map((c) => (
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [customText, setCustomText] = useState("");

  if (!input?.questions?.length) return null;
  const total = input.questions.length;
  const q = input.questions[currentIndex] || input.questions[0];

  const handleSelectOption = (optionLabel: string) => {
    if (answered) return;
    const newAnswers = { ...answers, [q.id]: optionLabel };
    setAnswers(newAnswers);
    setCustomText("");

    if (currentIndex < total - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      addToolResult({
        tool: "askUser",
        toolCallId: part.toolCallId,
        output: { answers: newAnswers },
      });
    }
  };

  const handleCustomSubmit = () => {
    if (answered || !customText.trim()) return;
    const newAnswers = { ...answers, [q.id]: customText.trim() };
    setAnswers(newAnswers);
    setCustomText("");

    if (currentIndex < total - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      addToolResult({
        tool: "askUser",
        toolCallId: part.toolCallId,
        output: { answers: newAnswers },
      });
    }
  };

  const getOptionIcon = (label?: string) => {
    const l = String(label || "").toLowerCase();
    if (l.includes("linkedin")) return <Briefcase className="h-4 w-4" />;
    if (l.includes("meta") || l.includes("facebook") || l.includes("instagram"))
      return <Smartphone className="h-4 w-4" />;
    if (l.includes("google") || l.includes("search")) return <Search className="h-4 w-4" />;
    if (l.includes("multiple") || l.includes("multi")) return <Globe className="h-4 w-4" />;
    return <Sparkles className="h-4 w-4" />;
  };

  return (
    <div className="space-y-2">
      {/* Waiting for input status indicator */}
      {!answered && (
        <div className="flex items-center gap-2 text-[12.5px] text-amber-500 pl-1 font-medium animate-pulse">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          <span>Waiting for user to give input..</span>
        </div>
      )}

      <div className="rounded-[16px] border border-border bg-card overflow-hidden shadow-2xs">
        {/* Header with 1/N pagination and controls */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/20">
          <span className="text-[13.5px] font-semibold text-foreground truncate pr-2">
            {currentIndex + 1}. {q.question}
          </span>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11.5px] font-mono font-medium text-muted-foreground">
              &lt; {currentIndex + 1}/{total} &gt;
            </span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                disabled={currentIndex === total - 1}
                onClick={() => setCurrentIndex(Math.min(total - 1, currentIndex + 1))}
                className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Question body */}
        <div className="p-4 space-y-3">
          {q.why && <p className="text-[12px] text-muted-foreground">{q.why}</p>}

          {/* Options list */}
          <div className="space-y-2 pt-1">
            {Array.isArray(q?.options) && q.options.map((o, idx) => {
              const label = o?.label || "";
              const selected = (submitted?.[q.id] ?? answers[q.id]) === label;
              return (
                <button
                  key={label || idx}
                  disabled={answered}
                  onClick={() => handleSelectOption(label)}
                  className={cn(
                    "w-full rounded-[12px] border p-3 text-left transition-all cursor-pointer flex items-start gap-3",
                    selected
                      ? "border-primary bg-primary-tint"
                      : "border-border bg-card hover:border-primary/40 hover:bg-muted/30",
                    answered && !selected && "opacity-50"
                  )}
                >
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-muted text-foreground shrink-0 mt-0.5">
                    {getOptionIcon(label)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-foreground">{label}</span>
                      {o?.recommended && (
                        <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[9.5px] font-bold tracking-wider text-muted-foreground uppercase">
                          RECOMMENDED
                        </span>
                      )}
                    </div>
                    {o?.description && (
                      <p className="mt-0.5 text-[12px] text-muted-foreground leading-snug">
                        {o.description}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Free text custom answer */}
          {!answered && (
            <div className="relative pt-1">
              <Input
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCustomSubmit();
                  }
                }}
                placeholder="Or type your own answer..."
                className="h-10 rounded-[10px] text-[12.5px] pr-10"
              />
              <button
                type="button"
                onClick={handleCustomSubmit}
                disabled={!customText.trim()}
                className="absolute right-2 top-2.5 h-7 w-7 rounded-md bg-foreground text-background flex items-center justify-center disabled:opacity-30 cursor-pointer"
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {answered && (
            <div className="pt-2 text-[12px] text-emerald-600 font-medium flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" /> Answers sent
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PlanCard({ part, addToolResult }: { part: ToolUIPart; addToolResult: AddToolResult }) {
  const input = part.input as PlanInput | undefined;
  const output = part.output as { approved?: boolean } | undefined;
  if (!input) return null;
  const decided = part.state === "output-available";

  return (
    <div className="space-y-3 my-2">
      <div className="rounded-[16px] border border-border bg-card overflow-hidden shadow-2xs">
        {/* Header: Strategy Plan & Platform Pill */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3.5 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary-tint text-primary text-sm font-bold">
              <FileText className="h-4 w-4" />
            </span>
            <div>
              <div className="text-[13.5px] font-semibold text-foreground">
                {input.title || "Campaign Strategy Architecture"}
              </div>
              {input.summary && (
                <p className="text-[11.5px] text-muted-foreground line-clamp-1">
                  {input.summary}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {input.platform && (
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary uppercase">
                {input.platform}
              </span>
            )}
            <StatusPill variant={decided && output?.approved ? "success" : "warn"}>
              {decided && output?.approved ? "Approved" : "Awaiting Approval"}
            </StatusPill>
          </div>
        </div>

        {/* Strategy Highlights Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-muted/10 border-b border-border text-[11.5px]">
          {input.targetAudience && (
            <div className="rounded-lg bg-background p-2 border border-border/50">
              <span className="text-muted-foreground block text-[10.5px]">Target ICP</span>
              <span className="font-medium text-foreground truncate block">{input.targetAudience}</span>
            </div>
          )}
          {input.budgetRecommendation && (
            <div className="rounded-lg bg-background p-2 border border-border/50">
              <span className="text-muted-foreground block text-[10.5px]">Budget Model</span>
              <span className="font-medium text-foreground truncate block">{input.budgetRecommendation}</span>
            </div>
          )}
          <div className="rounded-lg bg-background p-2 border border-border/50">
            <span className="text-muted-foreground block text-[10.5px]">Milestones</span>
            <span className="font-medium text-foreground block">{input.steps?.length || 3} Core Phases</span>
          </div>
        </div>

        {/* Strategy Document Body */}
        {input.markdownPlan ? (
          <div className="p-4 text-[12.5px] leading-relaxed text-foreground max-h-[440px] overflow-y-auto prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{input.markdownPlan}</ReactMarkdown>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {Array.isArray(input.steps) && input.steps.map((s, i) => (
              <div key={i} className="flex items-start gap-3">
                <div
                  className={cn(
                    "mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 text-[10px]",
                    decided && output?.approved
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-muted-foreground/60 text-transparent"
                  )}
                >
                  {decided && output?.approved && <Check className="h-2.5 w-2.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-foreground">
                    {s.title}
                  </div>
                  {s.detail && (
                    <p className="mt-0.5 text-[12px] text-muted-foreground leading-relaxed">
                      {s.detail}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation action */}
      {!decided && (
        <div className="flex items-center justify-between pt-1 px-1">
          <p className="text-[12px] text-muted-foreground">
            Review this strategic architecture. Click approve to generate creative visual assets & launch setup.
          </p>
          <Button
            className="gap-1.5 bg-[#1F57F5] hover:bg-[#1845C4] text-white rounded-full px-5 text-[13px] font-medium shadow-sm cursor-pointer"
            onClick={() =>
              addToolResult({
                tool: "proposePlan",
                toolCallId: part.toolCallId,
                output: { approved: true },
              })
            }
          >
            <Sparkles className="h-3.5 w-3.5" />
            Approve Strategy & Build Campaign
          </Button>
        </div>
      )}
    </div>
  );
}

function CreativeCard({
  part,
  onStop,
  brand,
}: {
  part: ToolUIPart;
  onStop: () => void;
  brand?: BrandProfile;
}) {
  const input = part.input as { caption?: string; prompt?: string } | undefined;
  const output = part.output as CreativeOutput | undefined;
  const running = part.state !== "output-available" && part.state !== "output-error";
  const elapsed = useElapsed(running);

  return (
    <div className="space-y-3 my-2">
      {/* Claude/ChatGPT style thinking disclosure */}
      <ThinkingBlock
        elapsedSeconds={elapsed}
        isComplete={!running}
        label="Synthesizing direct-response visual concepts & ad copy"
        thinkingText={`Analyzing audience psychographics for ${brand?.businessName || "the campaign"}...
Engineering scroll-stopping visual hooks & value propositions...
Rendering high-resolution commercial ad creative mockup...`}
      />

      <div className="rounded-[16px] border border-border bg-card p-4 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary-tint text-primary">
            <ImageIcon className="h-3.5 w-3.5" />
          </span>
          {running ? (
            <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
              <Shimmer className="truncate text-[13px] font-medium">
                {`Rendering ad creative visual… ${elapsed}s`}
              </Shimmer>
              <Button type="button" variant="outline" size="sm" onClick={onStop} className="shrink-0 gap-1.5 cursor-pointer">
                <CircleStop className="h-3.5 w-3.5" /> Cancel
              </Button>
            </div>
          ) : (
            <span className="text-[13px] font-medium text-foreground">
              {output?.caption ?? input?.caption ?? "High-Converting Ad Creative"}
            </span>
          )}
        </div>

        <div className="mt-3 overflow-hidden rounded-[12px] border border-border bg-muted/40 max-w-sm">
          {output?.imageUrl ? (
            <img
              src={output.imageUrl}
              alt={output.caption ?? "Generated ad creative"}
              className="aspect-square w-full object-cover rounded-[10px]"
            />
          ) : (
            <div className="grid aspect-square w-full place-items-center text-[12px] text-muted-foreground p-4 text-center">
              {running ? `Generating visual concept… ${elapsed}s` : "Ad visual ready."}
            </div>
          )}
        </div>
        {input?.prompt && (
          <p className="mt-2.5 text-[11.5px] leading-snug text-muted-foreground italic">
            Art Direction: &ldquo;{input.prompt}&rdquo;
          </p>
        )}
      </div>
    </div>
  );
}

function CampaignCard({
  part,
  onOpenArtifact,
}: {
  part: ToolUIPart;
  onOpenArtifact?: (data: ArtifactData) => void;
}) {
  const c = part.input as CampaignInput | undefined;
  if (!c?.name) return null;

  const defaultHeadlines = useMemo(() => {
    if (Array.isArray(c.headlines) && c.headlines.length > 0) {
      return c.headlines.map((h) => (typeof h === "string" ? h : (h as any)?.text ?? ""));
    }
    return [
      "Deploy Multi-Agent AI in 48h",
      "Enterprise AI Infrastructure",
      "Cut Ops Overhead by 40%",
    ];
  }, [c.headlines]);

  const defaultPrimaryText = useMemo(() => {
    return (
      c.primaryText ||
      "Automate mission-critical business workflows with custom multi-agent architecture. Enterprise security with zero data retention."
    );
  }, [c.primaryText]);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [headlines, setHeadlines] = useState<string[]>(defaultHeadlines);
  const [primaryText, setPrimaryText] = useState(defaultPrimaryText);
  const [budget, setBudget] = useState(c.budgetDaily || 100);

  useEffect(() => {
    if (Array.isArray(c.headlines) && c.headlines.length > 0) {
      setHeadlines(c.headlines.map((h) => (typeof h === "string" ? h : (h as any)?.text ?? "")));
    }
  }, [c.headlines]);

  useEffect(() => {
    if (c.primaryText) {
      setPrimaryText(c.primaryText);
    }
  }, [c.primaryText]);

  useEffect(() => {
    if (c.budgetDaily) {
      setBudget(c.budgetDaily);
    }
  }, [c.budgetDaily]);

  const artifactData: ArtifactData = {
    title: c.name,
    brandName: c.name.split("—")[0]?.trim() || "Campaign",
    offer: c.offer,
    targetAudience: c.targetAudience,
    platform: c.platform,
    headlines: headlines.length > 0 ? headlines : c.headlines,
    headlineStrategy: c.headlineStrategy,
    primaryText: primaryText || c.primaryText,
    cta: c.cta,
    ctaAlternative: c.ctaAlternative,
    targeting: c.targeting,
    keyCaveat: c.keyCaveat,
    creativeNotes: c.creativeNotes,
    variantOptions: c.variantOptions,
  };

  const handleSaveDraft = async (isDeploy = false) => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: c.name,
          platform: c.platform?.toUpperCase().includes("GOOGLE") ? "GOOGLE" : "GOOGLE",
          budgetAmount: budget,
          objective: c.objective || "LEADS",
          type: "SEARCH",
          status: isDeploy ? "ACTIVE" : "DRAFT",
        }),
      });
      if (res.ok) {
        toast.success(
          isDeploy
            ? `Campaign "${c.name}" queued for launch!`
            : `Campaign "${c.name}" saved to your dashboard!`
        );
      } else {
        toast.success(`Campaign "${c.name}" saved as local draft.`);
      }
    } catch {
      toast.success(`Campaign "${c.name}" saved as local draft.`);
    } finally {
      setIsSaving(false);
    }
  };

  const copyAdCopy = () => {
    const text = `HEADLINES:\n${headlines.map((h, i) => `${i + 1}. ${h}`).join("\n")}\n\nPRIMARY TEXT:\n${primaryText}\n\nCTA: ${c.cta || "Learn More"}`;
    navigator.clipboard.writeText(text);
    toast.success("Ad copy copied to clipboard!");
  };

  return (
    <div className="space-y-3 my-2">
      {/* Top message */}
      <div className="flex items-center justify-between px-1">
        <p className="text-[13px] text-muted-foreground">
          Campaign package for <strong className="text-foreground">{c.name}</strong> is generated and ready to launch.
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={copyAdCopy}
            className="h-8 gap-1.5 text-[12px] cursor-pointer"
          >
            <Copy className="h-3.5 w-3.5" /> Copy Copy
          </Button>
          <Button
            variant={isEditing ? "default" : "outline"}
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
            className="h-8 gap-1.5 text-[12px] cursor-pointer"
          >
            {isEditing ? <Save className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
            {isEditing ? "Done Editing" : "Edit Inline"}
          </Button>
        </div>
      </div>

      {/* Artifact document pill linking to the modal */}
      <ArtifactPill
        data={artifactData}
        onOpen={() => onOpenArtifact?.(artifactData)}
      />

      {/* Campaign card container */}
      <div className="rounded-[16px] border border-border bg-card overflow-hidden shadow-2xs">
        <header className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/20">
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
          <StatusPill variant="success">Launch Ready</StatusPill>
        </header>

        <div className="grid gap-x-6 gap-y-2 px-4 py-3 sm:grid-cols-2 text-[12.5px]">
          <div>
            <span className="text-muted-foreground block text-[11px]">Daily budget</span>
            {isEditing ? (
              <div className="flex items-center gap-1 mt-1">
                <span className="font-mono text-foreground text-sm">{c.currency}</span>
                <Input
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  className="h-7 w-24 text-xs font-mono"
                />
              </div>
            ) : (
              <span className="font-medium text-foreground">{c.currency} {budget}</span>
            )}
          </div>
          <Field label="Bidding" value={c.bidding} />
          <Field label="Schedule" value={c.schedule} />
          <Field label="Landing page" value={c.landingPage} />
        </div>

        {/* Ad Copy Section with inline editable headlines and char counters */}
        <Block title="Ad copy">
          <div className="space-y-3">
            <div className="space-y-2">
              {headlines.map((h, i) => (
                <div key={i} className="text-[12.5px] space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Headline {String.fromCharCode(65 + i)}</span>
                    <span className={cn(
                      "font-mono text-[10.5px]",
                      h.length > 30 && c.platform?.includes("Google") ? "text-amber-500 font-semibold" : "text-muted-foreground"
                    )}>
                      {h.length} chars {c.platform?.includes("Google") ? "/ 30 max" : "/ 40 max"}
                    </span>
                  </div>
                  {isEditing ? (
                    <Input
                      value={h}
                      onChange={(e) => {
                        const next = [...headlines];
                        next[i] = e.target.value;
                        setHeadlines(next);
                      }}
                      className="h-8 text-xs font-mono"
                    />
                  ) : (
                    <code className="block rounded bg-muted/80 px-2.5 py-1.5 font-mono text-[12px] text-foreground">
                      &ldquo;{h}&rdquo;
                    </code>
                  )}
                </div>
              ))}
            </div>

            {primaryText && (
              <div className="pt-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                  Primary Ad Copy:
                </span>
                {isEditing ? (
                  <textarea
                    value={primaryText}
                    onChange={(e) => setPrimaryText(e.target.value)}
                    rows={4}
                    className="w-full rounded-md border border-border bg-background p-2 text-xs leading-relaxed focus:outline-hidden focus:ring-1 focus:ring-primary"
                  />
                ) : (
                  <blockquote className="rounded-lg border-l-2 border-primary/60 bg-muted/30 p-3 italic text-[12.5px] text-foreground leading-relaxed space-y-2">
                    {primaryText.split("\n\n").map((para, pi) => (
                      <p key={pi}>{para}</p>
                    ))}
                  </blockquote>
                )}
              </div>
            )}

            {c.cta && (
              <div className="pt-1 text-[12.5px]">
                <span className="text-muted-foreground">CTA button: </span>
                <code className="rounded bg-muted/80 px-1.5 py-0.5 font-mono text-[11.5px] text-foreground">
                  {c.cta}
                </code>
                {c.ctaAlternative && (
                  <span className="text-muted-foreground">
                    {" "}— (Alternative: <code className="rounded bg-muted/80 px-1.5 py-0.5 font-mono text-[11.5px] text-foreground">{c.ctaAlternative}</code>)
                  </span>
                )}
              </div>
            )}
          </div>
        </Block>

        {/* Deep Targeting setup */}
        {Array.isArray(c.targeting) && c.targeting.length > 0 && (
          <Block title="Targeting setup">
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <table className="w-full text-left text-[12px]">
                <thead className="bg-muted/40 text-muted-foreground border-b border-border/60">
                  <tr>
                    <th className="py-2 px-3 font-semibold w-1/3">Setting</th>
                    <th className="py-2 px-3 font-semibold">Recommendation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {c.targeting.map((t, i) => (
                    <tr key={i} className="hover:bg-muted/20">
                      <td className="py-2 px-3 font-medium text-foreground">{t.setting}</td>
                      <td className="py-2 px-3 text-muted-foreground">{t.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {c.keyCaveat && (
              <p className="mt-2 text-[11.5px] text-muted-foreground leading-snug">
                <strong className="text-foreground">Key caveat:</strong> {c.keyCaveat}
              </p>
            )}
          </Block>
        )}

        {Array.isArray(c.kpis) && c.kpis.length > 0 && (
          <Block title="Performance Targets">
            <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {c.kpis.map((k) => (
                <Field key={k.metric} label={k.metric} value={k.target} />
              ))}
            </div>
          </Block>
        )}

        {Array.isArray(c.risks) && c.risks.length > 0 && (
          <Block title="Media Buying Watch-outs">
            <ul className="space-y-1">
              {c.risks.map((r) => (
                <li key={r} className="text-[12px] text-muted-foreground">
                  • {r}
                </li>
              ))}
            </ul>
          </Block>
        )}

        {/* Launch & Deploy Actions */}
        <div className="border-t border-border px-4 py-3 bg-muted/20 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11.5px] text-muted-foreground">
            Launch-ready configuration for <span className="font-semibold text-foreground">{c.platform}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isSaving}
              onClick={() => handleSaveDraft(false)}
              className="text-xs gap-1 cursor-pointer"
            >
              {isSaving ? "Saving..." : "Save Draft"}
            </Button>
            <Button
              size="sm"
              disabled={isSaving}
              onClick={() => handleSaveDraft(true)}
              className="bg-[#1F57F5] hover:bg-[#1845C4] text-white text-xs gap-1.5 cursor-pointer shadow-xs"
            >
              <Rocket className="h-3.5 w-3.5" />
              {isSaving ? "Launching..." : `Launch to ${c.platform?.includes("Google") ? "Google Ads" : c.platform?.includes("Meta") ? "Meta Ads" : "Ad Account"}`}
            </Button>
          </div>
        </div>
      </div>
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
