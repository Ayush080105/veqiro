'use client';
import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { FONT, T } from '../shared';
import { ToolIcon } from '../tool-logo';
import {
  PAIN_CARDS, WORKFORCE, CHATBOT_STEPS, VEQIRO_STEPS, WORK_EXAMPLES, liveToolsFor,
} from './home-data';
import { AgentFace, Kicker, Reveal, agentOf, roleOf, useInView, useReducedMotion } from './home-ui';

/* ── Pain ────────────────────────────────────────────────────────────────────────────────── */

export function PainSection() {
  return (
    <section id="problem" className="vq-section-pad" style={{ background: T.bg }} aria-labelledby="vh-pain-title">
      <div className="vq-shell">
        <Reveal>
          <Kicker>The real problem</Kicker>
          <h2 id="vh-pain-title" className="vh-h2">
            Small teams don&rsquo;t have a people problem. They have a workload problem.
          </h2>
          <p className="vh-lede">
            Every week, the same work keeps landing on the founder or a small team: research,
            content, follow-ups, reporting, SEO, admin and everything in between.
          </p>
        </Reveal>

        <div className="vh-pain-grid">
          {PAIN_CARDS.map((card, i) => (
            <Reveal key={card.label} delay={i * 60}>
              <article className="vh-pain-card" style={{ '--vh-accent': agentOf(card.agent).color } as React.CSSProperties}>
                <div className="vh-kicker" style={{ color: T.ink3 }}>{card.label}</div>
                <p style={{
                  fontFamily: FONT.display, fontSize: 'clamp(20px, 2vw, 24px)', fontWeight: 600,
                  letterSpacing: '-0.025em', lineHeight: 1.2, margin: '14px 0 22px', color: T.ink,
                }}>
                  {card.pain}
                </p>
                <span className="vh-symptom">{card.symptom}</span>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal className="vh-turn">
          <p className="vh-turn-q">What if that work just got&nbsp;done?</p>
          <p className="vh-lede vh-center">
            Instead of hiring another person for every function, give the work to an AI employee.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ── The workforce ───────────────────────────────────────────────────────────────────────── */

export function WorkforceSection() {
  const [active, setActive] = useState(WORKFORCE[2].agent);
  const role = WORKFORCE.find(w => w.agent === active)!;
  const emp = agentOf(active);
  const tools = liveToolsFor(active);

  return (
    <section id="workforce" className="vq-section-pad" style={{ background: T.bg, borderTop: `1px solid ${T.line}` }} aria-labelledby="vh-crew-title">
      <div className="vq-shell">
        <Reveal>
          <Kicker>Meet your AI workforce</Kicker>
          <h2 id="vh-crew-title" className="vh-h2">Six AI employees. Each one owns a real job.</h2>
          <p className="vh-lede">
            Veqiro gives lean teams specialised AI employees that own real business functions and
            produce finished work, not suggestions.
          </p>
        </Reveal>

        <Reveal className="vh-crew">
          <div className="vh-crew-list" role="tablist" aria-label="AI employees">
            {WORKFORCE.map(w => {
              const e = agentOf(w.agent);
              const selected = w.agent === active;
              return (
                <button
                  key={w.agent}
                  type="button"
                  role="tab"
                  id={`vh-crew-tab-${w.agent}`}
                  aria-selected={selected}
                  aria-controls="vh-crew-panel"
                  className="vh-crew-tab"
                  onClick={() => setActive(w.agent)}
                >
                  <AgentFace agent={w.agent} size={42} />
                  <span style={{ display: 'grid', gap: 1 }}>
                    <span style={{ fontFamily: FONT.display, fontWeight: 600, fontSize: 16, letterSpacing: '-0.015em' }}>{e.name}</span>
                    <span className="vh-crew-role" style={{ fontSize: 13, color: T.ink3 }}>{roleOf(w.agent)}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div
            key={active}
            id="vh-crew-panel"
            role="tabpanel"
            aria-labelledby={`vh-crew-tab-${active}`}
            className="vh-crew-detail"
            style={{ animation: 'pop 300ms ease' }}
          >
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <AgentFace agent={active} size={64} radius={18} />
              <div>
                <div className="vh-kicker" style={{ color: emp.ink }}>{roleOf(active)}</div>
                <div style={{ fontFamily: FONT.display, fontSize: 30, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.1, marginTop: 4 }}>
                  {emp.name}
                </div>
              </div>
            </div>
            <p style={{ fontSize: 'clamp(16px, 1.6vw, 18.5px)', lineHeight: 1.55, color: T.ink2, margin: '18px 0 0', maxWidth: '58ch' }}>
              {role.does}
            </p>

            <div className="vh-crew-cols">
              <div>
                <div className="vh-kicker">Give {emp.name} a task</div>
                <div style={{ marginTop: 10 }}>
                  {role.tasks.map(t => (
                    <div key={t} className="vh-task">
                      <ArrowRight size={16} strokeWidth={2} style={{ marginTop: 2, flexShrink: 0, color: emp.ink }} aria-hidden />
                      <span>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
                <div>
                  <div className="vh-kicker">Example output</div>
                  <div className="vh-output" style={{ marginTop: 10 }}>{role.output}</div>
                </div>
                {tools.length > 0 && (
                  <div>
                    <div className="vh-kicker">Works in</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                      {tools.slice(0, 7).map(t => <ToolIcon key={t.slug} name={t.name} logoUrl={t.logoUrl} size={36} />)}
                      {tools.length > 7 && (
                        <span style={{ alignSelf: 'center', fontSize: 13, color: T.ink3, marginLeft: 4 }}>+{tools.length - 7} more</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Link
              href={`/agents/${active}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 22, fontSize: 14.5, fontWeight: 550, color: T.ink, textDecoration: 'none', borderBottom: `1px solid ${T.line2}`, paddingBottom: 2 }}
            >
              Everything {emp.name} can do <ArrowRight size={15} aria-hidden />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Delegate, don't prompt ──────────────────────────────────────────────────────────────── */

function useStepper(total: number, run: boolean, stepMs: number): number {
  const reduced = useReducedMotion();
  const [done, setDone] = useState(0);
  useEffect(() => {
    if (!run || reduced || done >= total) return;
    const t = setTimeout(() => setDone(d => d + 1), stepMs);
    return () => clearTimeout(t);
  }, [run, done, total, stepMs, reduced]);
  // With reduced motion, the steps show as finished instead of animating.
  return reduced && run ? total : done;
}

export function DelegateSection() {
  const [ref, seen] = useInView<HTMLDivElement>(0.35);
  const done = useStepper(VEQIRO_STEPS.length, seen, 650);

  return (
    <section className="vq-section-pad vh-dark" aria-labelledby="vh-delegate-title">
      <div className="vq-shell">
        <Reveal>
          <Kicker center>From instruction to finished work</Kicker>
          <h2 id="vh-delegate-title" className="vh-h2 vh-center" style={{ textAlign: 'center', color: T.inkInv }}>
            Don&rsquo;t just ask AI. Delegate to it.
          </h2>
          <p className="vh-lede vh-center" style={{ textAlign: 'center' }}>
            ChatGPT gives you an answer. Veqiro gets the work done.
          </p>
        </Reveal>

        <div ref={ref} className="vh-vs">
          <div className="vh-vs-card">
            <div className="vh-kicker">A general AI chat</div>
            <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
              <div className="vh-bubble" style={{ background: 'rgba(242,236,224,0.08)', justifySelf: 'end', maxWidth: '85%' }}>
                Create this week&rsquo;s campaign for our new product.
              </div>
              <div className="vh-bubble" style={{ background: 'rgba(242,236,224,0.03)', border: `1px solid ${T.lineInv}`, maxWidth: '85%' }}>
                Here&rsquo;s a draft caption. Now you&rsquo;ll need to&hellip;
              </div>
            </div>
            <ol className="vh-manual">
              {CHATBOT_STEPS.map(s => (
                <li key={s}><span className="vh-you">YOU</span><span>{s}</span></li>
              ))}
            </ol>
            <p style={{ marginTop: 16, fontSize: 14, color: T.inkInv2 }}>An answer, and six more jobs for you.</p>
          </div>

          <div className="vh-vs-card is-veqiro">
            <div className="vh-kicker" style={{ color: T.amber }}>Veqiro</div>
            <div className="vh-bubble" style={{ background: 'rgba(245,197,24,0.14)', marginTop: 16 }}>
              Create this week&rsquo;s campaign for our new product.
            </div>
            <ol className="vh-pipe">
              {VEQIRO_STEPS.map((s, i) => (
                <li key={s} className="vh-pipe-step" data-state={i < done ? 'done' : i === done ? 'active' : 'waiting'}>
                  <span className="vh-tick" aria-hidden>✓</span>
                  <span style={{ flex: 1 }}>{s}</span>
                  {i === 0 && <span style={{ fontSize: 12, color: T.inkInv2 }}>Maya</span>}
                </li>
              ))}
            </ol>
            <p style={{ marginTop: 16, fontSize: 14, color: done >= VEQIRO_STEPS.length ? T.inkInv : T.inkInv2 }}>
              {done >= VEQIRO_STEPS.length ? 'Publish-ready: waiting for your approval.' : 'Working…'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Real work examples ──────────────────────────────────────────────────────────────────── */

function Artifact({ agent }: { agent: string }) {
  if (agent === 'maya') {
    // Made with the same image model Maya uses, for a fictional chai brand. The images carry no
    // lettering; the headline is HTML set over them, so it is always crisp and correctly spelled.
    const posts = [
      { img: '/examples/maya-mumbai.jpg', h: 'Mumbai, your chai just arrived.', cap: 'Kadak chai, delivered across Mumbai.', tag: '#MumbaiChai', alt: 'A clay kulhad of chai on the Marine Drive sea wall at dusk in the monsoon' },
      { img: '/examples/maya-monsoon.jpg', h: 'Monsoon mornings, sorted.', cap: 'Rain outside. Kulhad inside.', tag: '#MonsoonMood', alt: 'A steaming kulhad of chai on a rainy Mumbai windowsill' },
      { img: '/examples/maya-brew.jpg', h: 'Brewed in 3 minutes.', cap: 'Dhaba taste, no dhaba wait.', tag: '#3MinuteChai', alt: 'Masala chai being poured from a brass pot into a row of clay kulhads' },
      { img: '/examples/maya-launch.jpg', h: 'Launch week only.', cap: '20% off your first box.', tag: '#LaunchWeek', alt: 'A chai gift box of kulhads and tins with marigolds and a brass diya' },
    ];
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))', gap: 8 }}>
          {posts.map(p => (
            <div key={p.h} style={{ borderRadius: 12, border: `1px solid ${T.line}`, background: '#fff', overflow: 'hidden', fontSize: 11 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 8px' }}>
                <span aria-hidden style={{ width: 14, height: 14, borderRadius: '50%', background: 'linear-gradient(135deg,#F5C518,#F06464)' }} />
                <span style={{ fontWeight: 600, color: T.ink }}>kulhad.co</span>
              </div>
              <div style={{ position: 'relative', aspectRatio: '3 / 4', background: T.surface2 }}>
                <Image src={p.img} alt={p.alt} fill sizes="(max-width: 900px) 45vw, 160px" style={{ objectFit: 'cover' }} />
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', padding: 10,
                  background: 'linear-gradient(180deg, transparent 45%, rgba(0,0,0,0.62))',
                  color: '#fff', fontFamily: FONT.display, fontWeight: 600, fontSize: 14, lineHeight: 1.12, letterSpacing: '-0.02em',
                }}>
                  {p.h}
                </div>
              </div>
              <div style={{ padding: '7px 8px 9px', lineHeight: 1.35, color: T.ink2 }}>
                {p.cap} <span style={{ color: '#2f6fd6' }}>{p.tag}</span>
              </div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 14, color: T.ink2, margin: '12px 0 0', lineHeight: 1.5 }}>
          4 posts with captions and hashtags · Instagram and LinkedIn · <strong style={{ color: T.ink }}>ready for your approval</strong>
        </p>
      </div>
    );
  }
  if (agent === 'vega') {
    const items = [
      { who: 'Priya · Saffron Packaging', what: 'Needs the order confirmed by noon', state: 'Reply drafted' },
      { who: 'Anjali · investor', what: 'Asked for the September numbers', state: 'Reply drafted' },
      { who: 'Calendar', what: '2pm clashes with the supplier call', state: 'Move to Thu, needs your OK' },
    ];
    return (
      <div>
        <div style={{ fontFamily: FONT.display, fontSize: 19, fontWeight: 600, letterSpacing: '-0.02em' }}>
          Good morning: 3 things need you today.
        </div>
        <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
          {items.map(i => (
            <div key={i.who} style={{ padding: '11px 12px', borderRadius: 12, background: T.surface2, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{i.who}</div>
                <div style={{ fontSize: 13, color: T.ink2 }}>{i.what}</div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 9px', borderRadius: 999, background: i.state.includes('OK') ? 'rgba(245,197,24,0.25)' : 'rgba(29,188,135,0.15)', color: i.state.includes('OK') ? '#7a5b00' : '#0E7A56', whiteSpace: 'nowrap' }}>
                {i.state}
              </span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 13, color: T.ink3, margin: '12px 0 0' }}>38 threads triaged · 6 replies drafted · nothing sent without you</p>
      </div>
    );
  }
  if (agent === 'sage') {
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[['Keyword', 'masala chai online'], ['Intent', 'Buy: commercial'], ['Length', '~1,600 words']].map(([k, v]) => (
            <div key={k} style={{ padding: '8px 11px', borderRadius: 10, background: T.surface2 }}>
              <div style={{ fontSize: 11, color: T.ink3 }}>{k}</div>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{v}</div>
            </div>
          ))}
        </div>
        <div>
          <div className="vh-kicker" style={{ fontSize: 10 }}>Title options</div>
          <div style={{ fontSize: 14, marginTop: 6, lineHeight: 1.45 }}>Buy Masala Chai Online: 7 Blends Worth Your Morning</div>
          <div style={{ fontSize: 14, marginTop: 2, lineHeight: 1.45, color: T.ink2 }}>The Honest Guide to Ordering Masala Chai Online</div>
        </div>
        <div>
          <div className="vh-kicker" style={{ fontSize: 10 }}>Outline</div>
          <ol style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13.5, lineHeight: 1.6, color: T.ink }}>
            <li>What makes a masala chai blend authentic</li>
            <li>Loose leaf vs. premix: which to buy</li>
            <li>How to brew dhaba-style chai at home</li>
            <li>Where to buy online, and what to check</li>
          </ol>
        </div>
        <p style={{ fontSize: 13, color: T.ink3, margin: 0 }}>+ 6 questions to answer · 3 gaps competitors miss · CTA</p>
      </div>
    );
  }
  if (agent === 'scout') {
    const rows = [
      ['Brewnest', '₹399 / 250g', 'Fast delivery', 'No gifting range'],
      ['Leafora', '₹449 / 250g', 'Strong Instagram', 'Slow support replies'],
      ['Chaiwise', '₹299 / 250g', 'Lowest price', 'Weak brand story'],
    ];
    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
          <thead>
            <tr>{['Competitor', 'Pricing', 'Their edge', 'Your opening'].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontFamily: FONT.mono, fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.ink3, borderBottom: `1px solid ${T.line}` }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r[0]}>
                {r.map((c, i) => (
                  <td key={c} style={{ padding: '10px', borderBottom: `1px solid ${T.line}`, fontWeight: i === 0 ? 600 : 400, color: i === 3 ? '#0E7A56' : T.ink }}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 13, color: T.ink3, margin: '10px 0 0' }}>3 profiles filed · 11 sources cited</p>
      </div>
    );
  }
  if (agent === 'lex') {
    const clauses = [
      ['4.2 Termination', 'Supplier can exit without notice', 'High', '#F06464'],
      ['5.1 Liability', 'Capped at 30 days of fees', 'High', '#F06464'],
      ['6.0 Your data', 'Supplier may reuse your data', 'Medium', '#E0A800'],
    ];
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 14px', borderRadius: 12, background: 'rgba(240,100,100,0.1)' }}>
          <span style={{ fontWeight: 600 }}>Overall risk</span>
          <span style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: '0.12em', padding: '4px 9px', borderRadius: 6, background: '#F06464', color: '#fff' }}>HIGH</span>
        </div>
        {clauses.map(c => (
          <div key={c[0]} style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '10px 2px', borderBottom: `1px solid ${T.line}`, fontSize: 14 }}>
            <span style={{ fontWeight: 600, minWidth: 108 }}>{c[0]}</span>
            <span style={{ flex: 1, color: T.ink2 }}>{c[1]}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: c[3] }}>{c[2]}</span>
          </div>
        ))}
        <p style={{ fontSize: 14, color: T.ink2, margin: '12px 0 0' }}>
          Recommendation: <strong style={{ color: T.ink }}>negotiate before signing</strong>, 3 changes drafted.
        </p>
      </div>
    );
  }
  // Delivered revenue in lakh, from the same orders file as the KPIs above. Bars are labelled
  // with their value, so the axis can start above zero to make the month-to-month change visible.
  const months = [['Jan', 12.68], ['Feb', 13.65], ['Mar', 14.97], ['Apr', 13.33]] as const;
  const floor = 11;
  const max = 15;
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 8 }}>
        {[
          ['Revenue · March', '₹14,97,426', '+9.7% vs Feb'],
          ['Orders', '1,253', 'Delivered'],
          ['Return rate', '7.5%', 'Delhi highest'],
          ['Top city', 'Mumbai', '52.5% of revenue'],
        ].map(k => (
          <div key={k[0]} style={{ padding: '12px', borderRadius: 12, background: T.surface2 }}>
            <div style={{ fontSize: 12, color: T.ink3 }}>{k[0]}</div>
            <div style={{ fontFamily: FONT.display, fontSize: 21, fontWeight: 600, letterSpacing: '-0.02em', marginTop: 2 }}>{k[1]}</div>
            <div style={{ fontSize: 12, color: T.ink2 }}>{k[2]}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 104, marginTop: 14, padding: '0 4px' }} aria-label="Delivered revenue by month, January to April, in lakh rupees">
        {months.map(([m, v]) => (
          <div key={m} style={{ flex: 1, display: 'grid', gap: 4, justifyItems: 'center' }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: m === 'Mar' ? T.ink : T.ink2 }}>₹{v.toFixed(1)}L</span>
            <div style={{ width: '100%', height: `${((v - floor) / (max - floor)) * 64 + 6}px`, borderRadius: 6, background: m === 'Mar' ? T.amber : T.line2 }} />
            <span style={{ fontSize: 11, color: T.ink3 }}>{m}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function WorkExamplesSection() {
  const [active, setActive] = useState(0);
  const [ref, seen] = useInView<HTMLDivElement>(0.3);
  const example = WORK_EXAMPLES[active];
  const reduced = useReducedMotion();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!seen || reduced || progress >= example.steps.length) return;
    const t = setTimeout(() => setProgress(d => d + 1), 560);
    return () => clearTimeout(t);
  }, [seen, progress, example.steps.length, reduced]);

  // Switching tabs restarts the steps (see the tab's onClick); reduced motion shows them finished.
  const done = reduced ? example.steps.length : progress;
  const pick = (i: number) => { setActive(i); setProgress(0); };

  const emp = agentOf(example.agent);
  const ready = done >= example.steps.length;

  return (
    <section id="examples" className="vq-section-pad" style={{ background: T.surface2 }} aria-labelledby="vh-ex-title">
      <div className="vq-shell">
        <Reveal>
          <Kicker center>Real work, not demos</Kicker>
          <h2 id="vh-ex-title" className="vh-h2 vh-center" style={{ textAlign: 'center' }}>Watch the work get done.</h2>
          <p className="vh-lede vh-center" style={{ textAlign: 'center' }}>
            One instruction in. A finished deliverable out, the kind you would otherwise spend the afternoon on.
          </p>
        </Reveal>

        <div className="vh-ex-tabs" role="tablist" aria-label="Examples">
          {WORK_EXAMPLES.map((ex, i) => (
            <button
              key={ex.agent}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-controls="vh-ex-panel"
              className="vh-ex-tab"
              onClick={() => pick(i)}
            >
              <AgentFace agent={ex.agent} size={26} radius={999} />
              {agentOf(ex.agent).name}
            </button>
          ))}
        </div>

        <div ref={ref} id="vh-ex-panel" role="tabpanel" className="vh-ex">
          <div className="vh-ex-card">
            <div className="vh-kicker">You</div>
            <p style={{ fontFamily: FONT.display, fontSize: 'clamp(20px, 2.2vw, 26px)', fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.2, margin: '8px 0 20px' }}>
              &ldquo;{example.ask}&rdquo;
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <AgentFace agent={example.agent} size={30} radius={999} />
              <span style={{ fontSize: 14, fontWeight: 600 }}>{emp.name}</span>
              <span style={{ fontSize: 13, color: T.ink3 }}>{ready ? 'finished' : 'working…'}</span>
            </div>
            <ol className="vh-ex-steps">
              {example.steps.map((s, i) => (
                <li key={s} className="vh-ex-step" data-state={i < done ? 'done' : i === done ? 'active' : 'waiting'}>
                  <span className="vh-tick" aria-hidden>✓</span>{s}
                </li>
              ))}
            </ol>
          </div>

          <div className="vh-ex-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div className="vh-kicker">Deliverable</div>
              <span style={{ fontSize: 12, color: T.ink3 }}>Example output</span>
            </div>
            <div className="vh-artifact" data-ready={ready}>
              <Artifact agent={example.agent} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
