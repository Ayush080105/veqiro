'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { PageNav } from '@/components/veqiro/page-nav';
import { Footer } from '@/components/veqiro/sections';
import { FONT, Button } from '@/components/veqiro/shared';
import { agentPricing, enterpriseTier, consoleUrl, isPreLaunch, waitlistUrl, contact, PRICING_FAQ } from '@/lib/site-config';
import { useBillingCatalog } from '@/lib/use-billing-catalog';
import { EMPLOYEES } from '@/components/veqiro/data';
import { CHARACTER_COMPONENTS } from '@/components/veqiro/characters';
import { ContactModal } from '@/components/veqiro/contact-modal';

const AGENT_BLURBS: Record<string, string> = {
  vega:  'Inbox, calendar, briefings',
  scout: 'Research, leads, intel',
  maya:  'Content, copy, campaigns',
  sage:  'SEO, blogs, rankings',
  lex:   'Contracts, compliance, NDAs',
  rex:   'Finance, metrics, forecasts',
};

// Every blurb is exactly 3 comma-separated words, but at this card width some
// wrap after 2 words and some don't (depends on word length) — forcing the
// break after the 2nd word keeps every card the same height in a row.
function TwoLineBlurb({ text }: { text: string }) {
  const words = text.split(', ');
  return (
    <>
      {words.slice(0, 2).join(', ')},<br />
      {words.slice(2).join(', ')}
    </>
  );
}

const FEATURES = [
  { title: 'All 6 AI Employees', desc: 'Vega, Scout, Maya, Sage, Lex, and Rex — fully specialized, ready to work.', color: '#F5C518' },
  { title: 'Shared Brain', desc: 'One company profile. All agents read your brand voice, competitors, and goals.', color: '#6FCDE8' },
  { title: 'Custom Brand Voice', desc: '6 presets or fully custom — your agents write like you, not like a template.', color: '#F06464' },
  { title: 'Priority Processing', desc: "Your tasks don't wait in a queue. You get dedicated compute from day one.", color: '#1DBC87' },
  { title: 'Integrations', desc: 'Gmail, Google Calendar, LinkedIn, Twitter/X, Instagram, and more.', color: '#F79FD4' },
  { title: 'No Per-Task Fees', desc: "Assign as much work as you want. Maya's image/video generation draws from a monthly credit allowance — every other agent has none at all.", color: '#8A8AF0' },
];

// Fallback only, for the brief window before /billing/catalog resolves.
const STATIC_PRICE_BY_AGENT = Object.fromEntries(agentPricing.map(item => [item.key, item.monthly])) as Record<string, number | null>;

export default function PricingPageContent() {
  // Real prices come from the server catalog; site-config's hardcoded
  // numbers are only the fallback shown until the fetch resolves.
  const catalog = useBillingCatalog();
  const priceByAgent: Record<string, number | null> = catalog
    ? Object.fromEntries(Object.entries(catalog.agents).map(([key, value]) => [key.toLowerCase(), Math.round(value.priceCents / 100)]))
    : STATIC_PRICE_BY_AGENT;
  const [isContactOpen, setIsContactOpen] = useState(false);

  return (
    <div style={{ background: '#EFE7D6', minHeight: '100vh' }}>
      <PageNav />

      {/* ── HERO ── */}
      <section className="vq-section-pad" style={{
        borderTop: '3px solid #111',
        borderBottom: '3px solid #111',
        background: '#111',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{
            fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3,
            textTransform: 'uppercase', color: '#F5C518', marginBottom: 16,
          }}>
            [ PRICING ]
          </div>
          <h1 style={{
            fontFamily: FONT.display, fontSize: 'clamp(52px, 8vw, 112px)',
            margin: 0, lineHeight: 0.9, letterSpacing: -2, color: '#EFE7D6',
          }}>
            less than<br />
            <span style={{ color: '#F5C518' }}>a bad hire.</span>
          </h1>
          <p style={{
            fontFamily: FONT.body, fontSize: 'clamp(15px, 2.2vw, 18px)', color: '#CFC6B2',
            marginTop: 28, lineHeight: 1.6,
          }}>
            Six AI employees with real specialties. Hire them one at a time.
            No payroll. No HR drama. No sick days.
          </p>
          <p style={{
            fontFamily: FONT.body, fontSize: 'clamp(13px, 1.8vw, 15px)', color: '#888',
            marginTop: 14, lineHeight: 1.6, maxWidth: 620, marginLeft: 'auto', marginRight: 'auto',
          }}>
            Veqiro pricing is simple: every AI employee bills independently, starting at $9/mo — executive assistant, researcher, content writer, SEO specialist, legal reviewer, and financial analyst. Pick one or hire the whole team. No bundle, no tier decisions.
          </p>

          {/* Trust strip */}
          <div style={{ display: 'flex', gap: 'clamp(16px, 3vw, 32px)', justifyContent: 'center', marginTop: 44, flexWrap: 'wrap' }}>
            {[
              { v: '7 days', k: 'free trial' },
              { v: 'No CC', k: 'to start' },
              { v: 'Cancel', k: 'anytime' },
            ].map(s => (
              <div key={s.k} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: FONT.display, fontSize: 28, color: '#F5C518', lineHeight: 1 }}>{s.v}</div>
                <div style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#555', marginTop: 5 }}>{s.k}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="vq-section-pad" style={{ background: '#FFF9ED', borderBottom: '3px solid #111' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ marginBottom: 32, textAlign: 'center' }}>
            <div style={{ fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3, textTransform: 'uppercase', color: '#666', marginBottom: 12 }}>
              [ PICK YOUR AGENTS ]
            </div>
            <h2 style={{ fontFamily: FONT.display, fontSize: 'clamp(38px, 6vw, 76px)', margin: 0, lineHeight: 0.92 }}>
              start with one.<br />
              <span style={{ background: '#6FCDE8', border: '3px solid #111', borderRadius: 8, boxShadow: '5px 5px 0 #111', padding: '0 14px', display: 'inline-block' }}>
                add the rest later.
              </span>
            </h2>
            <p style={{ fontFamily: FONT.body, fontSize: 15, lineHeight: 1.6, color: '#444', maxWidth: 620, margin: '18px auto 0' }}>
              Every agent bills and renews on its own — no bundle, no tiers. Pick one, or hire the whole team.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 20, marginBottom: 32 }}>
            {EMPLOYEES.map(emp => {
              const Comp = CHARACTER_COMPONENTS[emp.key];
              const monthlyPrice = priceByAgent[emp.key];
              return (
                <div
                  key={emp.key}
                  style={{
                    textAlign: 'left',
                    border: '3px solid #111',
                    borderRadius: 12,
                    overflow: 'hidden',
                    background: '#fff',
                    boxShadow: '5px 5px 0 #111',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div style={{ position: 'relative', aspectRatio: '3 / 4', overflow: 'hidden', background: emp.color, borderBottom: '3px solid #111' }}>
                    <Comp size="100%" />
                  </div>
                  <div style={{ padding: 14, display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                    <div style={{ fontFamily: FONT.display, fontSize: 22, lineHeight: 1, color: emp.color }}>
                      {emp.name}
                    </div>
                    <div style={{ fontFamily: FONT.mono, fontSize: 9, letterSpacing: 1.2, textTransform: 'uppercase', color: '#777', marginTop: 6, lineHeight: 1.5 }}>
                      <TwoLineBlurb text={AGENT_BLURBS[emp.key]} />
                    </div>
                    <div style={{ fontFamily: FONT.display, fontSize: 24, color: '#111', marginTop: 12 }}>
                      {monthlyPrice == null ? '—' : `$${monthlyPrice}`}
                      <span style={{ fontFamily: FONT.body, fontSize: 12, color: '#888', marginLeft: 4 }}>/mo</span>
                    </div>
                    <div style={{ fontFamily: FONT.mono, fontSize: 10, color: '#1DBC87', marginTop: 4 }}>
                      {emp.key === 'maya' ? '300 credits/mo included' : 'Unlimited generations'}
                    </div>
                    <a
                      href={isPreLaunch ? waitlistUrl : `${consoleUrl}/signup`}
                      style={{
                        marginTop: 12, display: 'block', textAlign: 'center',
                        padding: '10px 14px', background: '#111', color: '#EFE7D6',
                        fontFamily: FONT.head, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1,
                        border: '3px solid #111', borderRadius: 8, textDecoration: 'none',
                        boxSizing: 'border-box',
                      } as React.CSSProperties}
                    >
                      Start with {emp.name} →
                    </a>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Enterprise — separate from per-agent pricing, not a per-agent card */}
          <div style={{
            border: '3px solid #111', borderRadius: 20, overflow: 'hidden',
            boxShadow: `10px 10px 0 ${enterpriseTier.color}`,
            display: 'flex', flexWrap: 'wrap',
          }}>
            <div style={{ flex: '1 1 260px', background: enterpriseTier.color, padding: 'clamp(22px, 4vw, 32px) clamp(20px, 5vw, 36px)', borderRight: '3px solid #111' }}>
              <h2 style={{ fontFamily: FONT.display, fontSize: 'clamp(36px, 6vw, 52px)', margin: 0, lineHeight: 1, color: '#111' }}>
                {enterpriseTier.name}
              </h2>
              <p style={{ fontFamily: FONT.body, fontSize: 16, color: '#111', margin: '8px 0 0', opacity: 0.7 }}>
                {enterpriseTier.tag}
              </p>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginTop: 20 }}>
                <div style={{ fontFamily: FONT.display, fontSize: 'clamp(40px, 8vw, 56px)', color: '#111', lineHeight: 1 }}>
                  ${enterpriseTier.monthly}+
                </div>
                <div style={{ fontFamily: FONT.body, fontSize: 15, color: '#111', opacity: 0.7, paddingBottom: 6 }}>
                  /mo and up
                </div>
              </div>
            </div>
            <div style={{ flex: '2 1 360px', background: '#FFF9ED', padding: 'clamp(20px, 4vw, 28px) clamp(20px, 5vw, 36px)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 20 }}>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                {enterpriseTier.includes.map(f => (
                  <li key={f} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ color: '#1DBC87', fontFamily: FONT.head, fontSize: 16, lineHeight: 1.2, flexShrink: 0 }}>✓</span>
                    <span style={{ fontFamily: FONT.body, fontSize: 14, color: '#111', lineHeight: 1.4 }}>{f}</span>
                  </li>
                ))}
              </ul>
              <div>
                <a
                  href={`mailto:${contact.email}?subject=Custom%20Enterprise%20Pricing`}
                  style={{
                    display: 'inline-block', padding: '14px 24px', background: '#111', color: '#EFE7D6',
                    fontFamily: FONT.head, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1,
                    border: '3px solid #111', borderRadius: 10, textDecoration: 'none',
                    boxShadow: `5px 5px 0 ${enterpriseTier.color}`,
                  } as React.CSSProperties}
                >
                  Talk to sales →
                </a>
                <p style={{ fontFamily: FONT.mono, fontSize: 11, color: '#888', marginTop: 10, marginBottom: 0 }}>
                  Response within 1 business day
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHO YOU GET ── */}
      <section className="vq-section-pad" style={{ background: '#111', borderBottom: '3px solid #111' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{
              fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3,
              textTransform: 'uppercase', color: '#F5C518', marginBottom: 16,
            }}>
              [ WHO YOU GET ]
            </div>
            <h2 style={{
              fontFamily: FONT.display, fontSize: 'clamp(36px, 5vw, 64px)',
              margin: 0, color: '#EFE7D6', lineHeight: 0.95,
            }}>
              six specialists.<br />
              <span style={{ color: '#F5C518' }}>no bundle required.</span>
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 20 }}>
            {EMPLOYEES.map(emp => {
              const Comp = CHARACTER_COMPONENTS[emp.key];
              return (
                <Link key={emp.key} href={`/agents/${emp.key}`} style={{ textDecoration: 'none' }}>
                  <div
                    style={{
                      border: '3px solid #333', borderRadius: 12,
                      overflow: 'hidden', background: '#1a1a1a',
                      transition: 'border-color 160ms, box-shadow 160ms',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLDivElement).style.borderColor = emp.color;
                      (e.currentTarget as HTMLDivElement).style.boxShadow = `4px 4px 0 ${emp.color}`;
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLDivElement).style.borderColor = '#333';
                      (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                    }}
                  >
                    <div style={{ overflow: 'hidden', background: emp.color }}>
                      <Comp size="100%" />
                    </div>
                    <div style={{ padding: '14px 16px' }}>
                      <div style={{ fontFamily: FONT.display, fontSize: 24, color: emp.color, lineHeight: 1 }}>
                        {emp.name}
                      </div>
                      <div style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#666', marginTop: 5 }}>
                        {AGENT_BLURBS[emp.key]}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── FEATURES BREAKDOWN ── */}
      <section className="vq-section-pad" style={{ background: '#FFF9ED', borderBottom: '3px solid #111' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ marginBottom: 48 }}>
            <div style={{ fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3, textTransform: 'uppercase', color: '#666', marginBottom: 16 }}>
              [ WHAT'S INCLUDED ]
            </div>
            <h2 style={{ fontFamily: FONT.display, fontSize: 'clamp(36px, 5vw, 64px)', margin: 0, lineHeight: 0.95 }}>
              everything.<br />
              <span style={{
                background: '#F06464', padding: '0 16px', display: 'inline-block',
                border: '3px solid #111', borderRadius: 8, boxShadow: '4px 4px 0 #111', transform: 'rotate(-1deg)',
              }}>
                day one.
              </span>
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {FEATURES.map((f, i) => (
              <div key={f.title} style={{
                border: '3px solid #111', borderRadius: 12, padding: '22px 20px',
                background: '#EFE7D6', boxShadow: '4px 4px 0 #111',
                transform: `rotate(${i % 2 === 0 ? -0.4 : 0.4}deg)`,
              }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: f.color, border: '2px solid #111', marginBottom: 14 }} />
                <h3 style={{ fontFamily: FONT.head, fontSize: 17, margin: '0 0 8px' }}>{f.title}</h3>
                <p style={{ fontFamily: FONT.body, fontSize: 14, lineHeight: 1.6, color: '#444', margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="vq-section-pad" style={{ borderBottom: '3px solid #111' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ marginBottom: 48 }}>
            <div style={{ fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3, textTransform: 'uppercase', color: '#666', marginBottom: 16 }}>
              [ COMMON QUESTIONS ]
            </div>
            <h2 style={{ fontFamily: FONT.display, fontSize: 'clamp(32px, 4vw, 56px)', margin: 0, lineHeight: 0.95 }}>
              honest answers.
            </h2>
          </div>
          <div style={{ display: 'grid', gap: 16 }}>
            {PRICING_FAQ.map(item => (
              <div key={item.q} style={{
                border: '3px solid #111', borderRadius: 12,
                padding: 'clamp(18px, 3.4vw, 22px) clamp(18px, 3.4vw, 24px)',
                background: '#fff', boxShadow: '4px 4px 0 #111',
              }}>
                <div style={{ fontFamily: FONT.head, fontSize: 16, marginBottom: 8 }}>{item.q}</div>
                <div style={{ fontFamily: FONT.body, fontSize: 15, lineHeight: 1.65, color: '#444' }}>{item.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="vq-section-pad">
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontFamily: FONT.display, fontSize: 'clamp(40px, 7vw, 96px)', margin: '0 0 28px', lineHeight: 0.9 }}>
            start free.<br />
            <span style={{
              background: '#F5C518', padding: '0 18px', display: 'inline-block',
              border: '3px solid #111', borderRadius: 8, boxShadow: '5px 5px 0 #111',
            }}>
              hire today.
            </span>
          </h2>
          <p style={{ fontFamily: FONT.body, fontSize: 'clamp(15px, 2.2vw, 18px)', color: '#555', marginBottom: 44 }}>
            7 days free. No credit card. Cancel anytime.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button variant="dark" href={isPreLaunch ? waitlistUrl : `${consoleUrl}/signup`}>{isPreLaunch ? 'Join the waitlist →' : 'Start 7-day free trial →'}</Button>
            <Button variant="ghost" onClick={() => setIsContactOpen(true)}>Talk to a human</Button>
          </div>
          <p style={{ fontFamily: FONT.mono, fontSize: 11, color: '#888', marginTop: 20, letterSpacing: 1, textTransform: 'uppercase' }}>
            Comparing options?{' '}
            <Link href="/compare" style={{ color: '#111', textDecoration: 'underline' }}>
              See Veqiro vs Sintra vs Marblism →
            </Link>
          </p>
        </div>
      </section>

      <Footer />
      <ContactModal open={isContactOpen} onClose={() => setIsContactOpen(false)} />
    </div>
  );
}
