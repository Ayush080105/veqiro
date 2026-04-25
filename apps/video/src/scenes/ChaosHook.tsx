import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS } from "../shared/constants";

const ITEMS = [
  { emoji: "📧", text: "147 unread emails", color: COLORS.yellow, delay: 0 },
  { emoji: "📅", text: "3 meetings today",  color: COLORS.red,    delay: 10 },
  { emoji: "📄", text: "5 decks due",       color: COLORS.blue,   delay: 20 },
] as const;

export const ChaosHook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        background: COLORS.ink,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 40,
      }}
    >
      {ITEMS.map((item, i) => {
        const localFrame = frame - item.delay;
        const s = localFrame < 0 ? 0 : spring({ frame: localFrame, fps, config: { damping: 12, stiffness: 200 } });
        const opacity = interpolate(Math.max(0, localFrame), [0, 10], [0, 1], { extrapolateRight: "clamp" });
        const translateY = interpolate(s, [0, 1], [80, 0]);

        return (
          <div
            key={i}
            style={{
              opacity,
              transform: `translateY(${translateY}px)`,
              background: item.color,
              color: COLORS.ink,
              fontFamily: FONTS.head,
              fontSize: 52,
              fontWeight: 900,
              padding: "20px 44px",
              borderRadius: 16,
              border: `4px solid ${COLORS.ink}`,
              display: "flex",
              alignItems: "center",
              gap: 20,
              boxShadow: `6px 6px 0 ${COLORS.ink}`,
            }}
          >
            <span style={{ fontSize: 60 }}>{item.emoji}</span>
            <span>{item.text}</span>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
