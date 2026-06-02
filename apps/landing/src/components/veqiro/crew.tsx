'use client';
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { EMPLOYEES, Employee } from './data';
import { CHARACTER_COMPONENTS } from './characters';
import { FONT } from './shared';
import { crewReplies, crewFollows, consoleUrl } from '@/lib/site-config';

function CrewCard({ emp, i, active, onClick }: { emp: Employee; i: number; active: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  const Comp = CHARACTER_COMPONENTS[emp.key];
  const rot = [-2, 1.5, -1, 2, -2, 1][i % 6];

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      style={{
        background: '#111', border: '3px solid #111', borderRadius: 8,
        padding: 0, cursor: 'pointer',
        transform: `rotate(${hover ? 0 : rot}deg) translateY(${hover ? -6 : 0}px)`,
        transition: 'transform 220ms cubic-bezier(.2,.9,.3,1.2), box-shadow 220ms',
        boxShadow: hover ? `10px 10px 0 ${emp.color}` : `6px 6px 0 #111`,
        overflow: 'hidden',
        outline: active ? `4px solid ${emp.color}` : 'none',
        outlineOffset: active ? 4 : 0,
        position: 'relative',
      }}>
      <Link
        href={`/agents/${emp.key}`}
        onClick={e => e.stopPropagation()}
        aria-label={`Open ${emp.name}'s page in the app`}
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 2,
          width: 34,
          height: 34,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#fff',
          color: '#111',
          border: '2px solid #111',
          borderRadius: 8,
          boxShadow: `3px 3px 0 ${emp.color}`,
          textDecoration: 'none',
        }}
      >
        <ExternalLink size={16} strokeWidth={2.5} />
      </Link>
      <div style={{ background: emp.color }}>
        <Comp size="100%" />
      </div>
      <div style={{ padding: '16px 18px 20px', background: '#111', color: '#EFE7D6' }}>
        <div style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.7 }}>
          {emp.role}
        </div>
        <div style={{ fontFamily: FONT.display, fontSize: 56, lineHeight: 1, color: emp.color, marginTop: 4 }}>
          {emp.name}
        </div>
        <Link
          href={`/agents/${emp.key}`}
          onClick={e => e.stopPropagation()}
          style={{
            display: 'inline-block',
            marginTop: 12,
            fontFamily: FONT.mono,
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: 2,
            color: emp.color,
            textDecoration: 'none',
            borderBottom: `1px solid ${emp.color}`,
            paddingBottom: 1,
          }}
        >
          {/* Meet {emp.name} → */}
        </Link>
      </div>
    </div>
  );
}

export function CrewSection({ onSelect, activeKey }: { onSelect: (k: string) => void; activeKey: string }) {
  const cards = [...EMPLOYEES, ...EMPLOYEES];

  return (
    <section id="crew" style={{ background: '#111', padding: 'clamp(56px, 8vw, 80px) 0', color: '#EFE7D6' }}>
      <style>{`
        @keyframes crew-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .crew-track { animation: crew-scroll 22s linear infinite; }
        .crew-track:hover { animation-play-state: paused; }
      `}</style>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 clamp(16px, 4vw, 32px)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20, marginBottom: 'clamp(32px, 5vw, 48px)' }}>
          <div>
            <div style={{ fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3, textTransform: 'uppercase', color: '#F5C518', marginBottom: 12 }}>
              [ THE CREW ]
            </div>
            <h2 style={{ fontFamily: FONT.display, fontSize: 'clamp(44px, 7vw, 104px)', margin: 0, lineHeight: 0.9, letterSpacing: -1, color: '#EFE7D6' }}>
              your crew, <span style={{ color: '#F5C518' }}>one bill.</span>
            </h2>
          </div>
          <p style={{ maxWidth: 420, fontFamily: FONT.body, fontSize: 'clamp(15px, 2vw, 18px)', lineHeight: 1.5, color: '#CFC6B2', margin: 0 }}>
            Each one has a specialty, a personality, and opinions about your brand voice.
            Click a card to put them to work.
          </p>
        </div>
      </div>

      {/* Carousel — full bleed, overflows the section padding */}
      <div style={{ overflow: 'hidden' }}>
        <div className="crew-track" style={{ display: 'flex', gap: 'clamp(14px, 2.5vw, 24px)', width: 'max-content' }}>
          {cards.map((emp, i) => (
            <div key={`${emp.key}-${i}`} className="vq-crew-card">
              <CrewCard emp={emp} i={i % EMPLOYEES.length} active={activeKey === emp.key} onClick={() => onSelect(emp.key)} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function getReply(k: string): string {
  return crewReplies[k] ?? "Got it.";
}

function getFollow(k: string): string {
  return crewFollows[k] ?? "On it.";
}

export function DeskPanel({ active, onNavigate }: { active: string; onNavigate: (key: string) => void }) {
  const emp = EMPLOYEES.find(e => e.key === active)!;
  const idx = EMPLOYEES.findIndex(e => e.key === active);
  const prevKey = EMPLOYEES[(idx - 1 + EMPLOYEES.length) % EMPLOYEES.length].key;
  const nextKey = EMPLOYEES[(idx + 1) % EMPLOYEES.length].key;
  const [msgs, setMsgs] = useState<{ who: string; text: string }[]>([]);
  const [typing, setTyping] = useState(false);
  const Comp = CHARACTER_COMPONENTS[emp.key];
  const sectionRef = useRef<HTMLElement>(null);
  const firstRunRef = useRef(true);

  useEffect(() => {
    // Replay chat animation when active employee changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMsgs([]);
    setTyping(true);
    const t1 = setTimeout(() => { setTyping(false); setMsgs([{ who: emp.name, text: emp.quote }]); }, 900);
    const t2 = setTimeout(() => { setMsgs(m => [...m, { who: 'you', text: getReply(emp.key) }]); }, 2400);
    const t3 = setTimeout(() => { setTyping(true); }, 2800);
    const t4 = setTimeout(() => { setTyping(false); setMsgs(m => [...m, { who: emp.name, text: getFollow(emp.key) }]); }, 3800);

    // Smooth-scroll the panel into view on every change except the first mount,
    // so visiting the landing page doesn't jump past the hero.
    if (firstRunRef.current) {
      firstRunRef.current = false;
    } else if (sectionRef.current) {
      const reduceMotion =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      sectionRef.current.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    }

    return () => [t1, t2, t3, t4].forEach(clearTimeout);
  }, [active, emp.name, emp.quote, emp.key]);

  return (
    <section ref={sectionRef} style={{ background: '#EFE7D6', padding: 'clamp(56px, 8vw, 80px) clamp(16px, 4vw, 32px)', borderTop: '3px solid #111' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div className="desk-grid">
          {/* LEFT: portrait + meta */}
          <div>
            <div style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: '#111', opacity: 0.7, marginBottom: 12 }}>
              {`>`} currently working with:
            </div>
            <div style={{ position: 'relative', maxWidth: 'min(420px, 90vw)' }}>
              <div style={{ background: emp.color, border: '3px solid #111', borderRadius: 12, boxShadow: '8px 8px 0 #111', overflow: 'hidden' }}>
                <Comp size="100%" />
              </div>
              <button
                type="button"
                onClick={() => onNavigate(prevKey)}
                aria-label={`Switch to previous agent (${EMPLOYEES.find(e => e.key === prevKey)?.name})`}
                style={{
                  position: 'absolute', top: '50%', left: -22,
                  transform: 'translateY(-50%)',
                  width: 44, height: 44, borderRadius: '50%',
                  background: '#fff', color: '#111',
                  border: '3px solid #111', boxShadow: '3px 3px 0 #111',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', padding: 0,
                }}
              >
                <ChevronLeft size={22} strokeWidth={2.5} />
              </button>
              <button
                type="button"
                onClick={() => onNavigate(nextKey)}
                aria-label={`Switch to next agent (${EMPLOYEES.find(e => e.key === nextKey)?.name})`}
                style={{
                  position: 'absolute', top: '50%', right: -22,
                  transform: 'translateY(-50%)',
                  width: 44, height: 44, borderRadius: '50%',
                  background: '#fff', color: '#111',
                  border: '3px solid #111', boxShadow: '3px 3px 0 #111',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', padding: 0,
                }}
              >
                <ChevronRight size={22} strokeWidth={2.5} />
              </button>
            </div>
            <h3 style={{ fontFamily: FONT.display, fontSize: 'clamp(56px, 12vw, 96px)', lineHeight: 0.9, margin: '24px 0 0', color: '#111' }}>
              {emp.name}
            </h3>
            <div style={{ fontFamily: FONT.head, fontSize: 14, letterSpacing: 1, textTransform: 'uppercase', marginTop: 8, color: emp.ink, display: 'inline-block', background: emp.color, padding: '6px 12px', border: '2px solid #111', borderRadius: 6 }}>
              {emp.role}
            </div>
            <p style={{ fontFamily: FONT.body, fontSize: 'clamp(16px, 2.2vw, 20px)', fontStyle: 'italic', marginTop: 20, color: '#333' }}>
              &ldquo;{emp.tag}&rdquo;
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
              {emp.skills.map(s => (
                <span key={s} style={{ fontFamily: FONT.mono, fontSize: 12, padding: '6px 12px', background: '#fff', border: '2px solid #111', borderRadius: 999 }}>
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* RIGHT: chat mock */}
          <div style={{ background: '#fff', border: '3px solid #111', borderRadius: 16, boxShadow: '10px 10px 0 #111', overflow: 'hidden', transform: 'rotate(-0.6deg)', marginTop: 'clamp(24px, 5vw, 60px)' }}>
            <div style={{ background: emp.color, padding: '14px 18px', borderBottom: '3px solid #111', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', border: '2px solid #111', background: '#fff', flexShrink: 0 }}>
                <Comp size={40} />
              </div>
              <div>
                <div style={{ fontFamily: FONT.head, fontSize: 15 }}>{emp.name} · {emp.role}</div>
                <div style={{ fontFamily: FONT.mono, fontSize: 11, opacity: 0.7, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1DBC87', boxShadow: '0 0 0 2px #fff', display: 'inline-block' }} />
                  online · typing in 42 languages
                </div>
              </div>
            </div>
            <div style={{ padding: 'clamp(16px, 3vw, 24px) clamp(14px, 3vw, 20px)', minHeight: 320, display: 'flex', flexDirection: 'column', gap: 14, background: '#FFF9ED' }}>
              {msgs.map((m, i) => (
                <div key={i} style={{
                  alignSelf: m.who === 'you' ? 'flex-end' : 'flex-start', maxWidth: '78%',
                  background: m.who === 'you' ? '#111' : emp.color,
                  color: m.who === 'you' ? '#EFE7D6' : '#111',
                  padding: '12px 16px', border: '2.5px solid #111',
                  borderRadius: m.who === 'you' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  fontFamily: FONT.body, fontSize: 16, lineHeight: 1.4,
                  boxShadow: '3px 3px 0 #111', animation: 'pop 260ms cubic-bezier(.2,.9,.3,1.4)',
                }}>
                  {m.who !== 'you' && (
                    <div style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.7, marginBottom: 4 }}>
                      {m.who}
                    </div>
                  )}
                  {m.text}
                </div>
              ))}
              {typing && (
                <div style={{ alignSelf: 'flex-start', background: emp.color, padding: '12px 16px', border: '2.5px solid #111', borderRadius: '16px 16px 16px 4px', boxShadow: '3px 3px 0 #111', display: 'flex', gap: 4, alignItems: 'center' }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{ width: 8, height: 8, background: '#111', borderRadius: '50%', display: 'inline-block', animation: `bounce 1.2s ${i * 0.15}s infinite ease-in-out` }} />
                  ))}
                </div>
              )}
            </div>
            <div style={{ padding: '12px 16px', borderTop: '3px solid #111', background: '#EFE7D6', display: 'flex', gap: 10 }}>
              <input readOnly placeholder={`Message ${emp.name}...`} style={{ flex: 1, border: '2px solid #111', borderRadius: 999, padding: '10px 16px', fontFamily: FONT.body, fontSize: 14, background: '#fff' }} />
              <button style={{ background: '#111', color: '#EFE7D6', border: 'none', borderRadius: 999, padding: '10px 18px', fontFamily: FONT.head, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, cursor: 'pointer' }}>
                Send →
              </button>
            </div>
          </div>
        </div>

        {/* stats strip */}
        <div className="stats-grid" style={{ marginTop: 'clamp(32px, 6vw, 64px)' }}>
          {emp.stats.map(s => (
            <div key={s.k} style={{ border: '3px solid #111', borderRadius: 12, padding: 'clamp(18px, 3vw, 24px) clamp(16px, 3vw, 20px)', background: '#fff', boxShadow: `6px 6px 0 ${emp.color}` }}>
              <div style={{ fontFamily: FONT.display, fontSize: 'clamp(40px, 6vw, 56px)', lineHeight: 1, color: emp.ink }}>{s.v}</div>
              <div style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', marginTop: 6 }}>{s.k}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
