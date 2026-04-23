import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS } from "../shared/constants";

export const PivotLine: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const s = spring({ frame, fps, config: { damping: 14, stiffness: 120 } });
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const translateY = interpolate(s, [0, 1], [50, 0]);

  return (
    <AbsoluteFill
      style={{
        background: COLORS.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 80px",
      }}
    >
      <p
        style={{
          opacity,
          transform: `translateY(${translateY}px)`,
          fontFamily: FONTS.display,
          fontSize: 104,
          color: COLORS.ink,
          textAlign: "center",
          lineHeight: 1.2,
          margin: 0,
        }}
      >
        what if you had a crew?
      </p>
    </AbsoluteFill>
  );
};
