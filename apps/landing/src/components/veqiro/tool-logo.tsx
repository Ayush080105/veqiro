'use client';
import { useState } from 'react';
import { FONT } from './shared';

interface ToolTileProps {
  name: string;
  logoUrl?: string;
  accent?: string;
  size?: number;
}

/**
 * logoUrl points at third-party logo hosts (Composio, jsdelivr, favicon
 * services) we don't control — falls back to an initials badge if the URL
 * is missing or the image fails to load.
 */
export function ToolTile({ name, logoUrl, accent = '#F5C518', size = 96 }: ToolTileProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(logoUrl) && !failed;

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
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- external, unoptimizable third-party logo hosts
          <img
            src={logoUrl}
            alt={`${name} logo`}
            width={size * 0.46}
            height={size * 0.46}
            style={{ objectFit: 'contain' }}
            onError={() => setFailed(true)}
          />
        ) : (
          <span
            style={{
              fontFamily: FONT.head,
              fontSize: size * 0.28,
              fontWeight: 700,
              color: '#111',
              opacity: 0.5,
            }}
          >
            {name.slice(0, 2).toUpperCase()}
          </span>
        )}
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
