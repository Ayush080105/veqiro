'use client';
import React from 'react';
import Image from 'next/image';
import { FONT, T } from './shared';

/**
 * Brand lockup: the real icon.png tile mark plus a wordmark set in the
 * display face.
 *
 * The full logo.png baked the wordmark in as black bubble-type, so it
 * disappeared against the dark hero. icon.png is the tile on its own with
 * transparent padding, so it reads correctly on cream and dark alike — only
 * the wordmark colour has to respond to tone.
 *
 * The asset is 801x659 with roughly a quarter of its height as transparent
 * padding, so it is rendered slightly taller than the nominal size to make
 * the visible tile match `size`.
 */
export function BrandMark({
  tone = 'light',
  size = 26,
  showWordmark = true,
}: {
  tone?: 'light' | 'dark';
  size?: number;
  showWordmark?: boolean;
}) {
  const wordColor = tone === 'dark' ? T.inkInv : T.ink;
  const boxHeight = Math.round(size * 1.3);

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.3 }}>
      <Image
        src="/icon.png"
        alt=""
        width={801}
        height={659}
        priority
        style={{
          height: boxHeight,
          width: 'auto',
          display: 'block',
          flexShrink: 0,
        }}
      />

      {showWordmark && (
        <span
          style={{
            fontFamily: FONT.display,
            fontSize: size * 0.88,
            fontWeight: 600,
            letterSpacing: '-0.035em',
            color: wordColor,
            lineHeight: 1,
          }}
        >
          Veqiro
        </span>
      )}
    </span>
  );
}
