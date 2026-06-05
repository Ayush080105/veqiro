"use client";

type FunnelData = {
  signedUp: number;
  brandKitCreated: number;
  firstMessage: number;
  socialConnected: number;
  publishedPost: number;
};

type FunnelStep = {
  label: string;
  count: number;
  pct: number;
};

export function OnboardingFunnel({ data }: { data: FunnelData }) {
  const base = data.signedUp || 1; // avoid division by zero

  const steps: FunnelStep[] = [
    {
      label: "Signed Up",
      count: data.signedUp,
      pct: 100,
    },
    {
      label: "BrandKit Created",
      count: data.brandKitCreated,
      pct: Math.round((data.brandKitCreated / base) * 100),
    },
    {
      label: "First Message",
      count: data.firstMessage,
      pct: Math.round((data.firstMessage / base) * 100),
    },
    {
      label: "Social Connected",
      count: data.socialConnected,
      pct: Math.round((data.socialConnected / base) * 100),
    },
    {
      label: "Published Post",
      count: data.publishedPost,
      pct: Math.round((data.publishedPost / base) * 100),
    },
  ];

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-0">
        {steps.map((step, i) => (
          <div key={step.label} className="flex sm:flex-1 sm:flex-col">
            {/* Arrow connector (between steps) */}
            {i > 0 && (
              <div className="hidden items-center justify-center sm:flex">
                <svg
                  className="h-4 w-4 -mx-1 shrink-0 text-[var(--muted-foreground)]"
                  fill="none"
                  viewBox="0 0 16 16"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 8h10M9 4l4 4-4 4"
                  />
                </svg>
              </div>
            )}
            <div className="flex-1 px-1 sm:px-2">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                {step.label}
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {step.pct}%
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">
                {step.count.toLocaleString()}
              </p>
              <div className="mt-2 h-1.5 w-full rounded-full bg-[var(--muted)]">
                <div
                  className="h-1.5 rounded-full bg-[var(--primary)]"
                  style={{ width: `${step.pct}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
