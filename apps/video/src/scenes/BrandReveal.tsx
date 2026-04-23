import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS } from "../shared/constants";

export const BrandReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const s1 = spring({ frame, fps, config: { damping: 12, stiffness: 200 } });
  const s2 = spring({ frame: Math.max(0, frame - 15), fps, config: { damping: 8, stiffness: 300 } });

  const y1 = interpolate(s1, [0, 1], [80, 0]);
  const y2 = interpolate(s2, [0, 1], [-80, 0]);
  const opacity1 = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const opacity2 = interpolate(frame, [15, 25], [0, 1], { extrapolateRight: "clamp" });
  const logoOpacity = interpolate(frame, [40, 55], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: COLORS.ink,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
      }}
    >
      <p
        style={{
          opacity: opacity1,
          transform: `translateY(${y1}px)`,
          fontFamily: FONTS.head,
          fontSize: 72,
          color: COLORS.yellow,
          letterSpacing: 8,
          margin: 0,
        }}
      >
        HIRE YOUR
      </p>
      <p
        style={{
          opacity: opacity2,
          transform: `translateY(${y2}px)`,
          fontFamily: FONTS.display,
          fontSize: 148,
          color: COLORS.red,
          margin: 0,
          lineHeight: 1,
        }}
      >
        WEIRDOS
      </p>
      <p
        style={{
          opacity: logoOpacity,
          fontFamily: FONTS.head,
          fontSize: 48,
          color: COLORS.cream,
          letterSpacing: 8,
          margin: "30px 0 0",
        }}
      >
        VEQIRO
      </p>
    </AbsoluteFill>
  );
};
