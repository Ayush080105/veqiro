'use client';
import { useEffect, useState } from 'react';
import type { TocItem } from '@/lib/blog';

interface BlogTocProps {
  items: TocItem[];
}

export function BlogToc({ items }: BlogTocProps) {
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    if (items.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((e) => e.isIntersecting);
        if (visible) setActiveId(visible.target.id);
      },
      { rootMargin: '-10% 0% -80% 0%', threshold: 0 },
    );
    items.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  return (
    <nav
      className="blog-toc-sidebar"
      aria-label="Table of contents"
      style={{
        background: 'var(--vq-cream)',
        border: '1px solid rgba(20,18,14,0.10)',
        borderRadius: 12,
        padding: 20,
        boxShadow: '0 1px 3px rgba(20,18,14,0.05), 0 8px 24px -6px rgba(20,18,14,0.09)',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-mono), monospace',
          fontSize: 10,
          letterSpacing: 3,
          textTransform: 'uppercase',
          color: '#888',
          margin: '0 0 12px',
        }}
      >
        In this post
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 4 }}>
        {items.map((item) => (
          <li key={item.id} style={{ paddingLeft: item.level === 3 ? 12 : 0 }}>
            <a
              href={`#${item.id}`}
              style={{
                display: 'block',
                fontFamily: 'var(--font-body), system-ui, sans-serif',
                fontSize: 13,
                lineHeight: 1.4,
                color: activeId === item.id ? '#111' : '#666',
                fontWeight: activeId === item.id ? 600 : 400,
                borderLeft: `1px solid ${activeId === item.id ? 'var(--vq-red)' : 'transparent'}`,
                paddingLeft: 8,
                paddingTop: 4,
                paddingBottom: 4,
                textDecoration: 'none',
                transition: 'color 120ms, border-color 120ms',
              }}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
