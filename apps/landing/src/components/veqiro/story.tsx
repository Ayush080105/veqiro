'use client';
import React from 'react';
import Image from 'next/image';
import { FONT, T, SectionHead } from './shared';
import { EMPLOYEES } from './data';
import { problemCopy, brainCopy, outcomeStats } from '@/lib/site-config';

const COLOR_BY_AGENT: Record<string, string> = Object.fromEntries(
  EMPLOYEES.map(e => [e.key, e.color]),
);

/* ──────────────────────────────────────────────────────────────
   The problem — six workloads, one person
   ────────────────────────────────────────────────────────────── */

export function ProblemSection() {
  return (
    <section id="problem" className="vq-section-pad" style={{ background: T.bg }}>
      <div className="vq-shell">
        <SectionHead
          eyebrow={problemCopy.eyebrow}
          title={problemCopy.title}
          lede={problemCopy.lede}
        />

        <div
          style={{
            marginTop: 'clamp(40px, 5vw, 64px)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 1,
            background: T.line,
            border: `1px solid ${T.line}`,
            borderRadius: 18,
            overflow: 'hidden',
          }}
        >
          {problemCopy.items.map(item => (
            <div
              key={item.agent}
              style={{
                background: T.surface,
                padding: 'clamp(22px, 3vw, 28px)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                minHeight: 190,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span
                  aria-hidden
                  style={{
                    width: 8, height: 8, borderRadius: 2,
                    background: COLOR_BY_AGENT[item.agent] ?? T.ink3,
                    flexShrink: 0,
                  }}
                />
                <span style={{
                  fontFamily: FONT.display, fontSize: 15.5, fontWeight: 600,
                  letterSpacing: '-0.015em', color: T.ink,
                }}>
                  {item.label}
                </span>
              </div>

              <p style={{
                fontFamily: FONT.body, fontSize: 15, lineHeight: 1.6,
                color: T.ink2, margin: 0, flex: 1,
              }}>
                {item.pain}
              </p>

              <div style={{
                fontFamily: FONT.mono, fontSize: 11, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: T.ink3,
                paddingTop: 12, borderTop: `1px solid ${T.line}`,
              }}>
                {item.cost}
              </div>
            </div>
          ))}
        </div>

        <p style={{
          fontFamily: FONT.display,
          fontSize: 'clamp(19px, 2.3vw, 26px)',
          fontWeight: 500,
          letterSpacing: '-0.025em',
          lineHeight: 1.4,
          color: T.ink,
          maxWidth: '34ch',
          margin: 'clamp(40px, 5vw, 56px) auto 0',
          textAlign: 'center',
        }}>
          Six people can solve this. Six AI agents can too — at a fraction of the cost.
        </p>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────
   Shared-brain diagram — built from components rather than a raster,
   so it stays sharp, matches the palette, and can be edited as copy.
   ────────────────────────────────────────────────────────────── */

function ContextCard({ label, desc }: { label: string; desc: string }) {
  return (
    <div
      style={{
        background: T.dark2,
        border: `1px solid ${T.lineInv}`,
        borderRadius: 12,
        padding: '14px 14px 16px',
        minHeight: 108,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{
        fontFamily: FONT.display, fontSize: 13.5, fontWeight: 600,
        letterSpacing: '-0.01em', color: T.inkInv, lineHeight: 1.25,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: FONT.body, fontSize: 12, lineHeight: 1.5,
        color: T.inkInv2,
      }}>
        {desc}
      </div>
    </div>
  );
}

function AgentNode({ name, role, color }: { name: string; role: string; color: string }) {
  return (
    <div style={{
      display: 'grid', justifyItems: 'center', gap: 8, textAlign: 'center',
    }}>
      <span style={{
        width: 46, height: 46, borderRadius: 12, overflow: 'hidden',
        border: `1px solid ${T.lineInv2}`, display: 'block',
        boxShadow: `0 0 0 3px ${color}22`,
      }}>
        <Image
          src={`/${name}.jpeg`}
          alt=""
          width={92}
          height={92}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </span>
      <span style={{
        fontFamily: FONT.display, fontSize: 13.5, fontWeight: 600,
        color: T.inkInv, letterSpacing: '-0.01em',
      }}>
        {name}
      </span>
      <span style={{
        fontFamily: FONT.body, fontSize: 11.5, lineHeight: 1.35, color: T.inkInv2,
      }}>
        {role}
      </span>
    </div>
  );
}

function BrainDiagram() {
  const stubs = Array.from({ length: 6 }, (_, i) => <span key={i} />);

  return (
    <div className="vq-brain" style={{ marginTop: 'clamp(40px, 5vw, 60px)' }}>
      {/* Inputs */}
      <div className="vq-brain-row">
        {brainCopy.contexts.map(ctx => (
          <ContextCard key={ctx.label} label={ctx.label} desc={ctx.desc} />
        ))}
      </div>

      {/* Inputs → brain */}
      <div className="vq-brain-stubs" aria-hidden>{stubs}</div>
      <div className="vq-brain-rail" aria-hidden />
      <div className="vq-brain-drop" aria-hidden />

      {/* The brain */}
      <div
        style={{
          position: 'relative',
          background: T.dark2,
          border: `1px solid ${T.amber}66`,
          borderRadius: 16,
          padding: '22px 30px',
          textAlign: 'center',
          boxShadow: `0 0 0 6px rgba(245,197,24,0.05), 0 24px 60px -20px rgba(245,197,24,0.30)`,
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute', inset: 0, borderRadius: 16, pointerEvents: 'none',
            background: 'radial-gradient(70% 120% at 50% 0%, rgba(245,197,24,0.16), transparent 70%)',
          }}
        />
        <div style={{ position: 'relative' }}>
          <div style={{
            fontFamily: FONT.mono, fontSize: 10, letterSpacing: '0.18em',
            textTransform: 'uppercase', color: T.amber, marginBottom: 8,
          }}>
            Your company brain
          </div>
          <div style={{
            fontFamily: FONT.display, fontSize: 'clamp(18px, 2.2vw, 24px)',
            fontWeight: 600, letterSpacing: '-0.028em', color: T.inkInv, lineHeight: 1.2,
          }}>
            One source of truth
          </div>
          <div style={{
            fontFamily: FONT.body, fontSize: 13.5, color: T.inkInv2, marginTop: 6,
          }}>
            Read by every agent, before every task
          </div>
        </div>
      </div>

      {/* Brain → agents */}
      <div className="vq-brain-drop" aria-hidden />
      <div className="vq-brain-rail" aria-hidden />
      <div className="vq-brain-stubs" aria-hidden>{stubs}</div>

      {/* Agents */}
      <div className="vq-brain-row vq-brain-row-agents" style={{ marginTop: 4 }}>
        {EMPLOYEES.map(emp => (
          <AgentNode
            key={emp.key}
            name={emp.name}
            role={emp.role.replace(/\n/g, ' ').replace(/^The /, '')}
            color={emp.color}
          />
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   The shared brain
   ────────────────────────────────────────────────────────────── */

export function SharedBrainSection() {
  return (
    <section
      id="brain"
      className="vq-section-pad"
      style={{ background: T.dark, color: T.inkInv }}
    >
      <div className="vq-shell">
        <SectionHead
          center
          invert
          eyebrow={brainCopy.eyebrow}
          title={brainCopy.title}
          lede={brainCopy.lede}
        />

        <BrainDiagram />

        <p style={{
          marginTop: 'clamp(36px, 5vw, 52px)',
          textAlign: 'center',
          fontFamily: FONT.body,
          fontSize: 'clamp(15px, 1.6vw, 17px)',
          lineHeight: 1.7,
          color: T.inkInv2,
          maxWidth: '58ch',
          marginInline: 'auto',
        }}>
          Brief it once. Correct it once. Every agent applies the change from
          then on — which is why the work gets more accurate the longer you
          use it, instead of resetting every session.
        </p>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────
   Outcome metrics
   ────────────────────────────────────────────────────────────── */

export function OutcomesSection() {
  return (
    <section style={{ background: T.bg, padding: '0 var(--vq-gutter)' }}>
      <div className="vq-shell" style={{ padding: 0 }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 1,
          background: T.line,
          border: `1px solid ${T.line}`,
          borderRadius: 18,
          overflow: 'hidden',
        }}>
          {outcomeStats.map(stat => (
            <div
              key={stat.k}
              style={{
                background: T.surface,
                padding: 'clamp(24px, 3vw, 32px) clamp(20px, 2.5vw, 28px)',
              }}
            >
              <div style={{
                fontFamily: FONT.display,
                fontSize: 'clamp(30px, 3.6vw, 42px)',
                fontWeight: 600,
                letterSpacing: '-0.035em',
                lineHeight: 1,
                color: T.ink,
              }}>
                {stat.v}
              </div>
              <div style={{
                fontFamily: FONT.body, fontSize: 13.5, lineHeight: 1.5,
                color: T.ink2, marginTop: 10,
              }}>
                {stat.k}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
