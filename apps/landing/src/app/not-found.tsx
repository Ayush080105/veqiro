import Link from 'next/link';
import { PageNav } from '@/components/veqiro/page-nav';
import { Footer } from '@/components/veqiro/sections';
import { Sticker, Button } from '@/components/veqiro/shared';
import { FONT, T } from '@/components/veqiro/tokens';

export default function NotFound() {
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
        <Sticker color={T.red}>404</Sticker>

        <h1
          style={{
            fontFamily: FONT.display,
            fontSize: 'clamp(2.5rem, 8vw, 4.5rem)',
            lineHeight: 1,
            letterSpacing: '-0.02em',
            color: T.ink,
            margin: 0,
          }}
        >
          Lost the plot.
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
          This page doesn&apos;t exist — or wandered off somewhere none of our
          six AI employees could find it.
        </p>

        <Button href="/" variant="dark" size="lg">
          Take me home
        </Button>

        <Link
          href="/pricing"
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: T.ink3,
            textDecoration: 'underline',
          }}
        >
          or see pricing
        </Link>
      </main>
      <Footer />
    </>
  );
}
