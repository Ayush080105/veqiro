'use client';
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { EMPLOYEES, Employee } from './data';
import { FONT, T, SectionHead } from './shared';
import { crewReplies, crewFollows } from '@/lib/site-config';

function roleOf(emp: Employee): string {
  return emp.role.replace(/\n/g, ' ');
}

/* ──────────────────────────────────────────────────────────────
   Agent roster
   ────────────────────────────────────────────────────────────── */

function AgentCard({ emp, active, onSelect }: {
  emp: Employee; active: boolean; onSelect: () => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      aria-pressed={active}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      style={{
        background: T.surface,
        border: `1px solid ${active ? T.line2 : T.line}`,
        borderRadius: 16,
        overflow: 'hidden',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: hover || active ? T.shadow : T.shadowSm,
        transform: hover ? 'translateY(-3px)' : 'none',
        transition: 'transform 200ms cubic-bezier(0.32,0.72,0,1), box-shadow 200ms ease, border-color 200ms ease',
        outline: active ? `1.5px solid ${emp.color}` : 'none',
        outlineOffset: -1,
      }}
    >
      {/* Portrait */}
      <div style={{
        position: 'relative',
        aspectRatio: '4 / 3',
        overflow: 'hidden',
        background: `${emp.color}1A`,
        borderBottom: `1px solid ${T.line}`,
      }}>
        <Image
          src={`/${emp.name}.jpeg`}
          alt={`${emp.name} — ${roleOf(emp)}`}
          fill
          sizes="(max-width: 700px) 100vw, 380px"
          style={{
            objectFit: 'cover',
            objectPosition: 'center 22%',
            transform: hover ? 'scale(1.03)' : 'scale(1)',
            transition: 'transform 400ms cubic-bezier(0.32,0.72,0,1)',
          }}
        />
      </div>

      {/* Meta */}
      <div style={{ padding: '18px 20px 20px', display: 'grid', gap: 8, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span aria-hidden style={{
            width: 7, height: 7, borderRadius: 2, background: emp.color, flexShrink: 0,
          }} />
          <span style={{
            fontFamily: FONT.mono, fontSize: 10.5, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: T.ink3,
          }}>
            {roleOf(emp)}
          </span>
        </div>

        <div style={{
          fontFamily: FONT.display, fontSize: 22, fontWeight: 600,
          letterSpacing: '-0.03em', color: T.ink, lineHeight: 1.1,
        }}>
          {emp.name}
        </div>

        <p style={{
          fontFamily: FONT.body, fontSize: 14.5, lineHeight: 1.6,
          color: T.ink2, margin: 0, flex: 1,
        }}>
          {emp.tag}
        </p>

        <Link
          href={`/agents/${emp.key}`}
          onClick={e => e.stopPropagation()}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontFamily: FONT.body, fontSize: 13.5, fontWeight: 500,
            color: T.ink, textDecoration: 'none', marginTop: 4,
          }}
        >
          What {emp.name} does
          <ArrowRight size={14} strokeWidth={2} />
        </Link>
      </div>
    </div>
  );
}

export function CrewSection({ onSelect, activeKey }: {
  onSelect: (k: string) => void; activeKey: string;
}) {
  return (
    <section id="agents" className="vq-section-pad" style={{ background: T.bg }}>
      <div className="vq-shell">
        <SectionHead
          eyebrow="The team"
          title="Six specialists, each with one job"
          lede="Every agent owns a function end to end — its own tools, its own outputs, its own price. Take one, or take all six."
        />

        <div style={{
          marginTop: 'clamp(36px, 5vw, 56px)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 'clamp(16px, 2vw, 24px)',
        }}>
          {EMPLOYEES.map(emp => (
            <AgentCard
              key={emp.key}
              emp={emp}
              active={activeKey === emp.key}
              onSelect={() => onSelect(emp.key)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────
   Working session — a real exchange with the selected agent
   ────────────────────────────────────────────────────────────── */

function getReply(k: string): string {
  return crewReplies[k] ?? 'Got it.';
}

function getFollow(k: string): string {
  return crewFollows[k] ?? 'On it.';
}

export function DeskPanel({ active, onNavigate }: {
  active: string; onNavigate: (key: string) => void;
}) {
  const emp = EMPLOYEES.find(e => e.key === active) ?? EMPLOYEES[0];
  const [msgs, setMsgs] = useState<{ who: string; text: string }[]>([]);
  const [typing, setTyping] = useState(false);
  const firstRunRef = useRef(true);

  useEffect(() => {
    // Replay the exchange whenever the selected agent changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMsgs([]);
    setTyping(true);
    const t1 = setTimeout(() => { setTyping(false); setMsgs([{ who: emp.name, text: emp.quote }]); }, 700);
    const t2 = setTimeout(() => { setMsgs(m => [...m, { who: 'you', text: getReply(emp.key) }]); }, 2000);
    const t3 = setTimeout(() => setTyping(true), 2400);
    const t4 = setTimeout(() => { setTyping(false); setMsgs(m => [...m, { who: emp.name, text: getFollow(emp.key) }]); }, 3400);

    if (firstRunRef.current) firstRunRef.current = false;

    return () => [t1, t2, t3, t4].forEach(clearTimeout);
  }, [active, emp.name, emp.quote, emp.key]);

  return (
    <section
      className="vq-section-pad"
      style={{ background: T.surface2, borderTop: `1px solid ${T.line}` }}
    >
      <div className="vq-shell">
        <div className="desk-grid">
          {/* Left: who you're working with */}
          <div>
            <div className="vq-eyebrow" style={{ marginBottom: 18 }}>
              Working with
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{
                width: 72, height: 72, borderRadius: 16, overflow: 'hidden',
                border: `1px solid ${T.line}`, flexShrink: 0, display: 'block',
                boxShadow: T.shadowSm,
              }}>
                <Image
                  src={`/${emp.name}.jpeg`}
                  alt={`${emp.name} — ${roleOf(emp)}`}
                  width={144}
                  height={144}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </span>
              <div>
                <div style={{
                  fontFamily: FONT.display, fontSize: 'clamp(26px, 3.4vw, 36px)',
                  fontWeight: 600, letterSpacing: '-0.035em', lineHeight: 1.05, color: T.ink,
                }}>
                  {emp.name}
                </div>
                <div style={{
                  fontFamily: FONT.body, fontSize: 14.5, color: T.ink2, marginTop: 5,
                }}>
                  {roleOf(emp)}
                </div>
              </div>
            </div>

            <p style={{
              fontFamily: FONT.body, fontSize: 'clamp(15px, 1.6vw, 16.5px)',
              lineHeight: 1.68, color: T.ink2, marginTop: 22, maxWidth: '46ch',
            }}>
              {emp.description}
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 22 }}>
              {emp.skills.map(s => (
                <span key={s} style={{
                  fontFamily: FONT.body, fontSize: 13, color: T.ink2,
                  padding: '5px 11px', background: T.surface,
                  border: `1px solid ${T.line}`, borderRadius: 999,
                }}>
                  {s}
                </span>
              ))}
            </div>

            {/* Agent switcher */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 26 }}>
              {EMPLOYEES.map(e => (
                <button
                  key={e.key}
                  type="button"
                  onClick={() => onNavigate(e.key)}
                  aria-pressed={e.key === active}
                  style={{
                    fontFamily: FONT.body, fontSize: 13, fontWeight: 500,
                    padding: '7px 13px', borderRadius: 999, cursor: 'pointer',
                    background: e.key === active ? T.ink : 'transparent',
                    color: e.key === active ? T.inkInv : T.ink2,
                    border: `1px solid ${e.key === active ? T.ink : T.line2}`,
                    transition: 'background 140ms ease, color 140ms ease',
                  }}
                >
                  {e.name}
                </button>
              ))}
            </div>
          </div>

          {/* Right: the exchange */}
          <div style={{
            background: T.surface,
            border: `1px solid ${T.line}`,
            borderRadius: 18,
            boxShadow: T.shadow,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{
              padding: '14px 18px',
              borderBottom: `1px solid ${T.line}`,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span aria-hidden style={{
                width: 7, height: 7, borderRadius: '50%', background: T.green,
                flexShrink: 0,
              }} />
              <span style={{
                fontFamily: FONT.mono, fontSize: 11, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: T.ink3,
              }}>
                {emp.name} · active
              </span>
            </div>

            <div style={{
              padding: 'clamp(18px, 3vw, 24px)',
              minHeight: 300,
              display: 'flex', flexDirection: 'column', gap: 12,
              flex: 1,
            }}>
              {msgs.map((m, i) => {
                const mine = m.who === 'you';
                return (
                  <div key={i} style={{
                    alignSelf: mine ? 'flex-end' : 'flex-start',
                    maxWidth: '84%',
                    background: mine ? T.ink : T.surface2,
                    color: mine ? T.inkInv : T.ink,
                    border: mine ? 'none' : `1px solid ${T.line}`,
                    padding: '12px 15px',
                    borderRadius: mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    fontFamily: FONT.body, fontSize: 14.5, lineHeight: 1.6,
                    animation: 'pop 240ms cubic-bezier(0.32,0.72,0,1)',
                  }}>
                    {m.text}
                  </div>
                );
              })}
              {typing && (
                <div style={{
                  alignSelf: 'flex-start', background: T.surface2,
                  border: `1px solid ${T.line}`, padding: '13px 15px',
                  borderRadius: '14px 14px 14px 4px',
                  display: 'flex', gap: 4, alignItems: 'center',
                }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{
                      width: 5, height: 5, background: T.ink3, borderRadius: '50%',
                      display: 'inline-block',
                      animation: `bounce 1.2s ${i * 0.15}s infinite ease-in-out`,
                    }} />
                  ))}
                </div>
              )}
            </div>

            <div style={{
              padding: '12px 16px',
              borderTop: `1px solid ${T.line}`,
              display: 'flex', gap: 10, alignItems: 'center',
            }}>
              <span style={{
                flex: 1, fontFamily: FONT.body, fontSize: 14, color: T.ink3,
              }}>
                Message {emp.name}…
              </span>
              <span aria-hidden style={{
                width: 28, height: 28, borderRadius: '50%', background: T.ink,
                color: T.inkInv, display: 'inline-flex', alignItems: 'center',
                justifyContent: 'center', flexShrink: 0, fontSize: 14,
              }}>
                ↑
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
