'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { PageNav } from '@/components/veqiro/page-nav';
import { Footer } from '@/components/veqiro/sections';
import { FONT, Button } from '@/components/veqiro/shared';
import { pricingTiers, mainAppUrl, demoCtaHref } from '@/lib/site-config';
import { EMPLOYEES } from '@/components/veqiro/data';
import { CHARACTER_COMPONENTS } from '@/components/veqiro/characters';

const PRICING_FAQ = [
  { q: 'Is there a free trial?', a: "Yes — 7 days, no credit card required. Full access to all six agents from day one." },
  { q: 'What does "billed annually" mean?', a: "You pay for 12 months upfront and save ~25% versus monthly. Cancel before renewal and we won't charge you again." },
  { q: 'Can I cancel anytime?', a: "On monthly billing: cancel before your next cycle. On annual: you keep access until the end of the paid period." },
  { q: 'What integrations are included?', a: "Gmail, Google Calendar, LinkedIn, Twitter/X, Instagram, and Slack out of the box. More on the roadmap." },
  { q: 'Do agents share memory across tasks?', a: "Yes. Your Brain (company profile, brand voice, competitors) is read by all six agents so they stay consistent." },
  { q: 'Is my data used to train your AI?', a: "Never. Your content is used only to perform the tasks you ask for. SOC 2 Type II certified." },
];

const AGENT_BLURBS: Record<string, string> = {
  vega:  'Inbox, calendar, briefings',
  scout: 'Research, leads, intel',
  maya:  'Content, copy, campaigns',
  sage:  'SEO, blogs, rankings',
  lex:   'Contracts, compliance, NDAs',
  rex:   'Finance, metrics, forecasts',
};

const FEATURES = [
  { title: 'All 6 AI Employees', desc: 'Vega, Scout, Maya, Sage, Lex, and Rex — fully specialized, ready to work.', color: '#F5C518' },
  { title: 'Shared Brain', desc: 'One company profile. All agents read your brand voice, competitors, and goals.', color: '#6FCDE8' },
  { title: 'Custom Brand Voice', desc: '6 presets or fully custom — your agents write like you, not like a template.', color: '#F06464' },
  { title: 'Priority Processing', desc: "Your tasks don't wait in a queue. You get dedicated compute from day one.", color: '#1DBC87' },
  { title: 'Integrations', desc: 'Gmail, Google Calendar, LinkedIn, Twitter/X, Instagram, Slack, and more.', color: '#F79FD4' },
  { title: 'Unlimited Tasks', desc: 'No credits. No per-task fees. Just assign the work and get results.', color: '#8A8AF0' },
];

export default function PricingPageContent() {
  const tier = pricingTiers[0];
  const [yearly, setYearly] = useState(false);
  const price = yearly ? tier.yearly : tier.monthly;

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
            Six AI employees with real specialties. One monthly bill.
            No payroll. No HR drama. No sick days.
          </p>

          {/* Trust strip */}
          <div style={{ display: 'flex', gap: 'clamp(16px, 3vw, 32px)', justifyContent: 'center', marginTop: 44, flexWrap: 'wrap' }}>
            {[
              { v: '7 days', k: 'free trial' },
              { v: 'No CC', k: 'to start' },
              { v: 'SOC 2', k: 'Type II' },
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

      {/* ── PRICING CARD ── */}
      <section className="vq-section-pad" style={{ borderBottom: '3px solid #111' }}>
        <div style={{ maxWidth: 580, margin: '0 auto' }}>
          {/* Billing toggle */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 36 }}>
            <div style={{
              display: 'inline-flex', background: '#111', borderRadius: 999,
              padding: 4, border: '3px solid #111',
            }}>
              {['Monthly', 'Annually · save 25%'].map((l, i) => (
                <button
                  key={l}
                  onClick={() => setYearly(i === 1)}
                  style={{
                    background: (yearly ? 1 : 0) === i ? '#F5C518' : 'transparent',
                    color: (yearly ? 1 : 0) === i ? '#111' : '#888',
                    border: 'none', borderRadius: 999, padding: '10px 20px',
                    fontFamily: FONT.head, fontSize: 12, textTransform: 'uppercase',
                    letterSpacing: 1, cursor: 'pointer', transition: 'background 160ms, color 160ms',
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Card */}
          <div style={{
            border: '3px solid #111', borderRadius: 20,
            overflow: 'hidden', boxShadow: '10px 10px 0 #111',
          }}>
            {/* Header */}
            <div style={{ background: tier.color, padding: 'clamp(22px, 4vw, 32px) clamp(20px, 5vw, 36px)', borderBottom: '3px solid #111' }}>
              <div style={{
                display: 'inline-block', background: '#111', color: tier.color,
                fontFamily: FONT.mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: 2,
                padding: '5px 12px', borderRadius: 999, marginBottom: 16,
              }}>
                Most hired
              </div>
              <h2 style={{ fontFamily: FONT.display, fontSize: 'clamp(44px, 8vw, 64px)', margin: 0, lineHeight: 1, color: '#111' }}>
                {tier.name}
              </h2>
              <p style={{ fontFamily: FONT.body, fontSize: 16, color: '#111', margin: '8px 0 0', opacity: 0.7 }}>
                {tier.tag}
              </p>
            </div>

            {/* Price */}
            <div style={{ background: '#fff', padding: 'clamp(20px, 4vw, 28px) clamp(20px, 5vw, 36px)', borderBottom: '3px solid #111' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ fontFamily: FONT.display, fontSize: 'clamp(48px, 12vw, 72px)', color: '#111', lineHeight: 1 }}>
                  ${price}
                </div>
                <div style={{ fontFamily: FONT.body, fontSize: 'clamp(15px, 2.2vw, 18px)', color: '#888', paddingBottom: 8 }}>
                  /mo{yearly ? ' · billed annually' : ''}
                </div>
              </div>
              {yearly && (
                <div style={{
                  display: 'inline-block', background: '#F5C518', border: '2px solid #111',
                  borderRadius: 999, padding: '4px 12px', fontFamily: FONT.mono,
                  fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', marginTop: 10,
                }}>
                  You save ${(tier.monthly - tier.yearly) * 12}/yr
                </div>
              )}
            </div>

            {/* Features */}
            <div style={{ background: '#FFF9ED', padding: 'clamp(20px, 4vw, 28px) clamp(20px, 5vw, 36px)', borderBottom: '3px solid #111' }}>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 14 }}>
                {tier.includes.map(f => (
                  <li key={f} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <span style={{ color: '#1DBC87', fontFamily: FONT.head, fontSize: 18, lineHeight: 1.2, flexShrink: 0 }}>✓</span>
                    <span style={{ fontFamily: FONT.body, fontSize: 16, color: '#111', lineHeight: 1.4 }}>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA */}
            <div style={{ background: '#fff', padding: 'clamp(18px, 4vw, 24px) clamp(20px, 5vw, 36px)', textAlign: 'center' }}>
              <a
                href={`${mainAppUrl}/signup`}
                style={{
                  display: 'block', width: '100%', textAlign: 'center',
                  padding: '16px 26px', background: '#111', color: '#EFE7D6',
                  fontFamily: FONT.head, fontSize: 14, textTransform: 'uppercase', letterSpacing: 1,
                  border: '3px solid #111', borderRadius: 10, textDecoration: 'none',
                  boxShadow: '5px 5px 0 #F5C518', boxSizing: 'border-box',
                } as React.CSSProperties}
              >
                Start 7-day free trial →
              </a>
              <p style={{ fontFamily: FONT.mono, fontSize: 11, color: '#888', marginTop: 12, marginBottom: 0 }}>
                No credit card · Cancel anytime
              </p>
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
              <span style={{ color: '#F5C518' }}>one subscription.</span>
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
                    <div style={{ aspectRatio: '1/1', overflow: 'hidden', background: emp.color }}>
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
            <Button variant="dark" href={`${mainAppUrl}/signup`}>Start 7-day free trial →</Button>
            <Button variant="ghost" href={demoCtaHref}>Talk to a human first</Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
