/**
 * Pure routing rules for the Growzzy chat composer.
 *
 * Guarantee: a plain typed message ALWAYS goes to the AI as a chat message.
 * It is only ever attached to a tool call when the agent is literally waiting
 * on that tool's answer (an unanswered askUser card).
 */
export type PendingTool = {
  toolName: string;
  toolCallId: string;
  state: string;
} | null;

export type Submission =
  | { kind: "ignore"; reason: "empty" | "busy" }
  | { kind: "send"; text: string }
  | { kind: "answer-question"; toolCallId: string; freeform: string };

export function resolveSubmission(args: {
  text: string;
  busy: boolean;
  pending?: PendingTool;
  mode?: string;
}): Submission {
  const value = args.text.trim();
  if (!value) return { kind: "ignore", reason: "empty" };
  if (args.busy) return { kind: "ignore", reason: "busy" };

  const p = args.pending;
  if (p && p.toolName === "askUser" && p.state !== "output-available") {
    return { kind: "answer-question", toolCallId: p.toolCallId, freeform: value };
  }

  return {
    kind: "send",
    text:
      args.mode === "deep" ? `${value}\n\n(Run deep live research before answering.)` : value,
  };
}

/** Classifies a chat error so the UI can show credits/limits state + retry. */
export type ChatErrorKind = "credits" | "blocked" | "rate-limit" | "network" | "unknown";

export function classifyChatError(error: unknown): { kind: ChatErrorKind; message: string } {
  const raw =
    (typeof error === "string" ? error : (error as Error | undefined)?.message ?? "") || "";
  const text = raw.toLowerCase();
  const status = Number(/\b(4\d\d|5\d\d)\b/.exec(raw)?.[1] ?? 0);

  if (status === 402 || text.includes("credit") || text.includes("payment required")) {
    return {
      kind: "credits",
      message:
        "Your workspace is out of AI credits. Add credits, then hit Retry — your message is saved.",
    };
  }
  if (status === 403 || text.includes("forbidden") || text.includes("limit reached")) {
    return {
      kind: "blocked",
      message:
        "AI access is blocked by a workspace limit or policy. An admin needs to lift it, then Retry.",
    };
  }
  if (status === 429 || text.includes("rate limit") || text.includes("too many requests")) {
    return { kind: "rate-limit", message: "Rate limited. Wait a few seconds and Retry." };
  }
  if (text.includes("fetch") || text.includes("network") || status >= 500) {
    return { kind: "network", message: "Connection problem reaching Growzzy. Retry." };
  }
  return { kind: "unknown", message: raw || "Growzzy couldn't answer — Retry." };
}
