"use client";

import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { ReactNode } from "react";

export function TrendPill({
  value,
  positiveIsGood = true,
  suffix = "%",
}: {
  value: number;
  positiveIsGood?: boolean;
  suffix?: string;
}) {
  if (!Number.isFinite(value)) return null;
  const up = value >= 0;
  const good = positiveIsGood ? up : !up;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium tnum",
        good ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600",
      )}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(value).toFixed(1)}
      {suffix}
    </span>
  );
}

export function KpiCard({
  label,
  value,
  trend,
  caption,
  icon,
  positiveIsGood = true,
}: {
  label: string;
  value: string;
  trend?: number;
  caption?: string;
  icon?: ReactNode;
  positiveIsGood?: boolean;
}) {
  return (
    <div className="rounded-[12px] border border-border bg-card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground font-medium">
          {icon}
          {label}
        </div>
        {typeof trend === "number" && <TrendPill value={trend} positiveIsGood={positiveIsGood} />}
      </div>
      <div className="text-[30px] font-bold leading-none text-foreground">{value}</div>
      {caption && <div className="text-xs text-muted-foreground">{caption}</div>}
    </div>
  );
}
