"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Globe,
  Smartphone,
  Copy,
  Download,
  Check,
  ExternalLink,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  MoreHorizontal,
  Layers,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

interface AdMockupPreviewProps {
  campaignName: string;
  brandName?: string;
  platform?: string;
  headlines?: string[];
  primaryText?: string;
  descriptions?: string[];
  cta?: string;
  landingPage?: string;
  imageUrl?: string | null;
  budgetDaily?: number;
  currency?: string;
  bidding?: string;
  schedule?: string;
  keywords?: string[];
  exclusions?: string[];
  className?: string;
}

export function AdMockupPreview({
  campaignName,
  brandName = "MARKITX",
  platform = "GOOGLE",
  headlines = ["Deploy Multi-Agent AI in 48h", "Enterprise AI Workflows", "MARKITX AI Stack"],
  primaryText = "Overcome manual inefficiencies with custom AI agents and enterprise-grade multi-agent infrastructure. Scale operations with zero latency.",
  descriptions = ["Automate mission-critical workflows with enterprise multi-agent systems.", "SOC2 certified with zero data retention. Book your technical architecture review today."],
  cta = "Book Architecture Review",
  landingPage = "https://markitx.ai/solutions",
  imageUrl = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1080&q=80",
  budgetDaily = 100,
  currency = "USD",
  bidding = "Maximize Conversions (Target CPA)",
  schedule = "Immediate start, run ongoing",
  keywords = ["[multi-agent systems]", "\"enterprise ai workflows\"", "[custom ai agents]"],
  exclusions = ["free", "jobs", "salary", "internship", "github", "tutorial", "course"],
  className,
}: AdMockupPreviewProps) {
  const isMetaInitial = platform.toUpperCase().includes("META");
  const [activeTab, setActiveTab] = useState<"google" | "meta" | "specs">(
    isMetaInitial ? "meta" : "google"
  );
  const [copied, setCopied] = useState(false);

  const cleanBrand = brandName || campaignName.split("—")[0]?.trim() || "Brand";
  const cleanHeadlines = headlines.length > 0 ? headlines : ["High-Converting Ad Headline"];
  const displayUrl = landingPage
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  const rootDomain = displayUrl.split("/")[0] || "example.com";
  const pathSegment = displayUrl.split("/")[1] || "solutions";

  const exportGoogleAdsCsv = () => {
    const headers = [
      "Campaign",
      "Ad Group",
      "Headline 1",
      "Headline 2",
      "Headline 3",
      "Description 1",
      "Description 2",
      "Final URL",
      "Daily Budget",
      "Bid Strategy",
    ].join(",");

    const h1 = (cleanHeadlines[0] || "").replace(/,/g, " ");
    const h2 = (cleanHeadlines[1] || "").replace(/,/g, " ");
    const h3 = (cleanHeadlines[2] || "").replace(/,/g, " ");
    const d1 = (descriptions[0] || primaryText.slice(0, 90)).replace(/,/g, " ");
    const d2 = (descriptions[1] || "Book your live demo today.").replace(/,/g, " ");

    const row = [
      `"${campaignName}"`,
      `"${cleanBrand} - Core Search"`,
      `"${h1}"`,
      `"${h2}"`,
      `"${h3}"`,
      `"${d1}"`,
      `"${d2}"`,
      `"${landingPage}"`,
      `${budgetDaily}`,
      `"${bidding}"`,
    ].join(",");

    const csvContent = `${headers}\n${row}`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${cleanBrand.toLowerCase()}-google-ads-editor.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded Google Ads Editor CSV!");
  };

  const copyNegativeKeywords = () => {
    const list = exclusions.map((k) => `-${k.trim()}`).join("\n");
    navigator.clipboard.writeText(list);
    setCopied(true);
    toast.success("Copied negative keyword list to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("rounded-[16px] border border-border bg-card overflow-hidden shadow-2xs", className)}>
      {/* Top Preview Selector Tabs */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2 bg-muted/30">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("google")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12px] font-medium transition-colors cursor-pointer",
              activeTab === "google"
                ? "bg-background text-foreground shadow-2xs border border-border/70"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <Globe className="h-3.5 w-3.5 text-[#1F57F5]" />
            Google SERP
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("meta")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12px] font-medium transition-colors cursor-pointer",
              activeTab === "meta"
                ? "bg-background text-foreground shadow-2xs border border-border/70"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <Smartphone className="h-3.5 w-3.5 text-[#E1306C]" />
            Meta Feed
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("specs")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12px] font-medium transition-colors cursor-pointer",
              activeTab === "specs"
                ? "bg-background text-foreground shadow-2xs border border-border/70"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <Layers className="h-3.5 w-3.5 text-muted-foreground" />
            Specs & KPIs
          </button>
        </div>

        <span className="text-[10.5px] font-mono text-muted-foreground uppercase tracking-wider">
          Interactive Mockup
        </span>
      </div>

      {/* Tab 1: Google Search SERP Mockup */}
      {activeTab === "google" && (
        <div className="p-4 space-y-3.5 bg-background">
          <div className="rounded-[12px] border border-border/70 bg-card p-4 space-y-2.5 shadow-2xs">
            {/* Header URL and Sponsored Badge */}
            <div className="flex items-center justify-between gap-2 text-[12px]">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center font-bold text-[10px] text-foreground shrink-0">
                  {cleanBrand.slice(0, 1).toUpperCase()}
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5 leading-tight truncate">
                    <span className="font-semibold text-foreground text-[12px] shrink-0">{cleanBrand}</span>
                    <span className="text-muted-foreground text-[11px]">·</span>
                    <span className="text-muted-foreground text-[11px] font-mono truncate">https://{rootDomain} › {pathSegment}</span>
                  </div>
                </div>
              </div>
              <span className="shrink-0 rounded bg-muted/80 px-2 py-0.5 text-[10px] font-bold text-muted-foreground tracking-wide">
                Sponsored
              </span>
            </div>

            {/* Clickable Blue Google Search Headline */}
            <h3 className="text-[15px] font-medium text-[#1A0DAB] dark:text-[#8AB4F8] hover:underline cursor-pointer leading-snug">
              {cleanHeadlines.slice(0, 3).join(" | ")}
            </h3>

            {/* Google Search Description */}
            <p className="text-[12.5px] text-[#4D5156] dark:text-[#BDC1C6] leading-relaxed">
              {descriptions[0] || primaryText.slice(0, 160)}
            </p>

            {/* Sitelinks Extension Chips */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50 text-[12px]">
              <div className="rounded-lg bg-muted/30 p-2 hover:bg-muted/50 cursor-pointer">
                <span className="font-medium text-[#1A0DAB] dark:text-[#8AB4F8] block">{cta}</span>
                <span className="text-[11px] text-muted-foreground line-clamp-1">Explore custom implementation</span>
              </div>
              <div className="rounded-lg bg-muted/30 p-2 hover:bg-muted/50 cursor-pointer">
                <span className="font-medium text-[#1A0DAB] dark:text-[#8AB4F8] block">SOC2 & Compliance</span>
                <span className="text-[11px] text-muted-foreground line-clamp-1">Zero data retention architecture</span>
              </div>
            </div>
          </div>

          {/* Action toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[12px]">
            <Button
              variant="outline"
              size="sm"
              onClick={copyNegativeKeywords}
              className="gap-1.5 h-8 text-[11px] px-2.5 cursor-pointer shrink-0"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
              Copy Negatives ({exclusions.length})
            </Button>
            <Button
              size="sm"
              onClick={exportGoogleAdsCsv}
              className="gap-1.5 h-8 text-[11px] px-2.5 bg-[#1F57F5] hover:bg-[#1845C4] text-white cursor-pointer shrink-0"
            >
              <Download className="h-3 w-3" />
              Download CSV
            </Button>
          </div>
        </div>
      )}

      {/* Tab 2: Meta Instagram / Facebook Feed Mockup */}
      {activeTab === "meta" && (
        <div className="p-4 space-y-3.5 bg-background">
          <div className="rounded-[14px] border border-border/80 bg-card overflow-hidden shadow-2xs max-w-md mx-auto">
            {/* Meta Post Header */}
            <div className="flex items-center justify-between p-3 border-b border-border/40">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] p-0.5 flex items-center justify-center">
                  <div className="h-full w-full rounded-full bg-background flex items-center justify-center font-bold text-xs">
                    {cleanBrand.slice(0, 2).toUpperCase()}
                  </div>
                </div>
                <div>
                  <div className="text-[12.5px] font-semibold text-foreground leading-tight flex items-center gap-1">
                    {cleanBrand}
                    <span className="h-1 w-1 rounded-full bg-muted-foreground inline-block" />
                    <span className="text-[11px] font-normal text-muted-foreground">Follow</span>
                  </div>
                  <div className="text-[10.5px] text-muted-foreground flex items-center gap-1">
                    Sponsored · 🌐
                  </div>
                </div>
              </div>
              <MoreHorizontal className="h-4 w-4 text-muted-foreground cursor-pointer" />
            </div>

            {/* Meta Primary Copy */}
            <div className="px-3.5 py-2.5 text-[12.5px] text-foreground leading-relaxed whitespace-pre-wrap">
              {primaryText}
            </div>

            {/* 1:1 Creative Visual */}
            {imageUrl && (
              <div className="aspect-square w-full bg-muted relative overflow-hidden">
                <img
                  src={imageUrl}
                  alt={cleanHeadlines[0] || "Ad visual"}
                  className="h-full w-full object-cover"
                />
                <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-xs text-white text-[10px] font-mono px-2 py-0.5 rounded-md font-semibold">
                  1:1 Feed Creative
                </div>
              </div>
            )}

            {/* Meta CTA Card Footer */}
            <div className="flex items-center justify-between bg-muted/40 p-3 border-t border-border/40">
              <div className="min-w-0 pr-3">
                <div className="text-[10.5px] font-mono uppercase text-muted-foreground truncate">
                  {rootDomain}
                </div>
                <div className="text-[13px] font-semibold text-foreground truncate leading-snug">
                  {cleanHeadlines[0] || "High-Converting Headline"}
                </div>
              </div>
              <Button
                size="sm"
                className="bg-[#1877F2] hover:bg-[#166FE5] text-white text-xs font-semibold rounded-md px-3.5 shrink-0"
              >
                {cta || "Learn More"}
              </Button>
            </div>

            {/* Social Engagement Mockup Bar */}
            <div className="flex items-center justify-between px-3.5 py-2 border-t border-border/30 text-muted-foreground">
              <div className="flex items-center gap-3">
                <Heart className="h-4 w-4 cursor-pointer hover:text-red-500 transition-colors" />
                <MessageCircle className="h-4 w-4 cursor-pointer hover:text-foreground transition-colors" />
                <Share2 className="h-4 w-4 cursor-pointer hover:text-foreground transition-colors" />
              </div>
              <Bookmark className="h-4 w-4 cursor-pointer hover:text-foreground transition-colors" />
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Specs & Targeting Architecture */}
      {activeTab === "specs" && (
        <div className="p-4 space-y-3 bg-background text-[12px]">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-muted/20 p-2.5 border border-border/50">
              <span className="text-muted-foreground block text-[11px]">Daily Budget</span>
              <span className="font-semibold text-foreground text-[13px]">{currency} {budgetDaily}/day</span>
            </div>
            <div className="rounded-lg bg-muted/20 p-2.5 border border-border/50">
              <span className="text-muted-foreground block text-[11px]">Bidding Strategy</span>
              <span className="font-semibold text-foreground text-[13px]">{bidding}</span>
            </div>
          </div>

          <div className="rounded-lg bg-muted/20 p-3 border border-border/50 space-y-1.5">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground block">
              Keywords & Match Types
            </span>
            <div className="flex flex-wrap gap-1.5">
              {keywords.map((kw, i) => (
                <span key={i} className="rounded bg-background px-2 py-0.5 font-mono text-[11px] border border-border">
                  {kw}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-muted/20 p-3 border border-border/50 space-y-1.5">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground block">
              Negative Exclusion List
            </span>
            <div className="flex flex-wrap gap-1.5">
              {exclusions.map((neg, i) => (
                <span key={i} className="rounded bg-red-500/10 text-red-600 dark:text-red-400 px-2 py-0.5 font-mono text-[11px] border border-red-500/20">
                  -{neg}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
