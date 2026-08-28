'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { FONT, T } from './shared';
import { BrandMark } from './brand-mark';
import { EMPLOYEES } from './data';
import { consoleUrl, isPreLaunch, waitlistUrl, nav as navLinks, useCaseNavItems } from '@/lib/site-config';

// Hash-only links (#crew, #faq, etc.) must always point to the home page,
// otherwise they resolve relative to the current path on inner pages.
function resolveNavHref(href: string): string {
  if (href.startsWith('#')) return `/${href}`;
  if (href.startsWith('/')) return href;
  return `/${href}`;
}

type Variant = 'hero' | 'page';

interface Props {
  /** 'hero' sits over the dark hero image and inverts its colours. */
  variant?: Variant;
}

const Chevron = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, marginLeft: 1 }} aria-hidden>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export function NavShared({ variant = 'page' }: Props) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const dark = variant === 'hero';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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

  const fg = dark ? T.inkInv : T.ink;
  const fgMuted = dark ? T.inkInv2 : T.ink2;

  return (
    <div
      className="vq-nav-wrap"
      data-scrolled={scrolled}
      data-tone={dark ? 'dark' : 'light'}
    >
      <style>{`
        .nav-link {
          color: ${fgMuted};
          text-decoration: none;
          font-family: var(--font-body), sans-serif;
          font-size: 14px;
          font-weight: 450;
          letter-spacing: -0.005em;
          padding: 8px 12px;
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          gap: 3px;
          transition: color 140ms ease, background 140ms ease;
          cursor: pointer;
          user-select: none;
          white-space: nowrap;
        }
        .nav-link:hover { color: ${fg}; background: ${dark ? 'rgba(242,236,224,0.07)' : 'rgba(20,18,14,0.05)'}; }

        .nav-menu-wrap { position: relative; }
        .nav-menu-wrap::after { content: ''; position: absolute; top: 100%; left: 0; right: 0; height: 12px; }
        .nav-menu {
          display: none;
          position: absolute;
          top: calc(100% + 12px);
          left: 50%;
          transform: translateX(-50%);
          background: #FBF7EF;
          border: 1px solid ${T.line};
          border-radius: 14px;
          padding: 6px;
          box-shadow: ${T.shadowLg};
          min-width: 288px;
          z-index: 200;
        }
        .nav-menu-wrap:hover .nav-menu,
        .nav-menu-wrap:focus-within .nav-menu { display: flex; flex-direction: column; }
        .nav-menu-right { left: auto; right: 0; transform: none; }
        .nav-menu-item {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 9px 10px;
          border-radius: 9px;
          text-decoration: none;
          color: ${T.ink} !important;
          transition: background 120ms;
        }
        .nav-menu-item:hover { background: ${T.surface2}; }
      `}</style>

      <nav
        data-testid="site-nav"
        className="vq-shell"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 20,
          height: 66,
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0 }}
          aria-label="Veqiro home"
        >
          <BrandMark tone={dark ? 'dark' : 'light'} size={27} />
        </Link>

        {/* Desktop nav */}
        <div className="vq-nav-desktop">
          {navLinks.map(({ href, label }) => (
            <Link key={href} href={resolveNavHref(href)} className="nav-link">
              {label}
            </Link>
          ))}

          <div className="nav-menu-wrap">
            <span className="nav-link" tabIndex={0} role="button">Agents <Chevron /></span>
            <div className="nav-menu">
              {EMPLOYEES.map(emp => (
                <Link key={emp.key} href={`/agents/${emp.key}`} className="nav-menu-item">
                  <span style={{
                    width: 30, height: 30, borderRadius: 8, overflow: 'hidden',
                    border: `1px solid ${T.line}`, flexShrink: 0, display: 'block',
                    background: T.surface2,
                  }}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- small static avatar, no layout shift risk */}
                    <img
                      src={`/${emp.name}.jpeg`}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </span>
                  <span style={{ display: 'grid', gap: 1 }}>
                    <span style={{ fontFamily: FONT.display, fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>
                      {emp.name}
                    </span>
                    <span style={{ fontFamily: FONT.body, fontSize: 12, color: T.ink3 }}>
                      {emp.role.replace(/\n/g, ' ')}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <div className="nav-menu-wrap">
            <span className="nav-link" tabIndex={0} role="button">Use cases <Chevron /></span>
            <div className="nav-menu">
              {useCaseNavItems.map(uc => (
                <Link key={uc.slug} href={`/use-cases/${uc.slug}`} className="nav-menu-item">
                  <span aria-hidden style={{
                    width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                    background: `${uc.color}22`, border: `1px solid ${uc.color}55`,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: uc.color }} />
                  </span>
                  <span style={{ display: 'grid', gap: 1 }}>
                    <span style={{ fontFamily: FONT.display, fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>
                      {uc.persona}
                    </span>
                    <span style={{ fontFamily: FONT.body, fontSize: 12, color: T.ink3 }}>{uc.tagline}</span>
                  </span>
                </Link>
              ))}
              <div style={{ height: 1, background: T.line, margin: '5px 8px' }} />
              <Link href="/use-cases" className="nav-menu-item">
                <span aria-hidden style={{
                  width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                  border: `1px dashed ${T.line2}`, display: 'inline-flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: 13, color: T.ink2,
                }}>→</span>
                <span style={{ fontFamily: FONT.display, fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>
                  All use cases
                </span>
              </Link>
            </div>
          </div>

          <div className="nav-menu-wrap">
            <span className="nav-link" tabIndex={0} role="button">Resources <Chevron /></span>
            <div className="nav-menu nav-menu-right">
              {[
                { href: '/compare',       label: 'Compare',  sub: 'Veqiro vs. the alternatives' },
                { href: '/blog',          label: 'Blog',     sub: 'Guides and playbooks' },
                { href: '/#faq',          label: 'FAQ',      sub: 'Common questions' },
                { href: '/about',         label: 'About',    sub: 'Who we are' },
                { href: '/about#contact', label: 'Contact',  sub: 'Talk to the team' },
              ].map(item => (
                <Link key={item.href} href={item.href} className="nav-menu-item">
                  <span style={{ display: 'grid', gap: 1 }}>
                    <span style={{ fontFamily: FONT.display, fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>
                      {item.label}
                    </span>
                    <span style={{ fontFamily: FONT.body, fontSize: 12, color: T.ink3 }}>{item.sub}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Right actions */}
        <div className="vq-nav-right">
          <a
            className="vq-nav-login nav-link"
            href={isPreLaunch ? waitlistUrl : `${consoleUrl}/login`}
          >
            Log in
          </a>
          <a
            className="vq-nav-cta"
            href={isPreLaunch ? waitlistUrl : `${consoleUrl}/signup`}
            style={{
              background: dark ? T.inkInv : T.ink,
              color: dark ? T.ink : T.inkInv,
              padding: '9px 17px',
              borderRadius: 9,
              fontFamily: FONT.body,
              fontSize: 14,
              fontWeight: 500,
              letterSpacing: '-0.005em',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              transition: 'opacity 140ms ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.86')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            {isPreLaunch ? 'Join waitlist' : 'Start free'}
          </a>
          <button
            type="button"
            className="vq-hamburger"
            aria-label="Open menu"
            aria-expanded={open}
            data-testid="nav-hamburger"
            onClick={() => setOpen(true)}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          </button>
        </div>
      </nav>

      {open && (
        <>
          <div className="vq-drawer-backdrop" onClick={() => setOpen(false)} aria-hidden />
          <aside
            className="vq-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Main navigation"
            data-testid="nav-drawer"
          >
            <div className="vq-drawer-header">
              <BrandMark size={25} />
              <button
                type="button"
                className="vq-drawer-close"
                aria-label="Close menu"
                data-testid="nav-drawer-close"
                onClick={() => setOpen(false)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="6" y1="18" x2="18" y2="6" />
                </svg>
              </button>
            </div>

            <nav className="vq-drawer-nav" aria-label="Primary">
              {navLinks.map(({ href, label }) => (
                <Link key={href} href={resolveNavHref(href)} className="vq-drawer-link" onClick={() => setOpen(false)}>
                  {label}
                </Link>
              ))}

              <div className="vq-drawer-section">Agents</div>
              {EMPLOYEES.map(emp => (
                <Link key={emp.key} href={`/agents/${emp.key}`} className="vq-drawer-crew" onClick={() => setOpen(false)}>
                  <span style={{
                    width: 34, height: 34, borderRadius: 9, overflow: 'hidden',
                    border: `1px solid ${T.line}`, flexShrink: 0, display: 'block',
                  }}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- small static avatar */}
                    <img src={`/${emp.name}.jpeg`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </span>
                  <span style={{ display: 'grid', gap: 1 }}>
                    <span style={{ fontFamily: FONT.display, fontSize: 14.5, fontWeight: 600 }}>{emp.name}</span>
                    <span style={{ fontFamily: FONT.body, fontSize: 12, color: T.ink3 }}>{emp.role.replace(/\n/g, ' ')}</span>
                  </span>
                </Link>
              ))}

              <div className="vq-drawer-section">Use cases</div>
              {useCaseNavItems.map(uc => (
                <Link key={uc.slug} href={`/use-cases/${uc.slug}`} className="vq-drawer-crew" onClick={() => setOpen(false)}>
                  <span aria-hidden style={{
                    width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                    background: `${uc.color}22`, border: `1px solid ${uc.color}55`,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: uc.color }} />
                  </span>
                  <span style={{ fontFamily: FONT.display, fontSize: 14.5, fontWeight: 600 }}>{uc.persona}</span>
                </Link>
              ))}
              <Link href="/use-cases" className="vq-drawer-link" onClick={() => setOpen(false)}>
                All use cases
              </Link>

              <div className="vq-drawer-section">Resources</div>
              {[
                { href: '/compare',       label: 'Compare' },
                { href: '/blog',          label: 'Blog' },
                { href: '/#faq',          label: 'FAQ' },
                { href: '/about',         label: 'About' },
                { href: '/about#contact', label: 'Contact' },
              ].map(item => (
                <Link key={item.href} href={item.href} className="vq-drawer-link" onClick={() => setOpen(false)}>
                  {item.label}
                </Link>
              ))}

              <div className="vq-drawer-divider" />

              <a
                href={isPreLaunch ? waitlistUrl : `${consoleUrl}/login`}
                className="vq-drawer-link"
                onClick={() => setOpen(false)}
              >
                Log in
              </a>
            </nav>

            <div className="vq-drawer-footer">
              <a
                href={isPreLaunch ? waitlistUrl : `${consoleUrl}/signup`}
                onClick={() => setOpen(false)}
                style={{
                  background: T.ink, color: T.inkInv,
                  padding: '13px 20px', borderRadius: 10,
                  fontFamily: FONT.body, fontSize: 15, fontWeight: 500,
                  textDecoration: 'none', textAlign: 'center',
                }}
              >
                {isPreLaunch ? 'Join the waitlist' : 'Start free'}
              </a>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
