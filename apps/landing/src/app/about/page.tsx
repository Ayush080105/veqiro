import React from 'react';
import { Footer } from '@/components/veqiro/sections';
import { PageNav } from '@/components/veqiro/page-nav';
import { FONT, Button } from '@/components/veqiro/shared';
import { AboutCrewGrid } from '@/components/veqiro/about-crew-grid';
import { consoleUrl } from '@/lib/site-config';
import { buildPageMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/veqiro/json-ld';
import { organizationJsonLd, faqPageJsonLd } from '@/lib/jsonld';

export const metadata = buildPageMetadata({
  title: 'About Veqiro — Who We Are & What Veqiro Is',
  description: 'Veqiro is a crew of six specialized AI employees for founders and lean teams. Built in Bengaluru. One subscription, six AI agents — all-in-one AI platform for startups.',
  path: '/about',
  keywords: [
    'who is veqiro',
    'what is veqiro',
    'who makes veqiro',
    'veqiro team',
    'veqiro company',
    'ai crew',
    'all in one ai platform for startups',
    'ai for lean teams',
    'ai workforce for founders',
  ],
});

const ABOUT_FAQ = [
  {
    q: 'What is Veqiro?',
    a: "Veqiro is an AI workforce platform that gives founders and lean teams a crew of six specialized AI employees — Vega (executive assistant), Scout (research), Maya (content), Sage (SEO), Lex (legal), and Rex (finance) — in one subscription. It's an all-in-one AI platform for startups that replaces the need to hire six separate specialists.",
  },
  {
    q: 'Who makes Veqiro?',
    a: "Veqiro is built by Veqiro Labs, based in Bengaluru, India. The company was founded by operators who were tired of copy-pasting between ChatGPT tabs at midnight and decided to build the AI employees they wished existed.",
  },
  {
    q: 'Who is Veqiro for?',
    a: "Veqiro is built for founders, lean teams (2–10 people), marketing teams, agencies, and solopreneurs who need the output of a full specialist team without the headcount. If you can't justify hiring a dedicated EA, researcher, content lead, SEO specialist, legal reviewer, and financial analyst — Veqiro is the answer.",
  },
  {
    q: 'How is Veqiro different from ChatGPT or other AI tools?',
    a: "ChatGPT is a general-purpose chatbot you prompt one task at a time. Veqiro is six specialized AI agents with shared memory (the Brain) — each named, each with its own role, each remembering your brand voice, goals, and context. Less prompting, more output. An AI workforce, not a tool you have to drive.",
  },
  {
    q: 'Is Veqiro safe to use with my business data?',
    a: "Yes. Veqiro is SOC 2 Type II certified, encrypts data at rest and in transit, connects to tools via OAuth (no password sharing), and never uses your data to train our models. Your content is used only to perform the tasks you ask for.",
  },
  {
    q: 'How much does Veqiro cost?',
    a: "Veqiro is $39/mo, or $29/mo billed annually. That's one subscription for all six AI employees — no per-seat fees, no per-agent tiers. A 7-day free trial is available with no credit card required.",
  },
];

const VALUES = [
  {
    title: 'Personality over prompts',
    body: "AI that has a name, a voice, and a point of view is AI you actually want to work with. Generic is boring. We make crew members.",
    color: '#6FCDE8',
  },
  {
    title: 'Real work, not summaries',
    body: "Vega doesn't just tell you about your emails — she handles them. Sage doesn't suggest keywords — she writes the post. Output over observation.",
    color: '#F06464',
  },
  {
    title: 'Lean is a superpower',
    body: "A 2-person team that operates like a 10-person team doesn't need to hire their way out. They need better tools. We're those tools.",
    color: '#F5C518',
  },
  {
    title: 'Trust but verify',
    body: "Every agent tells you what it's doing and why. Nothing gets sent without your say-so. We make them fast — you make them final.",
    color: '#1DBC87',
  },
];

export default function AboutPage() {
  return (
    <div style={{ background: '#EFE7D6', minHeight: '100vh' }}>
      <JsonLd data={[organizationJsonLd(), faqPageJsonLd(ABOUT_FAQ)]} />
      <PageNav />

      {/* ── HERO ── */}
      <section className="vq-section-pad" style={{
        borderTop: '3px solid #111',
        borderBottom: '3px solid #111',
        background: '#111',
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            fontFamily: FONT.mono,
            fontSize: 13,
            letterSpacing: 3,
            textTransform: 'uppercase',
            color: '#F5C518',
            marginBottom: 16,
          }}>
            [ ABOUT VEQIRO ]
          </div>
          <h1 style={{
            fontFamily: FONT.display,
            fontSize: 'clamp(56px, 8vw, 120px)',
            margin: 0,
            lineHeight: 0.9,
            color: '#EFE7D6',
          }}>
            made by humans.<br />
            <span style={{ color: '#F5C518' }}>(mostly.)</span>
          </h1>
        </div>
      </section>

      {/* ── MISSION ── */}
      <section className="vq-section-pad" style={{ borderBottom: '3px solid #111' }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <div style={{
            fontFamily: FONT.mono,
            fontSize: 13,
            letterSpacing: 3,
            textTransform: 'uppercase',
            color: '#666',
            marginBottom: 24,
          }}>
            [ THE WHY ]
          </div>
          <p style={{
            fontFamily: FONT.display,
            fontSize: 'clamp(28px, 3.5vw, 48px)',
            lineHeight: 1.2,
            margin: '0 0 36px',
          }}>
            Lean teams deserve the same leverage as teams ten times their size.
          </p>
          <p style={{ fontFamily: FONT.body, fontSize: 'clamp(15px, 2.2vw, 18px)', lineHeight: 1.75, color: '#333', margin: '0 0 24px' }}>
            We built Veqiro because we kept watching great companies stall — not because the ideas were bad, but because a 3-person team can only do so much in a day. The grunt work piles up. The emails go unanswered. The blog gets abandoned. The competitor analysis never gets done.
          </p>
          <p style={{ fontFamily: FONT.body, fontSize: 'clamp(15px, 2.2vw, 18px)', lineHeight: 1.75, color: '#333', margin: 0 }}>
            So we built six. Not a chat interface with a generic prompt. Six actual AI employees — each with a name, a specialty, a personality, and a bias toward shipping. They share memory. They talk to each other. They work while you sleep.
          </p>
        </div>
      </section>

      {/* ── WHAT IS VEQIRO ── */}
      <section className="vq-section-pad" style={{ background: '#FFF9ED', borderBottom: '3px solid #111' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ marginBottom: 'clamp(32px, 5vw, 48px)', maxWidth: 820 }}>
            <div style={{
              fontFamily: FONT.mono,
              fontSize: 13,
              letterSpacing: 3,
              textTransform: 'uppercase',
              color: '#666',
              marginBottom: 16,
            }}>
              [ WHAT VEQIRO IS ]
            </div>
            <h2 style={{
              fontFamily: FONT.display,
              fontSize: 'clamp(32px, 5vw, 64px)',
              margin: '0 0 24px',
              lineHeight: 0.95,
              letterSpacing: -1,
            }}>
              an AI workforce,<br />
              <span style={{
                background: '#F5C518',
                padding: '0 16px',
                display: 'inline-block',
                border: '3px solid #111',
                borderRadius: 8,
                boxShadow: '4px 4px 0 #111',
                transform: 'rotate(-1deg)',
              }}>
                not another tool.
              </span>
            </h2>
            <p style={{
              fontFamily: FONT.body,
              fontSize: 'clamp(15px, 1.9vw, 18px)',
              lineHeight: 1.75,
              color: '#333',
              margin: '0 0 18px',
            }}>
              Veqiro is a team of six specialized AI employees — an executive assistant, a researcher, a content writer, an SEO specialist, a legal reviewer, and a financial analyst — bundled into a single subscription. Each agent has its own name, role, personality, and specialized skills. They share a central Brain (your brand kit, competitors, and context), so output stays consistent across everything from inbox replies to blog posts to contract reviews.
            </p>
            <p style={{
              fontFamily: FONT.body,
              fontSize: 'clamp(15px, 1.9vw, 18px)',
              lineHeight: 1.75,
              color: '#333',
              margin: 0,
            }}>
              Veqiro exists because most AI tools are single-purpose utilities that don&apos;t talk to each other, and most &quot;AI agent platforms&quot; require you to configure workflows before anything useful happens. We built the opposite: six AI employees that arrive pre-hired, brief themselves from your company profile, and start shipping work the same day. Think AI workforce for founders, AI team for startups, AI employees for lean teams — all the same thing, and all what Veqiro is.
            </p>
          </div>

          {/* Quick facts row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: 16,
          }}>
            {[
              { label: 'AI employees', value: '6', accent: '#F5C518' },
              { label: 'One subscription', value: '$39/mo', accent: '#F06464' },
              { label: 'Built in', value: 'Bengaluru, IN', accent: '#1DBC87' },
              { label: 'Free trial', value: '7 days', accent: '#6FCDE8' },
            ].map((f) => (
              <div
                key={f.label}
                style={{
                  border: '3px solid #111',
                  borderRadius: 12,
                  background: '#EFE7D6',
                  padding: '18px 20px',
                  boxShadow: `4px 4px 0 ${f.accent}`,
                }}
              >
                <div style={{
                  fontFamily: FONT.display,
                  fontSize: 'clamp(22px, 3.2vw, 32px)',
                  color: '#111',
                  lineHeight: 1,
                  marginBottom: 8,
                }}>
                  {f.value}
                </div>
                <div style={{
                  fontFamily: FONT.mono,
                  fontSize: 10,
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                  color: '#666',
                }}>
                  {f.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── VALUES ── */}
      <section className="vq-section-pad" style={{ background: '#EFE7D6', borderBottom: '3px solid #111' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{
            fontFamily: FONT.mono,
            fontSize: 13,
            letterSpacing: 3,
            textTransform: 'uppercase',
            color: '#666',
            marginBottom: 56,
          }}>
            [ HOW WE THINK ]
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 24,
          }}>
            {VALUES.map((v, i) => (
              <div key={v.title} style={{
                border: '3px solid #111',
                borderRadius: 14,
                padding: '28px 24px',
                background: '#EFE7D6',
                boxShadow: '6px 6px 0 #111',
                transform: `rotate(${i % 2 === 0 ? -0.5 : 0.5}deg)`,
              }}>
                <div style={{
                  width: 32,
                  height: 5,
                  background: v.color,
                  border: '2px solid #111',
                  borderRadius: 4,
                  marginBottom: 18,
                }} />
                <h3 style={{ fontFamily: FONT.head, fontSize: 20, margin: '0 0 12px' }}>{v.title}</h3>
                <p style={{ fontFamily: FONT.body, fontSize: 15, lineHeight: 1.65, color: '#444', margin: 0 }}>{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MEET THE CREW ── */}
      <section className="vq-section-pad" style={{ background: '#FFF9ED', borderBottom: '3px solid #111' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ marginBottom: 48 }}>
            <div style={{
              fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3,
              textTransform: 'uppercase', color: '#666', marginBottom: 16,
            }}>
              [ THE CREW ]
            </div>
            <h2 style={{ fontFamily: FONT.display, fontSize: 'clamp(36px, 5vw, 64px)', margin: 0, lineHeight: 0.95 }}>
              meet your new<br />team members.
            </h2>
          </div>

          <AboutCrewGrid />
        </div>
      </section>

      {/* ── ORIGIN ── */}
      <section className="vq-section-pad" style={{ background: '#111', borderBottom: '3px solid #111' }}>
        <div style={{ maxWidth: 820, margin: '0 auto', textAlign: 'center' }}>
          <p style={{
            fontFamily: FONT.display,
            fontSize: 'clamp(24px, 3vw, 42px)',
            color: '#EFE7D6',
            lineHeight: 1.3,
            margin: 0,
          }}>
            "Built in a small room, loud — Bengaluru, IN. Started because the founders were tired of copy-pasting into ChatGPT at midnight."
          </p>
          <div style={{
            marginTop: 28,
            fontFamily: FONT.mono,
            fontSize: 12,
            letterSpacing: 3,
            textTransform: 'uppercase',
            color: '#666',
          }}>
            — the origin story, abridged
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="vq-section-pad" style={{ background: '#FFF9ED', borderBottom: '3px solid #111' }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <div style={{ marginBottom: 'clamp(28px, 4vw, 40px)' }}>
            <div style={{
              fontFamily: FONT.mono,
              fontSize: 13,
              letterSpacing: 3,
              textTransform: 'uppercase',
              color: '#666',
              marginBottom: 16,
            }}>
              [ COMMON QUESTIONS ]
            </div>
            <h2 style={{
              fontFamily: FONT.display,
              fontSize: 'clamp(32px, 4.5vw, 56px)',
              margin: 0,
              lineHeight: 0.95,
            }}>
              about Veqiro.
            </h2>
          </div>

          <div style={{ display: 'grid', gap: 14 }}>
            {ABOUT_FAQ.map((item) => (
              <details
                key={item.q}
                style={{
                  border: '3px solid #111',
                  borderRadius: 12,
                  background: '#EFE7D6',
                  boxShadow: '4px 4px 0 #111',
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
                      fontFamily: FONT.display,
                      fontSize: 22,
                      color: '#111',
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

      {/* ── CTA ── */}
      <section className="vq-section-pad">
        <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            fontFamily: FONT.mono,
            fontSize: 13,
            letterSpacing: 3,
            textTransform: 'uppercase',
            color: '#666',
            marginBottom: 20,
          }}>
            [ MEET THE CREW ]
          </div>
          <h2 style={{
            fontFamily: FONT.display,
            fontSize: 'clamp(48px, 7vw, 96px)',
            margin: '0 0 36px',
            lineHeight: 0.9,
          }}>
            six hires.<br />
            <span style={{
              background: '#F5C518',
              padding: '0 18px',
              display: 'inline-block',
              border: '3px solid #111',
              borderRadius: 8,
              boxShadow: '5px 5px 0 #111',
            }}>
              one bill.
            </span>
          </h2>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button variant="dark" href={`${consoleUrl}/signup`}>Start hiring →</Button>
            <Button variant="ghost" href="/">Back to home</Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
