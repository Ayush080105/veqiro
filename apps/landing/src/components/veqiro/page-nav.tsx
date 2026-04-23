import React from 'react';
import Link from 'next/link';
import { FONT, Button } from './shared';
import { mainAppUrl } from '@/lib/site-config';

const NAV_LINKS = [
  { href: '/#crew', label: 'The Crew' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/#how', label: 'How it Works' },
  { href: '/#faq', label: 'FAQ' },
];

export function PageNav() {
  return (
    <nav style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      maxWidth: 1400,
      margin: '0 auto',
      padding: '32px 32px',
    }}>
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
        <div style={{
          width: 42,
          height: 42,
          background: '#111',
          borderRadius: 10,
          display: 'grid',
          placeItems: 'center',
          transform: 'rotate(-6deg)',
          boxShadow: '3px 3px 0 #F5C518',
        }}>
          <span style={{ color: '#EFE7D6', fontFamily: FONT.display, fontSize: 24 }}>v</span>
        </div>
        <span style={{ fontFamily: FONT.display, fontSize: 22, color: '#111' }}>veqiro</span>
      </Link>

      <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
        {NAV_LINKS.map(l => (
          <Link
            key={l.href}
            href={l.href}
            style={{
              fontFamily: FONT.head,
              fontSize: 13,
              textTransform: 'uppercase' as const,
              letterSpacing: 1,
              color: '#111',
              textDecoration: 'none',
            }}
          >
            {l.label}
          </Link>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Button variant="ghost" href={`${mainAppUrl}/login`}>Sign in</Button>
        <Button variant="primary" href={`${mainAppUrl}/signup`}>Get the crew</Button>
      </div>
    </nav>
  );
}
