"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";

type HealthBucket = {
  week: string;
  active: number;
  trialing: number;
  pastDue: number;
  cancelledExpired: number;
};

export function HealthChart({ data }: { data: HealthBucket[] }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-5">
      <h3 className="mb-4 text-sm font-semibold">Subscription Health (by sign-up week)</h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <XAxis dataKey="week" tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
          <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
          <Tooltip labelFormatter={(l: string) => `Week of ${l}`} />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="active" name="Active" stackId="a" fill="#22c55e" />
          <Bar dataKey="trialing" name="Trialing" stackId="a" fill="#3b82f6" />
          <Bar dataKey="pastDue" name="Past-due" stackId="a" fill="#f59e0b" />
          <Bar dataKey="cancelledExpired" name="Churned" stackId="a" fill="#ef4444" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
