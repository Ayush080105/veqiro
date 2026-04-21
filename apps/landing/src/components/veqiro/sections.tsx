'use client';
import React, { useState } from 'react';
import { FONT } from './shared';
import {
  mainAppUrl,
  demoCtaHref,
  howItWorksSteps,
  pricingTiers,
  faqItems,
  footerColumns,
  footerBottom,
} from '@/lib/site-config';

export function HowItWorks() {
  return (
    <section id="how" style={{ padding: '100px 32px', background: '#EFE7D6', borderTop: '3px solid #111' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
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
              background: '#fff', border: '3px solid #111', borderRadius: 14, padding: '32px 28px',
              boxShadow: '8px 8px 0 #111', transform: `rotate(${i % 2 === 0 ? -1 : 1}deg)`, position: 'relative',
            }}>
              <div style={{
                position: 'absolute', top: -18, left: -18, width: 56, height: 56, background: s.c,
                border: '3px solid #111', borderRadius: '50%', display: 'grid', placeItems: 'center',
                fontFamily: FONT.display, fontSize: 20, boxShadow: '3px 3px 0 #111',
              }}>{s.n}</div>
              <h3 style={{ fontFamily: FONT.head, fontSize: 26, margin: '8px 0 12px' }}>{s.t}</h3>
              <p style={{ fontFamily: FONT.body, fontSize: 16, lineHeight: 1.5, color: '#333', margin: 0 }}>{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Pricing() {
  const [yearly, setYearly] = useState(false);
  return (
    <section id="pricing" style={{ padding: '100px 32px', background: '#111', color: '#EFE7D6' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12, color: '#F5C518' }}>
            [ PRICING ]
          </div>
          <h2 style={{ fontFamily: FONT.display, fontSize: 'clamp(48px, 7vw, 96px)', margin: 0, lineHeight: 0.9, letterSpacing: -1 }}>
            less than<br /><span style={{ color: '#F5C518' }}>a bad intern.</span>
          </h2>
          <div style={{ display: 'inline-flex', marginTop: 28, background: '#EFE7D6', borderRadius: 999, padding: 4, border: '3px solid #EFE7D6' }}>
            {['Monthly', 'Yearly · save 20%'].map((l, i) => (
              <button key={l} onClick={() => setYearly(i === 1)} style={{
                background: (yearly ? 1 : 0) === i ? '#111' : 'transparent',
                color: (yearly ? 1 : 0) === i ? '#EFE7D6' : '#111',
                border: 'none', borderRadius: 999, padding: '10px 20px',
                fontFamily: FONT.head, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, cursor: 'pointer',
              }}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
          {pricingTiers.map((p) => {
            const price = yearly ? p.yearly : p.monthly;
            return (
              <div key={p.name} style={{
                background: p.popular ? p.color : '#EFE7D6', color: '#111',
                border: '3px solid #EFE7D6', borderRadius: 16, padding: '32px 28px',
                position: 'relative', transform: `translateY(${p.popular ? -8 : 0}px)`,
                boxShadow: p.popular ? `10px 10px 0 ${p.color}` : '6px 6px 0 #EFE7D6',
              }}>
                {p.popular && (
                  <div style={{
                    position: 'absolute', top: -14, right: 20, background: '#F5C518', border: '3px solid #111',
                    borderRadius: 999, padding: '4px 14px', fontFamily: FONT.head, fontSize: 11,
                    letterSpacing: 1, textTransform: 'uppercase', transform: 'rotate(4deg)', boxShadow: '3px 3px 0 #111',
                  }}>most hired ✦</div>
                )}
                <div style={{ fontFamily: FONT.head, fontSize: 24 }}>{p.name}</div>
                <div style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.7, marginTop: 2 }}>{p.tag}</div>
                <div style={{ marginTop: 20, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontFamily: FONT.display, fontSize: 72, lineHeight: 1 }}>${price}</span>
                  <span style={{ fontFamily: FONT.body, fontSize: 16 }}>/{yearly ? 'mo, billed yearly' : 'month'}</span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '24px 0', display: 'grid', gap: 10 }}>
                  {p.includes.map(it => (
                    <li key={it} style={{ fontFamily: FONT.body, fontSize: 15, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 20, height: 20, background: '#111', color: p.color, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 11, fontFamily: FONT.head }}>✓</span>
                      {it}
                    </li>
                  ))}
                </ul>
                <a href={`${mainAppUrl}/signup`} style={{
                  display: 'block', textAlign: 'center', textDecoration: 'none',
                  background: '#111', color: '#EFE7D6', padding: '14px',
                  border: '3px solid #111', borderRadius: 10,
                  fontFamily: FONT.head, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1,
                }}>Hire {p.name.toLowerCase()}</a>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function FAQ() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" style={{ padding: '100px 32px', background: '#EFE7D6' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <div style={{ marginBottom: 48 }}>
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
                background: '#fff', border: '3px solid #111', borderRadius: 14, padding: '20px 24px',
                cursor: 'pointer', boxShadow: isOpen ? '8px 8px 0 #F06464' : '4px 4px 0 #111', transition: 'box-shadow 180ms',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontFamily: FONT.head, fontSize: 20 }}>{it.q}</div>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: isOpen ? '#F06464' : '#EFE7D6', border: '2.5px solid #111',
                    display: 'grid', placeItems: 'center', fontFamily: FONT.display, fontSize: 20,
                    transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)', transition: 'transform 200ms, background 200ms',
                  }}>+</div>
                </div>
                {isOpen && (
                  <div style={{ fontFamily: FONT.body, fontSize: 16, lineHeight: 1.6, color: '#333', marginTop: 14, paddingRight: 40 }}>
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
    <section id="hire" style={{ padding: '120px 32px', background: '#F5C518', borderTop: '3px solid #111', borderBottom: '3px solid #111', position: 'relative', overflow: 'hidden' }}>
      <div aria-hidden style={{
        position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
        fontFamily: FONT.display, fontSize: '38vw', color: '#111',
        opacity: 0.06, lineHeight: 1, userSelect: 'none', pointerEvents: 'none',
      }}>hire</div>
      <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
        <h2 style={{ fontFamily: FONT.display, fontSize: 'clamp(56px, 9vw, 144px)', margin: 0, lineHeight: 0.88, letterSpacing: -2 }}>
          your new team<br />is waiting.
        </h2>
        <p style={{ fontFamily: FONT.body, fontSize: 20, marginTop: 24, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto' }}>
          Seven days free. No credit card. No weird onboarding call. Just the work.
        </p>
        <div style={{ marginTop: 36, display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href={`${mainAppUrl}/signup`} style={{
            background: '#111', color: '#F5C518', padding: '20px 40px',
            fontFamily: FONT.head, fontSize: 18, textTransform: 'uppercase', letterSpacing: 1,
            textDecoration: 'none', border: '3px solid #111', borderRadius: 12, boxShadow: '8px 8px 0 #EFE7D6',
          }}>Hire the crew →</a>
          <a href={demoCtaHref} style={{
            background: 'transparent', color: '#111', padding: '20px 40px',
            fontFamily: FONT.head, fontSize: 18, textTransform: 'uppercase', letterSpacing: 1,
            textDecoration: 'none', border: '3px solid #111', borderRadius: 12,
          }}>Book a demo</a>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer style={{ background: '#111', color: '#EFE7D6', padding: '64px 32px 32px' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 40, marginBottom: 48 }}>
        <div>
          <div style={{ fontFamily: FONT.display, fontSize: 42, color: '#EFE7D6', lineHeight: 1 }}>veqiro</div>
          <p style={{ fontFamily: FONT.body, fontSize: 14, marginTop: 12, color: '#CFC6B2', maxWidth: 260 }}>
            Six AI employees with real jobs. Made in a small room, loud.
          </p>
        </div>
        {footerColumns.map(col => (
          <div key={col.h}>
            <div style={{ fontFamily: FONT.head, fontSize: 13, textTransform: 'uppercase', letterSpacing: 2, color: '#F5C518', marginBottom: 16 }}>
              {col.h}
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
              {col.links.map(link => (
                <li key={link.label}>
                  <a href={link.href} style={{ color: '#EFE7D6', textDecoration: 'none', fontFamily: FONT.body, fontSize: 15 }}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div style={{
        maxWidth: 1400, margin: '0 auto', paddingTop: 24, borderTop: '2px solid #333',
        display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16,
        fontFamily: FONT.mono, fontSize: 12, color: '#888',
      }}>
        <div>{footerBottom.copyright}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {footerBottom.links.map((l, i) => (
            <React.Fragment key={l.label}>
              {i > 0 && <span>·</span>}
              <a href={l.href} style={{ color: '#888', textDecoration: 'none' }}>{l.label}</a>
            </React.Fragment>
          ))}
        </div>
      </div>
    </footer>
  );
}
