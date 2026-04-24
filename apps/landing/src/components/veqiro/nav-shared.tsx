'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { FONT } from './shared';
import { EMPLOYEES } from './data';
import { mainAppUrl, nav as navLinks, useCaseNavItems } from '@/lib/site-config';

type Variant = 'hero' | 'page';

interface Props {
  variant?: Variant;
}

export function NavShared({ variant = 'page' }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const margin = variant === 'hero' ? '0 auto 64px' : '0 auto';
  const padding = variant === 'hero' ? '0' : 'clamp(20px, 4vw, 32px)';

  return (
    <nav
      data-testid="site-nav"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        maxWidth: 1400,
        margin,
        padding,
        gap: 16,
      }}
    >
      <style>{`
        .nav-pill-link { color: #111; text-decoration: none; font-family: var(--font-archivo), sans-serif; font-size: 12px; letter-spacing: 0.8px; text-transform: uppercase; padding: 10px 18px; display: block; border-radius: 999px; transition: background 150ms, color 150ms; }
        .nav-pill-link:hover { background: #111 !important; color: #EFE7D6 !important; }
        .nav-crew-wrap { position: relative; color: #111; font-family: var(--font-archivo), sans-serif; font-size: 12px; letter-spacing: 0.8px; text-transform: uppercase; padding: 10px 18px; border-radius: 999px; transition: background 150ms, color 150ms; cursor: pointer; user-select: none; }
        .nav-crew-wrap:hover { background: #111 !important; color: #EFE7D6 !important; }
        .nav-crew-wrap::after { content: ''; position: absolute; top: 100%; left: 0; right: 0; height: 14px; }
        .nav-crew-menu { display: none; position: absolute; top: calc(100% + 14px); left: 50%; transform: translateX(-50%); background: #fff; border: 2.5px solid #111; border-radius: 14px; padding: 6px; box-shadow: 4px 4px 0 #111; min-width: 248px; z-index: 200; }
        .nav-crew-wrap:hover .nav-crew-menu { display: flex; flex-direction: column; }
        .nav-crew-item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 8px; text-decoration: none; color: #111 !important; transition: background 120ms; }
        .nav-crew-item:hover { background: #F5F0E8; }
      `}</style>

      {/* Logo */}
      <Link
        href="/"
        style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit', flexShrink: 0 }}
      >
        <div
          className="vq-nav-brand-mark"
          style={{
            width: 50, height: 50, background: '#111', borderRadius: 12,
            display: 'grid', placeItems: 'center', transform: 'rotate(-6deg)',
            boxShadow: '4px 4px 0 #F5C518', flexShrink: 0,
          }}
        >
          <span style={{ color: '#EFE7D6', fontFamily: FONT.display, fontSize: 28 }}>v</span>
        </div>
        <div
          className="vq-nav-brand-text"
          style={{ fontFamily: FONT.display, fontSize: 36, lineHeight: 1, color: '#111' }}
        >
          veqiro
        </div>
      </Link>

      {/* Desktop pill nav */}
      <div className="vq-nav-desktop">
        {navLinks.map(({ href, label }) => (
          <Link
            key={href}
            href={href.startsWith('#') || href.startsWith('/') ? href : `/${href}`}
            className="nav-pill-link"
          >
            {label}
          </Link>
        ))}
        <div className="nav-crew-wrap">
          The Employees ▾
          <div className="nav-crew-menu">
            {EMPLOYEES.map(emp => (
              <Link key={emp.key} href={`/agents/${emp.key}`} className="nav-crew-item">
                <img
                  src={`/${emp.name}.jpeg`}
                  alt={emp.name}
                  style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid #111', objectFit: 'cover', flexShrink: 0, display: 'inline-block' }}
                />
                <span style={{ fontFamily: FONT.head, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase' }}>{emp.name}</span>
                <span style={{ marginLeft: 'auto', fontFamily: FONT.mono, fontSize: 10, color: '#888' }}>{emp.role}</span>
              </Link>
            ))}
          </div>
        </div>
        <div className="nav-crew-wrap">
          Use Cases ▾
          <div className="nav-crew-menu">
            {useCaseNavItems.map(uc => (
              <Link key={uc.slug} href={`/use-cases/${uc.slug}`} className="nav-crew-item">
                <span
                  aria-hidden
                  style={{
                    width: 28, height: 28, borderRadius: '50%',
                    border: '2px solid #111', background: uc.color,
                    flexShrink: 0, display: 'inline-block',
                  }}
                />
                <span style={{ fontFamily: FONT.head, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase' }}>{uc.persona}</span>
                <span style={{ marginLeft: 'auto', fontFamily: FONT.mono, fontSize: 10, color: '#888' }}>{uc.tagline}</span>
              </Link>
            ))}
            <div
              style={{
                height: 1,
                background: '#eee',
                margin: '4px 6px',
              }}
            />
            <Link href="/use-cases" className="nav-crew-item">
              <span
                aria-hidden
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  border: '2px dashed #111', display: 'inline-flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontFamily: FONT.display, fontSize: 16, color: '#111', flexShrink: 0,
                }}
              >
                →
              </span>
              <span style={{ fontFamily: FONT.head, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase' }}>All use cases</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Right actions + hamburger */}
      <div className="vq-nav-right">
        <a
          className="vq-nav-login"
          href={`${mainAppUrl}/login`}
          style={{
            color: '#555', textDecoration: 'none',
            fontFamily: FONT.head, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase',
          }}
        >
          Log in
        </a>
        <a
          className="vq-nav-cta"
          href={`${mainAppUrl}/signup`}
          style={{
            background: '#111', color: '#EFE7D6', padding: '14px 26px', borderRadius: 12,
            fontFamily: FONT.head, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase',
            textDecoration: 'none', border: '2.5px solid #111', boxShadow: '4px 4px 0 #6FCDE8',
            whiteSpace: 'nowrap',
          }}
        >
          Start free →
        </a>
        <button
          type="button"
          className="vq-hamburger"
          aria-label="Open menu"
          aria-expanded={open}
          data-testid="nav-hamburger"
          onClick={() => setOpen(true)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="4" y1="7" x2="20" y2="7" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="17" x2="20" y2="17" />
          </svg>
        </button>
      </div>

      {open && (
        <>
          <div
            className="vq-drawer-backdrop"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside
            className="vq-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Main navigation"
            data-testid="nav-drawer"
          >
            <div className="vq-drawer-header">
              <div style={{ fontFamily: FONT.display, fontSize: 28, color: '#111' }}>veqiro</div>
              <button
                type="button"
                className="vq-drawer-close"
                aria-label="Close menu"
                data-testid="nav-drawer-close"
                onClick={() => setOpen(false)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="6" y1="18" x2="18" y2="6" />
                </svg>
              </button>
            </div>

            <nav className="vq-drawer-nav" aria-label="Primary">
              {navLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href.startsWith('#') || href.startsWith('/') ? href : `/${href}`}
                  className="vq-drawer-link"
                  onClick={() => setOpen(false)}
                >
                  {label}
                </Link>
              ))}

              <div className="vq-drawer-section">The Employees</div>
              {EMPLOYEES.map(emp => (
                <Link
                  key={emp.key}
                  href={`/agents/${emp.key}`}
                  className="vq-drawer-crew"
                  onClick={() => setOpen(false)}
                >
                  <img
                    src={`/${emp.name}.jpeg`}
                    alt={emp.name}
                    style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid #111', objectFit: 'cover', flexShrink: 0 }}
                  />
                  <span style={{ fontFamily: FONT.head, fontSize: 14, letterSpacing: 0.5, textTransform: 'uppercase' }}>{emp.name}</span>
                  <span style={{ marginLeft: 'auto', fontFamily: FONT.mono, fontSize: 10, color: '#888' }}>{emp.role}</span>
                </Link>
              ))}

              <div className="vq-drawer-section">Use Cases</div>
              {useCaseNavItems.map(uc => (
                <Link
                  key={uc.slug}
                  href={`/use-cases/${uc.slug}`}
                  className="vq-drawer-crew"
                  onClick={() => setOpen(false)}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 36, height: 36, borderRadius: '50%',
                      border: '2px solid #111', background: uc.color,
                      flexShrink: 0, display: 'inline-block',
                    }}
                  />
                  <span style={{ fontFamily: FONT.head, fontSize: 14, letterSpacing: 0.5, textTransform: 'uppercase' }}>{uc.persona}</span>
                  <span style={{ marginLeft: 'auto', fontFamily: FONT.mono, fontSize: 10, color: '#888' }}>{uc.tagline}</span>
                </Link>
              ))}
              <Link
                href="/use-cases"
                className="vq-drawer-crew"
                onClick={() => setOpen(false)}
              >
                <span
                  aria-hidden
                  style={{
                    width: 36, height: 36, borderRadius: '50%',
                    border: '2px dashed #111', display: 'inline-flex',
                    alignItems: 'center', justifyContent: 'center',
                    fontFamily: FONT.display, fontSize: 20, color: '#111',
                    flexShrink: 0,
                  }}
                >
                  →
                </span>
                <span style={{ fontFamily: FONT.head, fontSize: 14, letterSpacing: 0.5, textTransform: 'uppercase' }}>All use cases</span>
              </Link>

              <div className="vq-drawer-divider" />

              <a
                href={`${mainAppUrl}/login`}
                className="vq-drawer-link"
                onClick={() => setOpen(false)}
              >
                Log in
              </a>
            </nav>

            <div className="vq-drawer-footer">
              <a
                href={`${mainAppUrl}/signup`}
                onClick={() => setOpen(false)}
                style={{
                  background: '#111', color: '#EFE7D6',
                  padding: '16px 20px', borderRadius: 12,
                  fontFamily: FONT.head, fontSize: 14, letterSpacing: 1, textTransform: 'uppercase',
                  textDecoration: 'none', border: '2.5px solid #111', boxShadow: '4px 4px 0 #6FCDE8',
                  textAlign: 'center',
                }}
              >
                Start free →
              </a>
            </div>
          </aside>
        </>
      )}
    </nav>
  );
}
