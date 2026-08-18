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
  live: "bg-[#E6F4EC] text-[#2E9E5B]",
  success: "bg-[#E6F4EC] text-[#2E9E5B]",
  paused: "bg-[#FBF0DA] text-[#B8892B]",
  warn: "bg-[#FBF0DA] text-[#B8892B]",
  learning: "bg-[#EEF1F5] text-[#4B6584]",
  info: "bg-[#EEF1F5] text-[#4B6584]",
  rejected: "bg-[#FBE7E5] text-[#D3564C]",
  danger: "bg-[#FBE7E5] text-[#D3564C]",
  draft: "bg-muted text-muted-foreground",
  primary: "bg-[#EAF0FE] text-[#1F57F5]",
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