"use client";
import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Send, Sparkles, Bot } from "lucide-react";
import { apiFetch } from "@/lib/api";

const PRESETS = [
  "What's the top spending category this month?",
  "Who spent the most overall?",
  "Are there any unusual or anomalous expenses?",
  "How does this month compare to last month?",
  "Which recurring expenses are most expensive?",
];

type Message = { role: "user" | "rex"; text: string };

export function RexInsightsPanel({ groupId }: { groupId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const ask = useMutation({
    mutationFn: (question: string) =>
      apiFetch(`/expenses/groups/${groupId}/rex`, {
        method: "POST",
        body: JSON.stringify({ question }),
      }) as Promise<{ answer: string }>,
    onMutate: (question) => {
      setMessages((prev) => [...prev, { role: "user", text: question }]);
    },
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: "rex", text: data.answer }]);
    },
    onError: () => {
      setMessages((prev) => [...prev, { role: "rex", text: "Sorry, Rex couldn't process that right now. Try again in a moment." }]);
    },
  });

  const send = (text: string) => {
    const q = text.trim();
    if (!q || ask.isPending) return;
    setInput("");
    ask.mutate(q);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100">
          <Sparkles className="h-4 w-4 text-violet-600" />
        </div>
        <div>
          <p className="text-sm font-semibold">Rex — Spend Intelligence</p>
          <p className="text-xs text-[var(--muted-foreground)]">Ask Rex anything about this group&apos;s expenses</p>
        </div>
      </div>

      {/* Preset chips */}
      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => send(p)}
              disabled={ask.isPending}
              className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] disabled:opacity-50"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Chat messages */}
      {messages.length > 0 && (
        <div className="flex-1 space-y-3 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--muted)] p-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "rex" && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100">
                  <Bot className="h-4 w-4 text-violet-600" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "bg-[var(--card)] text-[var(--foreground)]"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {ask.isPending && (
            <div className="flex gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100">
                <Bot className="h-4 w-4 text-violet-600" />
              </div>
              <div className="rounded-xl bg-[var(--card)] px-4 py-2.5 text-sm text-[var(--muted-foreground)]">
                Rex is thinking…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          placeholder="Ask Rex about expenses…"
          disabled={ask.isPending}
          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm placeholder-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] disabled:opacity-50"
        />
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || ask.isPending}
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>

      {/* Quick chips after first message */}
      {messages.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {PRESETS.slice(0, 3).map((p) => (
            <button
              key={p}
              onClick={() => send(p)}
              disabled={ask.isPending}
              className="rounded-full border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-50"
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
