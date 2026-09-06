'use client';
import { useId, useState } from 'react';
import { FONT, T } from '@/components/veqiro/shared';

export function UseCaseFaq({ items, accentColor }: { items: { q: string; a: string }[]; accentColor: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const baseId = useId();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map((item, i) => {
        const isOpen = open === i;
        const panelId = `${baseId}-panel-${i}`;
        const buttonId = `${baseId}-button-${i}`;
        return (
          <div
            key={i}
            style={{
              border: `1px solid ${T.line2}`,
              borderRadius: 12,
              overflow: 'hidden',
              boxShadow: isOpen ? T.shadow : T.shadowSm,
              transition: 'box-shadow 0.2s ease',
            }}
          >
            <button
              id={buttonId}
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpen(isOpen ? null : i)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '18px 22px',
                background: isOpen ? T.ink : T.bg,
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
                color: isOpen ? T.bg : T.ink,
                lineHeight: 1.4,
              }}>
                {item.q}
              </span>
              <span aria-hidden style={{
                fontFamily: FONT.display, fontWeight: 600, letterSpacing: '-0.03em',
                fontSize: 22,
                color: isOpen ? accentColor : T.ink,
                flexShrink: 0,
                transition: 'transform 0.2s ease',
                transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
                display: 'inline-block',
                lineHeight: 1,
              }}>
                +
              </span>
            </button>
            {isOpen && (
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                style={{
                  padding: '18px 22px',
                  background: T.surface,
                  borderTop: `1px solid ${T.line2}`,
                  fontFamily: FONT.body,
                  fontSize: 15,
                  lineHeight: 1.75,
                  color: T.ink2,
                }}
              >
                {item.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
