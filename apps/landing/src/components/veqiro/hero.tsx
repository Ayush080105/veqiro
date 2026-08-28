'use client';
import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { FONT, T } from './shared';
import { NavShared } from './nav-shared';
import { EMPLOYEES } from './data';
import { consoleUrl, isPreLaunch, waitlistUrl, heroCopy } from '@/lib/site-config';

export function Hero() {
  const signupHref = isPreLaunch ? waitlistUrl : `${consoleUrl}/signup`;

  return (
    <section
      style={{
        position: 'relative',
        background: T.dark,
        color: T.inkInv,
        isolation: 'isolate',
        overflow: 'hidden',
      }}
    >
      {/* Full-bleed background photograph */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: -2 }}>
        <Image
          src="/Empty-office.jpeg"
          alt=""
          fill
          sizes="100vw"
          priority
          style={{ objectFit: 'cover', objectPosition: 'center 58%' }}
        />
      </div>

      {/* Scrim. The source is a bright golden interior, so this is heavier than
          a typical hero overlay — enough for cream type to hold at AA, while
          the sun flare still reads through the middle. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: -1,
          background: `
            radial-gradient(130% 68% at 50% 0%, rgba(20,18,14,0.80), transparent 72%),
            linear-gradient(180deg,
              rgba(20,18,14,0.82) 0%,
              rgba(20,18,14,0.70) 32%,
              rgba(20,18,14,0.56) 56%,
              rgba(20,18,14,0.80) 84%,
              rgba(20,18,14,0.95) 100%)
          `,
        }}
      />

      <NavShared variant="hero" />

      <div
        className="vq-shell"
        style={{
          paddingTop: 'clamp(56px, 8vw, 104px)',
          paddingBottom: 'clamp(32px, 4vw, 48px)',
          textAlign: 'center',
        }}
      >
        {/* Headline */}
        <h1 style={{
          fontFamily: FONT.display,
          fontSize: 'clamp(36px, 6.2vw, 72px)',
          fontWeight: 600,
          lineHeight: 1.03,
          letterSpacing: '-0.038em',
          margin: '0 auto',
          maxInlineSize: '17ch',
          color: T.inkInv,
          textShadow: '0 2px 24px rgba(20,18,14,0.45)',
        }}>
          {heroCopy.headline}
        </h1>

        {/* Sub */}
        <p style={{
          fontFamily: FONT.body,
          fontSize: 'clamp(16px, 1.8vw, 19px)',
          lineHeight: 1.62,
          color: T.inkInv2,
          maxWidth: '60ch',
          margin: '22px auto 0',
          textShadow: '0 1px 14px rgba(20,18,14,0.5)',
        }}>
          {heroCopy.sub}
        </p>

        {/* CTAs */}
        <div style={{
          display: 'flex', gap: 12, justifyContent: 'center',
          flexWrap: 'wrap', marginTop: 32,
        }}>
          <a
            href={signupHref}
            style={{
              background: T.inkInv, color: T.ink,
              padding: '14px 26px', borderRadius: 11,
              fontFamily: FONT.body, fontSize: 15, fontWeight: 550,
              textDecoration: 'none', transition: 'opacity 140ms ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.87')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            {isPreLaunch ? 'Join the waitlist' : 'Start free — 7 days'}
          </a>
          <Link
            href="#how"
            style={{
              background: 'rgba(242,236,224,0.10)',
              color: T.inkInv,
              border: `1px solid ${T.lineInv2}`,
              padding: '14px 26px', borderRadius: 11,
              fontFamily: FONT.body, fontSize: 15, fontWeight: 500,
              textDecoration: 'none',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              transition: 'background 140ms ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(242,236,224,0.18)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(242,236,224,0.10)')}
          >
            See how it works
          </Link>
        </div>

        {/* Trust line */}
        <div style={{
          marginTop: 18,
          fontFamily: FONT.body, fontSize: 13.5, color: T.inkInv2,
          display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap',
          textShadow: '0 1px 12px rgba(20,18,14,0.6)',
        }}>
          {heroCopy.trust.map((item: string, i: number) => (
            <React.Fragment key={item}>
              {i > 0 && <span aria-hidden style={{ opacity: 0.5 }}>·</span>}
              <span>{item}</span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* The crew, on shift */}
      <div className="vq-shell" style={{ paddingTop: 'clamp(48px, 7vw, 88px)', paddingBottom: 'clamp(52px, 7vw, 88px)' }}>
        <div style={{
          fontFamily: FONT.mono, fontSize: 10.5, letterSpacing: '0.16em',
          textTransform: 'uppercase', color: T.inkInv2,
          marginBottom: 20, textAlign: 'center', opacity: 0.8,
        }}>
          On shift right now
        </div>

        <ul className="vq-hero-crew" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {EMPLOYEES.map(emp => (
            <li key={emp.key}>
              <Link
                href={`/agents/${emp.key}`}
                style={{
                  display: 'grid', justifyItems: 'center', gap: 12,
                  textDecoration: 'none', width: '100%',
                }}
                onMouseEnter={e => {
                  const t = e.currentTarget.querySelector('span') as HTMLElement | null;
                  if (t) t.style.transform = 'translateY(-3px)';
                }}
                onMouseLeave={e => {
                  const t = e.currentTarget.querySelector('span') as HTMLElement | null;
                  if (t) t.style.transform = '';
                }}
              >
                <span style={{
                  width: 'clamp(64px, 9.5vw, 108px)',
                  height: 'clamp(64px, 9.5vw, 108px)',
                  borderRadius: 20,
                  overflow: 'hidden',
                  display: 'block',
                  border: `1px solid ${T.lineInv2}`,
                  boxShadow: '0 10px 30px -10px rgba(0,0,0,0.75)',
                  transition: 'transform 200ms cubic-bezier(0.32,0.72,0,1)',
                }}>
                  <Image
                    src={`/${emp.name}.jpeg`}
                    alt={`${emp.name}, ${emp.role.replace(/\n/g, ' ')}`}
                    width={136}
                    height={136}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </span>
                <span style={{ display: 'grid', gap: 2, textAlign: 'center' }}>
                  <span style={{
                    fontFamily: FONT.display, fontSize: 'clamp(14px, 1.3vw, 16px)',
                    fontWeight: 600, color: T.inkInv, letterSpacing: '-0.015em',
                  }}>
                    {emp.name}
                  </span>
                  <span style={{
                    fontFamily: FONT.body, fontSize: 'clamp(11.5px, 1.05vw, 12.5px)',
                    color: T.inkInv2, lineHeight: 1.35, opacity: 0.85,
                  }}>
                    {emp.role.replace(/\n/g, ' ').replace(/^The /, '')}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * Quiet ticker strip. No longer used on the home page but kept for inner
 * pages that still want a moving trust line.
 */
export function Marquee({ items, color = T.ink2, bg = T.surface, speed = 60 }: {
  items: string[]; color?: string; bg?: string; speed?: number;
}) {
  const content = [...items, ...items, ...items];
  return (
    <div style={{
      overflow: 'hidden', background: bg,
      borderTop: `1px solid ${T.line}`, borderBottom: `1px solid ${T.line}`,
      padding: '13px 0',
    }}>
      <div
        className="vq-marquee-row"
        style={{ animation: `marquee ${speed}s linear infinite`, fontFamily: FONT.mono, color }}
      >
        {content.map((t, i) => (
          <span key={i}>
            {t}
            <span aria-hidden style={{
              display: 'inline-block', width: 3, height: 3,
              borderRadius: '50%', background: 'currentColor', opacity: 0.4,
            }} />
          </span>
        ))}
      </div>
    </div>
  );
}
