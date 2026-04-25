import React from "react";
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, CREW, FONTS } from "../shared/constants";

const MEMBER_DURATION = 65;

export const CrewParade: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const idx = Math.min(Math.floor(frame / MEMBER_DURATION), CREW.length - 1);
  const localFrame = frame % MEMBER_DURATION;
  const member = CREW[idx];

  const bgOpacity = interpolate(localFrame, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  const imgScale = spring({ frame: localFrame, fps, config: { damping: 14, stiffness: 160 } });
  const textS = spring({ frame: Math.max(0, localFrame - 15), fps, config: { damping: 12, stiffness: 180 } });
  const textY = interpolate(textS, [0, 1], [60, 0]);
  const textOpacity = interpolate(localFrame, [15, 30], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: member.color,
        opacity: bgOpacity,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 48,
      }}
    >
      <div
        style={{
          transform: `scale(${imgScale})`,
          width: 400,
          height: 400,
          borderRadius: "50%",
          overflow: "hidden",
          border: `6px solid ${COLORS.ink}`,
          boxShadow: `8px 8px 0 ${COLORS.ink}`,
          flexShrink: 0,
        }}
      >
        <Img
          src={member.photo}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
      <div
        style={{
          opacity: textOpacity,
          transform: `translateY(${textY}px)`,
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontFamily: FONTS.display,
            fontSize: 120,
            color: COLORS.ink,
            margin: 0,
            lineHeight: 1,
          }}
        >
          {member.name}
        </p>
        <p
          style={{
            fontFamily: FONTS.head,
            fontSize: 52,
            color: COLORS.ink,
            margin: "10px 0 0",
            opacity: 0.75,
          }}
        >
          {member.role}
        </p>
      </div>
    </AbsoluteFill>
  );
};
