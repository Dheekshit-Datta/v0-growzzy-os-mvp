"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  loadBrand,
  saveBrand,
  brandIsReady,
  brandContextText,
  emptyBrand,
  type BrandProfile,
} from "@/lib/brand-store";
import { useChat, type Message } from "@ai-sdk/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import ReactMarkdown from "react-markdown";
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
  Send,
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

  const offer = (brand.whatTheySell || brand.productDescription).trim();
  const segment = brand.segments[0]?.segment ?? brand.audience;
  const competitor = brand.competitors[0]?.name;
  const keyword = brand.keywords[0];

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

export interface AgentChatProps {
  threadId?: string;
}

export function AgentChat({ threadId = "growzzy-agent" }: AgentChatProps) {
  const [brand, setBrand] = useState<BrandProfile>(emptyBrand);

  useEffect(() => {
    const sync = () => setBrand(loadBrand());
    sync();
    window.addEventListener("growzzy:brand-updated", sync);
    return () => window.removeEventListener("growzzy:brand-updated", sync);
  }, []);

  const brandReady = brandIsReady(brand);
  const suggestions = useMemo(() => buildSuggestions(brand), [brand]);
  const greetingName = brand.businessName || "there";

  const {
    messages,
    input,
    setInput,
    handleSubmit: chatHandleSubmit,
    handleInputChange,
    isLoading,
    stop,
    addToolResult,
    error,
    reload,
  } = useChat({
    id: threadId,
    api: "/api/chat",
    body: {
      brandContext: brandContextText(loadBrand()),
    },
    maxSteps: 50,
    onError: (e) => {
      toast.error(e.message || "Something went wrong");
    },
    onToolCall: async ({ toolCall }) => {
      // Tools that need client-side confirmation return undefined to pause
      // Tools with server execute functions are auto-handled
      if (toolCall.toolName === "askBrandUrl" || toolCall.toolName === "askUser" || toolCall.toolName === "proposePlan") {
        // These tools need user input — don't auto-resolve
        return undefined;
      }
    },
  });

  /* When the agent analyses a website in-chat, persist it as the brand context. */
  const savedAnalysis = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const m of messages) {
      if (m.role !== "assistant" || !m.toolInvocations) continue;
      for (const inv of m.toolInvocations) {
        if (inv.toolName !== "analyzeWebsite" || inv.state !== "result") continue;
        if (savedAnalysis.current.has(inv.toolCallId)) continue;
        const result = inv.result as { site?: string; profile?: Partial<BrandProfile> } | undefined;
        if (!result?.profile?.businessName) continue;
        savedAnalysis.current.add(inv.toolCallId);
        const current = loadBrand();
        saveBrand({
          ...current,
          ...result.profile,
          website: result.site ?? current.website,
          defaultLandingPage: current.defaultLandingPage || result.site || "",
          analyzedAt: new Date().toISOString(),
        } as BrandProfile);
        toast.success(`Saved ${result.profile.businessName} to My Brand.`);
      }
    }
  }, [messages]);

  const started = messages.length > 0;

  const submit = (text: string) => {
    if (!text.trim()) return;
    setInput(text);
    // Use a micro-delay so the input state is set before submit
    setTimeout(() => {
      const fakeEvent = { preventDefault: () => {} } as FormEvent<HTMLFormElement>;
      chatHandleSubmit(fakeEvent);
    }, 0);
  };

  const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() && !isLoading) return;
    chatHandleSubmit(e);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim()) {
        const form = e.currentTarget.closest("form");
        if (form) form.requestSubmit();
      }
    }
  };

  /* ---- Derive artifacts for preview rail ---- */
  const artifacts = useMemo(() => {
    const out: {
      plan?: PlanInput;
      planApproved?: boolean;
      creative?: CreativeOutput;
      campaign?: CampaignInput;
      citations: { url: string; site: string; title: string }[];
    } = { citations: [] };
    const seen = new Set<string>();
    for (const m of messages) {
      if (!m.toolInvocations) continue;
      for (const inv of m.toolInvocations) {
        if (inv.toolName === "proposePlan" && inv.args) {
          out.plan = inv.args as PlanInput;
          if (inv.state === "result") {
            out.planApproved = (inv.result as { approved?: boolean })?.approved;
          }
        }
        if (inv.toolName === "generateCreative" && inv.state === "result") {
          out.creative = inv.result as CreativeOutput;
        }
        if (inv.toolName === "deliverCampaign" && inv.args) {
          out.campaign = inv.args as CampaignInput;
        }
        if (inv.toolName === "research" && inv.state === "result") {
          const cites = (inv.result as { citations?: { url: string; site: string; title: string }[] })?.citations;
          for (const c of cites ?? []) {
            if (seen.has(c.url)) continue;
            seen.add(c.url);
            out.citations.push(c);
          }
        }
      }
    }
    return out;
  }, [messages]);

  const hasPreview = Boolean(
    artifacts.plan || artifacts.campaign || artifacts.creative || artifacts.citations.length,
  );

  /* ---- Render ---- */
  const composer = (
    <div className={cn("w-full px-1 pb-2", hasPreview ? "" : "mx-auto max-w-3xl")}>
      <form
        onSubmit={handleFormSubmit}
        className="relative flex flex-col rounded-2xl border border-border bg-card shadow-xs transition-shadow focus-within:ring-1 focus-within:ring-primary/20"
      >
        <textarea
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          autoFocus
          placeholder={started ? "Ask anything…" : "Ask anything, or describe what to launch…"}
          rows={2}
          className="min-h-[60px] w-full resize-none border-0 bg-transparent px-4 pt-3.5 pb-2 text-[13.5px] shadow-none focus:outline-none focus:ring-0 placeholder:text-muted-foreground"
        />
        <div className="flex items-center justify-between gap-2 px-3 pb-2.5 pt-1 border-t border-border/40">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => toast.info("Attachments are coming soon.")}
              aria-label="Attach a file"
              className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
            >
              <Paperclip className="h-4 w-4" />
            </button>
          </div>
          {isLoading ? (
            <button
              type="button"
              onClick={stop}
              className="h-9 w-9 rounded-full bg-red-500 text-white hover:bg-red-600 flex items-center justify-center cursor-pointer transition-colors"
            >
              <CircleStop className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="h-9 w-9 rounded-full bg-foreground text-background hover:bg-foreground/90 flex items-center justify-center cursor-pointer transition-opacity disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>
      </form>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        Growzzy can make mistakes. Review every campaign before launching.
      </p>
    </div>
  );

  const thread = started ? (
    <div className="flex-1 overflow-y-auto">
      <div className={cn("flex flex-col gap-6 p-4", hasPreview ? "w-full" : "mx-auto max-w-3xl")}>
        {messages.map((m) => (
          <ChatMessage
            key={m.id}
            message={m}
            addToolResult={addToolResult}
            onStop={stop}
            isLoading={isLoading}
          />
        ))}
        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex items-center gap-2 pl-1">
            <Shimmer className="text-[13.5px]">Growzzy is thinking…</Shimmer>
          </div>
        )}
      </div>
    </div>
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
        <div className="mt-5 flex w-full max-w-xl items-center justify-between gap-3 rounded-[12px] border border-border bg-amber-50/50 dark:bg-amber-900/10 p-3.5">
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
            className="group flex items-start gap-3 rounded-[12px] border border-border bg-card p-3.5 text-left transition-colors hover:border-primary/30 hover:bg-blue-50/40 dark:hover:bg-blue-900/10 cursor-pointer"
          >
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-50 dark:bg-blue-900/20 text-primary">
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
            <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer text-xs">
              <DownloadIcon className="h-3.5 w-3.5" /> Download transcript
            </Button>
          </div>
        )}
        {thread}
        {error && (
          <div className={cn(
            "mx-1 mb-2 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border p-3",
            hasPreview ? "" : "mx-auto w-full max-w-3xl",
            "border-red-500/30 bg-red-500/5",
          )}>
            <div className="min-w-0">
              <div className="text-[12.5px] font-medium text-foreground">Something went wrong</div>
              <p className="text-[12px] leading-snug text-muted-foreground">{error.message}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" onClick={() => reload()} disabled={isLoading} className="gap-1.5 cursor-pointer">
                <RefreshCw className="h-3.5 w-3.5" /> Retry
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

/* ===================== Preview Rail ===================== */

function PreviewRail({ artifacts }: {
  artifacts: {
    plan?: PlanInput;
    planApproved?: boolean;
    creative?: CreativeOutput;
    campaign?: CampaignInput;
    citations: { url: string; site: string; title: string }[];
  };
}) {
  const { plan, planApproved, creative, campaign, citations } = artifacts;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Live campaign preview
        </span>
        {campaign ? (
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600">Ready</span>
        ) : plan ? (
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", planApproved ? "bg-blue-500/10 text-blue-600" : "bg-amber-500/10 text-amber-600")}>
            {planApproved ? "Building" : "Awaiting approval"}
          </span>
        ) : (
          <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-600">Researching</span>
        )}
      </div>

      {creative?.imageUrl && (
        <div className="overflow-hidden rounded-[12px] border border-border bg-card">
          <img src={creative.imageUrl} alt={creative.caption ?? "Ad creative"} className="aspect-square w-full object-cover" />
          <div className="px-3 py-2 text-[11.5px] text-muted-foreground">{creative.caption}</div>
        </div>
      )}

      {campaign ? (
        <div className="rounded-[12px] border border-border bg-card p-3">
          <div className="text-[13px] font-semibold text-foreground">{campaign.name}</div>
          <div className="text-[11.5px] text-muted-foreground">{campaign.platform} · {campaign.objective}</div>
          <div className="mt-2 space-y-1">
            <PField label="Daily budget" value={`${campaign.currency} ${campaign.budgetDaily}`} />
            <PField label="Bidding" value={campaign.bidding} />
            <PField label="Schedule" value={campaign.schedule} />
          </div>
        </div>
      ) : plan ? (
        <div className="rounded-[12px] border border-border bg-card p-3">
          <div className="text-[13px] font-semibold text-foreground">{plan.title}</div>
          <ol className="mt-2 space-y-1.5">
            {plan.steps.map((s, i) => (
              <li key={i} className="flex gap-2 text-[12px] text-muted-foreground">
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-muted text-[10px]">{i + 1}</span>
                {s.title}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {citations.length > 0 && (
        <div className="rounded-[12px] border border-border bg-card p-3">
          <div className="mb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">Sources read ({citations.length})</div>
          <ul className="space-y-1">
            {citations.slice(0, 10).map((c) => (
              <li key={c.url} className="truncate text-[11.5px]">
                <a href={c.url} target="_blank" rel="noreferrer noopener" className="text-primary hover:underline">{c.site}</a>
                <span className="text-muted-foreground"> — {c.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ===================== Chat Message ===================== */

function ChatMessage({
  message,
  addToolResult,
  onStop,
  isLoading,
}: {
  message: Message;
  addToolResult: (args: { toolCallId: string; result: any }) => void;
  onStop: () => void;
  isLoading: boolean;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl bg-muted/60 px-4 py-3 text-[13.5px] text-foreground">
          {message.content}
        </div>
      </div>
    );
  }

  // Assistant message
  const textContent = typeof message.content === "string" ? message.content : "";
  const toolInvocations = message.toolInvocations ?? [];

  return (
    <div className="space-y-3">
      {/* Text content */}
      {textContent && (
        <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed">
          <ReactMarkdown>{textContent}</ReactMarkdown>
        </div>
      )}

      {/* Tool invocations */}
      {toolInvocations.map((inv) => {
        if (inv.toolName === "askBrandUrl") {
          return <BrandUrlCard key={inv.toolCallId} inv={inv} addToolResult={addToolResult} />;
        }
        if (inv.toolName === "analyzeWebsite") {
          return <AnalyzeCard key={inv.toolCallId} inv={inv} />;
        }
        if (inv.toolName === "research") {
          return <ResearchCard key={inv.toolCallId} inv={inv} />;
        }
        if (inv.toolName === "askUser") {
          return <QuestionsCard key={inv.toolCallId} inv={inv} addToolResult={addToolResult} />;
        }
        if (inv.toolName === "proposePlan") {
          return <PlanCard key={inv.toolCallId} inv={inv} addToolResult={addToolResult} />;
        }
        if (inv.toolName === "generateCreative") {
          return <CreativeCard key={inv.toolCallId} inv={inv} onStop={onStop} />;
        }
        if (inv.toolName === "deliverCampaign") {
          return <CampaignCard key={inv.toolCallId} inv={inv} />;
        }
        return null;
      })}
    </div>
  );
}

/* ===================== Tool Cards ===================== */

type ToolInv = NonNullable<Message["toolInvocations"]>[number];

function BrandUrlCard({ inv, addToolResult }: { inv: ToolInv; addToolResult: (a: { toolCallId: string; result: any }) => void }) {
  const args = inv.args as { reason?: string } | undefined;
  const done = inv.state === "result";
  const sent = done ? (inv.result as { url?: string })?.url : undefined;
  const [url, setUrl] = useState("");

  return (
    <div className="rounded-[12px] border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-50 dark:bg-blue-900/20 text-primary">
          <Globe className="h-3.5 w-3.5" />
        </span>
        <span className="text-[13px] font-medium text-foreground">What&apos;s your website?</span>
      </div>
      <p className="mt-1.5 text-[12.5px] text-muted-foreground">
        {args?.reason ?? "Drop your website URL and I'll analyse your business live — offer, audience, competitors, keywords — before asking anything else."}
      </p>
      {done ? (
        <div className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-emerald-600">
          <Check className="h-3.5 w-3.5" /> {sent}
        </div>
      ) : (
        <form className="mt-3 flex gap-2" onSubmit={(e) => {
          e.preventDefault();
          const value = url.trim();
          if (!value) return;
          addToolResult({ toolCallId: inv.toolCallId, result: { url: value } });
        }}>
          <Input value={url} onChange={(e) => setUrl(e.currentTarget.value)} placeholder="yourbrand.com" className="h-9 text-[13px]" />
          <Button type="submit" disabled={!url.trim()} className="h-9 shrink-0 cursor-pointer">Analyse</Button>
        </form>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">
        Or set it up once in <Link href="/dashboard/brand" className="text-primary hover:underline">My Brand</Link>.
      </p>
    </div>
  );
}

function AnalyzeCard({ inv }: { inv: ToolInv }) {
  const args = inv.args as { url?: string } | undefined;
  const running = inv.state !== "result";
  const result = !running ? (inv.result as { site?: string; error?: string; profile?: any } | undefined) : undefined;
  const p = result?.profile;

  return (
    <div className="rounded-[12px] border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-50 dark:bg-blue-900/20 text-primary">
          <Globe className="h-3.5 w-3.5" />
        </span>
        {running ? (
          <Shimmer className="text-[13px] font-medium">{`Analysing ${args?.url ?? "your website"} — reading pages, finding competitors…`}</Shimmer>
        ) : (
          <span className="text-[13px] font-medium text-foreground">
            {p ? `Analysed ${p.businessName}` : "Analysis failed"}
          </span>
        )}
      </div>
      {result?.error && <p className="mt-2 text-[12.5px] text-red-500">{result.error}</p>}
      {p && (
        <div className="mt-3 space-y-1.5">
          <PField label="Industry" value={p.industry} />
          <PField label="Model" value={p.businessModel} />
          <PField label="Sells" value={p.whatTheySell} />
          <PField label="Audience" value={p.audience} />
          <div className="flex flex-wrap gap-1.5 pt-1">
            {(p.competitors ?? []).slice(0, 5).map((c: any) => (
              <span key={c.name} className="rounded-full border border-border bg-background px-2 py-0.5 text-[11.5px] text-muted-foreground">{c.name}</span>
            ))}
          </div>
          <p className="pt-1 text-[11px] text-muted-foreground">Saved to My Brand.</p>
        </div>
      )}
    </div>
  );
}

function ResearchCard({ inv }: { inv: ToolInv }) {
  const args = inv.args as { focus?: string; topics?: string[] } | undefined;
  const running = inv.state !== "result";
  const result = !running ? (inv.result as { notes?: string; queries?: string[]; citations?: { url: string; site: string; title: string }[] } | undefined) : undefined;

  return (
    <div className="rounded-[12px] border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-50 dark:bg-blue-900/20 text-primary">
          <Search className="h-3.5 w-3.5" />
        </span>
        {running ? (
          <Shimmer className="text-[13px] font-medium">{`Researching ${args?.focus ?? "your market"}…`}</Shimmer>
        ) : (
          <span className="text-[13px] font-medium text-foreground">Research complete — {args?.focus ?? "market analysis"}</span>
        )}
      </div>
      {args?.topics && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {args.topics.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[11.5px] text-muted-foreground">
              {!running && <Check className="h-3 w-3 text-emerald-500" />}
              {t}
            </span>
          ))}
        </div>
      )}
      {result?.citations && result.citations.length > 0 && (
        <div className="mt-3 rounded-[10px] border border-border bg-background p-3">
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Sources read live ({result.citations.length})</div>
          <ul className="space-y-1">
            {result.citations.map((c) => (
              <li key={c.url} className="text-[11.5px] leading-snug">
                <a href={c.url} target="_blank" rel="noreferrer noopener" className="font-medium text-primary hover:underline">{c.site}</a>
                <span className="text-muted-foreground"> — {c.title}</span>
              </li>
            ))}
          </ul>
          {result.queries && result.queries.length > 0 && (
            <p className="mt-2 text-[11px] text-muted-foreground">Searched: {result.queries.join(" · ")}</p>
          )}
        </div>
      )}
    </div>
  );
}

function QuestionsCard({ inv, addToolResult }: { inv: ToolInv; addToolResult: (a: { toolCallId: string; result: any }) => void }) {
  const args = inv.args as AskUserInput | undefined;
  const answered = inv.state === "result";
  const [answers, setAnswers] = useState<Record<string, string>>({});

  if (!args?.questions?.length) return null;
  const total = args.questions.length;
  const complete = args.questions.every((q) => answers[q.id]);

  return (
    <div className="rounded-[12px] border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-50 dark:bg-blue-900/20 text-primary">
          <MessageCircleQuestion className="h-3.5 w-3.5" />
        </span>
        <span className="text-[13px] font-medium text-foreground">A few things before I build</span>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{total} questions</span>
      </div>
      <div className="mt-4 space-y-4">
        {args.questions.map((q, qi) => (
          <div key={q.id} className="rounded-[10px] border border-border bg-background p-3.5">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{qi + 1} / {total}</div>
            <div className="mt-1 text-[13.5px] font-medium text-foreground">{q.question}</div>
            <p className="mt-0.5 text-[12px] text-muted-foreground">{q.why}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {q.options.map((o) => {
                const selected = answers[q.id] === o.label;
                return (
                  <button
                    key={o.label}
                    disabled={answered}
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.label }))}
                    className={cn(
                      "rounded-[10px] border p-2.5 text-left transition-colors cursor-pointer",
                      selected ? "border-primary bg-blue-50/50 dark:bg-blue-900/20" : "border-border bg-card hover:border-primary/30",
                      answered && !selected && "opacity-60",
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="text-[12.5px] font-medium text-foreground">{o.label}</span>
                      {o.recommended && (
                        <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">Recommended</span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-[11.5px] leading-snug text-muted-foreground">{o.description}</span>
                  </button>
                );
              })}
            </div>
            {!answered && (
              <Input
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswers((cur) => ({ ...cur, [q.id]: e.currentTarget.value }))}
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
          onClick={() => addToolResult({ toolCallId: inv.toolCallId, result: { answers } })}
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

function PlanCard({ inv, addToolResult }: { inv: ToolInv; addToolResult: (a: { toolCallId: string; result: any }) => void }) {
  const args = inv.args as PlanInput | undefined;
  const decided = inv.state === "result";
  const output = decided ? (inv.result as { approved?: boolean }) : undefined;
  if (!args?.steps?.length) return null;

  return (
    <div className="rounded-[12px] border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-50 dark:bg-blue-900/20 text-primary">
          <ListChecks className="h-3.5 w-3.5" />
        </span>
        <span className="text-[13px] font-medium text-foreground">{args.title || "Execution plan"}</span>
        {decided && (
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", output?.approved ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600")}>
            {output?.approved ? "Approved" : "Changes requested"}
          </span>
        )}
      </div>
      {args.summary && <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">{args.summary}</p>}
      <ol className="mt-4 space-y-3">
        {args.steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className={cn(
              "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-medium",
              decided && output?.approved ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground",
            )}>
              {decided && output?.approved ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <span>
              <span className="block text-[13px] font-medium text-foreground">{s.title}</span>
              <span className="block text-[12px] leading-snug text-muted-foreground">{s.detail}</span>
            </span>
          </li>
        ))}
      </ol>
      {!decided && (
        <div className="mt-4 flex gap-2">
          <Button className="flex-1 gap-1.5 cursor-pointer" onClick={() => addToolResult({ toolCallId: inv.toolCallId, result: { approved: true } })}>
            <Rocket className="h-4 w-4" /> Approve plan
          </Button>
          <Button variant="outline" className="flex-1 cursor-pointer" onClick={() => addToolResult({ toolCallId: inv.toolCallId, result: { approved: false, feedback: "The user wants changes — ask what to adjust before building." } })}>
            Decline
          </Button>
        </div>
      )}
    </div>
  );
}

function CreativeCard({ inv, onStop }: { inv: ToolInv; onStop: () => void }) {
  const args = inv.args as { caption?: string; prompt?: string } | undefined;
  const running = inv.state !== "result";
  const result = !running ? (inv.result as CreativeOutput | undefined) : undefined;
  const elapsed = useElapsed(running);

  return (
    <div className="rounded-[12px] border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-50 dark:bg-blue-900/20 text-primary">
          <ImageIcon className="h-3.5 w-3.5" />
        </span>
        {running ? (
          <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
            <Shimmer className="truncate text-[13px] font-medium">{`Rendering your ad creative… ${elapsed}s (usually 60–120s)`}</Shimmer>
            <Button type="button" variant="outline" size="sm" onClick={onStop} className="shrink-0 gap-1.5 cursor-pointer">
              <CircleStop className="h-3.5 w-3.5" /> Cancel
            </Button>
          </div>
        ) : (
          <span className="text-[13px] font-medium text-foreground">{result?.caption ?? args?.caption ?? "Ad creative"}</span>
        )}
      </div>
      <div className="mt-3 overflow-hidden rounded-[10px] border border-border bg-muted">
        {result?.imageUrl ? (
          <img src={result.imageUrl} alt={result.caption ?? "Generated ad creative"} className="aspect-square w-full max-w-sm object-cover" />
        ) : (
          <div className="grid aspect-square w-full max-w-sm place-items-center text-[12px] text-muted-foreground">
            {result?.error ?? (running ? `Rendering… ${elapsed}s elapsed` : "No creative returned — ask me to retry.")}
          </div>
        )}
      </div>
    </div>
  );
}

function CampaignCard({ inv }: { inv: ToolInv }) {
  const c = inv.args as CampaignInput | undefined;
  if (!c?.name) return null;
  return (
    <div className="rounded-[12px] border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-50 dark:bg-blue-900/20 text-primary">
            <Megaphone className="h-3.5 w-3.5" />
          </span>
          <div>
            <div className="text-[13.5px] font-semibold text-foreground">{c.name}</div>
            <div className="text-[11.5px] text-muted-foreground">{c.platform} · {c.objective}</div>
          </div>
        </div>
        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600">Launch ready</span>
      </header>
      <div className="grid gap-x-6 gap-y-2 px-4 py-3 sm:grid-cols-2">
        <PField label="Daily budget" value={`${c.currency} ${c.budgetDaily}`} />
        <PField label="Bidding" value={c.bidding} />
        <PField label="Schedule" value={c.schedule} />
        <PField label="Landing page" value={c.landingPage} />
      </div>
      {c.targeting?.length > 0 && (
        <CBlock title="Targeting">
          <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {c.targeting.map((t) => <PField key={t.setting} label={t.setting} value={t.value} />)}
          </div>
        </CBlock>
      )}
      {c.keywords?.length > 0 && (
        <CBlock title="Keywords">
          <div className="flex flex-wrap gap-1.5">
            {c.keywords.map((k) => (
              <span key={k} className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 text-[11.5px] text-primary">
                <Search className="h-3 w-3" />{k}
              </span>
            ))}
          </div>
        </CBlock>
      )}
      <CBlock title="Ad copy">
        <div className="space-y-1.5">
          {c.headlines?.map((h) => <div key={h} className="text-[13px] font-medium text-primary">{h}</div>)}
          {c.descriptions?.map((d) => <div key={d} className="text-[12.5px] text-foreground/80">{d}</div>)}
          {c.primaryText && <p className="pt-1 text-[12.5px] leading-relaxed text-muted-foreground">{c.primaryText}</p>}
          {c.cta && (
            <div className="pt-1">
              <span className="rounded-md bg-primary px-2.5 py-1 text-[11.5px] font-medium text-primary-foreground">{c.cta}</span>
            </div>
          )}
        </div>
      </CBlock>
      {c.kpis?.length > 0 && (
        <CBlock title="Targets">
          <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {c.kpis.map((k) => <PField key={k.metric} label={k.metric} value={k.target} />)}
          </div>
        </CBlock>
      )}
      {c.risks?.length > 0 && (
        <CBlock title="Watch-outs">
          <ul className="space-y-1">
            {c.risks.map((r) => <li key={r} className="text-[12.5px] text-muted-foreground">• {r}</li>)}
          </ul>
        </CBlock>
      )}
    </div>
  );
}

/* ===================== Helpers ===================== */

function CBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border px-4 py-3">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

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

function PField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12.5px] text-muted-foreground">{label}</span>
      <span className="text-[12.5px] font-medium text-foreground">{value}</span>
    </div>
  );
}
