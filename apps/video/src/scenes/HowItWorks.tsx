import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS } from "../shared/constants";

const STEPS = [
  { num: "01", text: "Pick your crew",  color: COLORS.yellow, delay: 0  },
  { num: "02", text: "Brief them",      color: COLORS.cream,  delay: 30 },
  { num: "03", text: "Go touch grass",  color: COLORS.green,  delay: 60 },
] as const;

export const HowItWorks: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: COLORS.ink,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "0 80px",
        gap: 56,
      }}
    >
      <p
        style={{
          fontFamily: FONTS.head,
          fontSize: 44,
          color: COLORS.yellow,
          letterSpacing: 4,
          margin: "0 0 8px",
          opacity: headerOpacity,
        }}
      >
        ONBOARDING TAKES 9 MIN
      </p>

      {STEPS.map((step, i) => {
        const s = spring({ frame: Math.max(0, frame - step.delay), fps, config: { damping: 14, stiffness: 160 } });
        const opacity = interpolate(Math.max(0, frame - step.delay), [0, 12], [0, 1], { extrapolateRight: "clamp" });
        const x = interpolate(s, [0, 1], [-120, 0]);

        return (
          <div
            key={i}
            style={{ opacity, transform: `translateX(${x}px)`, display: "flex", alignItems: "center", gap: 32 }}
          >
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: 40,
                color: step.color,
                minWidth: 64,
              }}
            >
              {step.num}
            </span>
            <span
              style={{
                fontFamily: FONTS.display,
                fontSize: 88,
                color: COLORS.cream,
                lineHeight: 1,
              }}
            >
              {step.text}
            </span>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
