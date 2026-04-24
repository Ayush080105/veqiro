import Image from 'next/image';
import { FONT, Button } from '@/components/veqiro/shared';
import { PageNav } from '@/components/veqiro/page-nav';
import { Footer } from '@/components/veqiro/sections';
import { Breadcrumbs } from '@/components/veqiro/breadcrumbs';
import { JsonLd } from '@/components/veqiro/json-ld';
import { faqPageJsonLd } from '@/lib/jsonld';
import { SITE_URL } from '@/lib/seo';
import { mainAppUrl } from '@/lib/site-config';
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
    <div style={{ background: '#EFE7D6', minHeight: '100vh' }}>
      <JsonLd data={faqPageJsonLd(content.faq)} />
      <PageNav />

      {/* ── HERO ── */}
      <section style={{
        background: '#111',
        borderTop: '3px solid #111',
        borderBottom: '3px solid #111',
        padding: 'clamp(40px, 7vw, 80px) clamp(20px, 4vw, 40px)',
      }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <Breadcrumbs items={crumbs} theme="dark" />

          <div style={{
            fontFamily: FONT.mono, fontSize: 12, letterSpacing: 3,
            textTransform: 'uppercase', color: '#555', marginBottom: 20, marginTop: 20,
          }}>
            [ USE CASE ]
          </div>

          <h1 style={{
            fontFamily: FONT.display,
            fontSize: 'clamp(44px, 8vw, 104px)',
            margin: '0 0 22px',
            lineHeight: 0.9,
            letterSpacing: -2,
            color: '#EFE7D6',
          }}>
            {content.hero.h1}
          </h1>

          <p style={{
            fontFamily: FONT.body,
            fontSize: 'clamp(15px, 1.8vw, 19px)',
            color: '#999',
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
                border: `2px solid ${content.accentColor}`,
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
            <Button variant="dark" href={`${mainAppUrl}/signup`}>Start free →</Button>
            <Button variant="ghost" href="/pricing">View pricing</Button>
          </div>
        </div>
      </section>

      {/* ── PAIN-POINT MARQUEE ── */}
      <div style={{
        background: content.accentColor,
        borderBottom: '3px solid #111',
        padding: '16px 0',
        overflow: 'hidden',
      }}>
        <div
          className="vq-marquee-row"
          style={{
            animation: 'marquee 28s linear infinite',
            color: content.accentInk,
          }}
        >
          <span>
            {[...content.painPoints, ...content.painPoints, ...content.painPoints, ...content.painPoints].map((p, i) => (
              <span key={i} style={{ marginRight: 'clamp(24px, 5vw, 48px)' }}>★ {p}</span>
            ))}
          </span>
        </div>
      </div>

      {/* ── WHY NOW ── */}
      <section className="vq-section-pad" style={{ borderBottom: '3px solid #111' }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <div style={{
            fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3,
            textTransform: 'uppercase', color: '#666', marginBottom: 16,
          }}>
            [ WHY THIS MATTERS ]
          </div>
          <h2 style={{
            fontFamily: FONT.display,
            fontSize: 'clamp(32px, 4.5vw, 56px)',
            margin: '0 0 24px',
            lineHeight: 1.05,
            letterSpacing: -1,
          }}>
            the real job Veqiro does for{' '}
            <span style={{
              background: content.accentColor,
              color: content.accentInk,
              padding: '0 14px',
              display: 'inline-block',
              border: '3px solid #111',
              borderRadius: 8,
              boxShadow: '4px 4px 0 #111',
            }}>
              {content.persona.toLowerCase()}.
            </span>
          </h2>
          <p style={{
            fontFamily: FONT.body,
            fontSize: 'clamp(15px, 1.9vw, 18px)',
            lineHeight: 1.75,
            color: '#333',
            margin: 0,
          }}>
            {content.whyNow}
          </p>
        </div>
      </section>

      {/* ── YOUR AI CREW ── */}
      <section className="vq-section-pad" style={{ borderBottom: '3px solid #111' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <div style={{ marginBottom: 'clamp(32px, 5vw, 52px)' }}>
            <div style={{
              fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3,
              textTransform: 'uppercase', color: '#666', marginBottom: 16,
            }}>
              [ YOUR AI CREW ]
            </div>
            <h2 style={{
              fontFamily: FONT.display,
              fontSize: 'clamp(40px, 6vw, 80px)',
              margin: 0, lineHeight: 0.92,
            }}>
              your crew.<br />
              <span style={{
                background: content.accentColor,
                color: content.accentInk,
                padding: '0 18px',
                display: 'inline-block',
                transform: 'rotate(-1.5deg)',
                border: '3px solid #111',
                borderRadius: 8,
                boxShadow: '5px 5px 0 #111',
              }}>
                ready now.
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
                  border: '3px solid #111',
                  borderRadius: 14,
                  overflow: 'hidden',
                  boxShadow: '6px 6px 0 #111',
                  display: 'block',
                  transform: `rotate(${i % 2 === 0 ? -0.6 : 0.6}deg)`,
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
                <div style={{ background: '#111', padding: '12px 14px', borderTop: '2px solid #222' }}>
                  <div style={{ fontFamily: FONT.display, fontSize: 20, color: agent.color, lineHeight: 1 }}>
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
                  border: '2.5px solid #111',
                  borderRadius: 10,
                  padding: '16px 18px',
                  background: i % 3 === 0 ? '#EFE7D6' : '#FFF9ED',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                  boxShadow: '3px 3px 0 #111',
                  animation: `fadeInUp 0.5s ease ${0.3 + i * 0.07}s both`,
                }}
              >
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: agent.color, border: '2px solid #111',
                  marginTop: 4, flexShrink: 0,
                }} />
                <div>
                  <div style={{ fontFamily: FONT.head, fontSize: 14, marginBottom: 4, letterSpacing: 0.5 }}>
                    {agent.name}
                  </div>
                  <div style={{ fontFamily: FONT.body, fontSize: 14, color: '#444', lineHeight: 1.6 }}>
                    {agent.blurb}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="vq-section-pad" style={{ background: '#111', borderBottom: '3px solid #111' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ marginBottom: 'clamp(32px, 5vw, 52px)' }}>
            <div style={{
              fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3,
              textTransform: 'uppercase', color: '#444', marginBottom: 16,
            }}>
              [ HOW IT WORKS ]
            </div>
            <h2 style={{
              fontFamily: FONT.display,
              fontSize: 'clamp(36px, 5.5vw, 72px)',
              margin: 0, lineHeight: 0.92, color: '#EFE7D6',
            }}>
              simple by design.
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
                  border: '3px solid #222',
                  borderRadius: 14,
                  padding: '32px 24px',
                  background: '#181818',
                  boxShadow: `6px 6px 0 ${step.color}`,
                  transform: `rotate(${i % 2 === 0 ? -0.5 : 0.5}deg)`,
                  animation: `fadeInUp 0.6s ease ${i * 0.15}s both`,
                }}
              >
                <div style={{
                  fontFamily: FONT.display,
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
                  color: '#EFE7D6',
                  margin: '0 0 12px',
                }}>
                  {step.title}
                </h3>
                <p style={{
                  fontFamily: FONT.body,
                  fontSize: 15,
                  color: '#888',
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
      <section className="vq-section-pad" style={{ borderBottom: '3px solid #111' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ marginBottom: 'clamp(32px, 5vw, 48px)', maxWidth: 720 }}>
            <div style={{
              fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3,
              textTransform: 'uppercase', color: '#666', marginBottom: 16,
            }}>
              [ A REAL SCENARIO ]
            </div>
            <h2 style={{
              fontFamily: FONT.display,
              fontSize: 'clamp(32px, 4.5vw, 56px)',
              margin: 0,
              lineHeight: 1.02,
              letterSpacing: -1,
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
              border: '3px solid #111',
              borderRadius: 14,
              padding: '28px 26px',
              background: '#EFE7D6',
              boxShadow: '6px 6px 0 #111',
            }}>
              <div style={{
                display: 'inline-block',
                background: '#111',
                color: '#EFE7D6',
                border: '2px solid #111',
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
                    color: '#444',
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                  }}>
                    <span aria-hidden style={{
                      color: '#B94141',
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
              border: '3px solid #111',
              borderRadius: 14,
              padding: '28px 26px',
              background: content.accentColor,
              boxShadow: `6px 6px 0 #111`,
            }}>
              <div style={{
                display: 'inline-block',
                background: '#111',
                color: content.accentColor,
                border: '2px solid #111',
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
                      fontWeight: 900,
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
      <section className="vq-section-pad" style={{ background: '#FFF9ED', borderBottom: '3px solid #111' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ marginBottom: 'clamp(32px, 5vw, 48px)' }}>
            <div style={{
              fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3,
              textTransform: 'uppercase', color: '#666', marginBottom: 16,
            }}>
              [ OUTCOMES ]
            </div>
            <h2 style={{
              fontFamily: FONT.display,
              fontSize: 'clamp(36px, 5vw, 64px)',
              margin: 0, lineHeight: 0.95,
            }}>
              what changes<br />
              <span style={{
                background: content.accentColor,
                color: content.accentInk,
                padding: '0 16px',
                display: 'inline-block',
                border: '3px solid #111',
                borderRadius: 8,
                boxShadow: '4px 4px 0 #111',
                transform: 'rotate(-1deg)',
              }}>
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
                border: '3px solid #111',
                borderRadius: 12,
                padding: '24px 22px',
                background: '#EFE7D6',
                boxShadow: '5px 5px 0 #111',
                transform: `rotate(${i % 2 === 0 ? -0.4 : 0.4}deg)`,
              }}>
                <div style={{
                  fontFamily: FONT.display,
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
                  color: '#444',
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
      <section className="vq-section-pad" style={{ background: '#EFE7D6', borderBottom: '3px solid #111' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ marginBottom: 'clamp(32px, 5vw, 48px)' }}>
            <div style={{
              fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3,
              textTransform: 'uppercase', color: '#666', marginBottom: 16,
            }}>
              [ FAQ ]
            </div>
            <h2 style={{
              fontFamily: FONT.display,
              fontSize: 'clamp(36px, 5vw, 64px)',
              margin: 0, lineHeight: 0.95,
            }}>
              good questions.
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
            textTransform: 'uppercase', color: '#666', marginBottom: 20,
          }}>
            [ READY TO HIRE? ]
          </div>
          <h2 style={{
            fontFamily: FONT.display,
            fontSize: 'clamp(48px, 7vw, 96px)',
            margin: '0 0 28px', lineHeight: 0.9,
          }}>
            hire your<br />
            <span style={{
              background: content.accentColor,
              color: content.accentInk,
              padding: '0 18px',
              display: 'inline-block',
              border: '3px solid #111',
              borderRadius: 8,
              boxShadow: '5px 5px 0 #111',
            }}>
              AI crew.
            </span>
          </h2>
          <p style={{
            fontFamily: FONT.body,
            fontSize: 'clamp(15px, 2vw, 18px)',
            color: '#555',
            marginBottom: 44,
            lineHeight: 1.6,
          }}>
            One subscription. Six AI employees. 7-day free trial — no card needed.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button variant="dark" href={`${mainAppUrl}/signup`}>Start free →</Button>
            <Button variant="ghost" href="/pricing">View pricing</Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
