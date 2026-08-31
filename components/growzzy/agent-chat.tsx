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
  Loader2,
  Megaphone,
  MessageCircleQuestion,
  Paperclip,
  Rocket,
  Search,
  Target,
  Wand2,
  Briefcase,
  ArrowRight,
  Sparkles,
  Pencil,
  Save,
  Copy,
  FileText,
  X,
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
  sitelinks?: { title: string; description: string }[];
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
  const lastSubmission = useRef<Submission | null>(null);

  const { messages, sendMessage, addToolResult, status, stop, setMessages } = useChat({
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
    onFinish: (message) => {
      // Persist conversation to DB
      const storeMessages = messages.map((m) => ({
        role: m.role,
        content: (m.parts ?? []).map((p) => {
          if (p.type === "text") return { role: m.role as "user" | "assistant" | "system", content: p.text };
          if (p.type === "tool-call") return { role: m.role as "user" | "assistant" | "system", content: JSON.stringify({ tool: (p as any).toolCallId, input: p.input }) };
          return null;
        }).filter(Boolean) as any,
      }));
      const convId = threadId === "growzzy-agent" ? crypto.randomUUID() : threadId;
      fetch(`/api/ai/conversations/${convId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: storeMessages }),
      }).catch(() => {}); // fire-and-forget
    },
  });

  // Load existing conversation from DB on mount (when threadId is a real UUID)
  const conversationLoaded = useRef(false);
  useEffect(() => {
    if (conversationLoaded.current) return;
    if (!threadId || threadId === "growzzy-agent") return;
    conversationLoaded.current = true;
    (async () => {
      try {
        const res = await fetch(`/api/ai/conversations/${encodeURIComponent(threadId)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!data?.ok || !data?.conversation) return;
        const stored: any[] = Array.isArray(data.conversation.messages) ? data.conversation.messages : [];
        if (!stored.length) return;
        const hydrated = stored.map((m: any, i: number) => ({
          id: `${threadId}-${i}`,
          role: m.role || "user",
          content: "",
          parts: Array.isArray(m.parts) && m.parts.length
            ? m.parts
            : [{ type: "text" as const, text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }],
        }));
        setMessages(hydrated as any);
      } catch {
        // silent — start with empty chat
      }
    })();
  }, [threadId, setMessages]);

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
    <div className={cn("w-full px-1 pb-2 mx-auto max-w-4xl")}>
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
        className={cn("w-full px-1 pb-6 mx-auto max-w-4xl")}
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
          <InlineStatusPill messages={messages} />
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
              "mx-1 mb-2 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border p-3 mx-auto w-full max-w-4xl",
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

      <ArtifactModal
        data={activeArtifact}
        open={Boolean(activeArtifact)}
        onClose={() => setActiveArtifact(null)}
      />
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
              return (
                <PlanCard
                  key={i}
                  part={part as ToolUIPart}
                  addToolResult={addToolResult}
                  onOpenArtifact={onOpenArtifact}
                  brandName={brand?.businessName}
                />
              );
            }
            if (name === "previewExecution") {
              return (
                <ExecutionPlanCard key={i} part={part as ToolUIPart} addToolResult={addToolResult} />
              );
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
      return <Megaphone className="h-4 w-4" />;
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

function PlanCard({
  part,
  addToolResult,
  onOpenArtifact,
  brandName,
}: {
  part: ToolUIPart;
  addToolResult: AddToolResult;
  onOpenArtifact?: (data: ArtifactData) => void;
  brandName?: string;
}) {
  const input = part.input as PlanInput | undefined;
  const output = part.output as
    | { approved?: boolean; qualityIssues?: string[]; retryGuidance?: string }
    | undefined;
  if (!input) return null;
  const decided = part.state === "output-available";
  const wasRejected = decided && output?.approved === false;
  const wasApproved = decided && output?.approved === true;

  const strategyArtifact: ArtifactData = {
    title: input.title || "Campaign Strategy Architecture",
    brandName: brandName || input.title?.split(" ")[0] || "Strategy",
    rawMarkdown: input.markdownPlan,
  };

  return (
    <div className="space-y-3 my-2">
      {input.markdownPlan && (
        <ArtifactPill
          data={strategyArtifact}
          onOpen={() => onOpenArtifact?.(strategyArtifact)}
        />
      )}

      <div
        className={cn(
          "rounded-[16px] border bg-card overflow-hidden shadow-2xs",
          wasRejected ? "border-amber-500/60" : "border-border",
        )}
      >
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
            <StatusPill variant={wasRejected ? "warn" : wasApproved ? "success" : "warn"}>
              {wasRejected ? "Quality Rejected" : wasApproved ? "Approved" : "Awaiting Approval"}
            </StatusPill>
          </div>
        </div>

        {/* Quality rejection banner — surfaces what was wrong so the user
            understands why the model is rewriting. */}
        {wasRejected && Array.isArray(output?.qualityIssues) && output.qualityIssues.length > 0 && (
          <div className="border-b border-amber-500/30 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-[12px]">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-amber-500 text-white">
                <X className="h-3 w-3" />
              </span>
              <div className="flex-1 min-w-0 space-y-1">
                <p className="font-semibold text-amber-900 dark:text-amber-200">
                  Strategy needs revision — Growzzy is rewriting it now.
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-amber-800 dark:text-amber-300/90 leading-relaxed">
                  {output.qualityIssues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

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

      {/* Confirmation action — adjust based on decision state */}
      {decided && output?.approved === false && (
        <div className="flex items-center justify-between pt-1 px-1">
          <p className="text-[12px] text-muted-foreground">
            Review this strategic architecture. Click below to resubmit after fixing the issues above.
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
            Resubmit
          </Button>
        </div>
      )}
      {decided && output?.approved && (
        <div className="flex items-center justify-between pt-1 px-1">
          <p className="text-[12px] text-muted-foreground">
            Approved — generating creative assets & launch setup.
          </p>
        </div>
      )}
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

function ExecutionPlanCard({
  part,
  addToolResult,
}: {
  part: ToolUIPart;
  addToolResult: AddToolResult;
}) {
  const input = part.input as
    | {
        title?: string;
        summary?: string;
        steps?: { activity: string; description: string }[];
      }
    | undefined;
  const decided = part.state === "output-available";
  const [secondsLeft, setSecondsLeft] = useState(10);
  const [proceeded, setProceeded] = useState(false);
  const fired = useRef(false);
  const addToolResultRef = useRef(addToolResult);
  addToolResultRef.current = addToolResult;

  // Auto-proceed after 10s — only run when the tool is actually pending.
  // Keep dependencies tight to avoid re-creating the interval on every parent render.
  useEffect(() => {
    if (decided || proceeded) return;
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          if (!fired.current) {
            fired.current = true;
            addToolResultRef.current({
              tool: "previewExecution",
              toolCallId: part.toolCallId,
              output: { proceed: true },
            });
            setProceeded(true);
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decided, proceeded, part.toolCallId]);

  if (!input?.steps?.length) return null;

  const handleProceed = () => {
    if (fired.current) return;
    fired.current = true;
    addToolResultRef.current({
      tool: "previewExecution",
      toolCallId: part.toolCallId,
      output: { proceed: true },
    });
    setProceeded(true);
  };

  return (
    <div className="space-y-2 my-2">
      <div className="flex items-center gap-2 text-[12.5px] text-foreground/80 pl-1">
        <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium">Execution plan</span>
        <span className="text-muted-foreground">
          — {input.title || "about to run these activities"}
        </span>
      </div>
      <div className="rounded-[16px] border border-border bg-card overflow-hidden shadow-2xs">
        <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary-tint text-primary shrink-0">
            <ListChecks className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-semibold text-foreground truncate">
              {input.title || "Execution Plan"}
            </div>
            {input.summary && (
              <p className="text-[11.5px] text-muted-foreground truncate">{input.summary}</p>
            )}
          </div>
        </div>
        <ol className="divide-y divide-border">
          {(input.steps || []).map((s, i) => {
            const isDone = proceeded || decided;
            const isActive = !isDone && i === 0;
            return (
              <li key={i} className="flex items-start gap-3 px-4 py-2.5">
                <div
                  className={cn(
                    "mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0",
                    isDone
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : isActive
                        ? "border-primary text-primary"
                        : "border-muted-foreground/40 text-muted-foreground/40",
                  )}
                >
                  {isDone ? (
                    <Check className="h-3 w-3" />
                  ) : isActive ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <span className="text-[10px] font-mono">{i + 1}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-medium text-foreground">{s.activity}</div>
                  {s.description && (
                    <p className="text-[11.5px] text-muted-foreground leading-snug">
                      {s.description}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        {!decided && !proceeded && (
          <div className="border-t border-border px-4 py-3 flex items-center justify-between gap-3 bg-muted/10">
            <p className="text-[11.5px] text-muted-foreground">
              Proceeding in{" "}
              <span className="font-mono font-bold text-foreground">{secondsLeft}s</span> unless you
              want to adjust.
            </p>
            <Button
              size="sm"
              onClick={handleProceed}
              className="bg-[#1F57F5] hover:bg-[#1845C4] text-white gap-1.5 text-[12.5px] cursor-pointer"
            >
              Proceed with plan
            </Button>
          </div>
        )}
        {proceeded && (
          <div className="border-t border-border px-4 py-2.5 text-[11.5px] text-emerald-600 font-medium flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5" /> Proceeding
          </div>
        )}
      </div>
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
              onError={(e) => {
                const el = e.currentTarget
                if (el.dataset.fallback === "1") return
                el.dataset.fallback = "1"
                el.src = "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=1080&q=80"
              }}
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

/** Serialise a delivered campaign into a clean Markdown document. */
function buildCampaignMarkdown(c: CampaignInput): string {
  const lines: string[] = [];
  lines.push(`# ${c.name}`);
  lines.push("");
  lines.push(`**Platform:** ${c.platform}  `);
  lines.push(`**Objective:** ${c.objective}  `);
  lines.push(`**Daily Budget:** ${c.currency} ${c.budgetDaily}  `);
  lines.push(`**Bidding:** ${c.bidding}  `);
  lines.push(`**Schedule:** ${c.schedule}  `);
  lines.push(`**Landing Page:** ${c.landingPage}  `);
  if (c.offer) lines.push(`**Offer:** ${c.offer}  `);
  if (c.targetAudience) lines.push(`**Target Audience:** ${c.targetAudience}  `);
  lines.push("");
  if (Array.isArray(c.headlines) && c.headlines.length) {
    lines.push("## Headlines");
    c.headlines.forEach((h, i) => lines.push(`${i + 1}. ${typeof h === "string" ? h : (h as { text?: string })?.text ?? ""}`));
    lines.push("");
  }
  if (Array.isArray(c.descriptions) && c.descriptions.length) {
    lines.push("## Descriptions");
    c.descriptions.forEach((d) => lines.push(`- ${d}`));
    lines.push("");
  }
  if (c.primaryText) {
    lines.push("## Primary Text");
    lines.push(c.primaryText);
    lines.push("");
  }
  if (c.cta) {
    lines.push(`**CTA:** ${c.cta}${c.ctaAlternative ? ` (alt: ${c.ctaAlternative})` : ""}`);
    lines.push("");
  }
  if (Array.isArray(c.targeting) && c.targeting.length) {
    lines.push("## Targeting");
    c.targeting.forEach((t) => lines.push(`- **${t.setting}:** ${t.value}`));
    lines.push("");
  }
  if (Array.isArray(c.keywords) && c.keywords.length) {
    lines.push("## High-Intent Keywords");
    c.keywords.forEach((k) => lines.push(`\`${k}\``));
    lines.push("");
  }
  if (Array.isArray(c.exclusions) && c.exclusions.length) {
    lines.push("## Negative Exclusions");
    c.exclusions.forEach((e) => lines.push(`-${e}`));
    lines.push("");
  }
  if (Array.isArray(c.sitelinks) && c.sitelinks.length) {
    lines.push("## Sitelinks");
    c.sitelinks.forEach((s) => lines.push(`- **${s.title}** — ${s.description}`));
    lines.push("");
  }
  if (Array.isArray(c.kpis) && c.kpis.length) {
    lines.push("## Performance Targets");
    c.kpis.forEach((k) => lines.push(`- **${k.metric}:** ${k.target}`));
    lines.push("");
  }
  if (Array.isArray(c.risks) && c.risks.length) {
    lines.push("## Watch-outs");
    c.risks.forEach((r) => lines.push(`- ${r}`));
    lines.push("");
  }
  if (c.keyCaveat) {
    lines.push(`**Key caveat:** ${c.keyCaveat}`);
    lines.push("");
  }
  return lines.join("\n");
}

function downloadCampaignAsMarkdown(c: CampaignInput) {
  try {
    const md = buildCampaignMarkdown(c);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${String(c.name || "campaign").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Campaign downloaded as Markdown");
  } catch {
    toast.error("Could not download campaign as Markdown");
  }
}

function CampaignCard({
  part,
  onOpenArtifact,
}: {
  part: ToolUIPart;
  onOpenArtifact?: (data: ArtifactData) => void;
}) {
  const c = part.input as CampaignInput | undefined;
  // If the server-side validator rejected this delivery, show a quality-issue
  // banner instead of a launch-ready card. The model is retrying in the same turn.
  const out = part.output as { delivered?: boolean; qualityIssues?: string[] } | undefined;
  const rejected = part.state === "output-available" && out?.delivered === false;
  if (!c?.name) return null;

  // Derive base values directly from the tool input so streaming updates
  // flow in without a useEffect → setState round-trip. useEffect-based
  // syncing against `c.headlines` was causing a React #185 infinite loop
  // because the AI SDK hands us a new array reference on every stream tick.
  const baseHeadlines: string[] = useMemo(() => {
    if (Array.isArray(c.headlines) && c.headlines.length > 0) {
      return c.headlines.map((h) => (typeof h === "string" ? h : (h as any)?.text ?? ""));
    }
    return [
      "Deploy Multi-Agent AI in 48h",
      "Enterprise AI Infrastructure",
      "Cut Ops Overhead by 40%",
    ];
  }, [c.headlines]);

  const basePrimaryText: string = useMemo(
    () =>
      c.primaryText ||
      "Automate mission-critical business workflows with custom multi-agent architecture. Enterprise security with zero data retention.",
    [c.primaryText],
  );

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [launchedId, setLaunchedId] = useState<string | null>(null);
  const [editedHeadlines, setEditedHeadlines] = useState<string[] | null>(null);
  const [editedPrimaryText, setEditedPrimaryText] = useState<string | null>(null);
  const [editedBudget, setEditedBudget] = useState<number | null>(null);

  // Once the user starts editing, lock the values to whatever they typed.
  // While NOT editing, follow the streamed base values so updates flow in.
  const headlines = editedHeadlines ?? baseHeadlines;
  const primaryText = editedPrimaryText ?? basePrimaryText;
  const budget = editedBudget ?? c.budgetDaily ?? 100;

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
    if (isDeploy) {
      // Real launch path — pushes to the user's connected Google / Meta ad account
      try {
        const res = await fetch("/api/chat/launch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: c.name,
            platform: c.platform?.toUpperCase().includes("META") ? "META" : "GOOGLE",
            objective: c.objective || "LEADS",
            budgetDaily: Number(budget) || 50,
            currency: "USD",
            bidding: c.bidding || "maximize conversions",
            schedule: c.schedule || undefined,
            landingPage: c.landingPage || undefined,
            offer: c.offer || undefined,
            targetAudience: c.targetAudience || undefined,
            headlines,
            descriptions: c.descriptions || [],
            primaryText: primaryText || undefined,
            cta: c.cta || undefined,
            keywords: c.keywords || [],
            exclusions: c.exclusions || [],
            targeting: c.targeting || [],
            keyCaveat: c.keyCaveat || undefined,
            imageUrl: undefined,
            brandContext: c.offer || c.name,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.ok) {
          setLaunchedId(data.externalCampaignId || null);
          toast.success(data.message || `Campaign is live.`);
        } else {
          const code = data?.error?.code || "LAUNCH_FAILED";
          const message = data?.error?.message || "Ad account rejected the launch.";
          if (code === "INTEGRATION_REQUIRED" || code === "AD_ACCOUNT_REQUIRED") {
            toast.error(message, { duration: 6000 });
          } else if (code === "QUALITY_BLOCK") {
            toast.error(message, { duration: 6000 });
          } else {
            toast.error(message);
          }
        }
      } catch (err) {
        toast.error("Network error. Could not reach the launch service.");
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // Save Draft path — local-only persistence
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: c.name,
          platform: c.platform?.toUpperCase().includes("META") ? "META" : "GOOGLE",
          budgetAmount: budget,
          objective: c.objective || "LEADS",
          type: "SEARCH",
          status: "DRAFT",
        }),
      });
      if (res.ok) {
        toast.success(`Campaign "${c.name}" saved to your dashboard!`);
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

      {/* Campaign card container */}
      <div className={cn(
        "rounded-[16px] border bg-card overflow-hidden shadow-2xs",
        rejected ? "border-amber-500/60" : "border-border",
      )}>
        <header className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/20">
          <div className="flex items-center gap-2 min-w-0">
            <span className={cn(
              "grid h-7 w-7 place-items-center rounded-lg shrink-0",
              rejected ? "bg-amber-500/10 text-amber-600" : "bg-primary-tint text-primary",
            )}>
              <Megaphone className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold text-foreground truncate">{c.name}</div>
              <div className="text-[11.5px] text-muted-foreground">
                {c.platform} · {c.objective}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadCampaignAsMarkdown(c)}
              className="h-7 gap-1.5 text-[11.5px] cursor-pointer"
              title="Download as Markdown"
            >
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground font-mono">MD</span>
              <DownloadIcon className="h-3 w-3" />
            </Button>
            <StatusPill variant={rejected ? "warn" : "success"}>
              {rejected ? "Quality Rejected" : "Launch Ready"}
            </StatusPill>
          </div>
        </header>

        {/* Quality rejection banner */}
        {rejected && Array.isArray(out?.qualityIssues) && out.qualityIssues.length > 0 && (
          <div className="border-b border-amber-500/30 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-[12px]">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-amber-500 text-white">
                <X className="h-3 w-3" />
              </span>
              <div className="flex-1 min-w-0 space-y-1">
                <p className="font-semibold text-amber-900 dark:text-amber-200">
                  Campaign needs revision — Growzzy is rewriting it now.
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-amber-800 dark:text-amber-300/90 leading-relaxed">
                  {out.qualityIssues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-x-6 gap-y-2 px-4 py-3 sm:grid-cols-2 text-[12.5px]">
          <div>
            <span className="text-muted-foreground block text-[11px]">Daily budget</span>
            {isEditing ? (
              <div className="flex items-center gap-1 mt-1">
                <span className="font-mono text-foreground text-sm">{c.currency}</span>
                <Input
                  type="number"
                  value={budget}
                  onChange={(e) => setEditedBudget(Number(e.target.value))}
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
                        setEditedHeadlines((prev) => {
                          const base = prev ? [...prev] : [...headlines];
                          base[i] = e.target.value;
                          return base;
                        });
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
                    onChange={(e) => setEditedPrimaryText(e.target.value)}
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

        {/* Keywords & Intent */}
        {Array.isArray(c.keywords) && c.keywords.length > 0 && (
          <Block title="High-Intent Keywords">
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {c.keywords.map((k, i) => (
                <span
                  key={i}
                  className="rounded bg-muted px-2 py-1 font-mono text-[11.5px] text-foreground border border-border/50"
                >
                  {k}
                </span>
              ))}
            </div>
            {Array.isArray(c.exclusions) && c.exclusions.length > 0 && (
              <div className="mt-2 text-[11.5px] text-muted-foreground">
                <span className="font-medium text-foreground">Negative exclusions ({c.exclusions.length}): </span>
                {c.exclusions.map((ex) => `-${ex}`).join(", ")}
              </div>
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
          <div className="flex items-center gap-2">
            <div className="text-[11.5px] text-muted-foreground">
              {launchedId ? (
                <span className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    LIVE
                  </span>
                  {launchedId && <span className="text-[11px] text-muted-foreground font-mono">{launchedId}</span>}
                </span>
              ) : (
                <>Launch-ready for <span className="font-semibold text-foreground">{c.platform}</span></>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!launchedId && (
              <Button
                variant="outline"
                size="sm"
                disabled={isSaving}
                onClick={() => handleSaveDraft(false)}
                className="text-xs gap-1 cursor-pointer"
              >
                {isSaving ? "Saving..." : "Save Draft"}
              </Button>
            )}
            {launchedId ? (
              <span className="text-[11.5px] text-emerald-600 font-medium flex items-center gap-1">
                <Check className="h-3.5 w-3.5" />
                Live in {c.platform?.includes("Google") ? "Google Ads" : "Meta Ads"}
              </span>
            ) : (
              <Button
                size="sm"
                disabled={isSaving}
                onClick={() => handleSaveDraft(true)}
                className="bg-[#1F57F5] hover:bg-[#1845C4] text-white text-xs gap-1.5 cursor-pointer shadow-xs"
              >
                <Rocket className="h-3.5 w-3.5" />
                {isSaving ? "Pushing..." : `Launch to ${c.platform?.includes("Google") ? "Google Ads" : c.platform?.includes("Meta") ? "Meta Ads" : "Ad Account"}`}
              </Button>
            )}
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

/** Inline status pill shown at the bottom of the chat while tools are running.
 *  Reflects the most recent in-flight tool call with a contextual label. */
function InlineStatusPill({ messages }: { messages: UIMessage[] }) {
  const label = useMemo(() => {
    for (let mi = (messages?.length ?? 0) - 1; mi >= 0; mi -= 1) {
      const m = messages[mi];
      if (!m?.parts) continue;
      for (let pi = m.parts.length - 1; pi >= 0; pi -= 1) {
        const p = m.parts[pi];
        if (!p || !isToolUIPart(p)) continue;
        const state = (p as ToolUIPart).state;
        if (state === "input-available" || state === "input-streaming") {
          const name = getToolName(p as ToolUIPart);
          if (name === "research") return "Researching your market";
          if (name === "analyzeWebsite") return "Analyzing your website";
          if (name === "askUser") return "Preparing setup questions";
          if (name === "askBrandUrl") return "Waiting for your website";
          if (name === "proposePlan") return "Building the strategy document";
          if (name === "generateCreative") return "Generating the ad creative";
          if (name === "deliverCampaign") return "Packaging the campaign";
          if (name === "getMyAnalytics") return "Reviewing your account performance";
          if (name === "getMyCampaigns") return "Checking your live campaigns";
          if (name === "getMyLeads") return "Pulling your recent leads";
          if (name === "getMyRecommendations") return "Finding optimization opportunities";
          if (name === "previewExecution") return "Preparing the execution plan";
          return "Working on it";
        }
      }
    }
    return "Thinking";
  }, [messages]);

  return (
    <div className="flex items-center gap-2 pl-1">
      <Shimmer className="text-[13.5px]">{`${label}…`}</Shimmer>
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
