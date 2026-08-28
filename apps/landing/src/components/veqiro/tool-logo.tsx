'use client';
import { useState } from 'react';
import { FONT, T } from './shared';

interface LogoImageProps {
  name: string;
  logoUrl?: string;
  imageSize: number;
  fontSize: number;
  alt?: string;
}

/**
 * logoUrl points at third-party logo hosts (Composio, jsdelivr, favicon
 * services) we don't control — falls back to an initials badge if the URL
 * is missing or the image fails to load. Shared by every tool primitive here.
 */
function LogoImage({ name, logoUrl, imageSize, fontSize, alt = '' }: LogoImageProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(logoUrl) && !failed;

  return showImage ? (
    // eslint-disable-next-line @next/next/no-img-element -- external, unoptimizable third-party logo hosts
    <img
      src={logoUrl}
      alt={alt}
      width={imageSize}
      height={imageSize}
      loading="lazy"
      style={{ objectFit: 'contain', display: 'block' }}
      onError={() => setFailed(true)}
    />
  ) : (
    <span style={{
      fontFamily: FONT.body, fontSize, fontWeight: 600,
      color: T.ink3, letterSpacing: '-0.02em',
    }}>
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

interface ToolTileProps {
  name: string;
  logoUrl?: string;
  accent?: string;
  size?: number;
}

/** Labelled tile used on the agent detail pages. */
export function ToolTile({ name, logoUrl, size = 88 }: ToolTileProps) {
  return (
    <div style={{ width: size, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div
        style={{
          width: size,
          height: size,
          background: T.surface,
          border: `1px solid ${T.line}`,
          borderRadius: 14,
          boxShadow: T.shadowSm,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = T.shadow;
          e.currentTarget.style.borderColor = T.line2;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = '';
          e.currentTarget.style.boxShadow = T.shadowSm;
          e.currentTarget.style.borderColor = T.line;
        }}
      >
        <LogoImage name={name} logoUrl={logoUrl} imageSize={size * 0.44} fontSize={size * 0.24} alt={`${name} logo`} />
      </div>
      <span style={{
        fontFamily: FONT.body, fontSize: 12, textAlign: 'center',
        color: T.ink2, lineHeight: 1.35, maxWidth: size + 16,
      }}>
        {name}
      </span>
    </div>
  );
}

interface ToolChipProps {
  name: string;
  logoUrl?: string;
  accent?: string;
}

/** Compact pill for dense grouped listings. */
export function ToolChip({ name, logoUrl }: ToolChipProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '5px 11px 5px 6px',
        background: T.surface,
        border: `1px solid ${T.line}`,
        borderRadius: 999,
        flexShrink: 0,
      }}
    >
      <span style={{
        width: 20, height: 20, borderRadius: 5,
        background: T.surface2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, overflow: 'hidden',
      }}>
        <LogoImage name={name} logoUrl={logoUrl} imageSize={13} fontSize={8} />
      </span>
      <span style={{
        fontFamily: FONT.body, fontSize: 13, color: T.ink2,
        whiteSpace: 'nowrap',
      }}>
        {name}
      </span>
    </span>
  );
}

/** Unlabelled rounded-square app icon, for the drifting integration rows. */
export function ToolIcon({ name, logoUrl, size = 58 }: { name: string; logoUrl?: string; size?: number }) {
  return (
    <span
      title={name}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        background: '#FFFFFF',
        border: `1px solid ${T.line}`,
        borderRadius: size * 0.26,
        boxShadow: T.shadowSm,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <LogoImage name={name} logoUrl={logoUrl} imageSize={size * 0.52} fontSize={size * 0.26} alt={`${name} logo`} />
    </span>
  );
}

/** Inline logo + name, used inside the example-prompt composer. */
export function ToolInline({ name, logoUrl }: { name: string; logoUrl?: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      verticalAlign: 'baseline', whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: 17, height: 17, borderRadius: 4, background: '#fff',
        border: `1px solid ${T.line}`, display: 'inline-flex',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        transform: 'translateY(3px)',
      }}>
        <LogoImage name={name} logoUrl={logoUrl} imageSize={11} fontSize={7} />
      </span>
      <span style={{ fontWeight: 600, color: T.ink }}>{name}</span>
    </span>
  );
}
