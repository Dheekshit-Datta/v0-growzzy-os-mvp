"use client";

import React, { memo, useState, type ComponentProps, type HTMLAttributes } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Check, Copy, Download, Maximize2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: "user" | "assistant" | "system";
};

export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      "group flex w-full max-w-[95%] flex-col gap-2",
      from === "user" ? "is-user ml-auto justify-end" : "is-assistant",
      className
    )}
    {...props}
  />
);

export type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageContent = ({
  children,
  className,
  ...props
}: MessageContentProps) => (
  <div
    className={cn(
      "is-user:dark flex w-fit min-w-0 max-w-full flex-col gap-2 overflow-hidden text-sm",
      "group-[.is-user]:ml-auto group-[.is-user]:rounded-2xl group-[.is-user]:bg-[#f0f2f5] dark:group-[.is-user]:bg-muted group-[.is-user]:px-4 group-[.is-user]:py-3 group-[.is-user]:text-foreground",
      "group-[.is-assistant]:text-foreground",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export type MessageActionsProps = ComponentProps<"div">;

export const MessageActions = ({
  className,
  children,
  ...props
}: MessageActionsProps) => (
  <div className={cn("flex items-center gap-1", className)} {...props}>
    {children}
  </div>
);

export type MessageActionProps = ComponentProps<typeof Button> & {
  tooltip?: string;
  label?: string;
};

export const MessageAction = ({
  tooltip,
  children,
  label,
  variant = "ghost",
  size = "sm",
  ...props
}: MessageActionProps) => {
  const button = (
    <Button size={size} type="button" variant={variant} {...props}>
      {children}
      <span className="sr-only">{label || tooltip}</span>
    </Button>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
};

/** Formatted table wrapper with Copy, Download, and Expand toolbar */
function MarkdownTable({ children }: { children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    const tableEl = (e.currentTarget.closest(".markdown-table-card") as HTMLElement)?.querySelector("table");
    if (!tableEl) return;
    const text = tableEl.innerText;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success("Table content copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = (e: React.MouseEvent) => {
    const tableEl = (e.currentTarget.closest(".markdown-table-card") as HTMLElement)?.querySelector("table");
    if (!tableEl) return;
    const rows = Array.from(tableEl.querySelectorAll("tr"));
    const csv = rows
      .map((row) =>
        Array.from(row.querySelectorAll("th, td"))
          .map((cell) => `"${(cell.textContent || "").replace(/"/g, '""').trim()}"`)
          .join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "campaign-ad-copy.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Table downloaded as CSV");
  };

  return (
    <div className="markdown-table-card my-4 overflow-hidden rounded-[12px] border border-border bg-card shadow-xs">
      <div className="flex items-center justify-end gap-1.5 border-b border-border bg-muted/40 px-3 py-1.5 text-muted-foreground">
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
          title="Copy table content"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
        </button>
        <button
          type="button"
          onClick={handleDownload}
          className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
          title="Download as CSV"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Download</span>
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">{children}</table>
      </div>
    </div>
  );
}

/** Code block wrapper with syntax styling and copy button */
function MarkdownCode({
  inline,
  className,
  children,
  ...props
}: {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const codeText = String(children).replace(/\n$/, "");

  if (inline) {
    return (
      <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[12.5px] font-medium text-primary" {...props}>
        {children}
      </code>
    );
  }

  const copyCode = () => {
    navigator.clipboard.writeText(codeText).then(() => {
      setCopied(true);
      toast.success("Code copied");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="relative my-3 overflow-hidden rounded-[10px] border border-border bg-slate-950 text-slate-100">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-3 py-1.5 text-[11px] text-slate-400">
        <span>{match ? match[1] : "code"}</span>
        <button
          type="button"
          onClick={copyCode}
          className="flex items-center gap-1 hover:text-slate-200 cursor-pointer"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3.5 font-mono text-[12.5px] leading-relaxed text-slate-200">
        <code>{children}</code>
      </pre>
    </div>
  );
}

export const MessageResponse = memo(
  ({ children, className }: { children?: string; className?: string }) => {
    return (
      <div className={cn("prose dark:prose-invert max-w-none text-[13.5px] leading-relaxed text-foreground", className)}>
        <ReactMarkdown
          components={{
            table: ({ node, ...props }) => <MarkdownTable {...props} />,
            thead: ({ node, ...props }) => <thead className="border-b border-border bg-muted/30 font-semibold text-foreground" {...props} />,
            tbody: ({ node, ...props }) => <tbody className="divide-y divide-border/60" {...props} />,
            tr: ({ node, ...props }) => <tr className="transition-colors hover:bg-muted/20" {...props} />,
            th: ({ node, ...props }) => <th className="px-4 py-2.5 font-semibold text-foreground text-[12.5px]" {...props} />,
            td: ({ node, ...props }) => <td className="px-4 py-3 align-top text-[13px] text-foreground/90 leading-relaxed" {...props} />,
            code: ({ node, className, children, ...props }: any) => {
              const isInline = !className && typeof children === "string" && !children.includes("\n");
              return <MarkdownCode inline={isInline} className={className} {...props}>{children}</MarkdownCode>;
            },
            h1: ({ node, ...props }) => <h1 className="mt-6 mb-2 text-[18px] font-bold text-foreground first:mt-0" {...props} />,
            h2: ({ node, ...props }) => <h2 className="mt-5 mb-2 text-[16px] font-semibold text-foreground first:mt-0" {...props} />,
            h3: ({ node, ...props }) => <h3 className="mt-4 mb-1.5 text-[14.5px] font-semibold text-foreground first:mt-0" {...props} />,
            h4: ({ node, ...props }) => <h4 className="mt-3 mb-1 text-[13.5px] font-semibold text-foreground first:mt-0" {...props} />,
            p: ({ node, ...props }) => <p className="mb-2.5 last:mb-0 leading-relaxed text-[13.5px] text-foreground/90" {...props} />,
            ul: ({ node, ...props }) => <ul className="my-2 ml-4 list-disc space-y-1 text-[13px] text-foreground/90" {...props} />,
            ol: ({ node, ...props }) => <ol className="my-2 ml-4 list-decimal space-y-1 text-[13px] text-foreground/90" {...props} />,
            li: ({ node, ...props }) => <li className="leading-snug" {...props} />,
            blockquote: ({ node, ...props }) => (
              <blockquote className="my-3 rounded-r-lg border-l-3 border-primary bg-primary/5 py-2 px-3 text-[13px] italic text-foreground/85" {...props} />
            ),
            a: ({ node, href, children, ...props }) => (
              <a
                href={href}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
                {...props}
              >
                {children}
                <ExternalLink className="h-3 w-3 inline opacity-70" />
              </a>
            ),
            strong: ({ node, ...props }) => <strong className="font-semibold text-foreground" {...props} />,
          }}
        >
          {children || ""}
        </ReactMarkdown>
      </div>
    );
  }
);

MessageResponse.displayName = "MessageResponse";
