'use client';
import Link from 'next/link';
import type { BlogPostMeta, BlogCategory } from '@/lib/blog';

const CATEGORY_COLORS: Record<BlogCategory, { bg: string; ink: string; shadow: string }> = {
  'ai-employees': { bg: '#F5C518', ink: '#7A5A00', shadow: '#F5C518' },
  'founders':     { bg: '#F06464', ink: '#7A1717', shadow: '#F06464' },
  'agents':       { bg: '#8A8AF0', ink: '#2A2A7A', shadow: '#8A8AF0' },
  'use-cases':    { bg: '#1DBC87', ink: '#0E5C3F', shadow: '#1DBC87' },
  'comparisons':  { bg: '#F79FD4', ink: '#8E2A6A', shadow: '#F79FD4' },
};

const CATEGORY_LABELS: Record<BlogCategory, string> = {
  'ai-employees': 'AI Employees',
  'founders':     'Founders',
  'agents':       'Agents',
  'use-cases':    'Use Cases',
  'comparisons':  'Comparisons',
};

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
        border: '1px solid rgba(20,18,14,0.10)',
        borderRadius: 16,
        padding: isFeatured ? '40px 36px' : '28px 24px',
        boxShadow: '0 1px 3px rgba(20,18,14,0.05), 0 8px 24px -6px rgba(20,18,14,0.09)',
        transition: 'transform 140ms ease, box-shadow 140ms ease',
        textDecoration: 'none',
        color: 'inherit',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = 'translateY(-3px)';
        el.style.boxShadow = '0 2px 6px rgba(20,18,14,0.06), 0 24px 48px -12px rgba(20,18,14,0.14)';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = 'none';
        el.style.boxShadow = '0 1px 3px rgba(20,18,14,0.05), 0 8px 24px -6px rgba(20,18,14,0.09)';
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
          color: '#111',
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
          color: '#555',
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
          color: '#777',
        }}
      >
        <span>
          {post.readingTime} min · {formatDate(post.date)}
        </span>
        <span style={{ color: '#111', fontWeight: 700 }}>→</span>
      </div>
    </Link>
  );
}
