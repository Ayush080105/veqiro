'use client';
import { useState } from 'react';
import { FONT } from '@/components/veqiro/shared';

export function UseCaseFaq({ items, accentColor }: { items: { q: string; a: string }[]; accentColor: string }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map((item, i) => (
        <div
          key={i}
          style={{
            border: '1px solid rgba(20,18,14,0.10)',
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: open === i
              ? '0 1px 3px rgba(20,18,14,0.05), 0 8px 24px -6px rgba(20,18,14,0.09)'
              : '0 1px 2px rgba(20,18,14,0.05)',
            transition: 'box-shadow 0.2s ease',
          }}
        >
          <button
            onClick={() => setOpen(open === i ? null : i)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '18px 22px',
              background: open === i ? '#111' : '#EFE7D6',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              gap: 16,
              transition: 'background 0.2s ease',
            }}
          >
            <span style={{
              fontFamily: FONT.head,
              fontSize: 'clamp(14px, 1.6vw, 16px)',
              color: open === i ? '#EFE7D6' : '#111',
              lineHeight: 1.4,
            }}>
              {item.q}
            </span>
            <span style={{
              fontFamily: FONT.display, fontWeight: 600, letterSpacing: '-0.03em',
              fontSize: 22,
              color: open === i ? accentColor : '#111',
              flexShrink: 0,
              transition: 'transform 0.2s ease',
              transform: open === i ? 'rotate(45deg)' : 'rotate(0deg)',
              display: 'inline-block',
              lineHeight: 1,
            }}>
              +
            </span>
          </button>
          {open === i && (
            <div style={{
              padding: '18px 22px',
              background: '#FBF7EF',
              borderTop: '1px solid rgba(20,18,14,0.10)',
              fontFamily: FONT.body,
              fontSize: 15,
              lineHeight: 1.75,
              color: '#333',
            }}>
              {item.a}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
