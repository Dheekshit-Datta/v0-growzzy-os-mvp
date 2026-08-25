"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import {
  FileText,
  Download,
  ChevronRight,
  X,
  Copy,
  Check,
  Share2,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { toast } from "sonner";

export interface ArtifactData {
  id?: string;
  title: string;
  brandName?: string;
  offer?: string;
  targetAudience?: string;
  platform?: string;
  headlines?: string[];
  headlineStrategy?: string;
  primaryText?: string;
  cta?: string;
  ctaAlternative?: string;
  targeting?: { setting: string; value: string }[];
  keyCaveat?: string;
  creativeNotes?: string;
  variantOptions?: string[];
  rawMarkdown?: string;
}

export function formatArtifactTitle(brandName?: string, rawTitle?: string): string {
  const brand = String(brandName || "Campaign").trim();
  const title = String(rawTitle || "Deliverable").trim();
  if (title.toLowerCase().startsWith(brand.toLowerCase())) {
    return title;
  }
  return `${brand} — ${title}`;
}

/** Builds a clean, professional markdown document from the artifact data. */
export function buildArtifactMarkdown(data: ArtifactData): string {
  if (data.rawMarkdown) return data.rawMarkdown;

  const brand = data.brandName || "Campaign";
  const platform = data.platform || "Multi-Channel";
  const offer = data.offer || "Core Proposition";
  const target = data.targetAudience || "Target ICP";
  const fullTitle = formatArtifactTitle(brand, data.title);

  let md = `# ${fullTitle}\n\n`;
  if (data.offer) md += `**Offer:** ${offer}  \n`;
  if (data.targetAudience) md += `**Target:** ${target}  \n`;
  if (data.platform) md += `**Platform:** ${platform}  \n\n`;
  md += `---\n\n`;

  // 1. Headline variations
  const headlines = data.headlines && data.headlines.length > 0 ? data.headlines : [];
  if (headlines.length > 0) {
    md += `### 1. Headline Variations\n\n`;
    md += `| # | Headline | Character Count |\n`;
    md += `|---|---|---|\n`;
    headlines.forEach((h, i) => {
      const label = String.fromCharCode(65 + i);
      const text = typeof h === "string" ? h : String((h as any)?.text || "");
      md += `| ${label} | ${text} | ${text.length} |\n`;
    });
    md += `\n`;
  }

  if (data.headlineStrategy) {
    md += `**Headline Strategy:** ${data.headlineStrategy}\n\n`;
  }

  // 2. Primary text
  if (data.primaryText) {
    md += `### 2. Ad Copy & Narrative Structure\n\n`;
    const paragraphs = data.primaryText.split("\n\n");
    paragraphs.forEach((p) => {
      if (p.trim()) md += `> ${p.trim()}\n>\n`;
    });
    md += `\n`;
  }

  // 3. CTA button
  if (data.cta) {
    md += `**Call to Action:** \`${data.cta}\``;
    if (data.ctaAlternative) {
      md += ` — (Alternative: \`${data.ctaAlternative}\`)\n\n`;
    } else {
      md += `\n\n`;
    }
  }

  // 4. Targeting setup table
  if (data.targeting && data.targeting.length > 0) {
    md += `### 3. Targeting & Channel Setup\n\n`;
    md += `| Setting | Recommendation |\n`;
    md += `|---|---|\n`;
    data.targeting.forEach((t) => {
      md += `| **${t.setting}** | ${t.value} |\n`;
    });
    md += `\n`;
  }

  // 5. Key caveat
  if (data.keyCaveat) {
    md += `**Key Strategic Caveat:** ${data.keyCaveat}\n\n`;
  }

  // 6. Ad creative
  if (data.creativeNotes) {
    md += `### 4. Creative Visual Art Direction\n\n${data.creativeNotes}\n\n`;
  }

  return md;
}

/** Renders the compact artifact card in the chat stream */
export function ArtifactPill({
  data,
  onOpen,
}: {
  data: ArtifactData;
  onOpen: () => void;
}) {
  const downloadFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    const md = buildArtifactMarkdown(data);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(data.brandName || "campaign").toLowerCase()}-campaign-brief.md`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded markdown brief");
  };

  return (
    <div
      onClick={onOpen}
      className="group relative flex items-center justify-between gap-3 rounded-[14px] border border-border bg-card/90 px-4 py-3 shadow-2xs transition-all hover:border-primary/50 hover:bg-card cursor-pointer"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-foreground/10 text-foreground font-mono text-[10px] font-bold">
          <FileText className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-foreground truncate">
              {formatArtifactTitle(data.brandName, data.title)}
            </span>
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] font-bold text-muted-foreground uppercase">
              MD
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={downloadFile}
          className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted cursor-pointer"
        >
          <span>Download</span>
        </button>
        <div className="grid h-7 w-7 place-items-center rounded-full bg-foreground text-background transition-transform group-hover:scale-105">
          <ChevronRight className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

/** Full-screen dark modal reader displaying the structured markdown campaign deliverable */
export function ArtifactModal({
  data,
  open,
  onClose,
}: {
  data: ArtifactData | null;
  open: boolean;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  if (!open || !data) return null;

  const markdown = buildArtifactMarkdown(data);

  const handleCopy = () => {
    navigator.clipboard.writeText(markdown);
    setCopied(true);
    toast.success("Copied markdown to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(data.brandName || "campaign").toLowerCase()}-campaign-deliverable.md`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded markdown file");
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `${data.brandName || "Campaign"} Deliverable`,
        text: markdown,
      }).catch(() => {});
    } else {
      handleCopy();
    }
  };

  const formattedTitle = formatArtifactTitle(data.brandName, data.title);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-xs transition-all animate-in fade-in">
      <div
        className={cn(
          "flex flex-col rounded-[18px] border border-border/60 bg-[#141415] text-white shadow-2xl transition-all",
          fullscreen
            ? "h-[98vh] w-[98vw]"
            : "h-[85vh] max-h-[850px] w-full max-w-4xl"
        )}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-border/40 px-5 py-3.5 bg-card/40">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-foreground/10 text-white font-mono text-[10px] font-bold">
              MD
            </div>
            <span className="text-[13.5px] font-medium text-white truncate">
              {formattedTitle}
            </span>
            <span className="rounded bg-white/10 px-2 py-0.5 text-[11px] text-white/70">
              Markdown
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleShare}
              title="Share"
              className="grid h-8 w-8 place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            >
              <Share2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleCopy}
              title="Copy markdown"
              className="grid h-8 w-8 place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              title="Download file"
              className="grid h-8 w-8 place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setFullscreen(!fullscreen)}
              title={fullscreen ? "Restore" : "Fullscreen"}
              className="grid h-8 w-8 place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            >
              {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Close"
              className="grid h-8 w-8 place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer ml-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10 prose prose-invert max-w-none prose-headings:font-bold prose-h1:text-2xl prose-h2:text-lg prose-h3:text-base prose-table:border prose-table:border-white/10 prose-th:bg-white/5 prose-td:border-white/5 prose-blockquote:border-l-primary prose-blockquote:bg-white/5 prose-blockquote:py-1 prose-blockquote:px-3 text-white/90">
          <ReactMarkdown>{markdown}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
