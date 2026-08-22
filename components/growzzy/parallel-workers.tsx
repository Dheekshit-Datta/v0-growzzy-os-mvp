"use client";

import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  Check,
  Loader2,
  Sparkles,
  Bot,
  Palette,
  Target,
} from "lucide-react";

export interface SpecialistTask {
  id: string;
  role: "Performance Marketing" | "Creative Director" | string;
  avatarIcon?: "target" | "palette" | "bot";
  taskTitle: string;
  brief: {
    offer?: string;
    targetAudience?: string;
    platform?: string;
    aesthetic?: string;
    deliverables?: string[];
    rawText?: string;
  };
  status: "pending" | "running" | "completed";
}

export interface ParallelWorkersProps {
  tasks?: SpecialistTask[];
  completedCount?: number;
  totalCount?: number;
  elapsedSeconds?: number;
  isComplete?: boolean;
}

export function ParallelWorkersCard({
  tasks,
  completedCount = 2,
  totalCount = 2,
  elapsedSeconds = 30,
  isComplete = true,
}: ParallelWorkersProps) {
  const [openWorker, setOpenWorker] = useState<Record<string, boolean>>({
    worker_1: false,
    worker_2: false,
  });

  const [timer, setTimer] = useState(elapsedSeconds);

  useEffect(() => {
    if (isComplete) return;
    const interval = setInterval(() => setTimer((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isComplete]);

  const defaultTasks: SpecialistTask[] = [
    {
      id: "worker_1",
      role: "Performance Marketing",
      avatarIcon: "target",
      taskTitle: 'Write a Meta (Facebook lead gen ad copy pack...)',
      brief: {
        rawText: `Write a Meta (Facebook/Instagram) lead gen ad for the brand. **Offer:** Free AI audit / consultation **Target audience:** CTOs / VPs of Engineering **Platform:** Meta feed (Facebook + Instagram)\n\nDeliver the following:\n1. **3 headline variations** (40 chars max each) — direct, technical, no fluff\n2. **Primary text** (2–3 short paragraphs) — speaks to engineering leaders, pain points around AI adoption/performance, edge\n3. **CTA button recommendation** (e.g. "Learn More", "Get Offer", "Book Now")\n4. **Targeting recommendations** — Meta audience targeting`,
      },
      status: isComplete ? "completed" : "running",
    },
    {
      id: "worker_2",
      role: "Creative Director",
      avatarIcon: "palette",
      taskTitle: 'Generate a Meta feed ad image...',
      brief: {
        rawText: `Generate a Meta feed ad image for the campaign. **Ad offer:** Free AI audit / consultation **Target audience:** CTOs / VPs of Engineering **Aesthetic:** Dark, minimalist enterprise AI — high contrast, bold typography, infrastructure/engineering tone. Think terminal interfaces, grid systems, precision. Not loud, not consumer — sharp and authoritative.\n\nGenerate one Meta feed image (1:1 or 4:5 ratio). The image should feel like it belongs in a technical/enterprise context — something a CTO would stop scrolling for. Include visual language that suggests AI systems.`,
      },
      status: isComplete ? "completed" : "running",
    },
  ];

  const displayTasks = tasks && tasks.length > 0 ? tasks : defaultTasks;
  const done = isComplete || completedCount >= totalCount;

  return (
    <div className="space-y-2">
      {/* Top message line */}
      <p className="text-[13px] text-muted-foreground pl-1">
        Copy and creative are independent — both running now.
      </p>

      {/* Main card */}
      <div className="rounded-[16px] border border-border bg-card overflow-hidden shadow-2xs">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2">
            <span className="grid h-5 w-5 place-items-center text-muted-foreground">
              👥
            </span>
            <span className="text-[12px] font-bold tracking-wide text-foreground uppercase">
              {totalCount} SPECIALISTS WORKING IN PARALLEL — {done ? totalCount : completedCount}/{totalCount} DONE
            </span>
          </div>
        </div>

        {/* Worker rows */}
        <div className="divide-y divide-border">
          {(Array.isArray(displayTasks) ? displayTasks : []).map((task, index) => {
            const isOpen = openWorker[task.id] ?? false;
            const isWorkerDone = task.status === "completed" || done;

            return (
              <div key={task.id} className="p-3.5 space-y-2">
                <div
                  onClick={() =>
                    setOpenWorker((prev) => ({ ...prev, [task.id]: !prev[task.id] }))
                  }
                  className="flex items-center justify-between gap-3 cursor-pointer hover:opacity-90 transition-opacity"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      {task.avatarIcon === "target" || index === 0 ? (
                        <Target className="h-3.5 w-3.5" />
                      ) : (
                        <Palette className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0 text-[13px]">
                      <span className="font-semibold text-foreground shrink-0">
                        {task.role}
                      </span>
                      <span className="text-muted-foreground truncate">
                        · &ldquo;{task.taskTitle}&rdquo;
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isWorkerDone ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    )}
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 text-muted-foreground transition-transform",
                        isOpen && "rotate-180"
                      )}
                    />
                  </div>
                </div>

                {isOpen && (
                  <div className="mt-2 rounded-[10px] border border-border bg-muted/40 p-3 text-[12px] leading-relaxed text-foreground/90 animate-in fade-in-50">
                    <span className="font-bold text-foreground block mb-1">Brief:</span>
                    <div className="whitespace-pre-line text-muted-foreground">
                      {task.brief.rawText}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Completion footer pill */}
      {done && (
        <div className="flex items-center gap-2 pl-1 pt-1">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11.5px] text-muted-foreground shadow-2xs">
            <span className="grid h-4 w-4 place-items-center rounded-full bg-emerald-500/10 text-emerald-600">
              <Check className="h-2.5 w-2.5" />
            </span>
            <span>{totalCount} tools completed {timer}s</span>
          </div>
        </div>
      )}
    </div>
  );
}
