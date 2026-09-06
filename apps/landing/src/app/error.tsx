'use client';

import { useEffect } from 'react';
import { PageNav } from '@/components/veqiro/page-nav';
import { Sticker, Button, FONT, T } from '@/components/veqiro/shared';

export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <PageNav />
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
          padding: '96px 24px',
          textAlign: 'center',
          background: T.bg,
        }}
      >
        <Sticker color={T.red}>error</Sticker>

        <h1
          style={{
            fontFamily: FONT.display,
            fontSize: 'clamp(2.25rem, 6vw, 3.5rem)',
            lineHeight: 1,
            letterSpacing: '-0.02em',
            color: T.ink,
            margin: 0,
          }}
        >
          Something went sideways.
        </h1>

        <p
          style={{
            fontFamily: FONT.body,
            fontSize: 16,
            lineHeight: 1.6,
            color: T.ink2,
            maxWidth: 440,
            margin: 0,
          }}
        >
          That wasn&apos;t supposed to happen. Try again — if it keeps
          happening, our team has already been notified.
        </p>

        <Button onClick={() => reset()} variant="dark" size="lg">
          Try again
        </Button>

        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: T.ink3,
          }}
        >
          error{error.digest ? ` · ${error.digest}` : ''}
        </span>
      </main>
    </>
  );
}
