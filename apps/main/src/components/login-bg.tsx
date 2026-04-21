"use client";
import { FONT, Sticker } from "@/components/veqiro/shared";
import Logo from "./logo";

/**
 * Decorative Veqiro panel shown on the right side of auth pages.
 * Pure presentation — cream background with rotated logo tile,
 * stacked sticker accents, and a grainy noise overlay.
 */
const LoginBg = () => {
  return (
    <div
      className="h-full w-full relative overflow-hidden"
      style={{ background: "#EFE7D6", borderLeft: "3px solid #111" }}
    >
      {/* grain overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0.05,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
          backgroundSize: "200px 200px",
        }}
      />

      {/* big rotated logo tile */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative">
          <Logo className="w-56 h-56" />
        </div>
      </div>

      {/* scattered sticker accents */}
      <div className="absolute top-12 left-16">
        <Sticker rot={-8} color="#F06464">
          six AI employees
        </Sticker>
      </div>
      <div className="absolute top-32 right-10">
        <Sticker rot={6} color="#F5C518">
          always on
        </Sticker>
      </div>
      <div className="absolute bottom-36 left-10">
        <Sticker rot={-4} color="#1DBC87">
          real jobs
        </Sticker>
      </div>
      <div className="absolute bottom-16 right-16">
        <Sticker rot={3} color="#8A8AF0">
          zero chill
        </Sticker>
      </div>

      {/* tagline */}
      <div className="absolute bottom-8 left-0 right-0 text-center px-8">
        <p
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "#111",
            opacity: 0.7,
          }}
        >
          // hire the whole crew in 60 seconds
        </p>
      </div>
    </div>
  );
};

export default LoginBg;
