import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number;
  highlight?: "warning" | "danger";
}

export function StatCard({ label, value, highlight }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-[var(--card)] p-5",
        highlight === "danger" && "border-red-300 bg-red-50",
        highlight === "warning" && "border-amber-300 bg-amber-50",
        !highlight && "border-[var(--border)]",
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 text-3xl font-bold tabular-nums",
          highlight === "danger" && "text-red-600",
          highlight === "warning" && "text-amber-600",
        )}
      >
        {value.toLocaleString()}
      </p>
    </div>
  );
}
