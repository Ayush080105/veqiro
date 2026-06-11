import Link from 'next/link';
import type { BlogPost, BlogPostMeta } from '@/lib/blog';
import { consoleUrl, isPreLaunch, waitlistUrl } from '@/lib/site-config';
import { JsonLd } from './json-ld';
import { Breadcrumbs } from './breadcrumbs';
import { BlogToc } from './blog-toc';
import { BlogProgressBar } from './blog-progress-bar';
import { BlogAgentCta } from './blog-agent-cta';
import { BlogCard } from './blog-card';
import { PageNav } from './page-nav';
import { Footer } from './sections';
import { articleJsonLd, faqPageJsonLd } from '@/lib/jsonld';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const CATEGORY_LABELS: Record<string, string> = {
  'ai-employees': 'AI Employees',
  'founders': 'Founders',
  'agents': 'Agents',
  'use-cases': 'Use Cases',
  'comparisons': 'Comparisons',
};

const CATEGORY_COLORS: Record<string, { bg: string; ink: string }> = {
  'ai-employees': { bg: '#F5C518', ink: '#7A5A00' },
  'founders': { bg: '#F06464', ink: '#7A1717' },
  'agents': { bg: '#8A8AF0', ink: '#2A2A7A' },
  'use-cases': { bg: '#1DBC87', ink: '#0E5C3F' },
  'comparisons': { bg: '#F79FD4', ink: '#8E2A6A' },
};

interface BlogPostLayoutProps {
  post: BlogPost;
  related: BlogPostMeta[];
  crumbs: { name: string; url: string }[];
}

export function BlogPostLayout({ post, related, crumbs }: BlogPostLayoutProps) {
  const catColor = CATEGORY_COLORS[post.category] ?? { bg: '#F5C518', ink: '#111' };

  return (
    <>
      <BlogProgressBar />

      <JsonLd data={[articleJsonLd(post), faqPageJsonLd(post.faq)]} />

      <PageNav />

      {/* Hero */}
      <section
        style={{
          background: '#111',
          padding: 'clamp(60px, 8vw, 100px) clamp(20px, 5vw, 80px) 60px',
        }}
      >
        <Breadcrumbs items={crumbs} theme="dark" />

        <div style={{ marginTop: 24, marginBottom: 16 }}>
          <span
            className="blog-category-badge"
            style={{ background: catColor.bg, color: catColor.ink, display: 'inline-block' }}
          >
            {CATEGORY_LABELS[post.category] ?? post.category}
          </span>
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-bagel), cursive',
            fontSize: 'clamp(34px, 5.5vw, 68px)',
            lineHeight: 0.96,
            color: 'var(--vq-cream)',
            margin: '0 0 20px',
            maxWidth: 900,
            letterSpacing: '-0.01em',
          }}
        >
          {post.title}
        </h1>

        <p
          style={{
            fontFamily: 'var(--font-mono), monospace',
            fontSize: 12,
            letterSpacing: 2,
            textTransform: 'uppercase',
            color: '#F5C518',
            margin: '0 0 16px',
          }}
        >
          [ {post.readingTime} min read ] · {formatDate(post.date)} · Veqiro
        </p>

        <p
          style={{
            fontFamily: 'var(--font-space), sans-serif',
            fontSize: 'clamp(15px, 1.8vw, 18px)',
            color: '#888',
            maxWidth: 640,
            lineHeight: 1.65,
            margin: 0,
          }}
        >
          {post.description}
        </p>
      </section>

      {/* Post body */}
      <section
        style={{
          background: 'var(--vq-bg)',
          borderTop: '3px solid #111',
          padding: 'clamp(48px, 6vw, 80px) clamp(20px, 5vw, 80px)',
        }}
      >
        <div className="blog-post-grid">
          {/* Article column */}
          <div>
            <article
              className="blog-content"
              dangerouslySetInnerHTML={{ __html: post.contentHtml }}
            />
            {post.agentKey && <BlogAgentCta agentKey={post.agentKey} />}
          </div>

          {/* TOC sidebar */}
          <BlogToc items={post.tocItems} />
        </div>
      </section>

      {/* FAQ */}
      {post.faq.length > 0 && (
        <section
          style={{
            background: 'var(--vq-cream)',
            borderTop: '3px solid #111',
            padding: 'clamp(48px, 6vw, 80px) clamp(20px, 5vw, 80px)',
          }}
        >
          <div style={{ maxWidth: 760, margin: '0 auto' }}>
            <h2
              style={{
                fontFamily: 'var(--font-bagel), cursive',
                fontSize: 'clamp(30px, 4vw, 50px)',
                color: '#111',
                margin: '0 0 40px',
                lineHeight: 1,
              }}
            >
              questions people keep asking.
            </h2>
            <div style={{ display: 'grid', gap: 20 }}>
              {post.faq.map((item, i) => (
                <div
                  key={i}
                  style={{
                    background: 'var(--vq-bg)',
                    border: '3px solid #111',
                    borderRadius: 12,
                    padding: '24px 28px',
                    boxShadow: '4px 4px 0 #111',
                  }}
                >
                  <h3
                    style={{
                      fontFamily: 'var(--font-archivo), sans-serif',
                      fontSize: 'clamp(16px, 1.8vw, 18px)',
                      fontWeight: 900,
                      color: '#111',
                      margin: '0 0 10px',
                    }}
                  >
                    {item.q}
                  </h3>
                  <p
                    style={{
                      fontFamily: 'var(--font-space), sans-serif',
                      fontSize: 15,
                      lineHeight: 1.7,
                      color: '#444',
                      margin: 0,
                    }}
                  >
                    {item.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Join CTA */}
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
          }}
        >
          Six AI employees. One subscription. $39/mo.
        </p>
        <a
          href={isPreLaunch ? waitlistUrl : `${consoleUrl}/signup`}
          style={{
            display: 'inline-block',
            background: 'var(--vq-yellow)',
            color: '#111',
            border: '3px solid var(--vq-yellow)',
            borderRadius: 999,
            padding: '14px 36px',
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
      </section>

      {/* Related posts */}
      {related.length > 0 && (
        <section
          style={{
            background: 'var(--vq-bg)',
            borderTop: '3px solid #111',
            padding: 'clamp(48px, 6vw, 80px) clamp(20px, 5vw, 80px)',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-archivo), sans-serif',
              fontSize: 'clamp(22px, 2.6vw, 30px)',
              fontWeight: 900,
              color: '#111',
              margin: '0 0 32px',
            }}
          >
            more from the crew
          </h2>
          <div className="blog-card-grid">
            {related.map((p, i) => (
              <BlogCard key={p.slug} post={p} index={i} />
            ))}
          </div>
        </section>
      )}

      <Footer />
    </>
  );
}
