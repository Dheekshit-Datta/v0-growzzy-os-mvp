import { cn } from "@/lib/utils";
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
  live: "bg-success-bg text-success",
  success: "bg-success-bg text-success",
  paused: "bg-warn-bg text-warn",
  warn: "bg-warn-bg text-warn",
  learning: "bg-info-bg text-info",
  info: "bg-info-bg text-info",
  rejected: "bg-danger-bg text-danger",
  danger: "bg-danger-bg text-danger",
  draft: "bg-muted text-muted-foreground",
  primary: "bg-primary-tint text-primary",
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