'use client';
import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { FONT } from './shared';
import { NavShared } from './nav-shared';
import { consoleUrl } from '@/lib/site-config';

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  return isDesktop;
}

function CursorEye({ size = 70, offset = [0, 0] }: { size?: number; offset?: number[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pupil, setPupil] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!ref.current) return;
      const r = ref.current.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.min(Math.hypot(dx, dy), 200);
      const angle = Math.atan2(dy, dx);
      const r2 = (size * 0.18) * (dist / 200);
      setPupil({ x: Math.cos(angle) * r2, y: Math.sin(angle) * r2 });
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [size]);

  return (
    <div ref={ref} style={{
      width: size, height: size, borderRadius: '50%',
      background: '#FFF1E0', border: '3px solid #111',
      position: 'relative', display: 'inline-block',
      transform: `translate(${offset[0]}px, ${offset[1]}px)`,
      boxShadow: '4px 4px 0 #111',
    }}>
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        width: size * 0.35, height: size * 0.35, borderRadius: '50%', background: '#111',
        transform: `translate(calc(-50% + ${pupil.x}px), calc(-50% + ${pupil.y}px))`,
        transition: 'transform 40ms linear',
      }}>
        <div style={{
          position: 'absolute', top: '15%', right: '15%',
          width: '30%', height: '30%', borderRadius: '50%', background: '#fff',
        }} />
      </div>
    </div>
  );
}

// Star data (shared between absolute desktop render and dimension tweaks)
const STARS = [
  { t: 90,  l: '3%',  r: '',   color: '#F5C518', sz: 52, rot: -15, dur: 4,   d: 0,   dense: false },
  { t: 200, l: '6%',  r: '',   color: '#F06464', sz: 22, rot:  20, dur: 5.5, d: 0.4, dense: true  },
  { t: 310, l: '2%',  r: '',   color: '#8A8AF0', sz: 38, rot:  -8, dur: 3.8, d: 0.8, dense: true  },
  { t: 420, l: '8%',  r: '',   color: '#F79FD4', sz: 26, rot:  15, dur: 4.2, d: 1.1, dense: true  },
  { t: 530, l: '4%',  r: '',   color: '#1DBC87', sz: 46, rot: -20, dur: 5,   d: 0.2, dense: false },
  { t: 100, l: '',    r: '4%', color: '#F79FD4', sz: 42, rot:  12, dur: 4.5, d: 0.6, dense: false },
  { t: 240, l: '',    r: '2%', color: '#1DBC87', sz: 20, rot: -20, dur: 6,   d: 0.9, dense: true  },
  { t: 350, l: '',    r: '7%', color: '#F5C518', sz: 48, rot:  30, dur: 5,   d: 0.3, dense: false },
  { t: 465, l: '',    r: '3%', color: '#F06464', sz: 30, rot: -25, dur: 3.5, d: 1.5, dense: true  },
  { t: 570, l: '',    r: '8%', color: '#8A8AF0', sz: 36, rot: -10, dur: 4.8, d: 0.7, dense: false },
];

export function Hero() {
  const [count, setCount] = useState(0);
  const stickyRef = useRef<HTMLDivElement>(null);
  const isDesktop = useIsDesktop();

  // Cursor-following spotlight: the scrim over the hero image is masked out
  // in a soft circle wherever the cursor is, revealing the full image there.
  // Off-screen default (`-9999, -9999`) means no visible hole when not hovered.
  const [spot, setSpot] = useState({ x: -9999, y: -9999 });

  useEffect(() => {
    let n = 0;
    const id = setInterval(() => {
      n += Math.floor(Math.random() * 37) + 12;
      setCount(n);
    }, 90);
    setTimeout(() => clearInterval(id), 1800);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isDesktop) return;
    const el = stickyRef.current;
    if (!el) return;
    let raf: number | null = null;
    let latest = { x: -9999, y: -9999 };
    const apply = () => {
      raf = null;
      setSpot(latest);
    };
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      latest = { x: e.clientX - r.left, y: e.clientY - r.top };
      if (raf === null) raf = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      if (raf !== null) {
        cancelAnimationFrame(raf);
        raf = null;
      }
      setSpot({ x: -9999, y: -9999 });
    };
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, [isDesktop]);

  const topOpacity = 0.92;
  const midOpacity = 0.82;
  const bottomOpacity = 0.55;

  const foreground = (
    <>
      <style>{`
        @keyframes hfloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
      `}</style>

      {STARS.map(({ t, l, r, color, sz, rot, dur, d, dense }, i) => (
        <div
          key={i}
          aria-hidden
          className={dense ? 'hero-star-dense' : undefined}
          style={{
            position: 'absolute',
            top: t,
            ...(l ? { left: l } : { right: r }),
            transform: `rotate(${rot}deg)`,
            pointerEvents: 'none',
          }}
        >
          <span style={{ display: 'block', color, fontSize: sz, lineHeight: 1, animation: `hfloat ${dur}s ${d}s ease-in-out infinite` }}>✦</span>
        </div>
      ))}

      {/* Faint giant star for depth */}
      <div aria-hidden style={{
        position: 'absolute', top: '32%', left: '50%',
        transform: 'translate(-50%, -50%)',
        fontSize: '42vw', color: '#F5C518', opacity: 0.045,
        lineHeight: 1, pointerEvents: 'none', userSelect: 'none',
      }}>✦</div>

      {/* Shared top nav */}
      <NavShared variant="hero" />

      {/* Content */}
      <div style={{ maxWidth: 1400, margin: '0 auto', position: 'relative' }}>
        <div style={{ textAlign: 'center', position: 'relative', marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 20 }}>
            <CursorEye size={54} />
            <CursorEye size={54} />
          </div>
          <h1 style={{
            fontFamily: FONT.display,
            fontSize: 'clamp(52px, 12vw, 180px)',
            lineHeight: 0.88, letterSpacing: -2, margin: 0, color: '#111',
            textShadow: '0 2px 0 rgba(239,231,214,0.9), 0 4px 12px rgba(239,231,214,0.5)',
          }}>
            hire your<br />
            <span style={{ color: '#F06464', WebkitTextStroke: '2px #111' }}>weirdos</span>
            {' '}
          </h1>
          <p style={{
            maxWidth: 720, margin: '28px auto 0',
            fontFamily: FONT.body,
            fontSize: 'clamp(16px, 2.2vw, 20px)',
            lineHeight: 1.5, color: '#2a2a2a',
            padding: '0 clamp(8px, 2vw, 16px)',
          }}>
            Veqiro is a crew of AI employees with real jobs, real personalities,
            and zero chill. They do the work. You take the credit.
            <span style={{ background: '#F5C518', padding: '0 6px' }}> We&apos;re cool with that.</span>
          </p>

          <div style={{ display: 'flex', gap: 'clamp(10px, 2vw, 16px)', justifyContent: 'center', marginTop: 36, flexWrap: 'wrap', padding: '0 clamp(8px, 2vw, 16px)' }}>
            <a href={`${consoleUrl}/signup`} style={{
              background: '#F5C518', color: '#111', padding: 'clamp(14px, 2.5vw, 18px) clamp(20px, 4vw, 32px)',
              fontFamily: FONT.head, fontSize: 'clamp(13px, 1.8vw, 15px)', textTransform: 'uppercase', letterSpacing: 1,
              textDecoration: 'none', border: '3px solid #111', borderRadius: 12, boxShadow: '6px 6px 0 #111',
              display: 'inline-block',
            }}>Start hiring — free 7 days</a>
            <a href="#crew" style={{
              background: 'transparent', color: '#111', padding: 'clamp(14px, 2.5vw, 18px) clamp(20px, 4vw, 32px)',
              fontFamily: FONT.head, fontSize: 'clamp(13px, 1.8vw, 15px)', textTransform: 'uppercase', letterSpacing: 1,
              textDecoration: 'none', border: '3px solid #111', borderRadius: 12, display: 'inline-block',
            }}>Meet the crew ↓</a>
          </div>
          <div style={{
            marginTop: 24, fontFamily: FONT.mono, fontSize: 13, color: '#111',
            textShadow: '0 1px 0 rgba(239,231,214,0.95), 0 0 6px rgba(239,231,214,0.85)',
          }}>
            <span style={{ color: '#1DBC87', marginRight: 8 }}>●</span>
            {count.toLocaleString()} tasks completed this morning
          </div>
        </div>
      </div>

    </>
  );

  return (
    <section
      style={{
        position: 'relative',
        background: '#EFE7D6',
      }}
    >
      <div
        ref={stickyRef}
        style={{
          position: 'relative',
          height: isDesktop ? '100vh' : 'auto',
          overflow: 'hidden',
        }}
      >
        {/* Background image layer — desktop only. */}
        {isDesktop && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 0,
              pointerEvents: 'none',
            }}
          >
            <Image
              src="/Hero_Image.jpg"
              alt=""
              fill
              sizes="100vw"
              style={{ objectFit: 'cover', objectPosition: 'center 40%' }}
              priority
            />
          </div>
        )}

        {/* Scrim layer — sibling of image so its coordinate system isn't affected
            by the image's scale transform. A radial-gradient mask cuts a soft
            hole in the scrim wherever the cursor is, revealing the full image. */}
        {isDesktop && (() => {
          const maskImage = `radial-gradient(circle at ${spot.x}px ${spot.y}px, transparent 0px, transparent 150px, black 280px)`;
          return (
            <div
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 1,
                background: `linear-gradient(180deg, rgba(239,231,214,${topOpacity}) 0%, rgba(239,231,214,${topOpacity}) 35%, rgba(239,231,214,${midOpacity}) 65%, rgba(239,231,214,${bottomOpacity}) 100%)`,
                pointerEvents: 'none',
                maskImage,
                WebkitMaskImage: maskImage,
              }}
            />
          );
        })()}

        {/* Foreground layer — hero nav, decorations, content, mobile card strip */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            padding: 'clamp(28px, 5vw, 48px) clamp(16px, 4vw, 32px) 0',
          }}
        >
          {foreground}
        </div>
      </div>

      {/* Mobile/tablet fallback: render the image below the hero, as before */}
      {!isDesktop && (
        <div style={{ position: 'relative', width: '100%', aspectRatio: '1610 / 1232', overflow: 'hidden', marginTop: 32 }}>
          <Image
            src="/Hero_Image.jpg"
            alt="The Veqiro crew"
            fill
            sizes="100vw"
            style={{ objectFit: 'cover', objectPosition: 'center 40%' }}
            priority
          />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, #EFE7D6 0%, rgba(239,231,214,0.7) 25%, rgba(239,231,214,0.15) 55%, transparent 100%)', pointerEvents: 'none', zIndex: 1 }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, #EFE7D6 0%, transparent 20%)', pointerEvents: 'none', zIndex: 1 }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to left, #EFE7D6 0%, transparent 20%)', pointerEvents: 'none', zIndex: 1 }} />
        </div>
      )}
    </section>
  );
}

export function Marquee({ items, color = '#111', bg = '#EFE7D6', speed = 40 }: {
  items: string[]; color?: string; bg?: string; speed?: number;
}) {
  const content = [...items, ...items, ...items];
  return (
    <div style={{ overflow: 'hidden', background: bg, borderTop: '3px solid #111', borderBottom: '3px solid #111', padding: '14px 0' }}>
      <div
        className="vq-marquee-row"
        style={{
          animation: `marquee ${speed}s linear infinite`,
          fontFamily: FONT.head,
          color,
        }}
      >
        {content.map((t, i) => (
          <span key={i}>
            {t}
            <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', background: color }} />
          </span>
        ))}
      </div>
    </div>
  );
}
