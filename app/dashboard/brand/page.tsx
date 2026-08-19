"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shell } from "@/components/dashboard-v2/shell";
import { PageHeader, SectionCard } from "@/components/growzzy/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check, Globe, Loader2, Sparkles } from "lucide-react";
import { emptyBrand, loadBrand, saveBrand, type BrandProfile } from "@/lib/brand-store";

export default function BrandPage() {
  const [brand, setBrand] = useState<BrandProfile>(emptyBrand);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const saved = loadBrand();
    setBrand(saved);
    setUrl(saved.website);
  }, []);

  const update = <K extends keyof BrandProfile>(key: K, value: BrandProfile[K]) =>
    setBrand((current) => ({ ...current, [key]: value }));

  async function analyze() {
    if (!url.trim()) {
      toast.error("Add your website URL first.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/brand/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ websiteUrl: url.trim(), url: url.trim() }),
      });
      if (!response.ok) throw new Error("Brand analysis failed.");
      const result = await response.json();
      const m = result.profile || result.data?.brandMemory || {};
      const next = {
        ...brand,
        businessName: m.businessName || m.brandName || brand.businessName,
        industry: m.industry || brand.industry,
        businessModel: m.businessModel || brand.businessModel,
        whatTheySell: m.whatTheySell || m.whatYouSell || brand.whatTheySell,
        productDescription: m.productDescription || brand.productDescription,
        positioning: m.positioning || brand.positioning,
        differentiators: m.differentiators ?? brand.differentiators,
        audience: m.audience || m.idealCustomer || brand.audience,
        website: result.site ?? url.trim(),
        defaultLandingPage: brand.defaultLandingPage || result.site || url.trim(),
        analyzedAt: new Date().toISOString(),
      } satisfies BrandProfile;
      setBrand(next);
      saveBrand(next);
      window.dispatchEvent(new Event("growzzy:brand-updated"));
      toast.success("Brand context connected to new campaigns.");
    } catch {
      toast.error("Could not analyse that website yet.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    saveBrand(brand);
    window.dispatchEvent(new Event("growzzy:brand-updated"));
    toast.success("Brand context saved.");
  }

  return (
    <Shell>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/40">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">My Brand</h1>
            <p className="text-sm text-muted-foreground mt-1">Connect your brand once, then use it directly inside every new campaign.</p>
          </div>
          <Button onClick={save} className="gap-2 bg-[#1F57F5] text-white hover:bg-[#1845C2] cursor-pointer shadow-sm">
            <Check className="size-4" /> Save brand context
          </Button>
        </div>

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex flex-col gap-6">
            <SectionCard title="Website analysis">
              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <div className="flex-1">
                  <Label htmlFor="brand-url" className="text-[12px] font-medium text-foreground">Your website URL</Label>
                  <div className="relative mt-1.5">
                    <Globe className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="brand-url" value={url} onChange={(event) => setUrl(event.target.value)} className="pl-9 text-[13px] h-10" placeholder="https://yourbrand.com" />
                  </div>
                </div>
                <Button onClick={analyze} disabled={busy} className="gap-2 bg-[#1F57F5] text-white hover:bg-[#1845C2] cursor-pointer h-10 px-5 shrink-0">
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  {busy ? "Analysing…" : "Analyse my business"}
                </Button>
              </div>
              <p className="mt-2.5 text-[12px] leading-relaxed text-muted-foreground">Growzzy turns your website into reusable campaign context: offer, positioning, audience, tone, and landing page.</p>
            </SectionCard>

            <SectionCard title="Business context">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="business-name" className="text-[12px] font-medium text-foreground">Business name</Label>
                  <Input id="business-name" className="mt-1.5 text-[13px]" value={brand.businessName} onChange={(e) => update("businessName", e.target.value)} placeholder="e.g. Acme Corp" />
                </div>
                <div>
                  <Label htmlFor="industry" className="text-[12px] font-medium text-foreground">Industry</Label>
                  <Input id="industry" className="mt-1.5 text-[13px]" value={brand.industry} onChange={(e) => update("industry", e.target.value)} placeholder="e.g. B2B SaaS" />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="offer" className="text-[12px] font-medium text-foreground">What you sell</Label>
                  <Textarea id="offer" className="mt-1.5 text-[13px]" value={brand.whatTheySell} onChange={(e) => update("whatTheySell", e.target.value)} rows={2} placeholder="Brief description of your products or services" />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="positioning" className="text-[12px] font-medium text-foreground">Positioning</Label>
                  <Textarea id="positioning" className="mt-1.5 text-[13px]" value={brand.positioning} onChange={(e) => update("positioning", e.target.value)} rows={2} placeholder="Your key value proposition and market edge" />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="audience" className="text-[12px] font-medium text-foreground">Ideal customer</Label>
                  <Input id="audience" className="mt-1.5 text-[13px]" value={brand.audience} onChange={(e) => update("audience", e.target.value)} placeholder="e.g. Mid-market growth leads and marketing directors" />
                </div>
              </div>
            </SectionCard>
          </div>

          <SectionCard title="Campaign connection">
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-border bg-muted/40 p-4">
                <p className="text-sm font-semibold text-foreground">New campaign uses this context</p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">Your next campaign brief will start with this business, audience, and positioning data.</p>
              </div>
              <Link href="/dashboard/campaigns/new" className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 shadow-sm">
                Create a campaign
              </Link>
              <div className="text-xs text-muted-foreground pt-1">{brand.analyzedAt ? `Last updated ${new Date(brand.analyzedAt).toLocaleDateString()}` : "No analysis connected yet"}</div>
            </div>
          </SectionCard>
        </div>
      </div>
    </Shell>
  );
}