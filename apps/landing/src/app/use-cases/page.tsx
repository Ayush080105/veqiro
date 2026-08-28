import Link from 'next/link';
import { buildPageMetadata, SITE_URL } from '@/lib/seo';
import { PageNav } from '@/components/veqiro/page-nav';
import { Footer } from '@/components/veqiro/sections';
import { Breadcrumbs } from '@/components/veqiro/breadcrumbs';
import { FONT, Button } from '@/components/veqiro/shared';
import { consoleUrl, isPreLaunch, waitlistUrl } from '@/lib/site-config';

export const metadata = buildPageMetadata({
  title: 'Use Cases — Who Veqiro Is For',
  description:
    'See how founders, marketing teams, agencies, and growing startups use Veqiro to automate operations without adding headcount. Pick the playbook that fits.',
  path: '/use-cases',
  keywords: [
    'ai use cases',
    'ai for startups',
    'ai for small teams',
    'ai employee platform',
    'ai workforce use cases',
  ],
});

interface UseCase {
  slug: string;
  persona: string;
  headline: string;
  blurb: string;
  bullets: string[];
  accent: string;
  ink: string;
}

const USE_CASES: UseCase[] = [
  {
    slug: 'founders',
    persona: 'For Founders',
    headline: 'Your first 6 hires, without the payroll.',
    blurb:
      'Early-stage founders wear six hats. Veqiro takes five of them off — inbox, research, content, SEO, legal, and finance — so you can focus on the one only you can wear.',
    bullets: [
      'Inbox zero without sacrificing your mornings',
      'Competitor teardowns written while you sleep',
      'Contracts reviewed before they land on your desk',
    ],
    accent: '#F5C518',
    ink: '#7A5A00',
  },
  {
    slug: 'marketing-teams',
    persona: 'For Marketing Teams',
    headline: 'Ship content at 3x pace. Same headcount.',
    blurb:
      'Small marketing teams drown in output: blog posts, social, SEO, ads. Maya writes, Sage ranks, Scout researches — your team stops executing and starts strategizing.',
    bullets: [
      'Brand-voice content across LinkedIn, X, Instagram, and blog',
      'SEO keyword research + full articles — no agency retainer',
      'Competitor content intel delivered weekly',
    ],
    accent: '#F06464',
    ink: '#7A1717',
  },
  {
    slug: 'agencies',
    persona: 'For Agencies',
    headline: 'Run 10 clients like you have a team of 30.',
    blurb:
      'Agency margins collapse when output per client rises. Veqiro isolates each client brand and multiplies output without multiplying headcount. One subscription, unlimited brands.',
    bullets: [
      'Per-client Brain = zero brand bleed across accounts',
      'Scale content, SEO, and research across every retainer',
      'Legal review built in for vendor and client contracts',
    ],
    accent: '#8A8AF0',
    ink: '#2A2A7A',
  },
  {
    slug: 'growing-startups',
    persona: 'For Growing Startups',
    headline: 'Scale the output. Not the headcount.',
    blurb:
      "You've got revenue, a real team, and momentum — but you're still running lean on the operational layer. Veqiro gives your team six AI specialists so you stop hiring for execution and start competing on speed.",
    bullets: [
      'Board decks and investor updates from live data — not 3 days of slides',
      'Content, SEO, and research at growth pace without a full team',
      'Legal reviews, financial reports, and exec inbox — handled',
    ],
    accent: '#1DBC87',
    ink: '#0E5C3F',
  },
];

export default function UseCasesHubPage() {
  const crumbs = [
    { name: 'Home', url: SITE_URL },
    { name: 'Use Cases', url: `${SITE_URL}/use-cases` },
  ];

  return (
    <div style={{ background: '#EFE7D6', minHeight: '100vh' }}>
      <PageNav />

      {/* ── HERO ── */}
      <section
        style={{
          background: '#111',
          borderTop: '1px solid rgba(20,18,14,0.10)',
          borderBottom: '1px solid rgba(20,18,14,0.10)',
          padding: 'clamp(40px, 7vw, 80px) clamp(20px, 4vw, 40px)',
        }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <Breadcrumbs items={crumbs} theme="dark" />

          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 13,
              letterSpacing: 3,
              textTransform: 'uppercase',
              color: '#F5C518',
              marginTop: 16,
              marginBottom: 20,
            }}
          >
            Use cases
          </div>

          <h1
            style={{
              fontFamily: FONT.display, fontWeight: 600, letterSpacing: '-0.03em',
              fontSize: 'clamp(48px, 8vw, 112px)',
              margin: '0 0 24px',
              lineHeight: 0.9,

              color: '#EFE7D6',
            }}
          >
            One crew.<br />
            <span style={{ color: '#F5C518' }}>four playbooks.</span>
          </h1>

          <p
            style={{
              fontFamily: FONT.body,
              fontSize: 'clamp(15px, 2vw, 19px)',
              color: '#999',
              lineHeight: 1.6,
              maxWidth: 640,
              margin: '0 0 12px',
            }}
          >
            Whether you&apos;re a founder wearing six hats, a marketing team bottlenecked on output, an agency scaling client work, or a growth-stage startup systematizing fast — the crew works the same. Pick the playbook that fits how you run.
          </p>
        </div>
      </section>

      {/* ── GRID OF USE CASES ── */}
      <section className="vq-section-pad" style={{ borderBottom: '1px solid rgba(20,18,14,0.10)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 28,
            }}
          >
            {USE_CASES.map((uc) => (
              <Link
                key={uc.slug}
                href={`/use-cases/${uc.slug}`}
                style={{
                  textDecoration: 'none',
                  color: 'inherit',
                  display: 'block',
                  background: '#FBF7EF',
                  border: '1px solid rgba(20,18,14,0.10)',
                  borderRadius: 16,
                  padding: '32px 28px',
                  boxShadow: '0 1px 3px rgba(20,18,14,0.05), 0 8px 24px -6px rgba(20,18,14,0.09)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                <div
                  style={{
                    display: 'inline-block',
                    background: uc.accent,
                    color: uc.ink,
                    border: '1px solid rgba(20,18,14,0.10)',
                    borderRadius: 999,
                    padding: '5px 14px',
                    fontFamily: FONT.mono,
                    fontSize: 11,
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                    marginBottom: 20,
                  }}
                >
                  {uc.persona}
                </div>
                <h2
                  style={{
                    fontFamily: FONT.display, fontWeight: 600, letterSpacing: '-0.03em',
                    fontSize: 'clamp(26px, 3.2vw, 36px)',
                    margin: '0 0 14px',
                    lineHeight: 1.05,

                  }}
                >
                  {uc.headline}
                </h2>
                <p
                  style={{
                    fontFamily: FONT.body,
                    fontSize: 15,
                    lineHeight: 1.65,
                    color: '#444',
                    margin: '0 0 18px',
                  }}
                >
                  {uc.blurb}
                </p>
                <ul
                  style={{
                    listStyle: 'none',
                    margin: '0 0 20px',
                    padding: 0,
                    display: 'grid',
                    gap: 8,
                  }}
                >
                  {uc.bullets.map((b) => (
                    <li
                      key={b}
                      style={{
                        fontFamily: FONT.body,
                        fontSize: 14,
                        color: '#333',
                        display: 'flex',
                        gap: 10,
                        alignItems: 'flex-start',
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: uc.accent,
                          border: '1px solid rgba(20,18,14,0.10)',
                          marginTop: 7,
                          flexShrink: 0,
                        }}
                      />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <div
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 12,
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                    color: '#111',
                    fontWeight: 700,
                  }}
                >
                  See the playbook →
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="vq-section-pad">
        <div style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 13,
              letterSpacing: 3,
              textTransform: 'uppercase',
              color: '#666',
              marginBottom: 20,
            }}
          >
            One plan for all
          </div>
          <h2
            style={{
              fontFamily: FONT.display, fontWeight: 600, letterSpacing: '-0.03em',
              fontSize: 'clamp(40px, 6vw, 80px)',
              margin: '0 0 28px',
              lineHeight: 0.92,
            }}
          >
            No matter which fits —<br />
            <span>
              Same crew.
            </span>
          </h2>
          <p
            style={{
              fontFamily: FONT.body,
              fontSize: 'clamp(15px, 2vw, 18px)',
              color: '#555',
              margin: '0 0 36px',
              lineHeight: 1.65,
            }}
          >
            All six AI employees, billed independently, starting at $9/mo. Pick one or hire the whole crew. 7-day free trial, no card needed.
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
