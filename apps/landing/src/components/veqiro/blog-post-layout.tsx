import Link from 'next/link';
import type { BlogPost, BlogPostMeta } from '@/lib/blog';
import { consoleUrl, isPreLaunch, waitlistUrl } from '@/lib/site-config';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '@/lib/blog-categories';
import { T } from './tokens';
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

interface BlogPostLayoutProps {
  post: BlogPost;
  related: BlogPostMeta[];
  crumbs: { name: string; url: string }[];
}

export function BlogPostLayout({ post, related, crumbs }: BlogPostLayoutProps) {
  const catColor = CATEGORY_COLORS[post.category] ?? { bg: T.amber, ink: T.ink };

  return (
    <>
      <BlogProgressBar />

      <JsonLd data={[articleJsonLd(post), faqPageJsonLd(post.faq)]} />

      <PageNav />

      {/* Hero */}
      <section
        style={{
          background: T.ink,
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
            fontFamily: 'var(--font-display), system-ui, sans-serif',
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
            color: T.amber,
            margin: '0 0 16px',
          }}
        >
          {post.readingTime} min read · {formatDate(post.date)} · Veqiro
        </p>

        <p
          style={{
            fontFamily: 'var(--font-body), system-ui, sans-serif',
            fontSize: 'clamp(15px, 1.8vw, 18px)',
            color: T.ink3,
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
          borderTop: `1px solid ${T.line}`,
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
            borderTop: `1px solid ${T.line}`,
            padding: 'clamp(48px, 6vw, 80px) clamp(20px, 5vw, 80px)',
          }}
        >
          <div style={{ maxWidth: 760, margin: '0 auto' }}>
            <h2
              style={{
                fontFamily: 'var(--font-display), system-ui, sans-serif',
                fontSize: 'clamp(30px, 4vw, 50px)',
                color: T.ink,
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
                    border: `1px solid ${T.line}`,
                    borderRadius: 12,
                    padding: '24px 28px',
                    boxShadow: T.shadow,
                  }}
                >
                  <h3
                    style={{
                      fontFamily: 'var(--font-display), system-ui, sans-serif',
                      fontSize: 'clamp(16px, 1.8vw, 18px)',
                      fontWeight: 600,
                      color: T.ink,
                      margin: '0 0 10px',
                    }}
                  >
                    {item.q}
                  </h3>
                  <p
                    style={{
                      fontFamily: 'var(--font-body), system-ui, sans-serif',
                      fontSize: 15,
                      lineHeight: 1.7,
                      color: T.ink2,
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
          background: T.ink,
          borderTop: `1px solid ${T.line}`,
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
            color: T.inkInv2,
            margin: '0 0 32px',
          }}
        >
          Six AI employees, billed independently, starting at $9/mo.
        </p>
        <a
          href={isPreLaunch ? waitlistUrl : `${consoleUrl}/signup`}
          style={{
            display: 'inline-block',
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
      </section>

      {/* Related posts */}
      {related.length > 0 && (
        <section
          style={{
            background: 'var(--vq-bg)',
            borderTop: `1px solid ${T.line}`,
            padding: 'clamp(48px, 6vw, 80px) clamp(20px, 5vw, 80px)',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-display), system-ui, sans-serif',
              fontSize: 'clamp(22px, 2.6vw, 30px)',
              fontWeight: 600,
              letterSpacing: '-0.03em',
              color: T.dark,
              margin: '0 0 32px',
            }}
          >
            More from the crew
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
