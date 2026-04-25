import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS } from "../shared/constants";

export const CTAClose: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bgOpacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const textOpacity = interpolate(frame, [10, 30], [0, 1], { extrapolateRight: "clamp" });
  const btnScale = spring({ frame: Math.max(0, frame - 30), fps, config: { damping: 10, stiffness: 200 } });
  const monoOpacity = interpolate(frame, [50, 65], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: COLORS.yellow,
        opacity: bgOpacity,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 52,
        border: `8px solid ${COLORS.ink}`,
      }}
    >
      <p
        style={{
          opacity: textOpacity,
          fontFamily: FONTS.display,
          fontSize: 88,
          color: COLORS.ink,
          textAlign: "center",
          margin: 0,
          lineHeight: 1.3,
          padding: "0 60px",
          whiteSpace: "pre-line",
        }}
      >
        {"7 days free.\nNo credit card."}
      </p>

      <div
        style={{
          transform: `scale(${btnScale})`,
          background: COLORS.ink,
          color: COLORS.yellow,
          fontFamily: FONTS.head,
          fontSize: 60,
          fontWeight: 900,
          padding: "24px 64px",
          borderRadius: 16,
          border: `4px solid ${COLORS.ink}`,
        }}
      >
        hire the crew →
      </div>

      <p
        style={{
          opacity: monoOpacity,
          fontFamily: FONTS.mono,
          fontSize: 36,
          color: COLORS.ink,
          margin: 0,
          letterSpacing: 4,
        }}
      >
        veqiro.com
      </p>
    </AbsoluteFill>
  );
};
