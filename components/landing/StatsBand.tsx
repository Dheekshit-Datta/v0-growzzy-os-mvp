const stats = [
  { value: "3×", label: "Faster campaign launches" },
  { value: "+42%", label: "Average ROAS lift" },
  { value: "60%", label: "Less time in reporting" },
  { value: "3-in-1", label: "Platforms unified" },
];

export function StatsBand() {
  return (
    <section className="border-t border-border/70 bg-surface-soft px-6 py-16 md:px-12">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <div className="font-display text-5xl text-ink md:text-6xl">{s.value}</div>
            <p className="mt-3 text-sm text-ink-soft">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
