"use client"

export function DashboardProgressBar({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div aria-hidden className="sticky top-0 z-40 h-0.5 overflow-hidden bg-transparent">
      <div
        className="h-full w-2/5 bg-primary"
        style={{ animation: "dashboardProgress 1.1s ease-in-out infinite" }}
      />
      <style>{`
        @keyframes dashboardProgress {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(150%); }
          100% { transform: translateX(250%); }
        }
      `}</style>
    </div>
  )
}
