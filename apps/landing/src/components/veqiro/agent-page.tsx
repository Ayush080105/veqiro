'use client';
import React from 'react';
import Link from 'next/link';
import { FONT, Button } from './shared';
import { PageNav } from './page-nav';
import { MobileChatDemo } from './mobile-chat';
import { mainAppUrl } from '@/lib/site-config';
import type { Employee } from './data';

interface Props {
  employee: Employee;
}

export function AgentPage({ employee }: Props) {
  return (
    <div style={{ background: '#EFE7D6', minHeight: '100vh' }}>
      <PageNav />

      {/* ── HERO ── */}
      <section style={{
        background: employee.color,
        borderTop: '3px solid #111',
        borderBottom: '3px solid #111',
        padding: '64px 32px 80px',
      }}>
        <div style={{
          maxWidth: 1400,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 48,
          alignItems: 'center',
        }}>
          <div>
            {/* Breadcrumb */}
            <Link href="/#crew" style={{
              fontFamily: FONT.mono,
              fontSize: 12,
              textTransform: 'uppercase' as const,
              letterSpacing: 2,
              color: employee.ink,
              textDecoration: 'none',
              marginBottom: 28,
              display: 'inline-block',
              opacity: 0.75,
            }}>
              ← The Crew
            </Link>

            {/* Label */}
            <div style={{
              fontFamily: FONT.mono,
              fontSize: 13,
              letterSpacing: 3,
              textTransform: 'uppercase' as const,
              color: employee.ink,
              marginBottom: 12,
              opacity: 0.7,
            }}>
              [ AI EMPLOYEE ]
            </div>

            {/* Name */}
            <h1 style={{
              fontFamily: FONT.display,
              fontSize: 'clamp(72px, 10vw, 140px)',
              margin: 0,
              lineHeight: 0.9,
              letterSpacing: -2,
              color: '#111',
            }}>
              {employee.name}
            </h1>

            {/* Role */}
            <div style={{
              fontFamily: FONT.head,
              fontSize: 'clamp(18px, 2.5vw, 26px)',
              marginTop: 14,
              color: employee.ink,
              fontWeight: 700,
            }}>
              {employee.role}
            </div>

            {/* Description */}
            <p style={{
              fontFamily: FONT.body,
              fontSize: 'clamp(15px, 1.8vw, 19px)',
              marginTop: 18,
              color: employee.ink,
              lineHeight: 1.55,
              maxWidth: 520,
            }}>
              {employee.description}
            </p>

            {/* Stats */}
            <div style={{ display: 'flex', gap: 40, marginTop: 40, flexWrap: 'wrap' }}>
              {employee.stats.map(s => (
                <div key={s.k}>
                  <div style={{ fontFamily: FONT.display, fontSize: 38, color: '#111', lineHeight: 1 }}>
                    {s.v}
                  </div>
                  <div style={{
                    fontFamily: FONT.mono,
                    fontSize: 11,
                    letterSpacing: 2,
                    textTransform: 'uppercase' as const,
                    color: employee.ink,
                    marginTop: 5,
                    opacity: 0.8,
                  }}>
                    {s.k}
                  </div>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div style={{ display: 'flex', gap: 14, marginTop: 44, flexWrap: 'wrap' }}>
              <Button variant="dark" href={`${mainAppUrl}/signup`}>
                Hire {employee.name} →
              </Button>
              <Button variant="ghost" href="/#pricing">See pricing</Button>
            </div>
          </div>

          {/* RIGHT: Chat demo */}
          <MobileChatDemo employee={employee} />
        </div>
      </section>

      {/* ── CAPABILITIES ── */}
      <section style={{ padding: '88px 32px', borderBottom: '3px solid #111' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <div style={{ marginBottom: 56 }}>
            <div style={{
              fontFamily: FONT.mono,
              fontSize: 13,
              letterSpacing: 3,
              textTransform: 'uppercase' as const,
              color: '#666',
              marginBottom: 16,
            }}>
              [ WHAT {employee.name.toUpperCase()} DOES ]
            </div>
            <h2 style={{
              fontFamily: FONT.display,
              fontSize: 'clamp(40px, 6vw, 80px)',
              margin: 0,
              lineHeight: 0.92,
            }}>
              real work.<br />
              <span style={{
                background: employee.color,
                padding: '0 18px',
                display: 'inline-block',
                transform: 'rotate(-1.5deg)',
                border: '3px solid #111',
                borderRadius: 8,
                boxShadow: '5px 5px 0 #111',
              }}>
                every day.
              </span>
            </h2>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 24,
          }}>
            {employee.capabilities.map((cap, i) => (
              <div key={cap.title} style={{
                background: '#fff',
                border: '3px solid #111',
                borderRadius: 14,
                padding: '28px 24px',
                boxShadow: '6px 6px 0 #111',
                transform: `rotate(${i % 2 === 0 ? -0.7 : 0.7}deg)`,
              }}>
                <div style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: employee.color,
                  border: '2px solid #111',
                  marginBottom: 18,
                }} />
                <h3 style={{ fontFamily: FONT.head, fontSize: 19, margin: '0 0 10px' }}>
                  {cap.title}
                </h3>
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
        background: '#111',
        color: '#EFE7D6',
        padding: '16px 0',
        borderBottom: '3px solid #111',
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex',
          gap: 48,
          animation: 'marquee 22s linear infinite',
          whiteSpace: 'nowrap',
        }}>
          {[...employee.skills, ...employee.skills, ...employee.skills, ...employee.skills, ...employee.skills].map((s, i) => (
            <span key={i} style={{
              fontFamily: FONT.head,
              fontSize: 13,
              textTransform: 'uppercase' as const,
              letterSpacing: 2,
            }}>
              ★ {s}
            </span>
          ))}
        </div>
      </div>

      {/* ── USE CASES ── */}
      <section style={{ padding: '88px 32px', background: '#FFF9ED', borderBottom: '3px solid #111' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <div style={{ marginBottom: 48 }}>
            <div style={{
              fontFamily: FONT.mono,
              fontSize: 13,
              letterSpacing: 3,
              textTransform: 'uppercase' as const,
              color: '#666',
              marginBottom: 16,
            }}>
              [ USE CASES ]
            </div>
            <h2 style={{
              fontFamily: FONT.display,
              fontSize: 'clamp(36px, 5vw, 64px)',
              margin: 0,
              lineHeight: 0.95,
            }}>
              who hires {employee.name}?
            </h2>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 20,
          }}>
            {employee.useCases.map((uc, i) => (
              <div key={i} style={{
                border: '3px solid #111',
                borderRadius: 12,
                padding: '24px 20px',
                background: '#EFE7D6',
                boxShadow: '5px 5px 0 #111',
              }}>
                <div style={{
                  display: 'inline-block',
                  background: employee.color,
                  border: '2px solid #111',
                  borderRadius: 999,
                  padding: '4px 12px',
                  fontFamily: FONT.mono,
                  fontSize: 10,
                  textTransform: 'uppercase' as const,
                  letterSpacing: 2,
                  marginBottom: 14,
                  color: employee.ink,
                }}>
                  Use case {i + 1}
                </div>
                <p style={{ fontFamily: FONT.body, fontSize: 16, margin: 0, lineHeight: 1.55 }}>
                  {uc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── QUOTE ── */}
      <section style={{
        padding: '88px 32px',
        background: '#111',
        borderBottom: '3px solid #111',
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            fontFamily: FONT.display,
            fontSize: 'clamp(24px, 3.5vw, 48px)',
            color: '#EFE7D6',
            lineHeight: 1.25,
          }}>
            "{employee.quote}"
          </div>
          <div style={{
            marginTop: 28,
            fontFamily: FONT.mono,
            fontSize: 12,
            letterSpacing: 3,
            textTransform: 'uppercase' as const,
            color: employee.color,
          }}>
            — {employee.name}, {employee.role}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: '88px 32px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            fontFamily: FONT.mono,
            fontSize: 13,
            letterSpacing: 3,
            textTransform: 'uppercase' as const,
            color: '#666',
            marginBottom: 20,
          }}>
            [ READY? ]
          </div>
          <h2 style={{
            fontFamily: FONT.display,
            fontSize: 'clamp(48px, 7vw, 96px)',
            margin: '0 0 28px',
            lineHeight: 0.9,
          }}>
            hire {employee.name}<br />
            <span style={{
              background: employee.color,
              padding: '0 18px',
              display: 'inline-block',
              border: '3px solid #111',
              borderRadius: 8,
              boxShadow: '5px 5px 0 #111',
            }}>
              today.
            </span>
          </h2>
          <p style={{ fontFamily: FONT.body, fontSize: 18, color: '#555', marginBottom: 44 }}>
            Start with {employee.name} on the Solo plan at $24/mo, or get all six on the Crew plan at $99/mo.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button variant="dark" href={`${mainAppUrl}/signup`}>Start free →</Button>
            <Button variant="ghost" href="/#pricing">View pricing</Button>
          </div>
        </div>
      </section>
    </div>
  );
}
