import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const tiers = [
  {
    name: "Starter",
    price: "$79",
    blurb: "For solo operators and small teams getting started.",
    features: ["1 ad account per platform", "AI suggestions (review mode)", "Unified reporting", "Email support"],
    cta: "Start free trial",
    highlight: false,
  },
  {
    name: "Growth",
    price: "$249",
    blurb: "For growth teams running multi-platform campaigns at scale.",
    features: [
      "Unlimited ad accounts",
      "AI Copilot autopilot mode",
      "Cross-channel attribution",
      "Audience overlap & dedupe",
      "Priority support",
    ],
    cta: "Start free trial",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    blurb: "For agencies and brands with multi-brand workspaces.",
    features: ["SSO & SCIM", "Custom guardrails & approvals", "Dedicated CSM", "Audit & compliance exports"],
    cta: "Book a demo",
    highlight: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="border-t border-border/70 px-6 py-20 md:px-12">
      <div className="mx-auto max-w-5xl text-center">
        <p className="text-xs uppercase tracking-[0.25em] text-ink-soft">Pricing</p>
        <h2 className="mt-4 font-display text-4xl leading-[1.05] text-ink md:text-5xl">
          Simple plans that scale with you.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[15px] text-ink-soft">
          14-day free trial on every plan. No credit card required.
        </p>
      </div>

      <div className="mx-auto mt-12 grid max-w-6xl gap-5 md:grid-cols-3">
        {tiers.map((t) => (
          <div
            key={t.name}
            className={`flex flex-col rounded-2xl border p-7 ${
              t.highlight
                ? "border-ink bg-ink text-primary-foreground shadow-[var(--shadow-card)]"
                : "border-border bg-surface text-ink"
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-2xl">{t.name}</h3>
              {t.highlight && (
                <span className="rounded-full bg-primary-foreground/15 px-2.5 py-0.5 text-[11px]">
                  Most popular
                </span>
              )}
            </div>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="font-display text-5xl">{t.price}</span>
              {t.price !== "Custom" && (
                <span className={t.highlight ? "text-primary-foreground/70" : "text-ink-soft"}>
                  /mo
                </span>
              )}
            </div>
            <p
              className={`mt-2 text-sm ${
                t.highlight ? "text-primary-foreground/80" : "text-ink-soft"
              }`}
            >
              {t.blurb}
            </p>

            <ul className="mt-6 flex-1 space-y-2.5 text-sm">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check
                    className={`mt-0.5 h-4 w-4 ${
                      t.highlight ? "text-primary-foreground" : "text-ink"
                    }`}
                  />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <Button
              className={`mt-7 rounded-full ${
                t.highlight
                  ? "bg-primary-foreground text-ink hover:bg-primary-foreground/90"
                  : "bg-ink text-primary-foreground hover:bg-ink/90"
              }`}
              asChild
            >
              <a href="#">{t.cta}</a>
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
