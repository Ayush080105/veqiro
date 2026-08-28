'use client';
import React, { useState } from 'react';
import { FONT } from './shared';
import { ContactForm } from './contact-form';

export function ContactPageForm() {
  const [success, setSuccess] = useState(false);

  if (success) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0' }}>
        <div style={{ fontFamily: FONT.display, fontWeight: 600, letterSpacing: '-0.03em', fontSize: 'clamp(36px, 5vw, 48px)', lineHeight: 0.95, marginBottom: 16 }}>
          message sent.
        </div>
        <p style={{ fontFamily: FONT.body, fontSize: 16, color: '#555', margin: 0 }}>
          We&apos;ll get back to you at your email soon.
        </p>
      </div>
    );
  }

  return <ContactForm onSuccess={() => setSuccess(true)} />;
}
