'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { FONT, T, SectionHead } from './shared';
import { BrandMark } from './brand-mark';
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

/* ──────────────────────────────────────────────────────────────
   How it works
   ────────────────────────────────────────────────────────────── */

export function HowItWorks() {
  return (
    <section id="how" className="vq-section-pad" style={{ background: T.bg, borderTop: `1px solid ${T.line}` }}>
      <div className="vq-shell">
        <SectionHead
          eyebrow="How it works"
          title="Running work in under ten minutes"
          lede="No implementation project, no solutions engineer, no six-week onboarding. Three steps, once."
        />

        <ol style={{
          marginTop: 'clamp(40px, 5vw, 64px)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))',
          gap: 'clamp(20px, 3vw, 40px)',
          listStyle: 'none',
          padding: 0,
        }}>
          {howItWorksSteps.map(step => (
            <li key={step.n} style={{ borderTop: `2px solid ${step.c}`, paddingTop: 20 }}>
              <div style={{
                fontFamily: FONT.mono, fontSize: 11, letterSpacing: '0.14em',
                color: T.ink3, marginBottom: 12,
              }}>
                {step.n}
              </div>
              <h3 style={{
                fontFamily: FONT.display, fontSize: 'clamp(19px, 2.1vw, 23px)',
                fontWeight: 600, letterSpacing: '-0.025em', color: T.ink, margin: '0 0 10px',
              }}>
                {step.t}
              </h3>
              <p style={{
                fontFamily: FONT.body, fontSize: 15, lineHeight: 1.65,
                color: T.ink2, margin: 0,
              }}>
                {step.d}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────
   Pricing
   ────────────────────────────────────────────────────────────── */

export function Pricing() {
  const catalog = useBillingCatalog();
  const priceByAgent: Record<string, number | null> = catalog
    ? Object.fromEntries(Object.entries(catalog.agents).map(([key, value]) => [key.toLowerCase(), Math.round(value.priceCents / 100)]))
    : Object.fromEntries(agentPricing.map(item => [item.key, item.monthly]));

  return (
    <section id="pricing" className="vq-section-pad" style={{ background: T.bg, borderTop: `1px solid ${T.line}` }}>
      <div className="vq-shell">
        <SectionHead
          center
          eyebrow="Pricing"
          title="Pay for the agents you actually use"
          lede="Every agent is billed independently. Start with one, add others when the workload calls for it, and cancel any of them without touching the rest."
        />

        {/* Per-agent grid */}
        <div style={{
          marginTop: 'clamp(40px, 5vw, 56px)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 1,
          background: T.line,
          border: `1px solid ${T.line}`,
          borderRadius: 18,
          overflow: 'hidden',
        }}>
          {EMPLOYEES.map(emp => (
            <Link
              key={emp.key}
              href={`/agents/${emp.key}`}
              style={{
                background: T.surface,
                padding: 'clamp(20px, 2.6vw, 26px)',
                textDecoration: 'none',
                display: 'grid',
                gap: 6,
                transition: 'background 150ms ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = T.surface2)}
              onMouseLeave={e => (e.currentTarget.style.background = T.surface)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span aria-hidden style={{
                  width: 7, height: 7, borderRadius: 2, background: emp.color, flexShrink: 0,
                }} />
                <span style={{
                  fontFamily: FONT.display, fontSize: 16, fontWeight: 600,
                  letterSpacing: '-0.02em', color: T.ink,
                }}>
                  {emp.name}
                </span>
              </div>

              <div style={{
                fontFamily: FONT.body, fontSize: 12.5, color: T.ink3,
                lineHeight: 1.4, minHeight: '2.8em',
              }}>
                {emp.role.replace(/\n/g, ' ')}
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
                <span style={{
                  fontFamily: FONT.display, fontSize: 30, fontWeight: 600,
                  letterSpacing: '-0.035em', color: T.ink, lineHeight: 1,
                }}>
                  {priceByAgent[emp.key] == null ? '—' : `$${priceByAgent[emp.key]}`}
                </span>
                <span style={{ fontFamily: FONT.body, fontSize: 13, color: T.ink3 }}>/mo</span>
              </div>
            </Link>
          ))}
        </div>

        {/* Enterprise */}
        <div style={{
          marginTop: 20,
          background: T.dark,
          color: T.inkInv,
          borderRadius: 18,
          padding: 'clamp(26px, 4vw, 40px)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 28,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ maxWidth: '46ch' }}>
            <div style={{
              fontFamily: FONT.display, fontSize: 'clamp(20px, 2.4vw, 26px)',
              fontWeight: 600, letterSpacing: '-0.028em',
            }}>
              {enterpriseTier.name}
            </div>
            <p style={{
              fontFamily: FONT.body, fontSize: 15, lineHeight: 1.65,
              color: T.inkInv2, margin: '10px 0 0',
            }}>
              {enterpriseTier.tag} — custom SLAs, dedicated onboarding, bespoke
              integrations, and volume pricing.
            </p>
          </div>
          <a
            href={`mailto:${contact.email}?subject=Custom%20Enterprise%20Pricing`}
            style={{
              background: T.inkInv, color: T.ink,
              padding: '13px 24px', borderRadius: 10,
              fontFamily: FONT.body, fontSize: 15, fontWeight: 500,
              textDecoration: 'none', whiteSpace: 'nowrap',
              transition: 'opacity 140ms ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            Talk to sales
          </a>
        </div>

        <p style={{
          textAlign: 'center', marginTop: 24,
          fontFamily: FONT.body, fontSize: 14.5, color: T.ink2,
        }}>
          Seven-day free trial on every agent, no card required.{' '}
          <Link href="/pricing" style={{ color: T.ink, textDecoration: 'underline', textUnderlineOffset: 3 }}>
            Full pricing details
          </Link>
        </p>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────
   FAQ
   ────────────────────────────────────────────────────────────── */

export function FAQ() {
  const [open, setOpen] = useState<number>(0);

  return (
    <section id="faq" className="vq-section-pad" style={{ background: T.bg, borderTop: `1px solid ${T.line}` }}>
      <div className="vq-shell" style={{ maxWidth: 880 }}>
        <SectionHead
          eyebrow="FAQ"
          title="Questions worth asking before you buy"
        />

        <div style={{ marginTop: 'clamp(32px, 4vw, 48px)', borderTop: `1px solid ${T.line}` }}>
          {faqItems.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={i} style={{ borderBottom: `1px solid ${T.line}` }}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  aria-expanded={isOpen}
                  style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 20,
                    padding: '22px 0',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{
                    fontFamily: FONT.display,
                    fontSize: 'clamp(16px, 1.9vw, 19px)',
                    fontWeight: 550,
                    letterSpacing: '-0.02em',
                    color: T.ink,
                    lineHeight: 1.4,
                  }}>
                    {item.q}
                  </span>
                  <span
                    aria-hidden
                    style={{
                      flexShrink: 0,
                      color: T.ink3,
                      transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
                      transition: 'transform 220ms cubic-bezier(0.32,0.72,0,1)',
                      marginTop: 2,
                    }}
                  >
                    <Plus size={18} strokeWidth={1.75} />
                  </span>
                </button>

                {isOpen && (
                  <p style={{
                    fontFamily: FONT.body,
                    fontSize: 'clamp(14.5px, 1.6vw, 16px)',
                    lineHeight: 1.7,
                    color: T.ink2,
                    margin: '0 0 24px',
                    maxWidth: '68ch',
                    paddingRight: 40,
                    animation: 'pop 200ms ease',
                  }}>
                    {item.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────
   Final CTA
   ────────────────────────────────────────────────────────────── */

export function FinalCTA() {
  const [isContactOpen, setIsContactOpen] = useState(false);

  return (
    <section
      id="hire"
      style={{
        position: 'relative',
        background: T.dark,
        color: T.inkInv,
        padding: 'clamp(72px, 10vw, 128px) var(--vq-gutter)',
        overflow: 'hidden',
        isolation: 'isolate',
      }}
    >
      {/* A warm glow anchored to the amber accent, rather than a photo — the
          hero already carries the imagery and a second scrimmed photo muddied it. */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0, zIndex: -1,
        background: 'radial-gradient(120% 90% at 50% 0%, rgba(245,197,24,0.16), transparent 62%)',
      }} />

      <div className="vq-shell" style={{ textAlign: 'center', maxWidth: 760 }}>
        <h2 style={{
          fontFamily: FONT.display,
          fontSize: 'clamp(30px, 5vw, 56px)',
          fontWeight: 600,
          letterSpacing: '-0.035em',
          lineHeight: 1.05,
          margin: 0,
          color: T.inkInv,
        }}>
          Your next six hires start today
        </h2>

        <p style={{
          fontFamily: FONT.body,
          fontSize: 'clamp(16px, 1.8vw, 18.5px)',
          lineHeight: 1.65,
          color: T.inkInv2,
          margin: '20px auto 0',
          maxWidth: '54ch',
        }}>
          Seven days free on every agent. No credit card, no onboarding call —
          connect a tool and give one of them something to do.
        </p>

        <div style={{
          display: 'flex', gap: 12, justifyContent: 'center',
          flexWrap: 'wrap', marginTop: 34,
        }}>
          <a
            href={isPreLaunch ? waitlistUrl : `${consoleUrl}/signup`}
            style={{
              background: T.inkInv, color: T.ink,
              padding: '14px 28px', borderRadius: 11,
              fontFamily: FONT.body, fontSize: 15, fontWeight: 550,
              textDecoration: 'none', transition: 'opacity 140ms ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            {isPreLaunch ? 'Join the waitlist' : 'Start free — 7 days'}
          </a>
          <button
            type="button"
            onClick={() => setIsContactOpen(true)}
            style={{
              background: 'rgba(242,236,224,0.07)',
              color: T.inkInv,
              border: `1px solid ${T.lineInv2}`,
              padding: '14px 28px', borderRadius: 11,
              fontFamily: FONT.body, fontSize: 15, fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 140ms ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(242,236,224,0.13)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(242,236,224,0.07)')}
          >
            Talk to us
          </button>
        </div>
      </div>

      <ContactModal open={isContactOpen} onClose={() => setIsContactOpen(false)} />
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────
   Footer
   ────────────────────────────────────────────────────────────── */

const iconProps = {
  width: 15,
  height: 15,
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
    <footer style={{
      background: T.bg,
      borderTop: `1px solid ${T.line}`,
      padding: 'clamp(48px, 6vw, 72px) var(--vq-gutter) 32px',
    }}>
      <div className="vq-shell" style={{ padding: 0 }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(200px, 1.4fr) repeat(auto-fit, minmax(140px, 1fr))',
          gap: 'clamp(28px, 4vw, 48px)',
          marginBottom: 'clamp(40px, 5vw, 56px)',
        }}>
          {/* Brand */}
          <div>
            <Link href="/" style={{ textDecoration: 'none', display: 'inline-block' }}>
              <BrandMark size={24} />
            </Link>
            <p style={{
              fontFamily: FONT.body, fontSize: 14, lineHeight: 1.65,
              color: T.ink2, margin: '16px 0 0', maxWidth: 260,
            }}>
              Six AI employees that share one company brain and work inside the
              tools your team already uses.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              {SOCIAL_LINKS.map(s => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  style={{
                    width: 32, height: 32, borderRadius: 8,
                    border: `1px solid ${T.line2}`,
                    display: 'grid', placeItems: 'center',
                    color: T.ink2, textDecoration: 'none',
                    transition: 'background 150ms ease, color 150ms ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = T.ink;
                    e.currentTarget.style.color = T.inkInv;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = T.ink2;
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
                fontFamily: FONT.mono, fontSize: 10.5, letterSpacing: '0.14em',
                textTransform: 'uppercase', color: T.ink3, marginBottom: 16,
              }}>
                {col.h}
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
                {col.links.map(link => {
                  const isInternal = link.href.startsWith('/') || link.href.startsWith('#');
                  const linkStyle: React.CSSProperties = {
                    color: T.ink2,
                    textDecoration: 'none',
                    fontFamily: FONT.body,
                    fontSize: 14,
                    lineHeight: 1.4,
                    transition: 'color 120ms',
                  };
                  const hover = (e: React.MouseEvent<HTMLAnchorElement>, on: boolean) => {
                    e.currentTarget.style.color = on ? T.ink : T.ink2;
                  };
                  return (
                    <li key={link.label}>
                      {isInternal ? (
                        <Link
                          href={link.href}
                          style={linkStyle}
                          onMouseEnter={e => hover(e, true)}
                          onMouseLeave={e => hover(e, false)}
                        >
                          {link.label}
                        </Link>
                      ) : (
                        <a
                          href={link.href}
                          style={linkStyle}
                          onMouseEnter={e => hover(e, true)}
                          onMouseLeave={e => hover(e, false)}
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
          borderTop: `1px solid ${T.line}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 20,
        }}>
          <div style={{ fontFamily: FONT.body, fontSize: 13, color: T.ink3 }}>
            {footerBottom.copyright}
          </div>

          <a
            href="https://openhunts.com"
            target="_blank"
            rel="noopener noreferrer"
            title="OpenHunts Club"
            style={{ display: 'inline-flex', flexShrink: 0, opacity: 0.75 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- external badge host */}
            <img
              alt="OpenHunts Club Member"
              height="105"
              src="https://cdn.openhunts.com/badges/club.webp"
              style={{ width: '150px', height: 'auto' }}
              width="486"
            />
          </a>

          <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
            <Link href="/privacy" style={{ fontFamily: FONT.body, fontSize: 13, color: T.ink3, textDecoration: 'none' }}>
              Privacy
            </Link>
            <Link href="/terms" style={{ fontFamily: FONT.body, fontSize: 13, color: T.ink3, textDecoration: 'none' }}>
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
