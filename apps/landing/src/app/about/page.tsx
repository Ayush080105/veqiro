import React from 'react';
import { Footer } from '@/components/veqiro/sections';
import { PageNav } from '@/components/veqiro/page-nav';
import { FONT, Button } from '@/components/veqiro/shared';
import { AboutCrewGrid } from '@/components/veqiro/about-crew-grid';
import { mainAppUrl } from '@/lib/site-config';
import { buildPageMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/veqiro/json-ld';
import { organizationJsonLd } from '@/lib/jsonld';

export const metadata = buildPageMetadata({
  title: 'About Veqiro — Six AI Employees, One Bill',
  description: 'We built Veqiro because lean teams deserve the same leverage as big ones. Meet the six AI employees behind your crew.',
  path: '/about',
  keywords: ['who is veqiro', 'veqiro team', 'ai crew', 'all in one ai platform for startups'],
});

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
      <JsonLd data={organizationJsonLd()} />
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

      {/* ── VALUES ── */}
      <section className="vq-section-pad" style={{ background: '#FFF9ED', borderBottom: '3px solid #111' }}>
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
      <section className="vq-section-pad" style={{ borderBottom: '3px solid #111' }}>
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
            <Button variant="dark" href={`${mainAppUrl}/signup`}>Start hiring →</Button>
            <Button variant="ghost" href="/">Back to home</Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
