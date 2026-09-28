'use client';
import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { FONT, T } from '../shared';
import { HERO_WORK } from './home-data';
import { Ctas, TrustLine, agentOf, useReducedMotion } from './home-ui';

const STEP_MS = 1400;
const HOLD_MS = 2600;

/** Six agents placed evenly around the core, starting at the top. */
const ORBIT = HERO_WORK.map((w, i) => {
  const a = (i / HERO_WORK.length) * Math.PI * 2 - Math.PI / 2;
  return { agent: w.agent, left: `${50 + 50 * Math.cos(a)}%`, top: `${50 + 50 * Math.sin(a)}%` };
});

/**
 * Work goes in, Veqiro works, finished work comes out. Each item on the left is picked up in
 * turn (its agent lights up on the core) and lands, done, on the right; the loop then resets.
 */
function WorkFlow() {
  const reduced = useReducedMotion();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const last = tick >= HERO_WORK.length;
    const t = setTimeout(() => setTick(last ? 0 : tick + 1), last ? HOLD_MS : STEP_MS);
    return () => clearTimeout(t);
  }, [tick, reduced]);

  // With reduced motion, show the finished state instead of animating towards it.
  const step = reduced ? HERO_WORK.length : tick;

  const activeAgent = step < HERO_WORK.length ? HERO_WORK[step].agent : null;

  return (
    <div className="vh-flow" aria-label="Your pending work being handled by Veqiro's AI employees">
      <div className="vh-panel vh-pile" style={{ position: 'relative' }}>
        <div className="vh-panel-head"><span>Your week</span><span>{Math.max(HERO_WORK.length - step, 0)} open</span></div>
        {HERO_WORK.map((w, i) => (
          <div key={w.pile} className="vh-row" data-state={i < step ? 'taken' : i === step ? 'active' : 'waiting'}>
            <span className="vh-dot" style={{ background: agentOf(w.agent).color }} />
            <span>{w.pile}</span>
          </div>
        ))}
        <span className="vh-beam vh-beam-r" aria-hidden />
      </div>

      <div className="vh-core" aria-hidden>
        <span className="vh-core-ring" />
        <span className="vh-core-ring is-inner" />
        <span className="vh-core-glow" />
        <div className="vh-orbit">
          {ORBIT.map(o => (
            <span key={o.agent} data-on={o.agent === activeAgent} style={{ left: o.left, top: o.top }}>
              <Image src={`/${agentOf(o.agent).name}.jpeg`} alt="" width={68} height={68}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </span>
          ))}
        </div>
        <div className="vh-core-label">
          Veqiro
          <small>{activeAgent ? `${agentOf(activeAgent).name} on it` : 'All done'}</small>
        </div>
      </div>

      <div className="vh-panel vh-done" style={{ position: 'relative' }}>
        <div className="vh-panel-head"><span>Done</span><span>{Math.min(step, HERO_WORK.length)} / {HERO_WORK.length}</span></div>
        {HERO_WORK.map((w, i) => (
          <div key={w.done} className="vh-row" data-state={i < step ? 'done' : 'waiting'}>
            <span className="vh-tick" aria-hidden>✓</span>
            <span>{w.done}</span>
          </div>
        ))}
        <span className="vh-beam vh-beam-l" aria-hidden />
      </div>
    </div>
  );
}

export function HeroWork() {
  return (
    <section className="vh-hero" aria-labelledby="vh-hero-title">
      <div className="vh-hero-grid-bg" aria-hidden />
      <div className="vq-shell" style={{ paddingTop: 'clamp(40px, 5vw, 64px)', paddingBottom: 'clamp(56px, 8vw, 96px)', textAlign: 'center' }}>
        <h1 id="vh-hero-title" className="vh-hero-h1" style={{ marginTop: 8 }}>
          You didn&rsquo;t start a business to manage <em>busywork.</em>
        </h1>

        <p style={{
          fontFamily: FONT.body, fontSize: 'clamp(16px, 1.8vw, 20px)', lineHeight: 1.6, color: T.inkInv2,
          maxWidth: '58ch', margin: '20px auto 0',
        }}>
          Veqiro gives your business AI employees that handle the work behind the scenes,
          from content and research to SEO, contracts, operations and reporting.
        </p>

        <div style={{ marginTop: 28 }}>
          <Ctas center />
          <TrustLine center items={['No credit card', 'Set up in minutes', 'AI employees from $9/month']} />
        </div>

        <WorkFlow />
      </div>
    </section>
  );
}
