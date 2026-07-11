const quotes = [
  {
    quote:
      "We replaced three dashboards and a weekly reporting deck with GrowzzyOS. The AI suggestions alone paid for it in the first month.",
    name: "Mara Chen",
    role: "Head of Growth, Northwind",
  },
  {
    quote:
      "Finally, one workspace for Meta and Google. Our team launches campaigns 3x faster and the ROAS lift is real.",
    name: "Diego Alvarez",
    role: "Performance Lead, Helio",
  },
  {
    quote:
      "The Copilot catches things our analysts miss â€” underperforming creatives, budget leaks, bid caps. It's like having a senior strategist on call.",
    name: "Priya Shah",
    role: "Director of Demand, Lumen",
  },
];

export function Testimonials() {
  return (
    <section className="px-6 py-20 md:px-12">
      <div className="mx-auto max-w-5xl text-center">
        <p className="text-xs uppercase tracking-[0.25em] text-ink-soft">Loved by performance teams</p>
        <h2 className="mt-4 font-display text-4xl leading-[1.05] text-ink md:text-5xl">
          What teams say.
        </h2>
      </div>

      <div className="mx-auto mt-12 grid max-w-6xl gap-5 md:grid-cols-3">
        {quotes.map((q) => (
          <figure
            key={q.name}
            className="flex h-full flex-col rounded-2xl border border-border bg-surface p-7"
          >
            <blockquote className="font-display text-xl leading-snug text-ink">
              â€œ{q.quote}â€
            </blockquote>
            <figcaption className="mt-6 text-sm text-ink-soft">
              <span className="block font-medium text-ink">{q.name}</span>
              {q.role}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
