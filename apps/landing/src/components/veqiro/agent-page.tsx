'use client';
import React from 'react';
import Link from 'next/link';
import { FONT, Button } from './shared';
import { PageNav } from './page-nav';
import { MobileChatDemo } from './mobile-chat';
import { CHARACTER_COMPONENTS } from './characters';
import { consoleUrl, isPreLaunch, waitlistUrl } from '@/lib/site-config';
import type { Employee } from './data';
import { EMPLOYEES } from './data';
import { JsonLd } from '@/components/veqiro/json-ld';
import { Breadcrumbs } from '@/components/veqiro/breadcrumbs';
import { personAgentJsonLd, faqPageJsonLd } from '@/lib/jsonld';
import { SITE_URL, AGENT_META } from '@/lib/seo';
import { agentPricing } from '@/lib/site-config';
import { ToolTile } from './tool-logo';
import type { AgentSlug } from '@repo/integrations-catalog';
import { getAllToolsByAgent } from './native-tools';

interface Props {
  employee: Employee;
}

export function AgentPage({ employee }: Props) {
  const Comp = CHARACTER_COMPONENTS[employee.key];
  const agentMonthlyPrice = agentPricing.find((a) => a.key === employee.key)?.monthly;
  const connectedTools = getAllToolsByAgent(employee.key as AgentSlug);
  const crumbs = [
    { name: 'Home', url: SITE_URL },
    { name: 'Agents', url: `${SITE_URL}/#crew` },
    { name: employee.name, url: `${SITE_URL}/agents/${employee.key}` },
  ];

  return (
    <div style={{ background: '#EFE7D6', minHeight: '100vh' }}>
      <PageNav />
      <JsonLd data={[personAgentJsonLd(employee), faqPageJsonLd(employee.faq)]} />

      {/* ── BREADCRUMBS ── */}
      <div style={{
        background: '#111',
        borderTop: '1px solid rgba(20,18,14,0.10)',
        padding: '4px clamp(20px, 4vw, 32px)',
      }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <Breadcrumbs items={crumbs} theme="dark" />
        </div>
      </div>

      {/* ── HERO ──
          The accent is a wash behind the cream ground rather than a flat
          fill: at full saturation it swamped the page and left the body copy
          sitting on a mid-tone. */}
      <section style={{
        position: 'relative',
        background: `
          linear-gradient(180deg, ${employee.color}26 0%, ${employee.color}0D 42%, rgba(239,231,214,0) 78%),
          #EFE7D6
        `,
        borderBottom: '1px solid rgba(20,18,14,0.10)',
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
              border: '1px solid rgba(20,18,14,0.10)',
              borderRadius: 16,
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(20,18,14,0.05), 0 8px 24px -6px rgba(20,18,14,0.09)',
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
              borderTop: '1px solid #222',
            }}>
              <div style={{ fontFamily: FONT.display, fontWeight: 600, letterSpacing: '-0.03em', fontSize: 28, lineHeight: 1, color: employee.color }}>
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
              AI employee
            </div>

            <h1 style={{
              fontFamily: FONT.display, fontWeight: 600, letterSpacing: '-0.03em', fontSize: 'clamp(56px, 8vw, 112px)',
              margin: 0, lineHeight: 0.9, color: '#111',
            }}>
              {employee.name}
            </h1>

            {AGENT_META[employee.key] && (
              <div style={{
                display: 'inline-flex', alignItems: 'center',
                marginTop: 10,
                background: `${employee.color}26`,
                border: `1px solid ${employee.color}`,
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
                  <div style={{ fontFamily: FONT.display, fontWeight: 600, letterSpacing: '-0.03em', fontSize: 36, color: '#111', lineHeight: 1 }}>{s.v}</div>
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
                  padding: '6px 12px', background: '#FBF7EF',
                  border: '1px solid rgba(20,18,14,0.10)',
                  borderRadius: 999, color: '#56514A',
                }}>
                  {s}
                </span>
              ))}
            </div>

            {/* CTAs */}
            <div style={{ display: 'flex', gap: 14, marginTop: 36, flexWrap: 'wrap' }}>
              <Button variant="dark" href={isPreLaunch ? waitlistUrl : `${consoleUrl}/signup`}>
                {isPreLaunch ? 'Join the waitlist →' : `Hire ${employee.name} →`}
              </Button>
              <Button variant="ghost" href="/pricing">View pricing</Button>
            </div>
          </div>

          {/* RIGHT: Chat demo */}
          <MobileChatDemo employee={employee} />
        </div>
      </section>

      {/* ── CAPABILITIES ── */}
      <section className="vq-section-pad" style={{ borderBottom: '1px solid rgba(20,18,14,0.10)' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <div style={{ marginBottom: 'clamp(36px, 6vw, 56px)' }}>
            <div style={{
              fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3,
              textTransform: 'uppercase' as const, color: '#666', marginBottom: 16,
            }}>
              What {employee.name} does
            </div>
            <h2 style={{ fontFamily: FONT.display, fontWeight: 600, letterSpacing: '-0.03em', fontSize: 'clamp(40px, 6vw, 80px)', margin: 0, lineHeight: 0.92 }}>
              Real work.<br />
              <span>
                Every day.
              </span>
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
            {employee.capabilities.map((cap) => (
              <div key={cap.title} style={{
                background: '#fff', border: '1px solid rgba(20,18,14,0.10)', borderRadius: 14,
                padding: '28px 24px', boxShadow: '0 1px 3px rgba(20,18,14,0.05), 0 8px 24px -6px rgba(20,18,14,0.09)',
              }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%', background: employee.color,
                  border: '1px solid rgba(20,18,14,0.10)', marginBottom: 18,
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

      {/* ── CONNECTED TOOLS ── */}
      {connectedTools.length > 0 && (
        <section className="vq-section-pad" style={{ background: '#FBF7EF', borderBottom: '1px solid rgba(20,18,14,0.10)' }}>
          <div style={{ maxWidth: 1400, margin: '0 auto' }}>
            <div style={{ marginBottom: 'clamp(32px, 5vw, 48px)' }}>
              <div style={{
                fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3,
                textTransform: 'uppercase' as const, color: '#666', marginBottom: 16,
              }}>
                [ {employee.name.toUpperCase()}&apos;S TOOLKIT ]
              </div>
              <h2 style={{ fontFamily: FONT.display, fontWeight: 600, letterSpacing: '-0.03em', fontSize: 'clamp(36px, 5vw, 64px)', margin: 0, lineHeight: 0.95 }}>
                Plugs right into<br />
                <span>
                  your stack.
                </span>
              </h2>
              <p style={{ fontFamily: FONT.body, fontSize: 'clamp(15px, 1.9vw, 18px)', color: '#333', marginTop: 20, maxWidth: 640, lineHeight: 1.6 }}>
                {employee.name} already speaks {connectedTools.length}+ of the tools your team runs on — connect them in a click, no setup work required.
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))',
                gap: 'clamp(16px, 2.5vw, 28px) clamp(12px, 2vw, 20px)',
                justifyItems: 'center',
              }}
            >
              {connectedTools.map(tool => (
                <ToolTile key={tool.slug} name={tool.name} logoUrl={tool.logoUrl} accent={employee.color} size={80} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── ACTIONS ── */}
      <section className="vq-section-pad" style={{ background: '#111', borderBottom: '1px solid rgba(20,18,14,0.10)' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <div style={{ marginBottom: 'clamp(28px, 4vw, 40px)' }}>
            <div style={{
              fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3,
              textTransform: 'uppercase' as const, color: '#555', marginBottom: 14,
            }}>
              Things to ask {employee.name}
            </div>
            <h2 style={{
              fontFamily: FONT.display, fontWeight: 600, letterSpacing: '-0.03em', fontSize: 'clamp(32px, 4.5vw, 60px)',
              margin: 0, lineHeight: 0.95, color: '#EFE7D6',
            }}>
              Try saying this.
            </h2>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 12,
          }}>
            {employee.actions.map((action, i) => (
              <div key={i} style={{
                border: `2px solid ${employee.color}33`,
                borderLeft: `1px solid ${employee.color}`,
                borderRadius: 10,
                padding: '14px 18px',
                background: '#1A1A1A',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
              }}>
                <span style={{
                  fontFamily: FONT.mono, fontSize: 11, color: employee.color,
                  letterSpacing: 1, flexShrink: 0, marginTop: 2,
                }}>
                  &gt;_
                </span>
                <span style={{
                  fontFamily: FONT.mono, fontSize: 13, color: '#CCC',
                  lineHeight: 1.55,
                }}>
                  {action}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SKILLS TICKER ── */}
      <div style={{
        background: '#111', color: '#EFE7D6', padding: '16px 0',
        borderBottom: '1px solid rgba(20,18,14,0.10)', overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', gap: 48,
          animation: 'marquee 22s linear infinite',
          whiteSpace: 'nowrap',
        }}>
          {[...employee.skills, ...employee.skills, ...employee.skills, ...employee.skills, ...employee.skills].map((s, i) => (
            <span key={i} style={{
              fontFamily: FONT.mono, fontSize: 'clamp(10px, 1.6vw, 12px)',
              textTransform: 'uppercase' as const, letterSpacing: 2,
              display: 'inline-flex', alignItems: 'center', gap: 12,
              color: '#A9A192',
            }}>
              <span aria-hidden style={{
                width: 3, height: 3, borderRadius: '50%',
                background: employee.color, flexShrink: 0,
              }} />
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* ── HOW IT HELPS + WORKFLOW ── */}
      <section className="vq-section-pad" style={{ borderBottom: '1px solid rgba(20,18,14,0.10)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ marginBottom: 'clamp(32px, 5vw, 48px)', maxWidth: 820 }}>
            <div style={{
              fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3,
              textTransform: 'uppercase' as const, color: '#666', marginBottom: 16,
            }}>
              How {employee.name} helps
            </div>
            <h2 style={{ fontFamily: FONT.display, fontWeight: 600, letterSpacing: '-0.03em', fontSize: 'clamp(36px, 5vw, 64px)', margin: '0 0 24px', lineHeight: 0.95 }}>
              What {employee.name} actually<br />
              <span>
                does for you.
              </span>
            </h2>
            <p style={{ fontFamily: FONT.body, fontSize: 'clamp(15px, 1.9vw, 18px)', color: '#333', lineHeight: 1.75, margin: 0 }}>
              {employee.howItHelps}
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 20,
            marginTop: 32,
          }}>
            {employee.workflow.map((step, i) => (
              <div key={step.title} style={{
                border: '1px solid rgba(20,18,14,0.10)', borderRadius: 14, padding: '24px 22px',
                background: '#FBF7EF', boxShadow: '0 1px 3px rgba(20,18,14,0.05), 0 8px 24px -6px rgba(20,18,14,0.09)',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', background: employee.color,
                  border: '1px solid rgba(20,18,14,0.10)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontFamily: FONT.display, fontWeight: 600, letterSpacing: '-0.03em', fontSize: 18,
                  color: employee.ink, marginBottom: 16,
                }}>
                  {i + 1}
                </div>
                <h3 style={{ fontFamily: FONT.head, fontSize: 17, margin: '0 0 10px', lineHeight: 1.3 }}>
                  {step.title}
                </h3>
                <p style={{ fontFamily: FONT.body, fontSize: 14.5, lineHeight: 1.65, color: '#444', margin: 0 }}>
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── OUTCOMES ── */}
      <section className="vq-section-pad" style={{ background: '#FBF7EF', borderBottom: '1px solid rgba(20,18,14,0.10)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ marginBottom: 'clamp(32px, 5vw, 48px)' }}>
            <div style={{
              fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3,
              textTransform: 'uppercase' as const, color: '#666', marginBottom: 16,
            }}>
              What you get
            </div>
            <h2 style={{ fontFamily: FONT.display, fontWeight: 600, letterSpacing: '-0.03em', fontSize: 'clamp(36px, 5vw, 64px)', margin: 0, lineHeight: 0.95 }}>
              Real outcomes.<br />
              <span>
                Not vibes.
              </span>
            </h2>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 18,
          }}>
            {employee.outcomes.map((out, i) => (
              <div key={out.title} style={{
                border: '1px solid rgba(20,18,14,0.10)', borderRadius: 12, padding: '22px 20px',
                background: '#EFE7D6', boxShadow: '0 1px 3px rgba(20,18,14,0.05), 0 8px 24px -6px rgba(20,18,14,0.09)',
              }}>
                <div style={{
                  display: 'inline-block', background: `${employee.color}26`, color: employee.ink,
                  border: `1px solid ${employee.color}`, borderRadius: 999, padding: '4px 12px',
                  fontFamily: FONT.mono, fontSize: 10, letterSpacing: 2,
                  textTransform: 'uppercase' as const, marginBottom: 14,
                }}>
                  Outcome {String(i + 1).padStart(2, '0')}
                </div>
                <h3 style={{ fontFamily: FONT.head, fontSize: 17, margin: '0 0 10px', lineHeight: 1.3 }}>
                  {out.title}
                </h3>
                <p style={{ fontFamily: FONT.body, fontSize: 14.5, lineHeight: 1.65, color: '#444', margin: 0 }}>
                  {out.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── USE CASES ── */}
      <section className="vq-section-pad" style={{ borderBottom: '1px solid rgba(20,18,14,0.10)' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <div style={{ marginBottom: 'clamp(32px, 5vw, 48px)' }}>
            <div style={{
              fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3,
              textTransform: 'uppercase' as const, color: '#666', marginBottom: 16,
            }}>
              Use cases
            </div>
            <h2 style={{ fontFamily: FONT.display, fontWeight: 600, letterSpacing: '-0.03em', fontSize: 'clamp(36px, 5vw, 64px)', margin: 0, lineHeight: 0.95 }}>
              Who hires {employee.name}?
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            {employee.useCases.map((uc, i) => (
              <div key={i} style={{
                border: '1px solid rgba(20,18,14,0.10)', borderRadius: 12, padding: '24px 20px',
                background: '#FBF7EF', boxShadow: '0 1px 3px rgba(20,18,14,0.05), 0 8px 24px -6px rgba(20,18,14,0.09)',
              }}>
                <div style={{
                  display: 'inline-block', background: `${employee.color}26`, border: `1px solid ${employee.color}`,
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

      {/* ── AGENT FAQ ── */}
      <section className="vq-section-pad" style={{ background: '#FBF7EF', borderBottom: '1px solid rgba(20,18,14,0.10)' }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <div style={{ marginBottom: 'clamp(32px, 5vw, 48px)' }}>
            <div style={{
              fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3,
              textTransform: 'uppercase' as const, color: '#666', marginBottom: 16,
            }}>
              FAQ
            </div>
            <h2 style={{ fontFamily: FONT.display, fontWeight: 600, letterSpacing: '-0.03em', fontSize: 'clamp(32px, 4.5vw, 56px)', margin: 0, lineHeight: 0.95 }}>
              About {employee.name}.
            </h2>
          </div>

          <div style={{ display: 'grid', gap: 14 }}>
            {employee.faq.map((item) => (
              <details
                key={item.q}
                style={{
                  border: '1px solid rgba(20,18,14,0.10)', borderRadius: 12,
                  background: '#EFE7D6', boxShadow: '0 1px 3px rgba(20,18,14,0.05), 0 8px 24px -6px rgba(20,18,14,0.09)',
                  overflow: 'hidden',
                }}
              >
                <summary style={{
                  cursor: 'pointer',
                  padding: '18px 22px',
                  fontFamily: FONT.head,
                  fontSize: 'clamp(14px, 1.6vw, 16px)',
                  lineHeight: 1.4,
                  listStyle: 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 16,
                }}>
                  <span>{item.q}</span>
                  <span
                    aria-hidden
                    style={{
                      fontFamily: FONT.display, fontWeight: 600, letterSpacing: '-0.03em',
                      fontSize: 22,
                      color: employee.ink,
                      flexShrink: 0,
                      lineHeight: 1,
                    }}
                  >
                    +
                  </span>
                </summary>
                <div style={{
                  padding: '0 22px 20px',
                  fontFamily: FONT.body,
                  fontSize: 15,
                  lineHeight: 1.75,
                  color: '#333',
                }}>
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── QUOTE ── */}
      <section className="vq-section-pad" style={{ background: '#111', borderBottom: '1px solid rgba(20,18,14,0.10)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            fontFamily: FONT.display, fontWeight: 600, letterSpacing: '-0.03em', fontSize: 'clamp(24px, 3.5vw, 48px)',
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
      <section style={{ borderBottom: '1px solid rgba(20,18,14,0.10)', background: '#FBF7EF', padding: 'clamp(40px, 6vw, 60px) clamp(20px, 4vw, 32px)' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <div style={{
            fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3,
            textTransform: 'uppercase', color: '#666', marginBottom: 32,
          }}>
            The rest of the crew
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
                    border: '1px solid rgba(20,18,14,0.10)',
                    borderRadius: 14,
                    overflow: 'hidden',
                    boxShadow: '0 1px 3px rgba(20,18,14,0.05), 0 8px 24px -6px rgba(20,18,14,0.09)',
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
                    borderTop: '1px solid #333',
                  }}>
                    <div style={{ fontFamily: FONT.display, fontWeight: 600, letterSpacing: '-0.03em', fontSize: 18, color: e.color, lineHeight: 1 }}>{e.name}</div>
                    <div style={{ fontFamily: FONT.mono, fontSize: 9, color: '#A9A192', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1.5 }}>{e.role}</div>
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
            Get started
          </div>
          <h2 style={{ fontFamily: FONT.display, fontWeight: 600, letterSpacing: '-0.03em', fontSize: 'clamp(48px, 7vw, 96px)', margin: '0 0 28px', lineHeight: 0.9 }}>
            Hire {employee.name}<br />
            <span>
              today.
            </span>
          </h2>
          <p style={{ fontFamily: FONT.body, fontSize: 'clamp(15px, 2vw, 18px)', color: '#555', marginBottom: 44 }}>
            Start with {employee.name} for {agentMonthlyPrice != null ? `$${agentMonthlyPrice}/mo` : 'starting at $9/mo'} — billed independently, no bundle — or try free for 7 days, no card needed.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button variant="dark" href={isPreLaunch ? waitlistUrl : `${consoleUrl}/signup`}>{isPreLaunch ? 'Join the waitlist →' : 'Start free →'}</Button>
            <Button variant="ghost" href="/pricing">View pricing</Button>
          </div>
        </div>
      </section>
    </div>
  );
}
