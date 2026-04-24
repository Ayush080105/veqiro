'use client';
import React from 'react';
import Link from 'next/link';
import { FONT, Button } from './shared';
import { PageNav } from './page-nav';
import { MobileChatDemo } from './mobile-chat';
import { CHARACTER_COMPONENTS } from './characters';
import { mainAppUrl } from '@/lib/site-config';
import type { Employee } from './data';
import { EMPLOYEES } from './data';
import { JsonLd } from '@/components/veqiro/json-ld';
import { personAgentJsonLd, breadcrumbJsonLd } from '@/lib/jsonld';
import { SITE_URL, AGENT_META } from '@/lib/seo';

interface Props {
  employee: Employee;
}

export function AgentPage({ employee }: Props) {
  const Comp = CHARACTER_COMPONENTS[employee.key];
  const crumbs = [
    { name: 'Home', url: SITE_URL },
    { name: 'Agents', url: `${SITE_URL}/#crew` },
    { name: employee.name, url: `${SITE_URL}/agents/${employee.key}` },
  ];

  return (
    <div style={{ background: '#EFE7D6', minHeight: '100vh' }}>
      <PageNav />
      <JsonLd data={[personAgentJsonLd(employee), breadcrumbJsonLd(crumbs)]} />

      {/* ── HERO ── */}
      <section style={{
        background: employee.color,
        borderTop: '3px solid #111',
        borderBottom: '3px solid #111',
        padding: 'clamp(40px, 7vw, 64px) clamp(20px, 4vw, 32px) clamp(56px, 8vw, 80px)',
      }}>
        <div
          className="agent-hero-grid"
          style={{
            maxWidth: 1400,
            margin: '0 auto',
            gridTemplateColumns: 'minmax(220px, 280px) 1fr minmax(280px, 320px)',
          }}
        >
          {/* LEFT: Character ID card */}
          <div
            className="agent-id-card"
            style={{
              border: '3px solid #111',
              borderRadius: 16,
              overflow: 'hidden',
              boxShadow: '8px 8px 0 #111',
              flexShrink: 0,
            }}
          >
            {/* Photo */}
            <div style={{ aspectRatio: '3/4', position: 'relative', background: '#111' }}>
              <Comp size="100%" />
            </div>
            {/* Name plate */}
            <div style={{
              padding: '14px 16px',
              background: '#111',
              borderTop: '3px solid #222',
            }}>
              <div style={{ fontFamily: FONT.display, fontSize: 28, lineHeight: 1, color: employee.color }}>
                {employee.name}
              </div>
              <div style={{
                fontFamily: FONT.mono, fontSize: 10, letterSpacing: 2,
                textTransform: 'uppercase' as const, color: '#888', marginTop: 5,
              }}>
                {employee.role}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#1DBC87', flexShrink: 0 }} />
                <span style={{ fontFamily: FONT.mono, fontSize: 10, color: '#666' }}>Available now</span>
              </div>
            </div>
          </div>

          {/* MIDDLE: Content */}
          <div>
            <Link href="/#crew" style={{
              fontFamily: FONT.mono, fontSize: 12, textTransform: 'uppercase' as const, letterSpacing: 2,
              color: employee.ink, textDecoration: 'none', marginBottom: 28, display: 'inline-block', opacity: 0.75,
            }}>
              ← The Crew
            </Link>

            <div style={{
              fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3,
              textTransform: 'uppercase' as const, color: employee.ink, marginBottom: 12, opacity: 0.7,
            }}>
              [ AI EMPLOYEE ]
            </div>

            <h1 style={{
              fontFamily: FONT.display, fontSize: 'clamp(56px, 8vw, 112px)',
              margin: 0, lineHeight: 0.9, letterSpacing: -2, color: '#111',
            }}>
              {employee.name}
            </h1>

            {AGENT_META[employee.key] && (
              <div style={{
                display: 'inline-flex', alignItems: 'center',
                marginTop: 10,
                background: employee.color,
                border: '2px solid #111',
                borderRadius: 999,
                padding: '5px 14px',
                fontFamily: FONT.mono,
                fontSize: 11,
                letterSpacing: 2,
                textTransform: 'uppercase',
                color: employee.ink,
              }}>
                {AGENT_META[employee.key].seoTitleSuffix.replace(' | Veqiro', '')}
              </div>
            )}

            <div style={{
              fontFamily: FONT.head, fontSize: 'clamp(16px, 2vw, 22px)',
              marginTop: 14, color: employee.ink, fontWeight: 700,
            }}>
              {employee.role}
            </div>

            <p style={{
              fontFamily: FONT.body, fontSize: 'clamp(15px, 1.6vw, 18px)',
              marginTop: 16, color: employee.ink, lineHeight: 1.6, maxWidth: 480,
            }}>
              {employee.description}
            </p>

            {/* Stats */}
            <div style={{ display: 'flex', gap: 36, marginTop: 36, flexWrap: 'wrap' }}>
              {employee.stats.map(s => (
                <div key={s.k}>
                  <div style={{ fontFamily: FONT.display, fontSize: 36, color: '#111', lineHeight: 1 }}>{s.v}</div>
                  <div style={{
                    fontFamily: FONT.mono, fontSize: 10, letterSpacing: 2,
                    textTransform: 'uppercase' as const, color: employee.ink, marginTop: 5, opacity: 0.8,
                  }}>
                    {s.k}
                  </div>
                </div>
              ))}
            </div>

            {/* Skills pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 24 }}>
              {employee.skills.map(s => (
                <span key={s} style={{
                  fontFamily: FONT.mono, fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: 1,
                  padding: '6px 12px', background: 'rgba(0,0,0,0.15)',
                  border: `1.5px solid ${employee.ink}`,
                  borderRadius: 999, color: employee.ink, opacity: 0.85,
                }}>
                  {s}
                </span>
              ))}
            </div>

            {/* CTAs */}
            <div style={{ display: 'flex', gap: 14, marginTop: 36, flexWrap: 'wrap' }}>
              <Button variant="dark" href={`${mainAppUrl}/signup`}>
                Hire {employee.name} →
              </Button>
              <Button variant="ghost" href="/pricing">View pricing</Button>
            </div>
          </div>

          {/* RIGHT: Chat demo */}
          <MobileChatDemo employee={employee} />
        </div>
      </section>

      {/* ── CAPABILITIES ── */}
      <section className="vq-section-pad" style={{ borderBottom: '3px solid #111' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <div style={{ marginBottom: 'clamp(36px, 6vw, 56px)' }}>
            <div style={{
              fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3,
              textTransform: 'uppercase' as const, color: '#666', marginBottom: 16,
            }}>
              [ WHAT {employee.name.toUpperCase()} DOES ]
            </div>
            <h2 style={{ fontFamily: FONT.display, fontSize: 'clamp(40px, 6vw, 80px)', margin: 0, lineHeight: 0.92 }}>
              real work.<br />
              <span style={{
                background: employee.color, padding: '0 18px', display: 'inline-block',
                transform: 'rotate(-1.5deg)', border: '3px solid #111', borderRadius: 8, boxShadow: '5px 5px 0 #111',
              }}>
                every day.
              </span>
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
            {employee.capabilities.map((cap, i) => (
              <div key={cap.title} style={{
                background: '#fff', border: '3px solid #111', borderRadius: 14,
                padding: '28px 24px', boxShadow: '6px 6px 0 #111',
                transform: `rotate(${i % 2 === 0 ? -0.7 : 0.7}deg)`,
              }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%', background: employee.color,
                  border: '2px solid #111', marginBottom: 18,
                }} />
                <h3 style={{ fontFamily: FONT.head, fontSize: 19, margin: '0 0 10px' }}>{cap.title}</h3>
                <p style={{ fontFamily: FONT.body, fontSize: 15, lineHeight: 1.65, color: '#333', margin: 0 }}>
                  {cap.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SKILLS TICKER ── */}
      <div style={{
        background: '#111', color: '#EFE7D6', padding: '16px 0',
        borderBottom: '3px solid #111', overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', gap: 48,
          animation: 'marquee 22s linear infinite',
          whiteSpace: 'nowrap',
        }}>
          {[...employee.skills, ...employee.skills, ...employee.skills, ...employee.skills, ...employee.skills].map((s, i) => (
            <span key={i} style={{
              fontFamily: FONT.head, fontSize: 'clamp(11px, 2vw, 13px)', textTransform: 'uppercase' as const, letterSpacing: 2,
            }}>
              ★ {s}
            </span>
          ))}
        </div>
      </div>

      {/* ── USE CASES ── */}
      <section className="vq-section-pad" style={{ background: '#FFF9ED', borderBottom: '3px solid #111' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <div style={{ marginBottom: 'clamp(32px, 5vw, 48px)' }}>
            <div style={{
              fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3,
              textTransform: 'uppercase' as const, color: '#666', marginBottom: 16,
            }}>
              [ USE CASES ]
            </div>
            <h2 style={{ fontFamily: FONT.display, fontSize: 'clamp(36px, 5vw, 64px)', margin: 0, lineHeight: 0.95 }}>
              who hires {employee.name}?
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            {employee.useCases.map((uc, i) => (
              <div key={i} style={{
                border: '3px solid #111', borderRadius: 12, padding: '24px 20px',
                background: '#EFE7D6', boxShadow: '5px 5px 0 #111',
              }}>
                <div style={{
                  display: 'inline-block', background: employee.color, border: '2px solid #111',
                  borderRadius: 999, padding: '4px 12px', fontFamily: FONT.mono, fontSize: 10,
                  textTransform: 'uppercase' as const, letterSpacing: 2, marginBottom: 14, color: employee.ink,
                }}>
                  Use case {i + 1}
                </div>
                <p style={{ fontFamily: FONT.body, fontSize: 16, margin: 0, lineHeight: 1.55 }}>{uc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── QUOTE ── */}
      <section className="vq-section-pad" style={{ background: '#111', borderBottom: '3px solid #111' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            fontFamily: FONT.display, fontSize: 'clamp(24px, 3.5vw, 48px)',
            color: '#EFE7D6', lineHeight: 1.25,
          }}>
            "{employee.quote}"
          </div>
          <div style={{
            marginTop: 28, fontFamily: FONT.mono, fontSize: 12, letterSpacing: 3,
            textTransform: 'uppercase' as const, color: employee.color,
          }}>
            — {employee.name}, {employee.role}
          </div>
        </div>
      </section>

      {/* ── REST OF THE CREW ── */}
      <section style={{ borderBottom: '3px solid #111', background: '#FFF9ED', padding: 'clamp(40px, 6vw, 60px) clamp(20px, 4vw, 32px)' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <div style={{
            fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3,
            textTransform: 'uppercase', color: '#666', marginBottom: 32,
          }}>
            [ THE REST OF THE CREW ]
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 16,
          }}>
            {EMPLOYEES.filter(e => e.key !== employee.key).map(e => {
              const EmpComp = CHARACTER_COMPONENTS[e.key];
              return (
                <a
                  key={e.key}
                  href={`/agents/${e.key}`}
                  style={{
                    textDecoration: 'none',
                    color: 'inherit',
                    border: '3px solid #111',
                    borderRadius: 14,
                    overflow: 'hidden',
                    boxShadow: '4px 4px 0 #111',
                    display: 'block',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  }}
                >
                  <div style={{ aspectRatio: '3/4', background: e.color, position: 'relative' }}>
                    <EmpComp size="100%" />
                  </div>
                  <div style={{
                    background: '#111',
                    padding: '10px 12px',
                    borderTop: '2px solid #333',
                  }}>
                    <div style={{ fontFamily: FONT.display, fontSize: 18, color: e.color, lineHeight: 1 }}>{e.name}</div>
                    <div style={{ fontFamily: FONT.mono, fontSize: 9, color: '#666', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1.5 }}>{e.role}</div>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="vq-section-pad">
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3,
            textTransform: 'uppercase' as const, color: '#666', marginBottom: 20,
          }}>
            [ READY? ]
          </div>
          <h2 style={{ fontFamily: FONT.display, fontSize: 'clamp(48px, 7vw, 96px)', margin: '0 0 28px', lineHeight: 0.9 }}>
            hire {employee.name}<br />
            <span style={{
              background: employee.color, padding: '0 18px', display: 'inline-block',
              border: '3px solid #111', borderRadius: 8, boxShadow: '5px 5px 0 #111',
            }}>
              today.
            </span>
          </h2>
          <p style={{ fontFamily: FONT.body, fontSize: 'clamp(15px, 2vw, 18px)', color: '#555', marginBottom: 44 }}>
            Start with {employee.name} on the Crew plan at $39/mo, or try free for 7 days — no card needed.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button variant="dark" href={`${mainAppUrl}/signup`}>Start free →</Button>
            <Button variant="ghost" href="/pricing">View pricing</Button>
          </div>
        </div>
      </section>
    </div>
  );
}
