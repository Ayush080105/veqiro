import Link from 'next/link';
import type { BlogPostMeta } from '@/lib/blog';
import { consoleUrl, isPreLaunch, waitlistUrl } from '@/lib/site-config';
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
          Blog
        </p>
        <h1
          style={{
            fontFamily: 'var(--font-display), system-ui, sans-serif',
            fontSize: 'clamp(48px, 8vw, 108px)',
            lineHeight: 0.92,
            color: 'var(--vq-cream)',
            margin: '0 0 20px',
            maxWidth: 900,
          }}
        >
          Guides, playbooks, and field notes.
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-body), system-ui, sans-serif',
            fontSize: 'clamp(15px, 1.8vw, 18px)',
            color: '#A9A192',
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
          borderTop: '1px solid rgba(20,18,14,0.10)',
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
          Featured
        </p>
        <div style={{ maxWidth: 800 }}>
          <BlogCard post={featured} index={0} variant="featured" />
        </div>
      </section>

      {/* Grid */}
      <section
        style={{
          background: 'var(--vq-cream)',
          borderTop: '1px solid rgba(20,18,14,0.10)',
          padding: 'clamp(48px, 6vw, 80px) clamp(20px, 5vw, 80px)',
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-display), system-ui, sans-serif',
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
          borderTop: '1px solid rgba(20,18,14,0.10)',
          padding: 'clamp(60px, 8vw, 100px) clamp(20px, 5vw, 80px)',
          textAlign: 'center',
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-display), system-ui, sans-serif',
            fontSize: 'clamp(36px, 5vw, 64px)',
            color: 'var(--vq-cream)',
            margin: '0 0 16px',
            lineHeight: 1,
          }}
        >
          Your crew is waiting.
        </h2>
        <p
          style={{
            fontFamily: 'var(--font-body), system-ui, sans-serif',
            fontSize: 17,
            color: '#A9A192',
            margin: '0 0 32px',
            lineHeight: 1.6,
          }}
        >
          Six AI employees, billed independently, starting at $9/mo.
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
            href={isPreLaunch ? waitlistUrl : `${consoleUrl}/signup`}
            style={{
              background: 'var(--vq-ink-inv)',
              color: 'var(--vq-ink)',
              border: '1px solid var(--vq-ink-inv)',
              borderRadius: 11,
              padding: '14px 28px',
              fontFamily: 'var(--font-body), system-ui, sans-serif',
              fontSize: 15,
              fontWeight: 550,
              textDecoration: 'none',
            }}
          >
            Start free — 7 days on us →
          </a>
          <Link
            href="/pricing"
            style={{
              background: 'rgba(242,236,224,0.08)',
              color: 'var(--vq-ink-inv)',
              border: '1px solid var(--vq-line-inv-2)',
              borderRadius: 11,
              padding: '14px 28px',
              fontFamily: 'var(--font-body), system-ui, sans-serif',
              fontSize: 15,
              fontWeight: 500,
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
