'use client';
import React, { useState } from 'react';
import { FONT, Button, VqInput, VqTextarea, FieldLabel } from './shared';
import { serverUrl } from '@/lib/site-config';

interface Props {
  onSuccess: () => void;
}

export function ContactForm({ onSuccess }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${serverUrl}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      });
      if (!res.ok) throw new Error('send failed');
      onSuccess();
    } catch {
      setError('Something went wrong. Try emailing us directly at info@veqiro.com');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <FieldLabel label="Your name">
        <VqInput value={name} onChange={setName} placeholder="Jane Smith" />
      </FieldLabel>
      <FieldLabel label="Your email">
        <VqInput value={email} onChange={setEmail} placeholder="jane@company.com" type="email" />
      </FieldLabel>
      <FieldLabel label="Message">
        <VqTextarea value={message} onChange={setMessage} placeholder="Tell us what you need..." rows={4} />
      </FieldLabel>
      {error && (
        <div style={{ fontFamily: FONT.mono, fontSize: 11, color: '#F06464', marginBottom: 16 }}>
          {error}
        </div>
      )}
      <Button type="submit" variant="dark" disabled={loading} style={{ width: '100%' }}>
        {loading ? 'Sending…' : 'Send message →'}
      </Button>
    </form>
  );
}
