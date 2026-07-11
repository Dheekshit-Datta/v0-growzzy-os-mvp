import { Sparkles, MessageSquare, ArrowUpRight, ShieldCheck } from "lucide-react";

export function AICopilot() {
  return (
    <section className="px-6 py-20 md:px-12">
      <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-2 md:items-center">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-ink-soft">AI Copilot</p>
          <h2 className="mt-4 font-display text-4xl leading-[1.05] text-ink md:text-5xl">
            An optimizer that <br className="hidden md:block" />
            never sleeps.
          </h2>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-ink-soft">
            GrowzzyOS continuously scores creatives, rebalances budgets across Meta and Google,
            and surfaces the next best action in plain language - ready to apply with one
            click.
          </p>

          <ul className="mt-7 space-y-3 text-sm text-ink">
            {[
              { icon: Sparkles, text: "Auto-bid & budget reallocation across Google and Meta" },
              { icon: MessageSquare, text: "Plain-English suggestions, with one-click apply" },
              { icon: ShieldCheck, text: "Full audit log â€” every change is reviewable" },
            ].map((i) => (
              <li key={i.text} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-md bg-accent">
                  <i.icon className="h-3.5 w-3.5 text-ink" />
                </span>
                <span>{i.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div
          className="rounded-2xl border border-border bg-surface p-5"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <div className="flex items-center gap-2 border-b border-border/70 pb-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-primary-foreground">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <p className="text-sm font-medium text-ink">AI Copilot</p>
            <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700">
              Live
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {[
              {
                tag: "Budget",
                title: "Shift $400 search spend to Meta",
                body: "Meta retargeting is converting at 5.1x ROAS while low-intent search is at 2.1x. Projected lift: +18% ROAS this week.",
              },
              {
                tag: "Creative",
                title: "Rotate 2 underperforming Meta ads",
                body: "Two creatives are below 1.4Ã— ROAS for 7 days. Pause and promote your top 3 performers.",
              },
              {
                tag: "Bidding",
                title: "Raise tCPA on Brand Search",
                body: "Brand Search is impression-share capped at 62%. Raise tCPA from $32 â†’ $38 to capture demand.",
              },
            ].map((s) => (
              <div
                key={s.title}
                className="flex items-start gap-3 rounded-xl border border-border/70 bg-surface-soft p-3"
              >
                <span className="rounded-md bg-accent px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink">
                  {s.tag}
                </span>
                <div className="flex-1">
                  <p className="text-[13px] font-medium text-ink">{s.title}</p>
                  <p className="mt-0.5 text-[12px] leading-snug text-ink-soft">{s.body}</p>
                </div>
                <button className="rounded-full bg-ink px-3 py-1 text-[11px] text-primary-foreground hover:bg-ink/90">
                  Apply
                  <ArrowUpRight className="ml-0.5 inline h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
