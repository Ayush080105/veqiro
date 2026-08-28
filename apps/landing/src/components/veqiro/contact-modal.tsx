'use client';
import React, { useEffect, useState } from 'react';
import { FONT } from './shared';
import { ContactForm } from './contact-form';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ContactModal({ open, onClose }: Props) {
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!open) { setSuccess(false); return; }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.82)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#FBF7EF', border: '1px solid rgba(20,18,14,0.10)',
          borderRadius: 16, padding: 'clamp(28px, 5vw, 44px)',
          maxWidth: 520, width: '100%', position: 'relative',
          boxShadow: '0 1px 3px rgba(20,18,14,0.05), 0 8px 24px -6px rgba(20,18,14,0.09)',
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute', top: 16, right: 16,
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: FONT.head, fontSize: 20, color: '#111', lineHeight: 1,
            padding: '4px 8px',
          }}
        >
          ×
        </button>

        {success ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontFamily: FONT.display, fontWeight: 600, letterSpacing: '-0.03em', fontSize: 40, lineHeight: 1, marginBottom: 16 }}>
              message sent.
            </div>
            <p style={{ fontFamily: FONT.body, fontSize: 16, color: '#555', margin: 0 }}>
              We&apos;ll get back to you at your email soon.
            </p>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 28 }}>
              <div style={{
                fontFamily: FONT.mono, fontSize: 11, letterSpacing: 3,
                textTransform: 'uppercase', color: '#888', marginBottom: 10,
              }}>
                Get in touch
              </div>
              <div style={{ fontFamily: FONT.display, fontWeight: 600, letterSpacing: '-0.03em', fontSize: 'clamp(32px, 6vw, 48px)', lineHeight: 0.95 }}>
                let&apos;s talk.
              </div>
            </div>
            <ContactForm onSuccess={() => setSuccess(true)} />
          </>
        )}
      </div>
    </div>
  );
}
