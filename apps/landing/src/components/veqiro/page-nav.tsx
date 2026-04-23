'use client';
import React from 'react';
import { FONT } from './shared';
import { EMPLOYEES } from './data';
import { mainAppUrl, nav as navLinks } from '@/lib/site-config';

export function PageNav() {
  return (
    <nav style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      maxWidth: 1400, margin: '0 auto', padding: '32px 32px',
    }}>
      <style>{`
        .pn-pill-link { color: #111; text-decoration: none; font-family: var(--font-archivo), sans-serif; font-size: 12px; letter-spacing: 0.8px; text-transform: uppercase; padding: 10px 18px; display: block; border-radius: 999px; transition: background 150ms, color 150ms; }
        .pn-pill-link:hover { background: #111 !important; color: #EFE7D6 !important; }
        .pn-crew-wrap { position: relative; color: #111; font-family: var(--font-archivo), sans-serif; font-size: 12px; letter-spacing: 0.8px; text-transform: uppercase; padding: 10px 18px; border-radius: 999px; transition: background 150ms, color 150ms; cursor: pointer; user-select: none; }
        .pn-crew-wrap:hover { background: #111 !important; color: #EFE7D6 !important; }
        .pn-crew-wrap::after { content: ''; position: absolute; top: 100%; left: 0; right: 0; height: 14px; }
        .pn-crew-menu { display: none; position: absolute; top: calc(100% + 14px); left: 50%; transform: translateX(-50%); background: #fff; border: 2.5px solid #111; border-radius: 14px; padding: 6px; box-shadow: 4px 4px 0 #111; min-width: 248px; z-index: 200; }
        .pn-crew-wrap:hover .pn-crew-menu { display: flex; flex-direction: column; }
        .pn-crew-item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 8px; text-decoration: none; color: #111 !important; transition: background 120ms; }
        .pn-crew-item:hover { background: #F5F0E8; }
      `}</style>

      {/* Logo */}
      <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit' }}>
        <div style={{
          width: 50, height: 50, background: '#111', borderRadius: 12,
          display: 'grid', placeItems: 'center', transform: 'rotate(-6deg)',
          boxShadow: '4px 4px 0 #F5C518', flexShrink: 0,
        }}>
          <span style={{ color: '#EFE7D6', fontFamily: FONT.display, fontSize: 28 }}>v</span>
        </div>
        <div style={{ fontFamily: FONT.display, fontSize: 36, lineHeight: 1, color: '#111' }}>veqiro</div>
      </a>

      {/* Pill nav */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 2,
        background: '#fff', border: '2.5px solid #111', borderRadius: 999,
        padding: '5px 6px', boxShadow: '4px 4px 0 #111',
      }}>
        {navLinks.map(({ href, label }) => (
          <a key={href} href={`/${href}`} className="pn-pill-link">{label}</a>
        ))}
        <div className="pn-crew-wrap">
          The Employees ▾
          <div className="pn-crew-menu">
            {EMPLOYEES.map(emp => (
              <a key={emp.key} href={`/agents/${emp.key}`} className="pn-crew-item">
                <img src={`/${emp.name}.jpeg`} alt={emp.name} style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid #111', objectFit: 'cover', flexShrink: 0, display: 'inline-block' }} />
                <span style={{ fontFamily: FONT.head, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase' }}>{emp.name}</span>
                <span style={{ marginLeft: 'auto', fontFamily: FONT.mono, fontSize: 10, color: '#888' }}>{emp.role}</span>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Right actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <a href={`${mainAppUrl}/login`} style={{
          color: '#555', textDecoration: 'none',
          fontFamily: FONT.head, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase',
        }}>Log in</a>
        <a href={`${mainAppUrl}/signup`} style={{
          background: '#111', color: '#EFE7D6', padding: '14px 26px', borderRadius: 12,
          fontFamily: FONT.head, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase',
          textDecoration: 'none', border: '2.5px solid #111', boxShadow: '4px 4px 0 #6FCDE8',
        }}>Start free →</a>
      </div>
    </nav>
  );
}
