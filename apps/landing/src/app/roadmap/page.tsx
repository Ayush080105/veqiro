import Link from 'next/link';
import { buildPageMetadata } from '@/lib/seo';
import { consoleUrl } from '@/lib/site-config';
import { PageNav } from '@/components/veqiro/page-nav';
import { Footer } from '@/components/veqiro/sections';
import { FONT } from '@/components/veqiro/shared';

// ─── Metadata ─────────────────────────────────────────────────────────────────

export const metadata = buildPageMetadata({
  title: 'Product Roadmap — Veqiro',
  description:
    'See what the Veqiro team is building now, what is planned next, and what has already shipped. Vote for upcoming AI agents you want most.',
  path: '/roadmap',
  keywords: ['veqiro roadmap', 'ai agents roadmap', 'product updates', 'upcoming features'],
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface RoadmapPost {
  id: string;
  title: string;
  description: string;
  category: string;
  agentSlug: string | null;
  status: string;
  voteCount: number;
  adminReply: string | null;
  roadmapEta: string | null;
  createdAt: string;
  createdBy: { id: string; name: string };
  _count: { comments: number };
}

interface UpcomingAgent {
  id: string;
  name: string;
  tagline: string;
  description: string | null;
  emoji: string | null;
  color: string | null;
  voteCount: number;
  order: number;
  isVisible: boolean;
}

interface PublicRoadmapData {
  posts: RoadmapPost[];
  upcoming: UpcomingAgent[];
}

// ─── Data fetching ────────────────────────────────────────────────────────────

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_INTERNAL_URL ||
  'http://localhost:3002/api';

async function getRoadmapData(): Promise<PublicRoadmapData> {
  try {
    const res = await fetch(`${API_BASE}/feedback/public-roadmap`, {
      next: { revalidate: 300 }, // revalidate every 5 minutes
    });
    if (!res.ok) return { posts: [], upcoming: [] };
    return res.json();
  } catch {
    return { posts: [], upcoming: [] };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  FEATURE_REQUEST: 'Feature Request',
  BUG_REPORT:      'Bug Report',
  INTEGRATION:     'Integration',
  NEW_AGENT:       'New Agent',
  UX_IMPROVEMENT:  'UX',
  GENERAL:         'General',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusColumn({
  title,
  accent,
  posts,
  emptyText,
}: {
  title: string;
  accent: string;
  posts: RoadmapPost[];
  emptyText: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Column header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          paddingBottom: 12,
          borderBottom: '3px solid #111',
        }}
      >
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: accent,
            border: '2px solid #111',
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: FONT.head,
            fontSize: 14,
            textTransform: 'uppercase',
            letterSpacing: 1,
            fontWeight: 700,
          }}
        >
          {title}
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontFamily: FONT.mono,
            fontSize: 11,
            color: '#888',
          }}
        >
          {posts.length}
        </span>
      </div>

      {posts.length === 0 ? (
        <p
          style={{
            fontFamily: FONT.body,
            fontSize: 13,
            color: '#999',
            fontStyle: 'italic',
            padding: '12px 0',
          }}
        >
          {emptyText}
        </p>
      ) : (
        posts.map((post) => <RoadmapCard key={post.id} post={post} accent={accent} />)
      )}
    </div>
  );
}

function RoadmapCard({ post, accent }: { post: RoadmapPost; accent: string }) {
  return (
    <div
      style={{
        background: '#FFF9ED',
        border: '2.5px solid #111',
        borderRadius: 12,
        padding: '16px 18px',
        boxShadow: `3px 3px 0 ${accent}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <h3
          style={{
            fontFamily: FONT.head,
            fontSize: 14,
            margin: 0,
            lineHeight: 1.35,
            fontWeight: 700,
          }}
        >
          {post.title}
        </h3>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            flexShrink: 0,
            background: accent,
            border: '2px solid #111',
            borderRadius: 999,
            padding: '3px 9px',
            fontFamily: FONT.mono,
            fontSize: 11,
          }}
        >
          ▲ {post.voteCount}
        </div>
      </div>

      <p
        style={{
          fontFamily: FONT.body,
          fontSize: 13,
          color: '#444',
          margin: 0,
          lineHeight: 1.5,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {post.description}
      </p>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: 1,
            color: '#777',
            background: '#eee',
            borderRadius: 4,
            padding: '2px 6px',
          }}
        >
          {CATEGORY_LABELS[post.category] ?? post.category}
        </span>
        {post.agentSlug && (
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: 1,
              color: '#777',
              background: '#eee',
              borderRadius: 4,
              padding: '2px 6px',
            }}
          >
            {post.agentSlug}
          </span>
        )}
        {post.roadmapEta && (
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 10,
              letterSpacing: 0.5,
              color: '#555',
              marginLeft: 'auto',
            }}
          >
            ETA: {post.roadmapEta}
          </span>
        )}
      </div>

      {post.adminReply && (
        <div
          style={{
            background: '#F0EAD8',
            border: '1.5px solid #ccc',
            borderRadius: 8,
            padding: '10px 12px',
            marginTop: 4,
          }}
        >
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 10,
              letterSpacing: 1,
              textTransform: 'uppercase',
              color: '#888',
              marginBottom: 4,
            }}
          >
            Team update
          </div>
          <p style={{ fontFamily: FONT.body, fontSize: 13, color: '#333', margin: 0, lineHeight: 1.5 }}>
            {post.adminReply}
          </p>
        </div>
      )}
    </div>
  );
}

function UpcomingAgentCard({ agent }: { agent: UpcomingAgent }) {
  return (
    <div
      style={{
        background: '#FFF9ED',
        border: '2.5px solid #111',
        borderRadius: 14,
        padding: '20px 22px',
        boxShadow: '4px 4px 0 #111',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {agent.emoji && (
          <div
            style={{
              width: 48,
              height: 48,
              background: agent.color ?? '#F5C518',
              border: '2.5px solid #111',
              borderRadius: 12,
              display: 'grid',
              placeItems: 'center',
              fontSize: 22,
              flexShrink: 0,
              boxShadow: '3px 3px 0 #111',
            }}
          >
            {agent.emoji}
          </div>
        )}
        <div>
          <div
            style={{
              fontFamily: FONT.head,
              fontSize: 16,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {agent.name}
          </div>
          <div
            style={{ fontFamily: FONT.body, fontSize: 13, color: '#555', marginTop: 2 }}
          >
            {agent.tagline}
          </div>
        </div>
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <div
            style={{
              fontFamily: FONT.display,
              fontSize: 28,
              lineHeight: 1,
              color: '#111',
            }}
          >
            {agent.voteCount}
          </div>
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 9,
              letterSpacing: 1,
              textTransform: 'uppercase',
              color: '#888',
            }}
          >
            votes
          </div>
        </div>
      </div>

      {agent.description && (
        <p
          style={{
            fontFamily: FONT.body,
            fontSize: 13,
            color: '#555',
            margin: 0,
            lineHeight: 1.55,
          }}
        >
          {agent.description}
        </p>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function RoadmapPage() {
  const { posts, upcoming } = await getRoadmapData();

  const inProgress = posts.filter((p) => p.status === 'IN_PROGRESS');
  const planned    = posts.filter((p) => p.status === 'PLANNED');
  const launched   = posts.filter((p) => p.status === 'LAUNCHED');

  return (
    <div style={{ background: '#EFE7D6', minHeight: '100vh' }}>
      <div className="noise-overlay" aria-hidden />

      {/* Nav */}
      <div
        style={{
          borderBottom: '3px solid #111',
          background: '#EFE7D6',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <PageNav />
      </div>

      {/* Hero */}
      <section
        style={{
          borderBottom: '3px solid #111',
          padding: 'clamp(48px, 8vw, 96px) clamp(20px, 5vw, 48px)',
          maxWidth: 1400,
          margin: '0 auto',
        }}
      >
        <div style={{ maxWidth: 720 }}>
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 12,
              letterSpacing: 3,
              textTransform: 'uppercase',
              color: '#888',
              marginBottom: 16,
            }}
          >
            [ ROADMAP ]
          </div>
          <h1
            style={{
              fontFamily: FONT.display,
              fontSize: 'clamp(56px, 8vw, 112px)',
              margin: 0,
              lineHeight: 0.9,
              letterSpacing: -1,
            }}
          >
            built by the
            <br />
            <span
              style={{
                background: '#F5C518',
                padding: '0 16px',
                display: 'inline-block',
                transform: 'rotate(-1.5deg)',
                border: '3px solid #111',
                borderRadius: 10,
                boxShadow: '5px 5px 0 #111',
              }}
            >
              community.
            </span>
          </h1>
          <p
            style={{
              fontFamily: FONT.body,
              fontSize: 'clamp(15px, 2vw, 18px)',
              color: '#444',
              marginTop: 28,
              lineHeight: 1.6,
              maxWidth: 560,
            }}
          >
            Every feature on this page was requested or upvoted by real Veqiro users. This is
            what we&apos;re building, what&apos;s coming next, and what we&apos;ve already shipped.
          </p>
        </div>
      </section>

      {/* Kanban columns */}
      <section
        style={{
          padding: 'clamp(40px, 6vw, 72px) clamp(20px, 5vw, 48px)',
          maxWidth: 1400,
          margin: '0 auto',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 32,
            alignItems: 'start',
          }}
        >
          <StatusColumn
            title="Now"
            accent="#1DBC87"
            posts={inProgress}
            emptyText="Nothing in active development right now."
          />
          <StatusColumn
            title="Next"
            accent="#F5C518"
            posts={planned}
            emptyText="Nothing officially queued yet — watch this space."
          />
          <StatusColumn
            title="Shipped"
            accent="#6FCDE8"
            posts={launched}
            emptyText="Nothing shipped yet — check back soon."
          />
        </div>
      </section>

      {/* Upcoming agents vote section */}
      {upcoming.length > 0 && (
        <section
          style={{
            borderTop: '3px solid #111',
            padding: 'clamp(40px, 6vw, 72px) clamp(20px, 5vw, 48px)',
            background: '#111',
            color: '#EFE7D6',
          }}
        >
          <div style={{ maxWidth: 1400, margin: '0 auto' }}>
            <div style={{ marginBottom: 'clamp(32px, 5vw, 52px)' }}>
              <div
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 12,
                  letterSpacing: 3,
                  textTransform: 'uppercase',
                  color: '#F5C518',
                  marginBottom: 12,
                }}
              >
                [ VOTE FOR WHAT&apos;S NEXT ]
              </div>
              <h2
                style={{
                  fontFamily: FONT.display,
                  fontSize: 'clamp(36px, 5vw, 72px)',
                  margin: 0,
                  lineHeight: 0.95,
                  letterSpacing: -0.5,
                }}
              >
                which agent
                <br />
                should we{' '}
                <span style={{ color: '#F5C518' }}>build next?</span>
              </h2>
              <p
                style={{
                  fontFamily: FONT.body,
                  fontSize: 'clamp(14px, 1.8vw, 16px)',
                  color: '#aaa',
                  marginTop: 16,
                  maxWidth: 480,
                  lineHeight: 1.6,
                }}
              >
                Sign in to cast your vote. The most-voted agents get prioritized.
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 20,
              }}
            >
              {upcoming.map((agent) => (
                <UpcomingAgentCard key={agent.id} agent={agent} />
              ))}
            </div>

            <div
              style={{
                marginTop: 40,
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <a
                href={`${consoleUrl}/signup`}
                style={{
                  background: '#F5C518',
                  color: '#111',
                  padding: '16px 36px',
                  border: '3px solid #F5C518',
                  borderRadius: 12,
                  fontFamily: FONT.head,
                  fontSize: 14,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  textDecoration: 'none',
                  boxShadow: '5px 5px 0 #F5C518',
                  display: 'inline-block',
                }}
              >
                Join Veqiro &amp; vote →
              </a>
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section
        style={{
          borderTop: '3px solid #111',
          padding: 'clamp(40px, 6vw, 72px) clamp(20px, 5vw, 48px)',
          background: '#F06464',
        }}
      >
        <div
          style={{
            maxWidth: 1400,
            margin: '0 auto',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 28,
          }}
        >
          <div>
            <h2
              style={{
                fontFamily: FONT.display,
                fontSize: 'clamp(32px, 5vw, 64px)',
                margin: 0,
                lineHeight: 0.95,
                color: '#111',
              }}
            >
              have ideas?
            </h2>
            <p
              style={{
                fontFamily: FONT.body,
                fontSize: 16,
                color: '#222',
                marginTop: 12,
                maxWidth: 420,
              }}
            >
              Submit feature requests, report bugs, or vote for what matters most to your team.
              Your feedback directly shapes what we build.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <Link
              href={`${consoleUrl}/feedback`}
              style={{
                background: '#111',
                color: '#EFE7D6',
                padding: '16px 28px',
                border: '3px solid #111',
                borderRadius: 12,
                fontFamily: FONT.head,
                fontSize: 13,
                textTransform: 'uppercase',
                letterSpacing: 1,
                textDecoration: 'none',
                boxShadow: '5px 5px 0 #F5C518',
                display: 'inline-block',
              }}
            >
              Submit feedback →
            </Link>
            <a
              href={`${consoleUrl}/signup`}
              style={{
                background: '#FFF9ED',
                color: '#111',
                padding: '16px 28px',
                border: '3px solid #111',
                borderRadius: 12,
                fontFamily: FONT.head,
                fontSize: 13,
                textTransform: 'uppercase',
                letterSpacing: 1,
                textDecoration: 'none',
                boxShadow: '5px 5px 0 #111',
                display: 'inline-block',
              }}
            >
              Start free trial →
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
