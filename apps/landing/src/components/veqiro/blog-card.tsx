'use client';
import Link from 'next/link';
import type { BlogPostMeta } from '@/lib/blog';
import { CATEGORY_COLORS, CATEGORY_LABELS } from '@/lib/blog-categories';
import { T } from './shared';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

interface BlogCardProps {
  post: BlogPostMeta;
  index?: number;
  variant?: 'default' | 'featured';
}

export function BlogCard({ post, variant = 'default' }: BlogCardProps) {
  const color = CATEGORY_COLORS[post.category];
  const isFeatured = variant === 'featured';

  return (
    <Link
      href={`/blog/${post.slug}`}
      style={{
        display: 'block',
        background: 'var(--vq-cream)',
        border: `1px solid ${T.line}`,
        borderRadius: 16,
        padding: isFeatured ? '40px 36px' : '28px 24px',
        boxShadow: T.shadow,
        transition: 'transform 140ms ease, box-shadow 140ms ease',
        textDecoration: 'none',
        color: 'inherit',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = 'translateY(-3px)';
        el.style.boxShadow = T.shadowLg;
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = 'none';
        el.style.boxShadow = T.shadow;
      }}
    >
      <span
        className="blog-category-badge"
        style={{
          background: color.bg,
          color: color.ink,
          marginBottom: 16,
          display: 'inline-block',
        }}
      >
        {CATEGORY_LABELS[post.category]}
      </span>

      <h3
        style={{
          fontFamily: 'var(--font-display), system-ui, sans-serif',
          fontSize: isFeatured ? 'clamp(22px, 2.8vw, 32px)' : 'clamp(18px, 2.2vw, 22px)',
          fontWeight: 600,
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
          color: T.ink,
          margin: '0 0 12px',
        }}
      >
        {post.title}
      </h3>

      <p
        style={{
          fontFamily: 'var(--font-body), system-ui, sans-serif',
          fontSize: 14,
          lineHeight: 1.6,
          color: T.ink2,
          margin: '0 0 20px',
          display: '-webkit-box',
          WebkitLineClamp: isFeatured ? 3 : 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {post.description}
      </p>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontFamily: 'var(--font-mono), monospace',
          fontSize: 11,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          color: T.ink3,
        }}
      >
        <span>
          {post.readingTime} min · {formatDate(post.date)}
        </span>
        <span style={{ color: T.ink, fontWeight: 700 }}>→</span>
      </div>
    </Link>
  );
}
