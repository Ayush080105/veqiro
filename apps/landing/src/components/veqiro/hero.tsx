'use client';
import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { FONT, Sticker } from './shared';
import { EMPLOYEES } from './data';
import { mainAppUrl, nav as navLinks } from '@/lib/site-config';

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
    <section style={{ position: 'relative', padding: '48px 32px 0', background: '#EFE7D6' }}>
      <style>{`
        @keyframes hfloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @media (max-width: 1180px) { .hero-card { display: none !important; } }
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
      {([
        { t: 90,  l: '3%',  r: '',   color: '#F5C518', sz: 52, rot: -15, dur: 4,   d: 0    },
        { t: 200, l: '6%',  r: '',   color: '#F06464', sz: 22, rot:  20, dur: 5.5, d: 0.4  },
        { t: 310, l: '2%',  r: '',   color: '#8A8AF0', sz: 38, rot:  -8, dur: 3.8, d: 0.8  },
        { t: 420, l: '8%',  r: '',   color: '#F79FD4', sz: 26, rot:  15, dur: 4.2, d: 1.1  },
        { t: 530, l: '4%',  r: '',   color: '#1DBC87', sz: 46, rot: -20, dur: 5,   d: 0.2  },
        { t: 100, l: '',    r: '4%', color: '#F79FD4', sz: 42, rot:  12, dur: 4.5, d: 0.6  },
        { t: 240, l: '',    r: '2%', color: '#1DBC87', sz: 20, rot: -20, dur: 6,   d: 0.9  },
        { t: 350, l: '',    r: '7%', color: '#F5C518', sz: 48, rot:  30, dur: 5,   d: 0.3  },
        { t: 465, l: '',    r: '3%', color: '#F06464', sz: 30, rot: -25, dur: 3.5, d: 1.5  },
        { t: 570, l: '',    r: '8%', color: '#8A8AF0', sz: 36, rot: -10, dur: 4.8, d: 0.7  },
      ] as { t: number; l: string; r: string; color: string; sz: number; rot: number; dur: number; d: number }[]).map(({ t, l, r, color, sz, rot, dur, d }, i) => (
        <div key={i} aria-hidden style={{
          position: 'absolute', top: t,
          ...(l ? { left: l } : { right: r }),
          transform: `rotate(${rot}deg)`,
          pointerEvents: 'none',
        }}>
          <span style={{ display: 'block', color, fontSize: sz, lineHeight: 1, animation: `hfloat ${dur}s ${d}s ease-in-out infinite` }}>✦</span>
        </div>
      ))}

      {/* Faint giant star for depth — same trick as FinalCTA section */}
      <div aria-hidden style={{
        position: 'absolute', top: '32%', left: '50%',
        transform: 'translate(-50%, -50%)',
        fontSize: '42vw', color: '#F5C518', opacity: 0.045,
        lineHeight: 1, pointerEvents: 'none', userSelect: 'none',
      }}>✦</div>

      {/* Floating agent action cards — hidden below 1180px */}
      {([
        { top: 145, l: '14%', r: '',   rot: -2,   dur: 4.5, d: 0.0, agent: 'Vega',  ac: '#6FCDE8', text: 'Calendar sorted. Blocked 2hrs tomorrow for deep work — you\'re welcome.' },
        { top: 380, l: '5%',  r: '',   rot:  1.5, dur: 5.2, d: 0.7, agent: 'Scout', ac: '#F5C518', text: 'Found the weird one — Tallinn startup, 4 people, shipping faster than Stripe in 2012.' },
        { top: 565, l: '13%', r: '',   rot: -1,   dur: 4.8, d: 1.4, agent: 'Maya',  ac: '#F06464', text: 'Drafted 3 posts. Image generated. Publishing directly. I vote spicy — brace.' },
        { top: 180, l: '',    r: '5%', rot:  2,   dur: 4.2, d: 0.4, agent: 'Lex',   ac: '#8A8AF0', text: 'Clause 7.3 is a trap. Redlined it. Sending to counsel with a summary.' },
        { top: 390, l: '',    r: '14%',rot: -1.5, dur: 5.6, d: 1.1, agent: 'Sage',  ac: '#F79FD4', text: '12 keywords ranking this week. Starting with long-tails. First wins ~10 days.' },
        { top: 570, l: '',    r: '4%', rot:  1,   dur: 5.0, d: 0.3, agent: 'Rex',   ac: '#1DBC87', text: 'CAC spiked 3× on Meta last Tuesday. Want the chart or just the fix?' },
      ] as { top: number; l: string; r: string; rot: number; dur: number; d: number; agent: string; ac: string; text: string }[]).map((c, i) => (
        <div key={i} className="hero-card" aria-hidden style={{
          position: 'absolute', top: c.top,
          ...(c.l ? { left: c.l } : { right: c.r }),
          width: 194, background: '#fff', border: '2px solid #111', borderRadius: 10,
          padding: '12px 14px', boxShadow: `4px 4px 0 ${c.ac}`,
          transform: `rotate(${c.rot}deg)`, pointerEvents: 'none',
          animation: `hfloat ${c.dur}s ${c.d}s ease-in-out infinite`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.ac, display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: '#777' }}>{c.agent}</span>
            <span style={{ marginLeft: 'auto', fontFamily: FONT.mono, fontSize: 9, color: '#aaa' }}>just now</span>
          </div>
          <div style={{ fontFamily: FONT.body, fontSize: 12.5, lineHeight: 1.45, color: '#111' }}>{c.text}</div>
        </div>
      ))}

      {/* Nav */}
      <nav style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        maxWidth: 1400, margin: '0 auto 64px',
      }}>
        {/* Logo */}
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit' }}>
          <div style={{
            width: 50, height: 50, background: '#111', borderRadius: 12,
            display: 'grid', placeItems: 'center', transform: 'rotate(-6deg)',
            boxShadow: '4px 4px 0 #F5C518', flexShrink: 0,
          }}>
            <span style={{ color: '#EFE7D6', fontFamily: FONT.display, fontSize: 28 }}>v</span>
          </div>
          <div>
            <div style={{ fontFamily: FONT.display, fontSize: 36, lineHeight: 1, color: '#111' }}>veqiro</div>
          </div>
        </a>

        {/* Pill nav */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 2,
          background: '#fff', border: '2.5px solid #111', borderRadius: 999,
          padding: '5px 6px', boxShadow: '4px 4px 0 #111',
        }}>
          {navLinks.map(({ href, label }) => (
            <a key={href} href={href} className="nav-pill-link">{label}</a>
          ))}
          <div className="nav-crew-wrap">
            The Employees ▾
            <div className="nav-crew-menu">
              {EMPLOYEES.map(emp => (
                <a key={emp.key} href={`/agents/${emp.key}`} className="nav-crew-item">
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

      {/* Content */}
      <div style={{ maxWidth: 1400, margin: '0 auto', position: 'relative' }}>
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
            hire your<br />
            <span style={{ color: '#F06464', WebkitTextStroke: '2px #111' }}>weirdos</span>
            {' '}
          </h1>
          <p style={{ maxWidth: 720, margin: '28px auto 0', fontFamily: FONT.body, fontSize: 20, lineHeight: 1.5, color: '#2a2a2a' }}>
            Veqiro is a crew of AI employees with real jobs, real personalities,
            and zero chill. They do the work. You take the credit.
            <span style={{ background: '#F5C518', padding: '0 6px' }}> We&apos;re cool with that.</span>
          </p>

          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 36, flexWrap: 'wrap' }}>
            <a href={`${mainAppUrl}/signup`} style={{
              background: '#F5C518', color: '#111', padding: '18px 32px',
              fontFamily: FONT.head, fontSize: 15, textTransform: 'uppercase', letterSpacing: 1,
              textDecoration: 'none', border: '3px solid #111', borderRadius: 12, boxShadow: '6px 6px 0 #111',
              display: 'inline-block',
            }}>Start hiring — free 7 days</a>
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

      {/* Image zone — starts after the CTA, fades in from top */}
      <div style={{ position: 'relative', width: '100%', aspectRatio: '1610 / 1232', overflow: 'hidden', marginTop: 32 }}>
        <Image
          src="/Hero_Image.jpg"
          alt="The Veqiro crew"
          fill
          style={{ objectFit: 'cover', objectPosition: 'center 40%' }}
          priority
        />
        {/* Fade from beige at top to fully visible at bottom */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, #EFE7D6 0%, rgba(239,231,214,0.7) 25%, rgba(239,231,214,0.15) 55%, transparent 100%)', pointerEvents: 'none', zIndex: 1 }} />
        {/* Soft side fades */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, #EFE7D6 0%, transparent 20%)', pointerEvents: 'none', zIndex: 1 }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to left, #EFE7D6 0%, transparent 20%)', pointerEvents: 'none', zIndex: 1 }} />
        {/* <div style={{ position: 'absolute', bottom: 18, left: 40, zIndex: 10 }}>
          <Sticker color="#F5C518" rot={-5}>zero sick days</Sticker>
        </div> */}
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
