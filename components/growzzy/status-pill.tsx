import { cn } from "@/lib/utils";
import type { CampaignStatus } from "@/lib/types";
import type { ReactNode } from "react";

type Variant =
  | "live"
  | "paused"
  | "learning"
  | "rejected"
  | "draft"
  | "success"
  | "warn"
  | "danger"
  | "info"
  | "primary";

const styles: Record<Variant, string> = {
  live: "bg-emerald-500/10 text-emerald-600",
  success: "bg-emerald-500/10 text-emerald-600",
  paused: "bg-amber-500/10 text-amber-600",
  warn: "bg-amber-500/10 text-amber-600",
  learning: "bg-blue-500/10 text-blue-600",
  info: "bg-blue-500/10 text-blue-600",
  rejected: "bg-red-500/10 text-red-600",
  danger: "bg-red-500/10 text-red-600",
  draft: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
};

const labels: Record<CampaignStatus, string> = {
  live: "Live",
  paused: "Paused",
  learning: "Learning",
  rejected: "Rejected",
  draft: "Draft",
};

export function StatusPill({
  variant,
  children,
  className,
}: {
  variant: Variant;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles[variant],
        className,
      )}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {children}
    </span>
  );
}

export function CampaignStatusPill({ status }: { status: CampaignStatus }) {
  return <StatusPill variant={status}>{labels[status]}</StatusPill>;
}