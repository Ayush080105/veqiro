'use client';
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Plus } from 'lucide-react';
import { FONT, T } from '../shared';
import { EMPLOYEES } from '../data';
import { BrainDiagram } from '../story';
import { agentPricing, contact } from '@/lib/site-config';
import { useBillingCatalog } from '@/lib/use-billing-catalog';
import {
  COMPARE_ROWS, USE_CASES, TRUST_FAQ, HIRE_FOR,
} from './home-data';
import { AgentFace, Ctas, Kicker, Reveal, TrustLine, SIGNUP_HREF, PRIMARY_CTA } from './home-ui';

/* ── Shared brain ────────────────────────────────────────────────────────────────────────── */

/** The original animated diagram — context cards feed one company brain, which feeds all six
 *  agents — under the brief's headline. */
export function BrainSection() {
  return (
    <section id="brain" className="vq-section-pad vh-dark" aria-labelledby="vh-brain-title">
      <div className="vq-shell">
        <Reveal>
          <Kicker center>One company brain</Kicker>
          <h2 id="vh-brain-title" className="vh-h2 vh-center" style={{ textAlign: 'center', color: T.inkInv, maxWidth: '22ch' }}>
            Your AI employees shouldn&rsquo;t have to meet your business every morning.
          </h2>
          <p className="vh-lede vh-center" style={{ textAlign: 'center' }}>
            Tell Veqiro about your company once. Every agent uses the same context — so Maya writes
            in the voice Sage optimises for, and Rex reports on the goals you set.
          </p>
        </Reveal>
        <Reveal delay={100}>
          <BrainDiagram />
        </Reveal>
        <Reveal>
          <p style={{ marginTop: 'clamp(32px, 4vw, 48px)', textAlign: 'center', fontFamily: FONT.display, fontSize: 'clamp(20px, 2.4vw, 28px)', fontWeight: 600, letterSpacing: '-0.025em', color: T.amber }}>
            Brief once. Every agent stays aligned.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Why not another AI chat ─────────────────────────────────────────────────────────────── */

export function CompareSection() {
  return (
    <section className="vq-section-pad" style={{ background: T.bg }} aria-labelledby="vh-compare-title">
      <div className="vq-shell" style={{ maxWidth: 1000 }}>
        <Reveal>
          <Kicker>Why Veqiro instead of another AI chat?</Kicker>
          <h2 id="vh-compare-title" className="vh-h2">Less prompting. More work getting done.</h2>
          <p className="vh-lede">
            A general assistant is brilliant at answers. Veqiro is built for the part that comes after:
            you delegate, the agent uses your context and your tools, and you get the finished deliverable.
          </p>
        </Reveal>
        <Reveal className="vh-compare" style={{ marginTop: 'clamp(32px, 4vw, 48px)' }}>
          <div className="vh-compare-row is-head" role="row">
            <div role="columnheader">&nbsp;</div>
            <div role="columnheader">General AI chat</div>
            <div role="columnheader">Veqiro</div>
          </div>
          {COMPARE_ROWS.map(r => (
            <div key={r.topic} className="vh-compare-row" role="row">
              <div role="rowheader">{r.topic}</div>
              <div role="cell">{r.chat}</div>
              <div role="cell">{r.veqiro}</div>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

/* ── How it works ────────────────────────────────────────────────────────────────────────── */

const STEPS = [
  { n: '01', t: 'Connect your tools', d: 'Connect the tools your business already uses — mail, calendar, social, analytics, docs.' },
  { n: '02', t: 'Teach Veqiro your business', d: 'Add your brand voice, goals, products, competitors and context. Once.' },
  { n: '03', t: 'Delegate', d: 'Tell your AI employee what needs to get done, the way you would tell a colleague.' },
];

export function HowSection() {
  return (
    <section id="how" className="vq-section-pad vh-dark" aria-labelledby="vh-how-title">
      <div className="vq-shell">
        <Reveal>
          <Kicker>How it works</Kicker>
          <h2 id="vh-how-title" className="vh-h2" style={{ color: T.inkInv }}>Put an AI employee to work in minutes.</h2>
        </Reveal>
        <ol className="vh-steps">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 90}>
              <li className="vh-step" style={{ listStyle: 'none', height: '100%' }}>
                <div className="vh-step-n">{s.n}</div>
                <h3 style={{ fontFamily: FONT.display, fontSize: 'clamp(20px, 2.2vw, 25px)', letterSpacing: '-0.025em', margin: '14px 0 8px', color: T.inkInv }}>{s.t}</h3>
                <p style={{ fontSize: 15, lineHeight: 1.6, color: T.inkInv2, margin: 0 }}>{s.d}</p>
              </li>
            </Reveal>
          ))}
        </ol>
        <Reveal>
          <p style={{ marginTop: 36, fontFamily: FONT.display, fontSize: 'clamp(20px, 2.4vw, 28px)', fontWeight: 600, letterSpacing: '-0.025em', color: T.inkInv }}>
            You delegate the outcome. <span style={{ color: T.amber }}>Veqiro handles the work.</span>
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Built for teams like yours ──────────────────────────────────────────────────────────── */

export function UseCasesSection() {
  const [active, setActive] = useState(USE_CASES[0].key);
  const uc = USE_CASES.find(u => u.key === active)!;

  return (
    <section id="use-cases" className="vq-section-pad" style={{ background: T.bg }} aria-labelledby="vh-uc-title">
      <div className="vq-shell">
        <Reveal>
          <Kicker>Built for teams like yours</Kicker>
          <h2 id="vh-uc-title" className="vh-h2">Whoever is carrying the work, it gets lighter.</h2>
        </Reveal>

        <div className="vh-ex-tabs" role="tablist" aria-label="Team types" style={{ justifyContent: 'flex-start' }}>
          {USE_CASES.map(u => (
            <button key={u.key} type="button" role="tab" aria-selected={u.key === active} aria-controls="vh-uc-panel"
              className="vh-ex-tab" style={{ padding: '8px 16px' }} onClick={() => setActive(u.key)}>
              {u.label}
            </button>
          ))}
        </div>

        <div id="vh-uc-panel" role="tabpanel" key={active} style={{ animation: 'pop 280ms ease' }}>
          <p style={{ fontFamily: FONT.display, fontSize: 'clamp(22px, 2.6vw, 30px)', fontWeight: 600, letterSpacing: '-0.025em', margin: '28px 0 0' }}>
            {uc.line}
          </p>
          <div className="vh-uc">
            <div className="vh-uc-cell">
              <div className="vh-kicker">The pain</div>
              <p style={{ fontSize: 16, lineHeight: 1.55, margin: '10px 0 0' }}>{uc.pain}</p>
            </div>
            <div className="vh-uc-cell is-flow">
              <div className="vh-kicker" style={{ color: T.inkInv2 }}>With Veqiro</div>
              <ol style={{ margin: '10px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
                {uc.flow.map(f => (
                  <li key={f} style={{ display: 'flex', gap: 8, fontSize: 15, lineHeight: 1.45 }}>
                    <ArrowRight size={15} style={{ marginTop: 3, flexShrink: 0, color: T.amber }} aria-hidden />{f}
                  </li>
                ))}
              </ol>
            </div>
            <div className="vh-uc-cell">
              <div className="vh-kicker">The outcome</div>
              <p style={{ fontSize: 16, lineHeight: 1.55, margin: '10px 0 0', fontWeight: 550 }}>{uc.outcome}</p>
              <Link href={`/use-cases/${uc.slug}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 14, fontSize: 14, color: T.ink, fontWeight: 550 }}>
                See how {uc.label.toLowerCase()} use Veqiro <ArrowRight size={14} aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Prices, from the billing catalog ────────────────────────────────────────────────────── */

function usePrices(): Record<string, number | null> {
  const catalog = useBillingCatalog();
  return useMemo(() => (catalog
    ? Object.fromEntries(Object.entries(catalog.agents).map(([k, v]) => [k.toLowerCase(), Math.round(v.priceCents / 100)]))
    : Object.fromEntries(agentPricing.map(p => [p.key, p.monthly]))), [catalog]);
}

/* ── How much are you carrying? ──────────────────────────────────────────────────────────── */

export function CalculatorSection() {
  const prices = usePrices();
  const [hours, setHours] = useState(12);
  const [people, setPeople] = useState(2);
  const [fns, setFns] = useState<string[]>(['maya', 'vega']);

  const monthlyHours = Math.round(hours * people * 4.33);
  const cost = fns.reduce((sum, k) => sum + (prices[k] ?? 0), 0);
  const toggle = (k: string) => setFns(f => (f.includes(k) ? f.filter(x => x !== k) : [...f, k]));

  return (
    <section className="vq-section-pad" style={{ background: T.surface2 }} aria-labelledby="vh-calc-title">
      <div className="vq-shell">
        <Reveal>
          <Kicker>Your workload</Kicker>
          <h2 id="vh-calc-title" className="vh-h2">How much work are you carrying yourself?</h2>
        </Reveal>
        <div className="vh-calc">
          <div className="vh-calc-card">
            <label style={{ display: 'block' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15 }}>
                <span>Hours a week on repetitive work, per person</span><strong>{hours}h</strong>
              </div>
              <input className="vh-range" type="range" min={1} max={40} value={hours} onChange={e => setHours(Number(e.target.value))} />
            </label>
            <label style={{ display: 'block', marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15 }}>
                <span>People doing it</span><strong>{people}</strong>
              </div>
              <input className="vh-range" type="range" min={1} max={20} value={people} onChange={e => setPeople(Number(e.target.value))} />
            </label>
            <div style={{ marginTop: 18, fontSize: 15 }}>Functions you want help with</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              {EMPLOYEES.map(e => (
                <button key={e.key} type="button" className="vh-fn" aria-pressed={fns.includes(e.key)} onClick={() => toggle(e.key)}>
                  <span aria-hidden style={{ width: 7, height: 7, borderRadius: 2, background: e.color }} />
                  {HIRE_FOR[e.key as keyof typeof HIRE_FOR]}
                </button>
              ))}
            </div>
          </div>

          <div className="vh-calc-card" style={{ background: T.dark, color: T.inkInv, borderColor: T.dark, display: 'grid', alignContent: 'space-between', gap: 24 }}>
            <div>
              <div className="vh-kicker" style={{ color: T.inkInv2 }}>Your team carries</div>
              <div aria-live="polite" style={{ fontFamily: FONT.display, fontSize: 'clamp(44px, 6vw, 72px)', fontWeight: 600, letterSpacing: '-0.045em', lineHeight: 1, marginTop: 8 }}>
                {monthlyHours.toLocaleString('en-IN')} hours
              </div>
              <div style={{ color: T.inkInv2, marginTop: 6 }}>of repetitive work every month.</div>
            </div>
            <div style={{ borderTop: `1px solid ${T.lineInv}`, paddingTop: 18 }}>
              <div style={{ fontSize: 15, color: T.inkInv2 }}>
                {fns.length ? <>Covering {fns.length === 1 ? 'that function' : `those ${fns.length} functions`} with Veqiro:</> : 'Pick a function to see what it costs.'}
              </div>
              {fns.length > 0 && (
                <div style={{ fontFamily: FONT.display, fontSize: 34, fontWeight: 600, letterSpacing: '-0.03em', marginTop: 4 }}>
                  ${cost}<span style={{ fontSize: 16, color: T.inkInv2, fontWeight: 400 }}> / month</span>
                </div>
              )}
              <p style={{ fontSize: 13, color: T.inkInv2, margin: '12px 0 0', lineHeight: 1.5 }}>
                Illustrative — your numbers, not a promised saving. Veqiro is designed to take
                execution-heavy work off your team&rsquo;s plate; how much depends on your work.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Pricing ─────────────────────────────────────────────────────────────────────────────── */

export function PricingSection() {
  const prices = usePrices();
  return (
    <section id="pricing" className="vq-section-pad" style={{ background: T.bg }} aria-labelledby="vh-price-title">
      <div className="vq-shell">
        <Reveal>
          <Kicker>Pricing</Kicker>
          <h2 id="vh-price-title" className="vh-h2">Start with the work you need help with.</h2>
          <p className="vh-lede">
            You don&rsquo;t need to hire the whole workforce. Start with one AI employee and add
            others as your workload grows. Each is billed on its own; cancel any without touching the rest.
          </p>
        </Reveal>
        <div className="vh-price-grid">
          {EMPLOYEES.map((e, i) => (
            <Reveal key={e.key} delay={i * 40}>
              <Link href={`/agents/${e.key}`} className="vh-price">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <AgentFace agent={e.key} size={36} />
                  <div>
                    <div style={{ fontFamily: FONT.display, fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em' }}>{e.name}</div>
                    <div style={{ fontSize: 13, color: T.ink3 }}>{HIRE_FOR[e.key as keyof typeof HIRE_FOR]}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 12 }}>
                  <span style={{ fontFamily: FONT.display, fontSize: 34, fontWeight: 600, letterSpacing: '-0.035em', lineHeight: 1 }}>
                    {prices[e.key] == null ? '—' : `$${prices[e.key]}`}
                  </span>
                  <span style={{ fontSize: 13, color: T.ink3 }}>/ month</span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
        <Reveal>
          <div className="vh-trial">
            <div>
              <div style={{ fontFamily: FONT.display, fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>7 days free, on every agent.</div>
              <div style={{ fontSize: 14.5, marginTop: 2 }}>No credit card. Full access from day one.</div>
            </div>
            <a href={SIGNUP_HREF} style={{ background: T.ink, color: T.inkInv, padding: '13px 22px', borderRadius: 11, textDecoration: 'none', fontWeight: 550, fontSize: 15, whiteSpace: 'nowrap' }}>
              {PRIMARY_CTA}
            </a>
          </div>
          <p style={{ fontSize: 14, color: T.ink2, marginTop: 16 }}>
            Bigger team?{' '}
            <a href={`mailto:${contact.email}?subject=Custom%20Enterprise%20Pricing`} style={{ color: T.ink }}>Talk to us about enterprise</a>
            {' · '}
            <Link href="/pricing" style={{ color: T.ink }}>Full pricing details</Link>
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Trust and objections ────────────────────────────────────────────────────────────────── */

export function TrustSection() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="vq-section-pad" style={{ background: T.surface2 }} aria-labelledby="vh-trust-title">
      <div className="vq-shell vh-trust">
        <Reveal>
          <Kicker>Before you decide</Kicker>
          <h2 id="vh-trust-title" className="vh-h2">The questions worth asking.</h2>
          <p className="vh-lede">
            Straight answers about your data, mistakes, and what stays in your hands.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 24 }}>
            {['OAuth — no passwords stored', 'Never used to train models', 'Approval before anything goes out'].map(t => (
              <span key={t} style={{ fontSize: 13, padding: '7px 12px', borderRadius: 999, background: T.surface, border: `1px solid ${T.line}` }}>{t}</span>
            ))}
          </div>
        </Reveal>
        <div style={{ borderTop: `1px solid ${T.line2}` }}>
          {TRUST_FAQ.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q} style={{ borderBottom: `1px solid ${T.line2}` }}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`vh-faq-${i}`}
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  style={{ width: '100%', display: 'flex', justifyContent: 'space-between', gap: 20, padding: '20px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', font: 'inherit', color: T.ink }}
                >
                  <span style={{ fontFamily: FONT.display, fontSize: 'clamp(16px, 1.8vw, 19px)', fontWeight: 550, letterSpacing: '-0.02em' }}>{item.q}</span>
                  <Plus size={18} aria-hidden style={{ flexShrink: 0, color: T.ink3, transform: isOpen ? 'rotate(45deg)' : 'none', transition: 'transform 200ms ease' }} />
                </button>
                <div id={`vh-faq-${i}`} hidden={!isOpen}>
                  <p style={{ fontSize: 15.5, lineHeight: 1.7, color: T.ink2, margin: '0 0 22px', maxWidth: '64ch' }}>{item.a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── Final CTA ───────────────────────────────────────────────────────────────────────────── */

export function FinalCtaSection() {
  return (
    <section className="vq-section-pad vh-dark" style={{ position: 'relative', overflow: 'hidden' }} aria-labelledby="vh-final-title">
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'radial-gradient(60% 70% at 50% 100%, rgba(245,197,24,0.16), transparent 70%)' }} />
      <div className="vq-shell" style={{ position: 'relative', textAlign: 'center' }}>
        <Reveal>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
            {EMPLOYEES.map((e, i) => (
              <span key={e.key} style={{ marginLeft: i ? -10 : 0, borderRadius: 14, boxShadow: `0 0 0 3px ${T.dark}` }}>
                <AgentFace agent={e.key} size={46} radius={14} />
              </span>
            ))}
          </div>
          <h2 id="vh-final-title" className="vh-hero-h1" style={{ fontSize: 'clamp(36px, 6vw, 76px)', maxWidth: '16ch', color: T.inkInv }}>
            Stop carrying work your team shouldn&rsquo;t have to.
          </h2>
          <p style={{ fontSize: 'clamp(16px, 1.7vw, 19px)', lineHeight: 1.6, color: T.inkInv2, maxWidth: '54ch', margin: '22px auto 32px' }}>
            Give the repetitive work to Veqiro and keep your team&rsquo;s attention on the work that actually matters.
          </p>
          <Ctas center />
          <TrustLine center items={['No credit card required']} />
        </Reveal>
      </div>
    </section>
  );
}

