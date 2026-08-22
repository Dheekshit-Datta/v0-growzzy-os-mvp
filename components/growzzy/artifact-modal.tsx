"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
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

/** Builds a clean, professional markdown document from the artifact data. */
export function buildArtifactMarkdown(data: ArtifactData): string {
  if (data.rawMarkdown) return data.rawMarkdown;

  const brand = data.brandName || "MARKITX";
  const platform = data.platform || "Meta feed (Facebook + Instagram)";
  const offer = data.offer || "Free AI audit / consultation";
  const target = data.targetAudience || "CTOs / VPs of Engineering";

  let md = `# ${brand} — ${data.title || "Meta lead gen ad"}\n\n`;
  md += `**Offer:** ${offer}  \n`;
  md += `**Target:** ${target}  \n`;
  md += `**Platform:** ${platform}  \n\n`;
  md += `---\n\n`;

  // 1. Headline variations
  md += `### 1. Headline variations (40 chars max)\n\n`;
  md += `| # | Headline | Chars |\n`;
  md += `|---|---|---|\n`;
  const headlines = data.headlines && data.headlines.length > 0
    ? data.headlines
    : [
        "Your AI stack has a performance leak.",
        "Most AI builds fail ops. Audit yours.",
        "Free AI audit for engineering leaders",
      ];
  headlines.forEach((h, i) => {
    const label = String.fromCharCode(65 + i);
    md += `| ${label} | ${h} | ${h.length} |\n`;
  });
  md += `\n`;
  if (data.headlineStrategy) {
    md += `**Which to lead with:** ${data.headlineStrategy}\n\n`;
  } else {
    md += `**Which to lead with:** A for cold audiences (provokes immediate self-audit). B as variant if A fatigues. C as a direct-offer fallback for retargeting.\n\n`;
  }

  // 2. Primary text
  md += `### 2. Primary text\n\n`;
  const primary = data.primaryText ||
    `Most AI implementations look functional on the surface. The problems live in the gaps — misaligned attribution, underperforming models, wasted compute, and blind spots your team has normalized.\n\n${brand} runs a free AI performance audit for engineering leaders who want an honest read on where their stack is costing them.\n\nNo sales deck. No obligation. Just a sharp, technical review from a team that's seen what breaks.`;

  const paragraphs = primary.split("\n\n");
  paragraphs.forEach((p) => {
    md += `> ${p.trim()}\n>\n`;
  });
  md += `\n`;

  // 3. CTA button
  md += `**CTA button:** \`${data.cta || "Book Free Audit"}\``;
  if (data.ctaAlternative) {
    md += ` — (alternatively \`${data.ctaAlternative}\`)\n\n`;
  } else {
    md += ` — (alternatively \`Get My Audit\` for first-person framing — tests well on lead gen objectives)\n\n`;
  }

  // 4. Targeting setup table
  md += `### 3. Targeting setup\n\n`;
  md += `| Setting | Recommendation |\n`;
  md += `|---|---|\n`;
  const targeting = data.targeting && data.targeting.length > 0
    ? data.targeting
    : [
        { setting: "Objective", value: "Lead Generation (native form) or Website Conversions" },
        { setting: "Job title targeting", value: "CTO, VP of Engineering, Head of Engineering, Director of Engineering, VP of Technology" },
        { setting: "Company size", value: "201–5,000 employees (filters out noise at both ends)" },
        { setting: "Interests layer", value: "Cloud infrastructure, DevOps, Machine learning, AWS/GCP/Azure" },
        { setting: "Exclusions", value: "Job titles: intern, student, junior, freelancer" },
        { setting: "Placement", value: "Facebook + Instagram Feed only — no Audience Network" },
        { setting: "Bid strategy", value: "Cost Cap (set at your target CPL) or Lowest Cost to gather early signal" },
      ];
  targeting.forEach((t) => {
    md += `| **${t.setting}** | ${t.value} |\n`;
  });
  md += `\n`;

  // 5. Key caveat
  if (data.keyCaveat) {
    md += `**Key caveat:** ${data.keyCaveat}\n\n`;
  } else {
    md += `**Key caveat:** Meta job title data is self-reported — expect 20–30% title bleed. The company size filter compensates for most of it.\n\n`;
  }

  // 6. Ad creative
  if (data.creativeNotes) {
    md += `### 4. Ad creative\n\n${data.creativeNotes}\n\n`;
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
              {data.brandName || "MARKITX"} — {data.title}
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
              {data.brandName || "MARKITX"} — {data.title}
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
        <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-6 text-[14px] leading-relaxed text-white/90">
          <div className="space-y-2 border-b border-white/10 pb-5">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {data.brandName || "MARKITX"} — {data.title}
            </h1>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 text-[12.5px] text-white/70">
              <div>
                <span className="font-semibold text-white/90">Offer:</span> {data.offer || "Free AI audit / consultation"}
              </div>
              <div>
                <span className="font-semibold text-white/90">Target:</span> {data.targetAudience || "CTOs / VPs of Engineering"}
              </div>
              <div>
                <span className="font-semibold text-white/90">Platform:</span> {data.platform || "Meta feed (Facebook + Instagram)"}
              </div>
            </div>
          </div>

          {/* Section 1: Headline variations */}
          <div className="space-y-3">
            <h2 className="text-[17px] font-bold text-white">1. Headline variations (40 chars max)</h2>
            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-white/5 text-white/70 border-b border-white/10">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold w-12">#</th>
                    <th className="py-2.5 px-4 font-semibold">Headline</th>
                    <th className="py-2.5 px-4 font-semibold w-20 text-right">Chars</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(Array.isArray(data.headlines) && data.headlines.length > 0 ? data.headlines : [
                    "Your AI stack has a performance leak.",
                    "Most AI builds fail ops. Audit yours.",
                    "Free AI audit for engineering leaders",
                  ]).map((h, i) => {
                    const hText = typeof h === "string" ? h : (h as any)?.text ?? "";
                    return (
                      <tr key={i} className="hover:bg-white/5 transition-colors">
                        <td className="py-2.5 px-4 font-mono font-medium text-white/80">{String.fromCharCode(65 + i)}</td>
                        <td className="py-2.5 px-4 text-white font-mono text-[12.5px]">{hText}</td>
                        <td className="py-2.5 px-4 font-mono text-white/60 text-right">{hText.length}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[12.5px] text-white/70 leading-relaxed pt-1">
              <strong className="text-white">Which to lead with:</strong>{" "}
              {data.headlineStrategy || "A for cold audiences (provokes immediate self-audit). B as variant if A fatigues. C as a direct-offer fallback for retargeting."}
            </p>
          </div>

          {/* Section 2: Primary text */}
          <div className="space-y-3">
            <h2 className="text-[17px] font-bold text-white">2. Primary text</h2>
            <blockquote className="rounded-lg border-l-2 border-primary/80 bg-white/5 p-4 italic text-white/90 space-y-3 leading-relaxed">
              {(typeof data.primaryText === "string" ? data.primaryText :
                "Most AI implementations look functional on the surface. The problems live in the gaps — misaligned attribution, underperforming models, wasted compute, and blind spots your team has normalized.\n\nMARKITX runs a free AI performance audit for engineering leaders who want an honest read on where their stack is costing them.\n\nNo sales deck. No obligation. Just a sharp, technical review from a team that's seen what breaks."
              ).split("\n\n").map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </blockquote>

            <div className="pt-2 text-[13px]">
              <span className="font-semibold text-white">CTA button:</span>{" "}
              <code className="rounded bg-white/10 px-2 py-0.5 font-mono text-[12px] text-white">
                {data.cta || "Book Free Audit"}
              </code>{" "}
              <span className="text-white/70">
                — (alternatively{" "}
                <code className="rounded bg-white/10 px-2 py-0.5 font-mono text-[12px] text-white">
                  {data.ctaAlternative || "Get My Audit"}
                </code>{" "}
                for first-person framing — tests well on lead gen objectives)
              </span>
            </div>
          </div>

          {/* Section 3: Targeting setup */}
          <div className="space-y-3">
            <h2 className="text-[17px] font-bold text-white">3. Targeting setup</h2>
            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-white/5 text-white/70 border-b border-white/10">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold w-1/3">Setting</th>
                    <th className="py-2.5 px-4 font-semibold">Recommendation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(Array.isArray(data.targeting) && data.targeting.length > 0 ? data.targeting : [
                    { setting: "Objective", value: "Lead Generation (native form) or Website Conversions" },
                    { setting: "Job title targeting", value: "CTO, VP of Engineering, Head of Engineering, Director of Engineering, VP of Technology" },
                    { setting: "Company size", value: "201–5,000 employees (filters out noise at both ends)" },
                    { setting: "Interests layer", value: "Cloud infrastructure, DevOps, Machine learning, AWS/GCP/Azure" },
                    { setting: "Exclusions", value: "Job titles: intern, student, junior, freelancer" },
                    { setting: "Placement", value: "Facebook + Instagram Feed only — no Audience Network" },
                    { setting: "Bid strategy", value: "Cost Cap (set at your target CPL) or Lowest Cost to gather early signal" },
                  ]).map((t, i) => (
                    <tr key={i} className="hover:bg-white/5 transition-colors">
                      <td className="py-2.5 px-4 font-semibold text-white/90">{t.setting}</td>
                      <td className="py-2.5 px-4 text-white/80">{t.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-[12.5px] text-white/70 leading-relaxed pt-1">
              <strong className="text-white">Key caveat:</strong>{" "}
              {data.keyCaveat || "Meta job title data is self-reported — expect 20–30% title bleed. The company size filter compensates for most of it."}
            </p>
          </div>

          {/* Section 4: Ad creative notes */}
          {data.creativeNotes && (
            <div className="space-y-3">
              <h2 className="text-[17px] font-bold text-white">4. Ad creative</h2>
              <p className="text-[13px] text-white/80 leading-relaxed">
                {data.creativeNotes}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
