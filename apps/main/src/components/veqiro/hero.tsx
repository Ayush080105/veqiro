'use client';
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { FONT, Sticker } from './shared';

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

export function Hero() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let n = 0;
    const id = setInterval(() => {
      n += Math.floor(Math.random() * 37) + 12;
      setCount(n);
    }, 90);
    setTimeout(() => clearInterval(id), 1800);
    return () => clearInterval(id);
  }, []);

  return (
    <section style={{ position: 'relative', padding: '48px 32px 24px', background: '#EFE7D6' }}>
      <nav style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        maxWidth: 1400, margin: '0 auto 60px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 42, height: 42, background: '#111', borderRadius: 10,
            display: 'grid', placeItems: 'center', transform: 'rotate(-6deg)',
            boxShadow: '3px 3px 0 #F5C518',
          }}>
            <span style={{ color: '#EFE7D6', fontFamily: FONT.display, fontSize: 24 }}>v</span>
          </div>
          <span style={{ fontFamily: FONT.head, fontSize: 22, letterSpacing: -0.5 }}>veqiro</span>
        </div>
        <div style={{ display: 'flex', gap: 32, fontFamily: FONT.body, fontWeight: 600, fontSize: 15 }}>
          {[['#crew', 'The Crew'], ['#how', 'How it Works'], ['#pricing', 'Pricing'], ['#faq', 'FAQ']].map(([href, label]) => (
            <a key={href} href={href} style={{ color: '#111', textDecoration: 'none', borderBottom: '2px solid transparent', paddingBottom: 2 }}>
              {label}
            </a>
          ))}
        </div>
        <Link href="/onboarding" style={{
          background: '#111', color: '#EFE7D6', padding: '12px 22px', borderRadius: 999,
          fontFamily: FONT.head, fontSize: 13, letterSpacing: 1,
          textTransform: 'uppercase', textDecoration: 'none',
          boxShadow: '4px 4px 0 #F06464', border: '2px solid #111',
        }}>Hire the Crew →</Link>
      </nav>

      <div style={{ maxWidth: 1400, margin: '0 auto', position: 'relative' }}>
        <div style={{ position: 'absolute', top: -10, right: 60, zIndex: 3 }}>
          <Sticker color="#F06464" rot={8}>✦ Now hiring: you</Sticker>
        </div>
        <div style={{ position: 'absolute', top: 180, left: -10, zIndex: 3 }}>
          <Sticker color="#1DBC87" rot={-10}>No payroll. No PTO.</Sticker>
        </div>
        <div style={{ position: 'absolute', top: 340, right: 0, zIndex: 3 }}>
          <Sticker color="#8A8AF0" rot={6}>works at 3am</Sticker>
        </div>

        <div style={{ textAlign: 'center', position: 'relative', marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 20 }}>
            <CursorEye size={54} />
            <CursorEye size={54} />
          </div>
          <h1 style={{
            fontFamily: FONT.display,
            fontSize: 'clamp(64px, 12vw, 180px)',
            lineHeight: 0.88, letterSpacing: -2, margin: 0, color: '#111',
          }}>
            hire six<br />
            <span style={{ color: '#F06464', WebkitTextStroke: '2px #111' }}>weirdos</span>
            {' '}
            <span style={{ fontFamily: FONT.body, fontWeight: 400, fontSize: '0.32em', verticalAlign: 'middle', fontStyle: 'italic' }}>
              (they&apos;re AI)
            </span>
          </h1>
          <p style={{ maxWidth: 720, margin: '28px auto 0', fontFamily: FONT.body, fontSize: 20, lineHeight: 1.5, color: '#2a2a2a' }}>
            Veqiro is a crew of six AI employees with real jobs, real personalities,
            and zero chill. They do the work. You take the credit.
            <span style={{ background: '#F5C518', padding: '0 6px' }}> We&apos;re cool with that.</span>
          </p>

          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 36, flexWrap: 'wrap' }}>
            <Link href="/onboarding" style={{
              background: '#F06464', color: '#111', padding: '18px 32px',
              fontFamily: FONT.head, fontSize: 15, textTransform: 'uppercase', letterSpacing: 1,
              textDecoration: 'none', border: '3px solid #111', borderRadius: 12, boxShadow: '6px 6px 0 #111',
              display: 'inline-block',
            }}>Start hiring — free 7 days</Link>
            <a href="#crew" style={{
              background: 'transparent', color: '#111', padding: '18px 32px',
              fontFamily: FONT.head, fontSize: 15, textTransform: 'uppercase', letterSpacing: 1,
              textDecoration: 'none', border: '3px solid #111', borderRadius: 12, display: 'inline-block',
            }}>Meet the crew ↓</a>
          </div>
          <div style={{ marginTop: 24, fontFamily: FONT.mono, fontSize: 13, color: '#555' }}>
            <span style={{ color: '#1DBC87', marginRight: 8 }}>●</span>
            {count.toLocaleString()} tasks completed this morning
          </div>
        </div>
      </div>
    </section>
  );
}

export function Marquee({ items, color = '#111', bg = '#EFE7D6', speed = 40 }: {
  items: string[]; color?: string; bg?: string; speed?: number;
}) {
  const content = [...items, ...items, ...items];
  return (
    <div style={{ overflow: 'hidden', background: bg, borderTop: '3px solid #111', borderBottom: '3px solid #111', padding: '14px 0' }}>
      <div style={{
        display: 'flex', gap: 48, whiteSpace: 'nowrap',
        animation: `marquee ${speed}s linear infinite`,
        fontFamily: FONT.head, fontSize: 22, color, textTransform: 'uppercase', letterSpacing: 2,
      }}>
        {content.map((t, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 48 }}>
            {t}
            <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', background: color }} />
          </span>
        ))}
      </div>
    </div>
  );
}
