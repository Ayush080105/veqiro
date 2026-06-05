import { cn } from "@/lib/utils";

const COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  TRIALING: "bg-blue-100 text-blue-800",
  PAST_DUE: "bg-amber-100 text-amber-800",
  CANCELLED: "bg-red-100 text-red-800",
  EXPIRED: "bg-gray-100 text-gray-600",
};

export function StatusBadge({ status }: { status: string | null }) {
  const color = status ? (COLORS[status] ?? "bg-gray-100 text-gray-600") : "bg-gray-100 text-gray-400";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", color)}>
      {status ?? "—"}
    </span>
  );
}
