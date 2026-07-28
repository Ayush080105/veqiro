'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { FONT } from './shared';
import {
  consoleUrl,
  isPreLaunch,
  waitlistUrl,
  howItWorksSteps,
  agentPricing,
  enterpriseTier,
  faqItems,
  footerColumns,
  social,
  footerBottom,
  contact,
} from '@/lib/site-config';
import { useBillingCatalog } from '@/lib/use-billing-catalog';
import { EMPLOYEES } from './data';
import { ContactModal } from './contact-modal';

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
  const catalog = useBillingCatalog();
  const priceByAgent: Record<string, number | null> = catalog
    ? Object.fromEntries(Object.entries(catalog.agents).map(([key, value]) => [key.toLowerCase(), Math.round(value.priceCents / 100)]))
    : Object.fromEntries(agentPricing.map(item => [item.key, item.monthly]));

  return (
    <section id="pricing" className="vq-section-pad" style={{ background: '#111', color: '#EFE7D6' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12, color: '#F5C518' }}>
            [ PRICING ]
          </div>
          <h2 style={{ fontFamily: FONT.display, fontSize: 'clamp(48px, 7vw, 96px)', margin: 0, lineHeight: 0.9, letterSpacing: -1 }}>
            less than<br /><span style={{ color: '#F5C518' }}>a bad intern.</span>
          </h2>
          <p style={{ fontFamily: FONT.body, fontSize: 'clamp(15px, 2vw, 18px)', color: '#CFC6B2', marginTop: 20 }}>
            Every agent bills on its own, starting at $9/mo. No bundle required.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, marginBottom: 32 }}>
          {EMPLOYEES.map(emp => (
            <div key={emp.key} style={{
              background: '#1a1a1a', border: `3px solid ${emp.color}`, borderRadius: 14,
              padding: '18px 16px', textAlign: 'center', boxShadow: `4px 4px 0 ${emp.color}`,
            }}>
              <div style={{ fontFamily: FONT.head, fontSize: 18, color: emp.color }}>{emp.name}</div>
              <div style={{ fontFamily: FONT.display, fontSize: 28, marginTop: 8 }}>
                {priceByAgent[emp.key] == null ? '—' : `$${priceByAgent[emp.key]}`}
              </div>
              <div style={{ fontFamily: FONT.mono, fontSize: 10, color: '#888', marginTop: 2 }}>/month</div>
            </div>
          ))}
        </div>

        <div style={{
          background: '#1a1a1a', color: '#EFE7D6',
          border: `3px solid ${enterpriseTier.color}`, borderRadius: 20,
          padding: 'clamp(24px, 5vw, 40px) clamp(20px, 5vw, 36px)',
          boxShadow: `10px 10px 0 ${enterpriseTier.color}`,
          display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontFamily: FONT.head, fontSize: 24 }}>{enterpriseTier.name}</div>
            <div style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.7, marginTop: 4 }}>{enterpriseTier.tag}</div>
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontFamily: FONT.display, fontSize: 'clamp(40px, 8vw, 56px)', lineHeight: 1, color: enterpriseTier.color }}>${enterpriseTier.monthly}+</span>
              <span style={{ fontFamily: FONT.body, fontSize: 15 }}>/month and up</span>
            </div>
          </div>
          <a href={`mailto:${contact.email}?subject=Custom%20Enterprise%20Pricing`} style={{
            display: 'inline-block', textDecoration: 'none',
            background: '#EFE7D6', color: '#111', padding: '16px 26px',
            border: '3px solid #111', borderRadius: 12, boxShadow: `5px 5px 0 ${enterpriseTier.color}`,
            fontFamily: FONT.head, fontSize: 14, textTransform: 'uppercase', letterSpacing: 1,
          } as React.CSSProperties}>Talk to sales →</a>
        </div>

        <p style={{ textAlign: 'center', fontFamily: FONT.mono, fontSize: 13, marginTop: 32, color: '#EFE7D6', opacity: 0.8 }}>
          Want the whole team?{' '}
          <Link href="/pricing" style={{ color: '#F5C518', textDecoration: 'underline', textUnderlineOffset: 3 }}>
            See every agent →
          </Link>
        </p>
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
  const [isContactOpen, setIsContactOpen] = useState(false);
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
          <a href={isPreLaunch ? waitlistUrl : `${consoleUrl}/signup`} style={{
            background: '#111', color: '#F5C518', padding: 'clamp(14px, 2.5vw, 20px) clamp(24px, 5vw, 40px)',
            fontFamily: FONT.head, fontSize: 'clamp(14px, 2vw, 18px)', textTransform: 'uppercase', letterSpacing: 1,
            textDecoration: 'none', border: '3px solid #111', borderRadius: 12, boxShadow: '8px 8px 0 #EFE7D6',
          }}>{isPreLaunch ? 'Save my spot →' : 'Hire the crew →'}</a>
          <button onClick={() => setIsContactOpen(true)} style={{
            background: 'transparent', color: '#111', padding: 'clamp(14px, 2.5vw, 20px) clamp(24px, 5vw, 40px)',
            fontFamily: FONT.head, fontSize: 'clamp(14px, 2vw, 18px)', textTransform: 'uppercase', letterSpacing: 1,
            border: '3px solid #111', borderRadius: 12, cursor: 'pointer',
          }}>Contact us</button>
        </div>
      </div>
      <ContactModal open={isContactOpen} onClose={() => setIsContactOpen(false)} />
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
          gap: 20,
        }}>
          <div style={{ fontFamily: FONT.mono, fontSize: 12, color: '#555' }}>
            {footerBottom.copyright}
          </div>
          <a
            href="https://openhunts.com"
            target="_blank"
            rel="noopener noreferrer"
            title="OpenHunts Club"
            style={{ display: 'inline-flex', flexShrink: 0 }}
          >
            <img
              alt="OpenHunts Club Member"
              height="105"
              src="https://cdn.openhunts.com/badges/club.webp"
              style={{ width: '195px', height: 'auto' }}
              width="486"
            />
          </a>
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
