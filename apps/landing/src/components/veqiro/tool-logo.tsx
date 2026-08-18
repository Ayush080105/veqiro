'use client';
import { useState } from 'react';
import { FONT } from './shared';

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
 * is missing or the image fails to load. Shared by ToolTile and ToolChip.
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
      style={{ objectFit: 'contain' }}
      onError={() => setFailed(true)}
    />
  ) : (
    <span style={{ fontFamily: FONT.head, fontSize, fontWeight: 700, color: '#111', opacity: 0.5 }}>
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

export function ToolTile({ name, logoUrl, accent = '#F5C518', size = 96 }: ToolTileProps) {
  return (
    <div
      style={{
        width: size,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          background: '#FFF9ED',
          border: '3px solid #111',
          borderRadius: 16,
          boxShadow: '4px 4px 0 #111',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 150ms ease, box-shadow 150ms ease',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translate(-2px,-2px)';
          e.currentTarget.style.boxShadow = `6px 6px 0 ${accent}`;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = '';
          e.currentTarget.style.boxShadow = '4px 4px 0 #111';
        }}
      >
        <LogoImage name={name} logoUrl={logoUrl} imageSize={size * 0.46} fontSize={size * 0.28} alt={`${name} logo`} />
      </div>
      <span
        style={{
          fontFamily: FONT.mono,
          fontSize: 11,
          textAlign: 'center',
          color: '#333',
          lineHeight: 1.3,
          maxWidth: size + 12,
        }}
      >
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

/** A static pill-shaped logo+name badge, for dense grouped listings. */
export function ToolChip({ name, logoUrl, accent = '#111' }: ToolChipProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '7px 18px 7px 7px',
        background: '#FFF9ED',
        border: '2.5px solid #111',
        borderRadius: 999,
        boxShadow: `3px 3px 0 ${accent}`,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: '#EFE7D6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        <LogoImage name={name} logoUrl={logoUrl} imageSize={18} fontSize={11} />
      </span>
      <span style={{ fontFamily: FONT.head, fontSize: 14, color: '#111', whiteSpace: 'nowrap' }}>{name}</span>
    </span>
  );
}
