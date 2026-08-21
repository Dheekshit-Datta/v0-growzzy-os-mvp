/** Builds a downloadable markdown transcript of a Growzzy chat session. */
export interface TranscriptPart {
  type: string;
  text?: string;
  input?: unknown;
  output?: unknown;
  state?: string;
}

export interface TranscriptMessage {
  role: string;
  parts: TranscriptPart[];
  /** ISO timestamp of when this turn appeared in the conversation. */
  at?: string;
}

const toolName = (type: string) => (type.startsWith("tool-") ? type.slice(5) : "");

function fmtList(items: unknown, render: (i: never) => string): string {
  return Array.isArray(items) ? items.map((i) => render(i as never)).join("\n") : "";
}

function stamp(at?: string): string {
  if (!at) return "";
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "";
  return ` — ${d.toISOString().replace("T", " ").slice(0, 19)} UTC`;
}

export function buildTranscript(
  messages: TranscriptMessage[],
  opts: { title?: string; date?: Date } = {},
): string {
  const generated = opts.date ?? new Date();
  const stamps = messages.map((m) => m.at).filter(Boolean) as string[];

  const lines: string[] = [
    `# ${opts.title ?? "Growzzy chat transcript"}`,
    "",
    `- Generated: ${generated.toISOString().replace("T", " ").slice(0, 19)} UTC`,
    `- Turns: ${messages.length}`,
    stamps.length
      ? `- Session window: ${stamps[0]!.replace("T", " ").slice(0, 19)} UTC → ${stamps[stamps.length - 1]!.replace("T", " ").slice(0, 19)} UTC`
      : "",
    "",
    "---",
    "",
  ].filter(Boolean);

  (messages ?? []).forEach((m) => {
    const parts = m?.parts ?? [];
    const text = parts
      .filter((p) => p?.type === "text" && p?.text?.trim())
      .map((p) => p.text!.trim())
      .join("\n\n");

    if (m.role === "user" && text) lines.push(`## You${stamp(m.at)}`, "", text, "");
    else if (m.role === "assistant" && text) lines.push(`## Growzzy${stamp(m.at)}`, "", text, "");

    parts.forEach((p) => {
      const name = toolName(p.type);
      if (!name) return;
      const input = (p.input ?? {}) as Record<string, unknown>;
      const output = (p.output ?? {}) as Record<string, unknown>;

      if (name === "askBrandUrl") {
        lines.push(`### [QUESTIONS] Website requested${stamp(m.at)}`, "");
        if (input.reason) lines.push(`Reason: ${String(input.reason)}`, "");
      }

      if (name === "askUser") {
        lines.push(`### [QUESTIONS] Growzzy asked${stamp(m.at)}`, "");
        lines.push(
          fmtList(input.questions, (q: { question?: string; why?: string }) =>
            `- **${q.question ?? ""}** — ${q.why ?? ""}`,
          ),
        );
        const answered = output.answers as Record<string, string> | undefined;
        if (answered && Object.keys(answered).length) {
          lines.push("", "**Your answers**");
          lines.push(...Object.entries(answered).map(([k, v]) => `- ${k}: ${v}`));
        }
        if (output.freeform)
          lines.push("", `**Your answer typed in chat:** ${String(output.freeform)}`);
        if (!answered && !output.freeform) lines.push("", "_Not answered._");
        lines.push("");
      }

      if (name === "research") {
        lines.push(`### [RESEARCH] ${String(input.focus ?? "Live research run")}${stamp(m.at)}`, "");
        lines.push("**Searches run**");
        lines.push(fmtList(output.queries, (q: string) => `- ${q}`) || "- (none recorded)");
        if (output.notes) lines.push("", "**Findings**", "", String(output.notes));
        lines.push("", "**Sources read**");
        lines.push(fmtList(output.sources, (s: string) => `- ${s}`) || "- (none recorded)", "");
      }

      if (name === "analyzeWebsite") {
        lines.push(
          `### [RESEARCH] Website analysed: ${String(input.url ?? "")}${stamp(m.at)}`,
          "",
        );
      }

      if (name === "proposePlan") {
        lines.push(`### [APPROVAL] Execution plan: ${String(input.title ?? "")}${stamp(m.at)}`, "");
        if (input.summary) lines.push(String(input.summary), "");
        lines.push(
          fmtList(input.steps, (s: { title?: string; detail?: string }) =>
            `1. **${s.title ?? ""}** — ${s.detail ?? ""}`,
          ),
        );
        const approved = output.approved;
        lines.push(
          "",
          `**Decision:** ${approved === true ? "APPROVED by you" : approved === false ? "DECLINED by you" : "awaiting your decision"}`,
          "",
        );
      }

      if (name === "generateCreative") {
        lines.push(`### [CREATIVE] Ad creative${stamp(m.at)}`, "");
        lines.push(`- Caption: ${String(output.caption ?? input.caption ?? "")}`);
        lines.push(`- Art direction: ${String(input.prompt ?? "")}`);
        lines.push(
          `- Result: ${output.imageUrl ? "image generated and shown in chat" : `not generated (${String(output.error ?? "canceled")})`}`,
          "",
        );
      }

      if (name === "deliverCampaign") {
        lines.push(
          `### [FINAL CAMPAIGN] ${String(input.name ?? "Campaign")}${stamp(m.at)}`,
          "",
        );
        Object.entries(input).forEach(([k, v]) => {
          if (k === "name") return;
          if (Array.isArray(v)) {
            lines.push(
              `- ${k}:`,
              ...v.map((item) =>
                typeof item === "object" && item
                  ? `  - ${Object.values(item as Record<string, unknown>).join(" — ")}`
                  : `  - ${String(item)}`,
              ),
            );
          } else {
            lines.push(`- ${k}: ${String(v)}`);
          }
        });
        lines.push("");
      }
    });
  });

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

export function downloadTranscript(markdown: string, filename = "growzzy-transcript.md") {
  const blob = new Blob([markdown], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
