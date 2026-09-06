'use client';

import { useEffect } from 'react';

export default function GlobalError({
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
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
          padding: '64px 24px',
          textAlign: 'center',
          background: '#EFE7D6',
          color: '#14120E',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <h1 style={{ fontSize: 'clamp(2rem, 6vw, 3.5rem)', margin: 0, letterSpacing: '-0.02em' }}>
          Something went sideways.
        </h1>
        <p style={{ maxWidth: 420, fontSize: 14, lineHeight: 1.6, color: '#56514A', margin: 0 }}>
          The site failed to load. Try refreshing — if it keeps happening,
          our team has already been notified.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            fontFamily: 'inherit',
            fontSize: 14,
            fontWeight: 500,
            background: '#14120E',
            color: '#EFE7D6',
            border: 'none',
            borderRadius: 10,
            padding: '12px 24px',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
        <span style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#8B857A' }}>
          error{error.digest ? ` · ${error.digest}` : ''}
        </span>
      </body>
    </html>
  );
}
