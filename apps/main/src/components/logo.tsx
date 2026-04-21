import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  /** Shadow colour behind the tile. Defaults to Veqiro yellow. */
  shadow?: string;
  /** Rotation in degrees. Defaults to -6 (playful tilt). */
  rot?: number;
}

/**
 * Veqiro mark — a tilted ink tile with the lowercase `v` and a hard
 * offset coloured shadow. Implemented in SVG so the glyph scales with
 * the wrapper's width/height (className sets the bounding box).
 */
export default function Logo({ className, shadow = "#F5C518", rot = -6 }: LogoProps) {
  return (
    <svg
      className={cn(className)}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="geometricPrecision"
    >
      <g transform={`rotate(${rot} 32 32)`}>
        <rect x="6" y="10" width="54" height="54" rx="13" fill={shadow} />
        <rect x="2" y="6" width="54" height="54" rx="13" fill="#111" stroke="#111" strokeWidth="2" />
        <text
          x="29"
          y="46"
          textAnchor="middle"
          fill="#EFE7D6"
          fontFamily="var(--font-bagel), cursive"
          fontSize="38"
        >
          v
        </text>
      </g>
    </svg>
  );
}
