"use client"

export function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [hStr, mStr] = value.split(":")
  const h = Number.isFinite(Number(hStr)) ? Math.min(23, Math.max(0, parseInt(hStr, 10))) : 0
  const rawMinute = Number.isFinite(Number(mStr)) ? parseInt(mStr, 10) : 0
  const m = Math.min(55, Math.max(0, Math.floor(rawMinute / 5) * 5))
  const pad = (n: number) => String(n).padStart(2, "0")
  const selectClass =
    "min-w-12 appearance-none rounded-md border border-[var(--vq-line-2)] bg-card px-2.5 py-1.5 text-center font-mono text-[13px] font-semibold text-foreground outline-none cursor-pointer"

  return (
    <div className="flex items-center gap-1">
      <select
        aria-label="Hour"
        value={h}
        onChange={(e) => onChange(`${pad(Number(e.target.value))}:${pad(m)}`)}
        className={selectClass}
      >
        {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{pad(i)}</option>)}
      </select>
      <span className="font-mono text-sm font-bold text-foreground">:</span>
      <select
        aria-label="Minute"
        value={m}
        onChange={(e) => onChange(`${pad(h)}:${pad(Number(e.target.value))}`)}
        className={selectClass}
      >
        {Array.from({ length: 12 }, (_, i) => <option key={i} value={i * 5}>{pad(i * 5)}</option>)}
      </select>
    </div>
  )
}
