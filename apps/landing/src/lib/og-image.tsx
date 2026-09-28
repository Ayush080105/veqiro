// Shared Open Graph card renderer, used by every opengraph-image.tsx route
// (root default, agents/[slug], blog/[slug]) via next/og's ImageResponse.
// Kept prop-driven so one template covers every route instead of hand-designed
// static PNGs per page.
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/png';

const BG = '#14120E';
const CREAM = '#F2ECE0';
const MUTED = '#A9A192';

export function renderOgCard({
  eyebrow,
  title,
  subtitle,
  accent,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  accent: string;
}) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: BG,
        padding: 80,
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontSize: 22,
          letterSpacing: 4,
          textTransform: 'uppercase',
          color: accent,
        }}
      >
        <div style={{ width: 10, height: 10, borderRadius: 999, background: accent }} />
        {eyebrow}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div
          style={{
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 3,
            overflow: 'hidden',
            fontSize: 64,
            fontWeight: 700,
            color: CREAM,
            lineHeight: 1.15,
            letterSpacing: -2,
            maxWidth: 1000,
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div
            style={{
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 2,
              overflow: 'hidden',
              fontSize: 28,
              color: MUTED,
              lineHeight: 1.35,
              maxWidth: 980,
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 24, color: MUTED }}>
        veqiro.com
      </div>
    </div>
  );
}
