import { LayoutGrid, Sparkles, BarChart3 } from "lucide-react";

const features = [
  {
    icon: LayoutGrid,
    title: "Unified Ads Workspace",
    desc: "Manage Meta and Google campaigns from one inbox-style cockpit. No more tab juggling.",
  },
  {
    icon: Sparkles,
    title: "AI Ads Optimization",
    desc: "Auto-bidding, budget reallocation, and creative scoring run continuously across every platform.",
  },
  {
    icon: BarChart3,
    title: "Cross-Channel Insights",
    desc: "True ROAS, attribution, and audience overlap rolled up across all three platforms in real time.",
  },
];

export function Features() {
  return (
    <section id="features" className="px-6 pb-16 pt-20 md:px-12">
      <div className="mx-auto max-w-5xl text-center">
        <p className="text-xs uppercase tracking-[0.25em] text-ink-soft">Use case</p>
        <h2 className="mt-4 font-display text-4xl leading-[1.05] text-ink md:text-6xl">
          One workspace. <br className="hidden md:block" />
          Every ad platform.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-ink-soft">
          GrowzzyOS is the AI workspace performance teams use to run Meta and Google together,
          with optimization that never sleeps.
        </p>
      </div>

      <div className="mx-auto mt-12 grid max-w-6xl gap-5 md:grid-cols-3">
        {features.map((f) => (
          <div
            key={f.title}
            className="rounded-2xl border border-border bg-surface p-7 transition-shadow hover:shadow-[var(--shadow-card)]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-ink">
              <f.icon className="h-5 w-5" />
            </span>
            <h3 className="mt-5 font-display text-2xl text-ink">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
