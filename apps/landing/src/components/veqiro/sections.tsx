'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { FONT } from './shared';
import {
  mainAppUrl,
  demoCtaHref,
  howItWorksSteps,
  pricingTiers,
  faqItems,
  footerColumns,
  social,
  footerBottom,
} from '@/lib/site-config';

export function HowItWorks() {
  return (
    <section id="how" className="vq-section-pad" style={{ background: '#EFE7D6', borderTop: '3px solid #111' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 'clamp(40px, 6vw, 64px)' }}>
          <div style={{ fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12, color: '#666' }}>
            [ HOW IT WORKS ]
          </div>
          <h2 style={{ fontFamily: FONT.display, fontSize: 'clamp(48px, 7vw, 96px)', margin: 0, lineHeight: 0.9, letterSpacing: -1 }}>
            onboarding takes<br />
            <span style={{ background: '#F79FD4', padding: '0 16px', display: 'inline-block', transform: 'rotate(-2deg)', border: '3px solid #111', borderRadius: 8, boxShadow: '4px 4px 0 #111' }}>
              nine minutes.
            </span>
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
          {howItWorksSteps.map((s, i) => (
            <div key={s.n} style={{
              background: '#fff', border: '3px solid #111', borderRadius: 14,
              padding: 'clamp(24px, 4vw, 32px) clamp(20px, 4vw, 28px)',
              boxShadow: '8px 8px 0 #111', transform: `rotate(${i % 2 === 0 ? -1 : 1}deg)`, position: 'relative',
            }}>
              <div style={{
                position: 'absolute', top: -18, left: 'clamp(-14px, 0vw, -18px)',
                width: 56, height: 56, background: s.c,
                border: '3px solid #111', borderRadius: '50%', display: 'grid', placeItems: 'center',
                fontFamily: FONT.display, fontSize: 20, boxShadow: '3px 3px 0 #111',
              }}>{s.n}</div>
              <h3 style={{ fontFamily: FONT.head, fontSize: 'clamp(20px, 3vw, 26px)', margin: '8px 0 12px' }}>{s.t}</h3>
              <p style={{ fontFamily: FONT.body, fontSize: 'clamp(14px, 2vw, 16px)', lineHeight: 1.5, color: '#333', margin: 0 }}>{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Pricing() {
  const [yearly, setYearly] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'out' | 'in'>('idle');
  const p = pricingTiers[0];
  const price = yearly ? p.yearly : p.monthly;

  // Monthly: red card, yellow shadow/badge
  // Yearly:  yellow card, red shadow/badge
  const cardBg    = yearly ? '#F5C518' : '#F06464';
  const shadowClr = yearly ? '#F06464' : '#F5C518';
  const badgeBg   = yearly ? '#F06464' : '#F5C518';
  const badgeTxt  = yearly ? '#EFE7D6' : '#111';

  const handleToggle = (toYearly: boolean) => {
    if (toYearly === yearly || phase !== 'idle') return;
    setPhase('out');
    setTimeout(() => { setYearly(toYearly); setPhase('in'); }, 280);
    setTimeout(() => { setPhase('idle'); }, 560);
  };

  const cardTransform = phase === 'out' ? 'perspective(900px) rotateY(90deg) scale(0.95)' : 'perspective(900px) rotateY(0deg) scale(1)';
  const cardTransition = phase === 'out' ? 'transform 280ms ease-in' : 'transform 280ms ease-out';

  return (
    <section id="pricing" className="vq-section-pad" style={{ background: '#111', color: '#EFE7D6' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12, color: '#F5C518' }}>
            [ PRICING ]
          </div>
          <h2 style={{ fontFamily: FONT.display, fontSize: 'clamp(48px, 7vw, 96px)', margin: 0, lineHeight: 0.9, letterSpacing: -1 }}>
            less than<br /><span style={{ color: '#F5C518' }}>a bad intern.</span>
          </h2>
          <div style={{ display: 'inline-flex', marginTop: 28, background: '#EFE7D6', borderRadius: 999, padding: 4, border: '3px solid #EFE7D6' }}>
            {['Monthly', 'Yearly · save 25%'].map((l, i) => (
              <button key={l} onClick={() => handleToggle(i === 1)} style={{
                background: (yearly ? 1 : 0) === i ? '#111' : 'transparent',
                color: (yearly ? 1 : 0) === i ? '#EFE7D6' : '#111',
                border: 'none', borderRadius: 999, padding: '10px 20px',
                fontFamily: FONT.head, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, cursor: 'pointer',
                transition: 'background 200ms, color 200ms',
              }}>{l}</button>
            ))}
          </div>
        </div>

        <div style={{
          background: cardBg, color: '#111',
          border: '3px solid #EFE7D6', borderRadius: 20,
          padding: 'clamp(24px, 5vw, 40px) clamp(20px, 5vw, 36px)',
          position: 'relative', boxShadow: `10px 10px 0 ${shadowClr}`,
          transform: cardTransform, transition: cardTransition,
          willChange: 'transform',
        }}>
          <div style={{
            position: 'absolute', top: -14, right: 24,
            background: badgeBg, color: badgeTxt,
            border: '3px solid #111', borderRadius: 999, padding: '4px 14px',
            fontFamily: FONT.head, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase',
            transform: 'rotate(4deg)', boxShadow: '3px 3px 0 #111',
          }}>most hired ✦</div>

          <div style={{ fontFamily: FONT.head, fontSize: 28 }}>{p.name}</div>
          <div style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.7, marginTop: 4 }}>{p.tag}</div>

          <div style={{ marginTop: 24, display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: FONT.display, fontSize: 'clamp(56px, 14vw, 88px)', lineHeight: 1 }}>${price}</span>
            <span style={{ fontFamily: FONT.body, fontSize: 'clamp(15px, 2vw, 18px)' }}>/{yearly ? 'mo, billed yearly' : 'month'}</span>
          </div>

          <ul style={{ listStyle: 'none', padding: 0, margin: '28px 0', display: 'grid', gap: 12 }}>
            {p.includes.map(it => (
              <li key={it} style={{ fontFamily: FONT.body, fontSize: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 22, height: 22, background: '#111', color: cardBg, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 12, fontFamily: FONT.head, flexShrink: 0 }}>✓</span>
                {it}
              </li>
            ))}
          </ul>

          <a href={`${mainAppUrl}/signup`} style={{
            display: 'block', textAlign: 'center', textDecoration: 'none',
            background: '#111', color: '#EFE7D6', padding: '16px',
            border: '3px solid #111', borderRadius: 12, boxShadow: '5px 5px 0 #111',
            fontFamily: FONT.head, fontSize: 14, textTransform: 'uppercase', letterSpacing: 1,
          }}>Start hiring — free 7 days →</a>

          <p style={{ textAlign: 'center', fontFamily: FONT.mono, fontSize: 12, opacity: 0.65, marginTop: 16, marginBottom: 0 }}>
            No credit card needed · Cancel anytime
          </p>
        </div>
      </div>
    </section>
  );
}

export function FAQ() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="vq-section-pad" style={{ background: '#EFE7D6' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <div style={{ marginBottom: 'clamp(32px, 5vw, 48px)' }}>
          <div style={{ fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12, color: '#666' }}>
            [ FAQ ]
          </div>
          <h2 style={{ fontFamily: FONT.display, fontSize: 'clamp(48px, 7vw, 88px)', margin: 0, lineHeight: 0.9, letterSpacing: -1 }}>
            questions you&apos;re<br />too cool to ask.
          </h2>
        </div>
        <div style={{ display: 'grid', gap: 16 }}>
          {faqItems.map((it, i) => {
            const isOpen = open === i;
            return (
              <div key={i} onClick={() => setOpen(isOpen ? -1 : i)} style={{
                background: '#fff', border: '3px solid #111', borderRadius: 14,
                padding: 'clamp(16px, 3vw, 20px) clamp(18px, 3vw, 24px)',
                cursor: 'pointer', boxShadow: isOpen ? '8px 8px 0 #F06464' : '4px 4px 0 #111', transition: 'box-shadow 180ms',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontFamily: FONT.head, fontSize: 'clamp(15px, 2.4vw, 20px)' }}>{it.q}</div>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    background: isOpen ? '#F06464' : '#EFE7D6', border: '2.5px solid #111',
                    display: 'grid', placeItems: 'center', fontFamily: FONT.display, fontSize: 20,
                    transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)', transition: 'transform 200ms, background 200ms',
                  }}>+</div>
                </div>
                {isOpen && (
                  <div style={{ fontFamily: FONT.body, fontSize: 'clamp(14px, 2vw, 16px)', lineHeight: 1.6, color: '#333', marginTop: 14, paddingRight: 'clamp(8px, 3vw, 40px)' }}>
                    {it.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function FinalCTA() {
  return (
    <section id="hire" style={{ padding: 'clamp(72px, 11vw, 120px) clamp(20px, 4vw, 32px)', background: '#F5C518', borderTop: '3px solid #111', borderBottom: '3px solid #111', position: 'relative', overflow: 'hidden' }}>
      <div aria-hidden style={{
        position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
        fontFamily: FONT.display, fontSize: '38vw', color: '#111',
        opacity: 0.06, lineHeight: 1, userSelect: 'none', pointerEvents: 'none',
      }}>hire</div>
      <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
        <h2 style={{ fontFamily: FONT.display, fontSize: 'clamp(56px, 9vw, 144px)', margin: 0, lineHeight: 0.88, letterSpacing: -2 }}>
          your new team<br />is waiting.
        </h2>
        <p style={{ fontFamily: FONT.body, fontSize: 'clamp(15px, 2.2vw, 20px)', marginTop: 24, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto' }}>
          Seven days free. No credit card. No weird onboarding call. Just the work.
        </p>
        <div style={{ marginTop: 36, display: 'flex', gap: 'clamp(10px, 2vw, 16px)', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href={`${mainAppUrl}/signup`} style={{
            background: '#111', color: '#F5C518', padding: 'clamp(14px, 2.5vw, 20px) clamp(24px, 5vw, 40px)',
            fontFamily: FONT.head, fontSize: 'clamp(14px, 2vw, 18px)', textTransform: 'uppercase', letterSpacing: 1,
            textDecoration: 'none', border: '3px solid #111', borderRadius: 12, boxShadow: '8px 8px 0 #EFE7D6',
          }}>Hire the crew →</a>
          <a href={demoCtaHref} style={{
            background: 'transparent', color: '#111', padding: 'clamp(14px, 2.5vw, 20px) clamp(24px, 5vw, 40px)',
            fontFamily: FONT.head, fontSize: 'clamp(14px, 2vw, 18px)', textTransform: 'uppercase', letterSpacing: 1,
            textDecoration: 'none', border: '3px solid #111', borderRadius: 12,
          }}>Book a demo</a>
        </div>
      </div>
    </section>
  );
}

const iconProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'currentColor',
  'aria-hidden': true as const,
};

const SOCIAL_LINKS: { label: string; href: string; icon: React.ReactNode }[] = [
  {
    label: 'Twitter / X',
    href: social.twitter,
    icon: (
      <svg {...iconProps}>
        <path d="M18.244 2H21.5l-7.5 8.57L23 22h-6.828l-5.348-6.99L4.7 22H1.44l8.03-9.18L1 2h7l4.83 6.38L18.244 2Zm-2.39 18h1.88L7.25 4H5.24l10.614 16Z" />
      </svg>
    ),
  },
  {
    label: 'LinkedIn',
    href: social.linkedin,
    icon: (
      <svg {...iconProps}>
        <path d="M19 3A2 2 0 0 1 21 5v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14ZM8.34 18.34v-7.96H5.67v7.96h2.67Zm-1.34-9.1a1.55 1.55 0 1 0 0-3.1 1.55 1.55 0 0 0 0 3.1ZM18.34 18.34v-4.36c0-2.38-1.27-3.49-2.97-3.49-1.37 0-1.98.76-2.33 1.29v-1.1h-2.67c.04.75 0 7.96 0 7.96h2.67v-4.45c0-.24.02-.48.09-.65.19-.48.63-.98 1.37-.98.97 0 1.36.74 1.36 1.82v4.26h2.48Z" />
      </svg>
    ),
  },
  {
    label: 'Instagram',
    href: social.instagram,
    icon: (
      <svg {...iconProps}>
        <path d="M12 2c2.72 0 3.05.01 4.12.06 1.06.05 1.79.22 2.43.47a4.9 4.9 0 0 1 1.77 1.15 4.9 4.9 0 0 1 1.15 1.77c.25.64.42 1.37.47 2.43C21.99 8.95 22 9.28 22 12s-.01 3.05-.06 4.12c-.05 1.06-.22 1.79-.47 2.43a4.9 4.9 0 0 1-1.15 1.77 4.9 4.9 0 0 1-1.77 1.15c-.64.25-1.37.42-2.43.47-1.07.05-1.4.06-4.12.06s-3.05-.01-4.12-.06c-1.06-.05-1.79-.22-2.43-.47a4.9 4.9 0 0 1-1.77-1.15 4.9 4.9 0 0 1-1.15-1.77c-.25-.64-.42-1.37-.47-2.43C2.01 15.05 2 14.72 2 12s.01-3.05.06-4.12c.05-1.06.22-1.79.47-2.43a4.9 4.9 0 0 1 1.15-1.77A4.9 4.9 0 0 1 5.45 2.53c.64-.25 1.37-.42 2.43-.47C8.95 2.01 9.28 2 12 2Zm0 1.8c-2.67 0-2.99.01-4.04.06-.98.04-1.51.2-1.86.34-.47.18-.8.4-1.15.75-.35.35-.57.68-.75 1.15-.14.35-.3.88-.34 1.86-.05 1.05-.06 1.37-.06 4.04s.01 2.99.06 4.04c.04.98.2 1.51.34 1.86.18.47.4.8.75 1.15.35.35.68.57 1.15.75.35.14.88.3 1.86.34 1.05.05 1.37.06 4.04.06s2.99-.01 4.04-.06c.98-.04 1.51-.2 1.86-.34.47-.18.8-.4 1.15-.75.35-.35.57-.68.75-1.15.14-.35.3-.88.34-1.86.05-1.05.06-1.37.06-4.04s-.01-2.99-.06-4.04c-.04-.98-.2-1.51-.34-1.86a3.1 3.1 0 0 0-.75-1.15 3.1 3.1 0 0 0-1.15-.75c-.35-.14-.88-.3-1.86-.34-1.05-.05-1.37-.06-4.04-.06Zm0 3.06a5.14 5.14 0 1 1 0 10.28 5.14 5.14 0 0 1 0-10.28Zm0 1.8a3.34 3.34 0 1 0 0 6.68 3.34 3.34 0 0 0 0-6.68Zm5.35-2.95a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Z" />
      </svg>
    ),
  },
  {
    label: 'GitHub',
    href: social.github,
    icon: (
      <svg {...iconProps}>
        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.48 2 2 6.58 2 12.24c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-.88-.01-1.72-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.9-.63.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.67.35-1.11.63-1.37-2.22-.26-4.55-1.14-4.55-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05a9.3 9.3 0 0 1 2.5-.34c.85.01 1.7.12 2.5.34 1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.82 0 .27.18.59.69.49A10.06 10.06 0 0 0 22 12.24C22 6.58 17.52 2 12 2Z" />
      </svg>
    ),
  },
];

export function Footer() {
  return (
    <footer style={{ background: '#111', color: '#EFE7D6', padding: 'clamp(48px, 8vw, 72px) clamp(20px, 4vw, 32px) 36px' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>

        {/* Top grid: brand + columns */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 'clamp(24px, 4vw, 40px)',
          marginBottom: 'clamp(36px, 6vw, 56px)',
        }}>
          {/* Brand */}
          <div>
            <Link href="/" style={{ textDecoration: 'none' }}>
              <div style={{ fontFamily: FONT.display, fontSize: 'clamp(28px, 5vw, 40px)', color: '#EFE7D6', lineHeight: 1 }}>veqiro</div>
            </Link>
            <p style={{ fontFamily: FONT.body, fontSize: 14, marginTop: 14, color: '#CFC6B2', lineHeight: 1.65, maxWidth: 200 }}>
              AI employees that do real work. Made in a small room, loud.
            </p>
            {/* Social icons */}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              {SOCIAL_LINKS.map(s => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    border: '2px solid #333',
                    display: 'grid',
                    placeItems: 'center',
                    color: '#CFC6B2',
                    textDecoration: 'none',
                    transition: 'border-color 150ms, color 150ms, background 150ms, transform 150ms',
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLAnchorElement;
                    el.style.borderColor = '#F5C518';
                    el.style.color = '#111';
                    el.style.background = '#F5C518';
                    el.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLAnchorElement;
                    el.style.borderColor = '#333';
                    el.style.color = '#CFC6B2';
                    el.style.background = 'transparent';
                    el.style.transform = 'translateY(0)';
                  }}
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {footerColumns.map(col => (
            <div key={col.h}>
              <div style={{
                fontFamily: FONT.head,
                fontSize: 11,
                textTransform: 'uppercase' as const,
                letterSpacing: 2,
                color: '#F5C518',
                marginBottom: 18,
              }}>
                {col.h}
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
                {col.links.map(link => {
                  const isInternal = link.href.startsWith('/') || link.href.startsWith('#');
                  const linkStyle: React.CSSProperties = {
                    color: '#AAA',
                    textDecoration: 'none',
                    fontFamily: FONT.body,
                    fontSize: 14,
                    lineHeight: 1,
                    transition: 'color 120ms',
                  };
                  return (
                    <li key={link.label}>
                      {isInternal ? (
                        <Link
                          href={link.href}
                          style={linkStyle}
                          onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.color = '#EFE7D6')}
                          onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.color = '#AAA')}
                        >
                          {link.label}
                        </Link>
                      ) : (
                        <a
                          href={link.href}
                          style={linkStyle}
                          onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.color = '#EFE7D6')}
                          onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.color = '#AAA')}
                        >
                          {link.label}
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div style={{
          paddingTop: 24,
          borderTop: '1px solid #2a2a2a',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <div style={{ fontFamily: FONT.mono, fontSize: 12, color: '#555' }}>
            {footerBottom.copyright}
          </div>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <Link href="/privacy" style={{ fontFamily: FONT.mono, fontSize: 11, color: '#555', textDecoration: 'none' }}>
              Privacy
            </Link>
            <span style={{ color: '#333' }}>·</span>
            <Link href="/terms" style={{ fontFamily: FONT.mono, fontSize: 11, color: '#555', textDecoration: 'none' }}>
              Terms
            </Link>
          </div>
        </div>

      </div>
    </footer>
  );
}
