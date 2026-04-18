import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

interface MetricCardProps {
  label: string
  value: string
  change?: string
  trend?: "up" | "down" | "neutral"
}

export function MetricCard({ label, value, change, trend }: MetricCardProps) {
  return (
    <Card className="flex-1">
      <CardContent className="flex flex-col gap-2 py-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
          {label}
        </p>
        <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
        {change && trend && (
          <div className="flex items-center gap-1">
            {trend === "up" && (
              <Badge
                variant="outline"
                className="gap-1 border-transparent bg-chart-2/10 text-chart-2 px-1.5"
              >
                <TrendingUp className="size-3" />
                {change}
              </Badge>
            )}
            {trend === "down" && (
              <Badge
                variant="destructive"
                className="gap-1 px-1.5"
              >
                <TrendingDown className="size-3" />
                {change}
              </Badge>
            )}
            {trend === "neutral" && (
              <Badge
                variant="outline"
                className="gap-1 px-1.5"
              >
                <Minus className="size-3" />
                {change}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
