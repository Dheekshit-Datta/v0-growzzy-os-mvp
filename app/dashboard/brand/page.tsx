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
      const m = result.data?.brandMemory || result.profile || {};
      const next = {
        ...brand,
        businessName: m.brandName || m.businessName || brand.businessName,
        industry: m.industry || brand.industry,
        businessModel: m.businessModel || brand.businessModel,
        whatTheySell: m.whatYouSell || m.whatTheySell || brand.whatTheySell,
        productDescription: m.productDescription || brand.productDescription,
        positioning: m.positioning || brand.positioning,
        differentiators: m.differentiators ?? brand.differentiators,
        audience: m.idealCustomer || m.audience || brand.audience,
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
      <PageHeader
        title="My Brand"
        subtitle="Connect your brand once, then use it directly inside every new campaign."
        actions={
          <Button onClick={save} className="gap-2 bg-[#1F57F5] text-white hover:bg-[#1845C2] cursor-pointer">
            <Check className="size-4" /> Save brand context
          </Button>
        }
      />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-4">
          <SectionCard title="Website analysis">
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <div className="flex-1">
                <Label htmlFor="brand-url" className="text-[12px]">Your website URL</Label>
                <div className="relative mt-1">
                  <Globe className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="brand-url" value={url} onChange={(event) => setUrl(event.target.value)} className="pl-9 text-[13px]" placeholder="yourbrand.com" />
                </div>
              </div>
              <Button onClick={analyze} disabled={busy} className="gap-2 bg-[#1F57F5] text-white hover:bg-[#1845C2] cursor-pointer">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                {busy ? "Analysing…" : "Analyse my business"}
              </Button>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">Growzzy turns your website into reusable campaign context: offer, positioning, audience, tone, and landing page.</p>
          </SectionCard>
          <SectionCard title="Business context">
            <div className="grid gap-3.5 md:grid-cols-2">
              <div><Label htmlFor="business-name" className="text-[12px]">Business name</Label><Input id="business-name" className="mt-1 text-[13px]" value={brand.businessName} onChange={(e) => update("businessName", e.target.value)} /></div>
              <div><Label htmlFor="industry" className="text-[12px]">Industry</Label><Input id="industry" className="mt-1 text-[13px]" value={brand.industry} onChange={(e) => update("industry", e.target.value)} /></div>
              <div className="md:col-span-2"><Label htmlFor="offer" className="text-[12px]">What you sell</Label><Textarea id="offer" className="mt-1 text-[13px]" value={brand.whatTheySell} onChange={(e) => update("whatTheySell", e.target.value)} rows={2} /></div>
              <div className="md:col-span-2"><Label htmlFor="positioning" className="text-[12px]">Positioning</Label><Textarea id="positioning" className="mt-1 text-[13px]" value={brand.positioning} onChange={(e) => update("positioning", e.target.value)} rows={2} /></div>
              <div className="md:col-span-2"><Label htmlFor="audience" className="text-[12px]">Ideal customer</Label><Input id="audience" className="mt-1 text-[13px]" value={brand.audience} onChange={(e) => update("audience", e.target.value)} /></div>
            </div>
          </SectionCard>
        </div>
        <SectionCard title="Campaign connection">
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-sm font-medium text-foreground">New campaign uses this context</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">Your next campaign brief will start with this business, audience, and positioning data.</p>
            </div>
            <Link href="/dashboard/campaigns/new" className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
              Create a campaign
            </Link>
            <div className="text-xs text-muted-foreground">{brand.analyzedAt ? `Last updated ${new Date(brand.analyzedAt).toLocaleDateString()}` : "No analysis connected yet"}</div>
          </div>
        </SectionCard>
      </div>
    </Shell>
  );
}