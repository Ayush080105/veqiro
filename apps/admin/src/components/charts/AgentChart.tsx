"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from "recharts";

const COLORS = ["#18181b", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ef4444"];

export function AgentChart({ data }: { data: Array<{ agent: string; messages: number }> }) {
  const sorted = [...data].sort((a, b) => b.messages - a.messages);
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
      <h3 className="mb-4 text-sm font-semibold">Agent Popularity (30 days)</h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={sorted} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
          <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
          <YAxis type="category" dataKey="agent" tick={{ fontSize: 11 }} width={46} />
          <Tooltip formatter={(v) => [v, "messages"]} />
          <Bar dataKey="messages" radius={[0, 3, 3, 0]}>
            {sorted.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
