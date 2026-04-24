import Link from 'next/link';
import type { BlogPostMeta } from '@/lib/blog';
import { BlogCard } from './blog-card';
import { PageNav } from './page-nav';
import { Footer } from './sections';

interface BlogIndexPageProps {
  featured: BlogPostMeta;
  posts: BlogPostMeta[];
}

export function BlogIndexPage({ featured, posts }: BlogIndexPageProps) {
  return (
    <>
      <PageNav />

      {/* Hero */}
      <section
        style={{
          background: '#111',
          padding: 'clamp(60px, 8vw, 100px) clamp(20px, 5vw, 80px) 60px',
        }}
      >
        <nav
          aria-label="Breadcrumb"
          style={{
            fontFamily: 'var(--font-mono), monospace',
            fontSize: 11,
            letterSpacing: 2,
            textTransform: 'uppercase',
            color: '#555',
            marginBottom: 24,
          }}
        >
          <Link href="/" style={{ color: '#555', textDecoration: 'none' }}>
            Home
          </Link>
          <span style={{ margin: '0 8px' }}>›</span>
          <span style={{ color: '#888' }}>Blog</span>
        </nav>

        <p
          style={{
            fontFamily: 'var(--font-mono), monospace',
            fontSize: 11,
            letterSpacing: 3,
            textTransform: 'uppercase',
            color: '#F5C518',
            marginBottom: 16,
          }}
        >
          [ the crew&apos;s notes ]
        </p>
        <h1
          style={{
            fontFamily: 'var(--font-bagel), cursive',
            fontSize: 'clamp(48px, 8vw, 108px)',
            lineHeight: 0.92,
            color: 'var(--vq-cream)',
            margin: '0 0 20px',
            maxWidth: 900,
          }}
        >
          from the desk of the crew.
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-space), sans-serif',
            fontSize: 'clamp(15px, 1.8vw, 18px)',
            color: '#777',
            maxWidth: 560,
            lineHeight: 1.65,
            margin: 0,
          }}
        >
          Guides, how-tos, and founder playbooks on AI employees, startup ops,
          SEO, legal, and finance.
        </p>
      </section>

      {/* Featured post */}
      <section
        style={{
          background: 'var(--vq-bg)',
          borderTop: '3px solid #111',
          padding: 'clamp(48px, 6vw, 80px) clamp(20px, 5vw, 80px)',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-mono), monospace',
            fontSize: 10,
            letterSpacing: 3,
            textTransform: 'uppercase',
            color: '#888',
            marginBottom: 28,
          }}
        >
          [ featured read ]
        </p>
        <div style={{ maxWidth: 800 }}>
          <BlogCard post={featured} index={0} variant="featured" />
        </div>
      </section>

      {/* Grid */}
      <section
        style={{
          background: 'var(--vq-cream)',
          borderTop: '3px solid #111',
          padding: 'clamp(48px, 6vw, 80px) clamp(20px, 5vw, 80px)',
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-bagel), cursive',
            fontSize: 'clamp(28px, 4vw, 48px)',
            color: '#111',
            margin: '0 0 40px',
            lineHeight: 1,
          }}
        >
          the rest of the notes.
        </h2>
        <div className="blog-card-grid">
          {posts.map((post, i) => (
            <BlogCard key={post.slug} post={post} index={i + 1} />
          ))}
        </div>
      </section>

      {/* CTA */}
      <section
        style={{
          background: '#111',
          borderTop: '3px solid #111',
          padding: 'clamp(60px, 8vw, 100px) clamp(20px, 5vw, 80px)',
          textAlign: 'center',
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-bagel), cursive',
            fontSize: 'clamp(36px, 5vw, 64px)',
            color: 'var(--vq-cream)',
            margin: '0 0 16px',
            lineHeight: 1,
          }}
        >
          your crew is waiting.
        </h2>
        <p
          style={{
            fontFamily: 'var(--font-space), sans-serif',
            fontSize: 17,
            color: '#777',
            margin: '0 0 32px',
            lineHeight: 1.6,
          }}
        >
          Six AI employees. One subscription. $39/mo.
        </p>
        <div
          style={{
            display: 'flex',
            gap: 16,
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <a
            href="https://app.veqiro.com/signup"
            style={{
              background: 'var(--vq-yellow)',
              color: '#111',
              border: '3px solid var(--vq-yellow)',
              borderRadius: 999,
              padding: '14px 32px',
              fontFamily: 'var(--font-mono), monospace',
              fontSize: 13,
              letterSpacing: 2,
              textTransform: 'uppercase',
              fontWeight: 700,
              textDecoration: 'none',
              boxShadow: '4px 4px 0 #b89400',
            }}
          >
            Start free — 7 days on us →
          </a>
          <Link
            href="/pricing"
            style={{
              background: 'transparent',
              color: 'var(--vq-cream)',
              border: '3px solid #444',
              borderRadius: 999,
              padding: '14px 32px',
              fontFamily: 'var(--font-mono), monospace',
              fontSize: 13,
              letterSpacing: 2,
              textTransform: 'uppercase',
              textDecoration: 'none',
            }}
          >
            See pricing
          </Link>
        </div>
      </section>

      <Footer />
    </>
  );
}
