"use client";

import { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  X,
  Send,
  Loader2,
  HelpCircle,
  TrendingUp,
  DollarSign,
  Layers,
  Lightbulb,
  ArrowRight,
  Bot,
  User,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface AIAssistantDrawerProps {
  open: boolean;
  onClose: () => void;
}

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

const STARTER_PROMPTS = [
  {
    icon: DollarSign,
    title: "How much daily budget should I start with?",
    text: "How much daily budget should a beginner start with for Google Ads and Meta Ads?",
  },
  {
    icon: TrendingUp,
    title: "Explain ROAS like I'm 5",
    text: "What is ROAS (Return on Ad Spend), how is it calculated, and what is a good benchmark?",
  },
  {
    icon: Layers,
    title: "Google Ads vs Meta Ads — which one first?",
    text: "Should I run Google Search Ads or Meta Ads first for my business?",
  },
  {
    icon: HelpCircle,
    title: "Why are people clicking but not buying?",
    text: "My ads are getting clicks but no sales or conversions. What should I check?",
  },
  {
    icon: Lightbulb,
    title: "What makes an ad headline click?",
    text: "What are 3 practical rules for writing high-converting ad headlines?",
  },
];

export function AIAssistantDrawer({ open, onClose }: AIAssistantDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hey! 👋 I'm your Growzzy AI Assistant. Ask me anything about advertising, budgets, metrics, or getting started — no question is too basic or silly! How can I help you today?",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

  const handleSend = async (questionText?: string) => {
    const textToSend = (questionText || input).trim();
    if (!textToSend || loading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // Call chat API in question/advice mode
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            ...messages.map((m) => ({
              id: m.id,
              role: m.role,
              parts: [{ type: "text", text: m.content }],
            })),
            {
              id: userMsg.id,
              role: "user",
              parts: [{ type: "text", text: textToSend }],
            },
          ],
        }),
      });

      if (!res.ok) throw new Error("Failed to get response");

      const rawText = await res.text();
      // Extract text content from stream or fallback to plain text
      let answer = rawText;
      try {
        // If SSE stream format was returned, extract text chunks
        const lines = rawText.split("\n");
        const parsed = lines
          .filter((line) => line.startsWith("0:") || line.startsWith("data: "))
          .map((line) => {
            const raw = line.replace(/^(0:|data:\s*)/, "").trim();
            try {
              return JSON.parse(raw);
            } catch {
              return raw.replace(/^"|"$/g, "");
            }
          })
          .join("");
        if (parsed.trim()) answer = parsed;
      } catch {}

      // Fallback clean answer if raw string contains protocol noise
      if (answer.includes('{"type":') || answer.length < 5) {
        answer = getLocalHelpfulAnswer(textToSend);
      }

      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        role: "assistant",
        content: answer,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      // Friendly local answer fallback
      const fallbackMsg: Message = {
        id: `bot-${Date.now()}`,
        role: "assistant",
        content: getLocalHelpfulAnswer(textToSend),
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content:
          "Fresh chat! Feel free to ask any beginner questions, advice on metrics, or how to launch your ads.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/30 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-card border-l border-border h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-300"
        style={{ background: "linear-gradient(180deg, #ffffff 0%, #f9fafb 100%)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#1F57F5]/10 text-[#1F57F5]">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-foreground flex items-center gap-1.5">
                AI Marketing Assistant
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#EAF0FE] text-[#1F57F5] uppercase">
                  Any question welcome
                </span>
              </h3>
              <p className="text-[11.5px] text-muted-foreground">
                Friendly, jargon-free explanations & advice.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleReset}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Start fresh"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              aria-label="Close assistant"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex gap-2.5 max-w-[92%]",
                m.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
              )}
            >
              <div
                className={cn(
                  "grid h-6 w-6 place-items-center rounded-full shrink-0 text-[11px] mt-0.5",
                  m.role === "user"
                    ? "bg-[#1F57F5] text-white"
                    : "bg-muted text-foreground border border-border"
                )}
              >
                {m.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5 text-[#1F57F5]" />}
              </div>

              <div
                className={cn(
                  "rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed shadow-2xs",
                  m.role === "user"
                    ? "bg-[#1F57F5] text-white rounded-tr-xs"
                    : "bg-card border border-border text-foreground rounded-tl-xs"
                )}
              >
                <div className="whitespace-pre-wrap">{m.content}</div>
                <div
                  className={cn(
                    "text-[10px] mt-1 text-right",
                    m.role === "user" ? "text-white/70" : "text-muted-foreground"
                  )}
                >
                  {m.timestamp}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-2.5 mr-auto max-w-[85%] animate-pulse">
              <div className="grid h-6 w-6 place-items-center rounded-full bg-muted border border-border shrink-0">
                <Bot className="h-3.5 w-3.5 text-[#1F57F5]" />
              </div>
              <div className="rounded-2xl rounded-tl-xs px-4 py-2.5 bg-card border border-border text-[12.5px] text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#1F57F5]" />
                <span>Thinking...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Starter Chips */}
        {messages.length <= 2 && (
          <div className="px-4 py-2 space-y-1.5 border-t border-border/50 bg-muted/10">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Popular questions:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {STARTER_PROMPTS.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSend(p.text)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-card hover:bg-muted/50 hover:border-primary/40 text-[11.5px] text-foreground transition-all cursor-pointer text-left"
                >
                  <p.icon className="h-3 w-3 text-primary shrink-0" />
                  <span className="truncate max-w-[240px]">{p.title}</span>
                  <ArrowRight className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Composer */}
        <div className="p-4 border-t border-border bg-card">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything (e.g., What is CPC? How to test ads?)..."
              className="flex-1 h-10 px-3.5 text-[13px] rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-all"
            />
            <Button
              type="submit"
              size="sm"
              disabled={!input.trim() || loading}
              className="h-10 w-10 p-0 rounded-xl bg-[#1F57F5] hover:bg-[#1F57F5]/90 text-white shrink-0 cursor-pointer"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

function getLocalHelpfulAnswer(prompt: string): string {
  const q = prompt.toLowerCase();

  if (q.includes("roas")) {
    return `**ROAS stands for Return On Ad Spend.**\n\nIt simply tells you how many dollars you make for every $1 you spend on ads:\n• **Formula**: Total Revenue ÷ Total Ad Spend\n• **Example**: If you spend $100 and make $400 in sales, your ROAS is **4.0x** (or 400%).\n\n**What is a good ROAS?**\n• Under 2.0x: Often losing money after product costs.\n• 2.5x – 4.0x: Healthy and profitable for most e-commerce businesses.\n• 5.0x+: Super high performance!`;
  }

  if (q.includes("budget") || q.includes("how much") || q.includes("spend")) {
    return `**Recommended Starting Budgets for Beginners:**\n\n1. **Google Search Ads**: Start with **$25 to $50/day** ($750 – $1,500/month). This gives the algorithm enough data (10–30 high-intent clicks daily) to learn without burning money.\n\n2. **Meta Ads (Facebook/Instagram)**: Start with **$20 to $40/day**. Test 2–3 creative variants at $10/day per ad set.\n\n💡 **Golden Rule**: Run for at least 7 days without tweaking so the AI learning phase can stabilize.`;
  }

  if (q.includes("google") && q.includes("meta")) {
    return `**Google Ads vs Meta Ads: Quick Guide**\n\n• **Choose Google Ads if**: People are already searching for your product/service with intent (e.g. "emergency plumber near me", "CRM software for real estate").\n\n• **Choose Meta Ads if**: Your product is visual, solves a problem people don't know they have yet, or relies on emotion & impulse (fashion, beauty, consumer gadgets, courses).\n\n🚀 **Best Strategy**: Capture high intent on Google Search, while building demand and retargeting on Meta!`;
  }

  if (q.includes("click") && (q.includes("buying") || q.includes("converting") || q.includes("sales"))) {
    return `**Why Clicks Aren't Converting (The 4 Main Fixes):**\n\n1. **Landing Page Mismatch**: Does your landing page headline match the exact promise made in the ad?\n2. **Slow Page Speed**: If your site takes >3 seconds to load on mobile, over 50% of visitors leave immediately.\n3. **Friction at Checkout / Form**: Is your form asking for too many fields? Keep it to Name + Email/Phone.\n4. **Unclear Call To Action (CTA)**: Make sure there is ONE big, obvious button above the fold.`;
  }

  return `Great question! In performance advertising, the key to success is:\n\n1. **Clear Audience Targeting**: Focus on the 20% of buyers who generate 80% of revenue.\n2. **Compelling Hooks**: Lead with the customer's pain point or desired outcome rather than just listing features.\n3. **Relentless Testing**: Always test at least 2 headlines and 2 image variants side by side.\n\nFeel free to ask for specific examples or how to set this up in Growzzy!`;
}
