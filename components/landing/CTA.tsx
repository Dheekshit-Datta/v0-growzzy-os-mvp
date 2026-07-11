import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function CTA() {
  return (
    <section className="px-6 pb-20 pt-4 md:px-12">
      <div
        className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-ink px-8 py-16 text-center text-primary-foreground md:px-16 md:py-20"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <h2 className="mx-auto max-w-3xl font-display text-4xl leading-[1.05] md:text-6xl">
          Run Meta and Google from one AI workspace.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-primary-foreground/75">
          Start your 14-day free trial. No credit card required.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button
            size="lg"
            className="group rounded-full bg-primary-foreground px-6 text-ink hover:bg-primary-foreground/90"
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
            className="rounded-full border-primary-foreground/25 bg-transparent px-6 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            asChild
          >
            <Link href="/auth">Sign in</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
