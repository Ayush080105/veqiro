import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, CREW, FONTS } from "../shared/constants";

export const PricingPunch: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const namesOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const tagOpacity = interpolate(frame, [20, 40], [0, 1], { extrapolateRight: "clamp" });
  const priceScale = spring({ frame: Math.max(0, frame - 40), fps, config: { damping: 8, stiffness: 300 } });

  return (
    <AbsoluteFill
      style={{
        background: COLORS.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 80px",
        gap: 48,
      }}
    >
      <div
        style={{
          opacity: namesOpacity,
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          justifyContent: "center",
        }}
      >
        {CREW.map((m) => (
          <span
            key={m.name}
            style={{
              background: m.color,
              color: COLORS.ink,
              fontFamily: FONTS.head,
              fontSize: 40,
              fontWeight: 900,
              padding: "10px 30px",
              borderRadius: 999,
              border: `3px solid ${COLORS.ink}`,
            }}
          >
            {m.name}
          </span>
        ))}
      </div>

      <p
        style={{
          opacity: tagOpacity,
          fontFamily: FONTS.head,
          fontSize: 56,
          color: COLORS.ink,
          textAlign: "center",
          margin: 0,
        }}
      >
        less than a bad intern
      </p>

      <div
        style={{
          transform: `scale(${priceScale})`,
          background: COLORS.ink,
          color: COLORS.yellow,
          fontFamily: FONTS.display,
          fontSize: 120,
          padding: "20px 64px",
          borderRadius: 20,
          border: `4px solid ${COLORS.ink}`,
          lineHeight: 1,
        }}
      >
        $39<span style={{ fontSize: 60 }}>/mo</span>
      </div>
    </AbsoluteFill>
  );
};
