import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "Which ad platforms does GrowzzyOS support?",
    a: "GrowzzyOS works natively with Meta Ads and Google Ads. You connect each account once and manage everything from one workspace.",
  },
  {
    q: "Does the AI take actions automatically?",
    a: "By default, the AI Copilot suggests changes and you approve them with one click. You can enable autopilot mode within your guardrails (target ROAS, CPA, max budget) whenever you're ready.",
  },
  {
    q: "How long does setup take?",
    a: "Most teams are connected and seeing AI suggestions in under 10 minutes. No engineering required.",
  },
  {
    q: "Is my ad data secure?",
    a: "Yes. Connections are read-and-write scoped per platform, all data is encrypted in transit and at rest, and every AI action is recorded in a full audit log.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes — every plan is month-to-month with a 14-day free trial. No long-term contracts.",
  },
];

export function FAQ() {
  return (
    <section className="px-6 py-20 md:px-12">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-ink-soft">FAQ</p>
          <h2 className="mt-4 font-display text-4xl leading-[1.05] text-ink md:text-5xl">
            Questions, answered.
          </h2>
        </div>

        <Accordion type="single" collapsible className="mt-10">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`} className="border-border/70">
              <AccordionTrigger className="text-left text-base font-medium text-ink hover:no-underline">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-ink-soft">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
