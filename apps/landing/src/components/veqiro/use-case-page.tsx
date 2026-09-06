import Image from 'next/image';
import { Button } from '@/components/veqiro/shared';
import { FONT, T } from '@/components/veqiro/tokens';
import { PageNav } from '@/components/veqiro/page-nav';
import { Footer } from '@/components/veqiro/sections';
import { Breadcrumbs } from '@/components/veqiro/breadcrumbs';
import { JsonLd } from '@/components/veqiro/json-ld';
import { faqPageJsonLd } from '@/lib/jsonld';
import { SITE_URL } from '@/lib/seo';
import { consoleUrl, isPreLaunch, waitlistUrl } from '@/lib/site-config';
import { UseCaseFaq } from '@/components/veqiro/use-case-faq';

export interface AgentSpotlight {
  key: string;
  name: string;
  color: string;
  ink: string;
  blurb: string;
}

export interface WorkflowStep {
  n: string;
  title: string;
  description: string;
  color: string;
}

export interface Outcome {
  title: string;
  body: string;
}

export interface ScenarioBlock {
  title: string;
  before: string[];
  after: string[];
}

export interface UseCaseContent {
  path: string;
  persona: string;
  accentColor: string;
  accentInk: string;
  hero: {
    h1: string;
    subheading: string;
    stats: string[];
  };
  painPoints: string[];
  whyNow: string;
  agents: AgentSpotlight[];
  steps: WorkflowStep[];
  scenario: ScenarioBlock;
  outcomes: Outcome[];
  faq: { q: string; a: string }[];
}

export function UseCasePage({ content }: { content: UseCaseContent }) {
  const crumbs = [
    { name: 'Home', url: SITE_URL },
    { name: 'Use Cases', url: `${SITE_URL}/use-cases` },
    { name: content.persona, url: `${SITE_URL}${content.path}` },
  ];

  return (
    <div style={{ background: T.bg, minHeight: '100vh' }}>
      <JsonLd data={faqPageJsonLd(content.faq)} />
      <PageNav />

      {/* ── HERO ── */}
      <section style={{
        background: T.ink,
        borderTop: `1px solid ${T.line}`,
        borderBottom: `1px solid ${T.line}`,
        padding: 'clamp(40px, 7vw, 80px) clamp(20px, 4vw, 40px)',
      }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <Breadcrumbs items={crumbs} theme="dark" />

          <div style={{
            fontFamily: FONT.mono, fontSize: 12, letterSpacing: 3,
            textTransform: 'uppercase', color: T.ink2, marginBottom: 20, marginTop: 20,
          }}>
            Use case
          </div>

          <h1 style={{
            fontFamily: FONT.display, fontWeight: 600, letterSpacing: '-0.03em',
            fontSize: 'clamp(44px, 8vw, 104px)',
            margin: '0 0 22px',
            lineHeight: 0.9,

            color: T.bg,
          }}>
            {content.hero.h1}
          </h1>

          <p style={{
            fontFamily: FONT.body,
            fontSize: 'clamp(15px, 1.8vw, 19px)',
            color: T.ink3,
            margin: '0 0 44px',
            maxWidth: 560,
            lineHeight: 1.65,
          }}>
            {content.hero.subheading}
          </p>

          {/* Stat pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 52 }}>
            {content.hero.stats.map((stat, i) => (
              <div key={i} style={{
                border: `1px solid ${content.accentColor}`,
                borderRadius: 999,
                padding: '8px 20px',
                fontFamily: FONT.mono,
                fontSize: 12,
                letterSpacing: 2,
                textTransform: 'uppercase',
                color: content.accentColor,
                background: 'rgba(255,255,255,0.04)',
              }}>
                {stat}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {/* This hero sits on T.ink — `dark`/`ghost` would be invisible here. */}
            <Button variant="light" href={isPreLaunch ? waitlistUrl : `${consoleUrl}/signup`}>{isPreLaunch ? 'Join the waitlist →' : 'Start free →'}</Button>
            <Button variant="ghost-light" href="/pricing">View pricing</Button>
          </div>
        </div>
      </section>

      {/* ── PAIN-POINT MARQUEE ── */}
      <div style={{
        background: T.surface,
        borderTop: `1px solid ${T.line}`,
        borderBottom: `1px solid ${T.line}`,
        padding: '14px 0',
        overflow: 'hidden',
      }}>
        <div
          className="vq-marquee-row"
          style={{
            animation: 'marquee 28s linear infinite',
            color: T.ink2,
          }}
        >
          <span>
            {[...content.painPoints, ...content.painPoints, ...content.painPoints, ...content.painPoints].map((p, i) => (
              <span key={i} style={{ marginRight: 'clamp(24px, 5vw, 48px)' }}>{p}</span>
            ))}
          </span>
        </div>
      </div>

      {/* ── WHY NOW ── */}
      <section className="vq-section-pad" style={{ borderBottom: `1px solid ${T.line}` }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <div style={{
            fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3,
            textTransform: 'uppercase', color: T.ink2, marginBottom: 16,
          }}>
            Why this matters
          </div>
          <h2 style={{
            fontFamily: FONT.display, fontWeight: 600, letterSpacing: '-0.03em',
            fontSize: 'clamp(32px, 4.5vw, 56px)',
            margin: '0 0 24px',
            lineHeight: 1.05,

          }}>
            The real job Veqiro does for{' '}
            <span>
              {content.persona.toLowerCase()}.
            </span>
          </h2>
          <p style={{
            fontFamily: FONT.body,
            fontSize: 'clamp(15px, 1.9vw, 18px)',
            lineHeight: 1.75,
            color: T.ink,
            margin: 0,
          }}>
            {content.whyNow}
          </p>
        </div>
      </section>

      {/* ── YOUR AI CREW ── */}
      <section className="vq-section-pad" style={{ borderBottom: `1px solid ${T.line}` }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <div style={{ marginBottom: 'clamp(32px, 5vw, 52px)' }}>
            <div style={{
              fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3,
              textTransform: 'uppercase', color: T.ink2, marginBottom: 16,
            }}>
              Your AI crew
            </div>
            <h2 style={{
              fontFamily: FONT.display, fontWeight: 600, letterSpacing: '-0.03em',
              fontSize: 'clamp(40px, 6vw, 80px)',
              margin: 0, lineHeight: 0.92,
            }}>
              Your crew.<br />
              <span>
                Ready now.
              </span>
            </h2>
          </div>

          {/* Agent portrait cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))',
            gap: 20,
            marginBottom: 48,
          }}>
            {content.agents.map((agent, i) => (
              <a
                key={agent.key}
                href={`/agents/${agent.key}`}
                style={{
                  textDecoration: 'none',
                  color: 'inherit',
                  border: `1px solid ${T.line}`,
                  borderRadius: 14,
                  overflow: 'hidden',
                  boxShadow: T.shadow,
                  display: 'block',
                  animation: `fadeInUp 0.5s ease ${i * 0.08}s both`,
                }}
              >
                <div style={{ aspectRatio: '3/4', background: agent.color, position: 'relative' }}>
                  <Image
                    src={`/${agent.name}.jpeg`}
                    alt={`${agent.name}, Veqiro's AI ${agent.key}`}
                    fill
                    sizes="(max-width: 640px) 45vw, (max-width: 1024px) 25vw, 200px"
                    style={{ objectFit: 'cover' }}
                  />
                </div>
                <div style={{ background: T.ink, padding: '12px 14px', borderTop: `1px solid ${T.lineInv}` }}>
                  <div style={{ fontFamily: FONT.display, fontWeight: 600, letterSpacing: '-0.03em', fontSize: 20, color: agent.color, lineHeight: 1 }}>
                    {agent.name}
                  </div>
                </div>
              </a>
            ))}
          </div>

          {/* Agent blurb list */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 14,
          }}>
            {content.agents.map((agent, i) => (
              <div
                key={agent.key}
                style={{
                  border: `1px solid ${T.line}`,
                  borderRadius: 10,
                  padding: '16px 18px',
                  background: i % 3 === 0 ? T.bg : T.surface,
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                  boxShadow: T.shadow,
                  animation: `fadeInUp 0.5s ease ${0.3 + i * 0.07}s both`,
                }}
              >
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: agent.color, border: `1px solid ${T.line}`,
                  marginTop: 4, flexShrink: 0,
                }} />
                <div>
                  <div style={{ fontFamily: FONT.head, fontSize: 14, marginBottom: 4, letterSpacing: 0.5 }}>
                    {agent.name}
                  </div>
                  <div style={{ fontFamily: FONT.body, fontSize: 14, color: T.ink2, lineHeight: 1.6 }}>
                    {agent.blurb}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="vq-section-pad" style={{ background: T.ink, borderBottom: `1px solid ${T.line}` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ marginBottom: 'clamp(32px, 5vw, 52px)' }}>
            <div style={{
              fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3,
              textTransform: 'uppercase', color: T.ink2, marginBottom: 16,
            }}>
              How it works
            </div>
            <h2 style={{
              fontFamily: FONT.display, fontWeight: 600, letterSpacing: '-0.03em',
              fontSize: 'clamp(36px, 5.5vw, 72px)',
              margin: 0, lineHeight: 0.92, color: T.bg,
            }}>
              Simple by design.
            </h2>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 20,
          }}>
            {content.steps.map((step, i) => (
              <div
                key={step.n}
                style={{
                  border: `1px solid ${T.lineInv}`,
                  borderRadius: 14,
                  padding: '32px 24px',
                  background: T.dark2,
                  boxShadow: T.shadow,
                  animation: `fadeInUp 0.6s ease ${i * 0.15}s both`,
                }}
              >
                <div style={{
                  fontFamily: FONT.display, fontWeight: 600, letterSpacing: '-0.03em',
                  fontSize: 'clamp(48px, 6vw, 72px)',
                  color: step.color,
                  lineHeight: 1,
                  marginBottom: 18,
                }}>
                  {step.n}
                </div>
                <h3 style={{
                  fontFamily: FONT.head,
                  fontSize: 'clamp(16px, 1.8vw, 20px)',
                  color: T.bg,
                  margin: '0 0 12px',
                }}>
                  {step.title}
                </h3>
                <p style={{
                  fontFamily: FONT.body,
                  fontSize: 15,
                  color: T.ink3,
                  margin: 0,
                  lineHeight: 1.7,
                }}>
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SCENARIO: BEFORE / AFTER ── */}
      <section className="vq-section-pad" style={{ borderBottom: `1px solid ${T.line}` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ marginBottom: 'clamp(32px, 5vw, 48px)', maxWidth: 720 }}>
            <div style={{
              fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3,
              textTransform: 'uppercase', color: T.ink2, marginBottom: 16,
            }}>
              A real scenario
            </div>
            <h2 style={{
              fontFamily: FONT.display, fontWeight: 600, letterSpacing: '-0.03em',
              fontSize: 'clamp(32px, 4.5vw, 56px)',
              margin: 0,
              lineHeight: 1.02,

            }}>
              {content.scenario.title}
            </h2>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 24,
          }}>
            {/* Before */}
            <div style={{
              border: `1px solid ${T.line}`,
              borderRadius: 14,
              padding: '28px 26px',
              background: T.bg,
              boxShadow: T.shadow,
            }}>
              <div style={{
                display: 'inline-block',
                background: T.ink,
                color: T.bg,
                border: `1px solid ${T.line}`,
                borderRadius: 999,
                padding: '5px 14px',
                fontFamily: FONT.mono,
                fontSize: 11,
                letterSpacing: 2,
                textTransform: 'uppercase',
                marginBottom: 18,
              }}>
                Before Veqiro
              </div>
              <ul style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                display: 'grid',
                gap: 12,
              }}>
                {content.scenario.before.map((b) => (
                  <li key={b} style={{
                    fontFamily: FONT.body,
                    fontSize: 15,
                    lineHeight: 1.65,
                    color: T.ink2,
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                  }}>
                    <span aria-hidden style={{
                      color: `color-mix(in srgb, ${T.red} 55%, black)`,
                      fontFamily: FONT.head,
                      fontSize: 18,
                      lineHeight: 1,
                      flexShrink: 0,
                      marginTop: 2,
                    }}>
                      ✕
                    </span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* After */}
            <div style={{
              border: `1px solid ${T.line}`,
              borderRadius: 14,
              padding: '28px 26px',
              background: content.accentColor,
              boxShadow: T.shadow,
            }}>
              <div style={{
                display: 'inline-block',
                background: T.ink,
                color: content.accentColor,
                border: `1px solid ${T.line}`,
                borderRadius: 999,
                padding: '5px 14px',
                fontFamily: FONT.mono,
                fontSize: 11,
                letterSpacing: 2,
                textTransform: 'uppercase',
                marginBottom: 18,
              }}>
                With Veqiro
              </div>
              <ul style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                display: 'grid',
                gap: 12,
              }}>
                {content.scenario.after.map((a) => (
                  <li key={a} style={{
                    fontFamily: FONT.body,
                    fontSize: 15,
                    lineHeight: 1.65,
                    color: content.accentInk,
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                  }}>
                    <span aria-hidden style={{
                      color: content.accentInk,
                      fontFamily: FONT.head,
                      fontSize: 18,
                      lineHeight: 1,
                      flexShrink: 0,
                      marginTop: 2,
                      fontWeight: 600,
                    }}>
                      ✓
                    </span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── OUTCOMES ── */}
      <section className="vq-section-pad" style={{ background: T.surface, borderBottom: `1px solid ${T.line}` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ marginBottom: 'clamp(32px, 5vw, 48px)' }}>
            <div style={{
              fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3,
              textTransform: 'uppercase', color: T.ink2, marginBottom: 16,
            }}>
              Outcomes
            </div>
            <h2 style={{
              fontFamily: FONT.display, fontWeight: 600, letterSpacing: '-0.03em',
              fontSize: 'clamp(36px, 5vw, 64px)',
              margin: 0, lineHeight: 0.95,
            }}>
              What changes<br />
              <span>
                in week one.
              </span>
            </h2>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 20,
          }}>
            {content.outcomes.map((out, i) => (
              <div key={out.title} style={{
                border: `1px solid ${T.line}`,
                borderRadius: 12,
                padding: '24px 22px',
                background: T.bg,
                boxShadow: T.shadow,
              }}>
                <div style={{
                  fontFamily: FONT.display, fontWeight: 600, letterSpacing: '-0.03em',
                  fontSize: 36,
                  color: content.accentInk,
                  lineHeight: 1,
                  marginBottom: 14,
                }}>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <h3 style={{
                  fontFamily: FONT.head,
                  fontSize: 17,
                  margin: '0 0 10px',
                  lineHeight: 1.3,
                }}>
                  {out.title}
                </h3>
                <p style={{
                  fontFamily: FONT.body,
                  fontSize: 14.5,
                  lineHeight: 1.65,
                  color: T.ink2,
                  margin: 0,
                }}>
                  {out.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="vq-section-pad" style={{ background: T.bg, borderBottom: `1px solid ${T.line}` }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ marginBottom: 'clamp(32px, 5vw, 48px)' }}>
            <div style={{
              fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3,
              textTransform: 'uppercase', color: T.ink2, marginBottom: 16,
            }}>
              FAQ
            </div>
            <h2 style={{
              fontFamily: FONT.display, fontWeight: 600, letterSpacing: '-0.03em',
              fontSize: 'clamp(36px, 5vw, 64px)',
              margin: 0, lineHeight: 0.95,
            }}>
              Good questions.
            </h2>
          </div>
          <UseCaseFaq items={content.faq} accentColor={content.accentColor} />
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="vq-section-pad">
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3,
            textTransform: 'uppercase', color: T.ink2, marginBottom: 20,
          }}>
            Get started
          </div>
          <h2 style={{
            fontFamily: FONT.display, fontWeight: 600, letterSpacing: '-0.03em',
            fontSize: 'clamp(48px, 7vw, 96px)',
            margin: '0 0 28px', lineHeight: 0.9,
          }}>
            Hire your<br />
            <span>
              AI crew.
            </span>
          </h2>
          <p style={{
            fontFamily: FONT.body,
            fontSize: 'clamp(15px, 2vw, 18px)',
            color: T.ink2,
            marginBottom: 44,
            lineHeight: 1.6,
          }}>
            One subscription. Six AI employees. 7-day free trial — no card needed.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button variant="dark" href={isPreLaunch ? waitlistUrl : `${consoleUrl}/signup`}>{isPreLaunch ? 'Join the waitlist →' : 'Start free →'}</Button>
            <Button variant="ghost" href="/pricing">View pricing</Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
