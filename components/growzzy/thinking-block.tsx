"use client";

import { useState } from "react";
import { ChevronDown, Sparkles, Brain, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Shimmer } from "@/components/ai-elements/shimmer";

interface ThinkingBlockProps {
  thinkingText?: string;
  isComplete?: boolean;
  elapsedSeconds?: number;
  label?: string;
  className?: string;
}

export function ThinkingBlock({
  thinkingText,
  isComplete = false,
  elapsedSeconds = 0,
  label = "Thinking",
  className,
}: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(false);

  const defaultThinkingProcess = [
    "Analyzing brand context & market positioning...",
    "Identifying high-intent buyer personas & awareness levels...",
    "Evaluating competitor differentiation & direct-response hooks...",
    "Structuring single-topic ad groups and keyword clusters...",
    "Synthesizing high-converting ad copy and creative art direction...",
  ].join("\n");

  const displayText = thinkingText?.trim() || defaultThinkingProcess;

  return (
    <div
      className={cn(
        "my-2 rounded-[12px] border border-border/70 bg-muted/20 text-[12.5px] transition-all overflow-hidden",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-muted/30 transition-colors text-left cursor-pointer"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2 text-muted-foreground font-medium">
          {isComplete ? (
            <div className="flex items-center gap-1.5 text-foreground/80">
              <Brain className="h-3.5 w-3.5 text-[#1F57F5]" />
              <span>Thought for {Math.max(1, elapsedSeconds)}s</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[#1F57F5] animate-pulse" />
              <Shimmer className="text-foreground/90 font-medium">
                {label}... ({elapsedSeconds}s)
              </Shimmer>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 text-[11px] text-muted-foreground/80">
          <span>{expanded ? "Hide reasoning" : "Show reasoning"}</span>
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform duration-200", expanded && "rotate-180")}
          />
        </div>
      </button>

      {expanded && (
        <div className="px-4 py-3 border-t border-border/50 bg-background/60 text-[12px] font-mono leading-relaxed text-muted-foreground whitespace-pre-wrap animate-in fade-in duration-150">
          {displayText}
        </div>
      )}
    </div>
  );
}
