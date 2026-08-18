import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function SectionCard({
  title,
  action,
  children,
  className,
  padding = true,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  padding?: boolean;
}) {
  return (
    <section className={cn("card-surface", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border">
          <h3 className="text-[16px] font-semibold text-foreground">{title}</h3>
          {action}
        </header>
      )}
      <div className={cn(padding && "p-5")}>{children}</div>
    </section>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 px-6 text-center", className)}>
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-tint text-primary">
          {icon}
        </div>
      )}
      <h4 className="text-[15px] font-semibold text-foreground">{title}</h4>
      {description && <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function SkeletonPanel({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3 animate-pulse", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-4 rounded bg-muted" style={{ width: `${70 + ((i * 13) % 30)}%` }} />
      ))}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-[20px] font-semibold text-foreground">{title}</h1>
        {subtitle && <p className="text-[13px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}