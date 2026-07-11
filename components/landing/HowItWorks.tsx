const steps = [
  {
    n: "01",
    title: "Connect your ad accounts",
    body: "Securely link Meta and Google in under two minutes. Read-only by default.",
  },
  {
    n: "02",
    title: "Set goals & guardrails",
    body: "Tell GrowzzyOS your target ROAS, CPA, and budget caps per platform. AI respects every rule.",
  },
  {
    n: "03",
    title: "Let the workspace run",
    body: "Review AI suggestions in your inbox, approve with one click, or enable autopilot mode.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="border-t border-border/70 px-6 py-20 md:px-12">
      <div className="mx-auto max-w-5xl text-center">
        <p className="text-xs uppercase tracking-[0.25em] text-ink-soft">How it works</p>
        <h2 className="mt-4 font-display text-4xl leading-[1.05] text-ink md:text-5xl">
          Live in minutes. <br className="hidden md:block" />
          Optimizing in hours.
        </h2>
      </div>

      <div className="mx-auto mt-12 grid max-w-6xl gap-5 md:grid-cols-3">
        {steps.map((s) => (
          <div
            key={s.n}
            className="rounded-2xl border border-border bg-surface p-7 transition-shadow hover:shadow-[var(--shadow-card)]"
          >
            <span className="font-display text-3xl text-brand-soft">{s.n}</span>
            <h3 className="mt-4 font-display text-2xl text-ink">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
