"use client"

export function DashboardProgressBar({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div
      aria-hidden
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        height: 2,
        background: "transparent",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          width: "40%",
          background: "#111",
          animation: "dashboardProgress 1.1s ease-in-out infinite",
        }}
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
