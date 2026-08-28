'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FONT, T } from './shared';
import { ToolInline } from './tool-logo';
import { getAllTools } from './native-tools';
import { examplePrompts, type PromptSegment } from '@/lib/site-config';

const TYPE_MS = 20;      // per character
const HOLD_MS = 2600;    // pause on a finished prompt
const CLEAR_MS = 420;    // fade-out before the next prompt

function isTool(seg: PromptSegment): seg is { tool: string; slug: string } {
  return 'tool' in seg;
}

function segLength(seg: PromptSegment): number {
  return isTool(seg) ? seg.tool.length : seg.text.length;
}

/**
 * Cycling "delegation" composer. Types each example prompt out character by
 * character — tool pills materialise inline as their name is typed — holds,
 * then moves to the next agent. Falls back to the fully-typed first prompt
 * when the visitor prefers reduced motion.
 */
export function PromptComposer() {
  const allTools = useMemo(() => getAllTools(), []);
  const logoBySlug = useMemo(
    () => Object.fromEntries(allTools.map(t => [t.slug, t.logoUrl])) as Record<string, string | undefined>,
    [allTools],
  );

  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState(0);
  const [clearing, setClearing] = useState(false);
  const [reduced, setReduced] = useState(false);

  const prompt = examplePrompts[index];
  const total = useMemo(
    () => prompt.segments.reduce((sum, s) => sum + segLength(s), 0),
    [prompt],
  );

  // Respect the reduced-motion preference: no typing, no cycling.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (reduced) return;

    // Clear any timers left from the previous prompt before scheduling new ones.
    timers.current.forEach(clearTimeout);
    timers.current = [];

    if (typed < total) {
      const t = setTimeout(() => setTyped(n => n + 1), TYPE_MS);
      timers.current.push(t);
      return () => clearTimeout(t);
    }

    // Finished typing: hold, fade out, advance.
    const hold = setTimeout(() => {
      setClearing(true);
      const next = setTimeout(() => {
        setClearing(false);
        setTyped(0);
        setIndex(i => (i + 1) % examplePrompts.length);
      }, CLEAR_MS);
      timers.current.push(next);
    }, HOLD_MS);
    timers.current.push(hold);

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [typed, total, reduced]);

  const shown = reduced ? total : typed;
  const done = shown >= total;

  // Walk the segments, spending the revealed-character budget across them.
  const rendered: React.ReactNode[] = [];
  let budget = shown;
  for (let i = 0; i < prompt.segments.length; i++) {
    const seg = prompt.segments[i];
    if (budget <= 0) break;
    const len = segLength(seg);
    const take = Math.min(budget, len);

    if (isTool(seg)) {
      rendered.push(
        <ToolInline
          key={`${prompt.agent}-${i}`}
          name={seg.tool.slice(0, take)}
          logoUrl={logoBySlug[seg.slug]}
        />,
      );
    } else {
      rendered.push(
        <React.Fragment key={`${prompt.agent}-${i}`}>{seg.text.slice(0, take)}</React.Fragment>,
      );
    }
    budget -= take;
  }

  return (
    <div style={{ maxWidth: 780, margin: '0 auto' }}>
      <style>{`
        @keyframes vq-caret { 0%, 45% { opacity: 1; } 55%, 100% { opacity: 0; } }
      `}</style>

      <div
        style={{
          background: T.surface,
          border: `1px solid ${T.line2}`,
          borderRadius: 20,
          boxShadow: T.shadow,
          padding: 'clamp(20px, 3vw, 26px)',
          opacity: clearing ? 0 : 1,
          transition: `opacity ${CLEAR_MS}ms ease`,
        }}
      >
        {/* Prompt line — min-height holds the box steady as the text grows */}
        <div
          aria-live="polite"
          style={{
            fontFamily: FONT.body,
            fontSize: 'clamp(15px, 1.7vw, 17px)',
            lineHeight: 1.75,
            color: T.ink2,
            minHeight: '3.5em',
          }}
        >
          {rendered}
          <span
            aria-hidden
            style={{
              display: 'inline-block',
              width: 2,
              height: '1.05em',
              background: T.ink,
              marginLeft: 2,
              transform: 'translateY(3px)',
              animation: done ? 'vq-caret 1.1s steps(1) infinite' : 'none',
            }}
          />
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, marginTop: 18, paddingTop: 14, borderTop: `1px solid ${T.line}`,
        }}>
          <span style={{
            fontFamily: FONT.mono, fontSize: 11, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: T.ink3,
            transition: 'opacity 200ms ease',
          }}>
            {prompt.agentLabel}
          </span>
          <span
            aria-hidden
            style={{
              width: 32, height: 32, borderRadius: '50%',
              background: done ? T.ink : T.line2,
              color: done ? T.inkInv : T.ink3,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, fontSize: 15,
              transition: 'background 260ms ease, color 260ms ease',
            }}
          >
            ↑
          </span>
        </div>
      </div>

      {/* Progress dots double as the agent indicator */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 7, marginTop: 20,
      }}>
        {examplePrompts.map((p, i) => (
          <button
            key={p.agent}
            type="button"
            aria-label={`Show the ${p.agentLabel} example`}
            onClick={() => {
              setClearing(false);
              setTyped(0);
              setIndex(i);
            }}
            style={{
              width: i === index ? 22 : 7, height: 7, padding: 0,
              borderRadius: 999, border: 'none', cursor: 'pointer',
              background: i === index ? T.ink : T.line2,
              transition: 'width 260ms ease, background 260ms ease',
            }}
          />
        ))}
      </div>

      <p style={{
        textAlign: 'center', marginTop: 16,
        fontFamily: FONT.body, fontSize: 14, color: T.ink3,
        minHeight: '1.4em',
        transition: 'opacity 200ms ease',
      }}>
        {prompt.outcome}
      </p>
    </div>
  );
}
