"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export function OrgTokenChart({
  data,
}: {
  data: Array<{ week: string; tokens: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={data} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
        <XAxis
          dataKey="week"
          tick={{ fontSize: 10 }}
          tickFormatter={(v: string) => v.slice(5)}
        />
        <YAxis
          tick={{ fontSize: 10 }}
          tickFormatter={(v: number) => fmtTokens(v)}
        />
        <Tooltip
          formatter={(v) => [typeof v === "number" ? v.toLocaleString() : v, "tokens"]}
          labelFormatter={(l) => `Week of ${l as string}`}
        />
        <Bar dataKey="tokens" fill="var(--vq-violet)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
