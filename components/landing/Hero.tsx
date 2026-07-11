import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardMockup } from "./DashboardMockup";
import { PlatformLogosRow } from "./PlatformLogos";
import Link from "next/link";

export function Hero() {
  return (
    <section className="px-6 pb-24 pt-10 md:px-12">
      <div className="mx-auto max-w-4xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs text-ink">
          <Sparkles className="h-3.5 w-3.5 text-brand-soft" />
          <span className="font-medium text-brand-soft">AI workspace</span>
          <span className="text-ink-soft">for performance marketers</span>
        </span>

        <h1 className="mt-6 font-display text-5xl leading-[1.02] text-ink md:text-7xl">
          The AI workspace <br className="hidden md:block" />
          for your ads.
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-ink-soft md:text-lg">
          GrowzzyOS unifies <span className="text-ink">Meta</span> and{" "}
          <span className="text-ink">Google</span> ads into one workspace — with AI optimization
          that keeps spend, bids, and creatives tuned 24/7.
        </p>

        <div className="mt-8 flex items-center justify-center gap-3">
          <Button
            size="lg"
            className="group rounded-full bg-ink px-6 text-primary-foreground shadow-sm hover:bg-ink/90"
            asChild
          >
            <Link href="/dashboard">
              Sign up
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="rounded-full border-border bg-surface px-6 text-ink hover:bg-accent"
            asChild
          >
            <Link href="/auth">Sign in</Link>
          </Button>
        </div>
      </div>

      <div className="mt-16">
        <DashboardMockup />
      </div>

      <div className="mt-20">
        <PlatformLogosRow />
      </div>
    </section>
  );
}
