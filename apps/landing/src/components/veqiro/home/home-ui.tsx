'use client';
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { FONT, T } from '../shared';
import { EMPLOYEES, type Employee } from '../data';
import { consoleUrl, isPreLaunch, waitlistUrl } from '@/lib/site-config';

export const SIGNUP_HREF = isPreLaunch ? waitlistUrl : `${consoleUrl}/signup`;
export const PRIMARY_CTA = isPreLaunch ? 'Join the waitlist' : 'Start free for 7 days';

const BY_KEY: Record<string, Employee> = Object.fromEntries(EMPLOYEES.map(e => [e.key, e]));
export function agentOf(key: string): Employee {
  return BY_KEY[key];
}
export function roleOf(key: string): string {
  return agentOf(key).role.replace(/\n/g, ' ').replace(/^The /, '');
}

/** True once the element has been on screen; animations start then, not on page load. */
export function useInView<T extends Element>(threshold = 0.25): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setSeen(true);
        io.disconnect();
      }
    }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [seen, threshold]);
  return [ref, seen];
}

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';
function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

/** The visitor's reduced-motion setting, kept in sync; false during server rendering. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false,
  );
}

/** Fades a block in as it enters the viewport. Content is present in the HTML either way. */
export function Reveal({ children, delay = 0, className = '', style }: {
  children: React.ReactNode; delay?: number; className?: string; style?: React.CSSProperties;
}) {
  const [ref, seen] = useInView<HTMLDivElement>(0.12);
  return (
    <div
      ref={ref}
      className={`vh-reveal${seen ? ' is-in' : ''}${className ? ` ${className}` : ''}`}
      style={{ transitionDelay: `${delay}ms`, ...style }}
    >
      {children}
    </div>
  );
}

export function AgentFace({ agent, size = 40, radius }: { agent: string; size?: number; radius?: number }) {
  const emp = agentOf(agent);
  return (
    <span style={{
      width: size, height: size, borderRadius: radius ?? Math.round(size * 0.28), overflow: 'hidden',
      display: 'inline-block', flexShrink: 0, border: `1px solid ${T.line}`, background: emp.color,
    }}>
      <Image
        src={`/${emp.name}.jpeg`}
        alt=""
        width={size * 2}
        height={size * 2}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </span>
  );
}

export function Kicker({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return <div className="vh-kicker" style={center ? { textAlign: 'center' } : undefined}>{children}</div>;
}

const ctaBase: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  padding: '14px 26px', borderRadius: 12, fontFamily: FONT.body, fontSize: 15, fontWeight: 550,
  textDecoration: 'none', whiteSpace: 'nowrap', transition: 'opacity 140ms ease, background 140ms ease',
};

/** The one primary action, plus the secondary "see how it works". `tone` is the section ground. */
export function Ctas({ tone = 'dark', center }: { tone?: 'dark' | 'light'; center?: boolean }) {
  const onDark = tone === 'dark';
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: center ? 'center' : 'flex-start' }}>
      <a
        href={SIGNUP_HREF}
        style={{ ...ctaBase, background: T.amber, color: T.ink }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
      >
        {PRIMARY_CTA}
      </a>
      <Link
        href="#how"
        style={{
          ...ctaBase, fontWeight: 500,
          background: onDark ? 'rgba(242,236,224,0.08)' : 'transparent',
          color: onDark ? T.inkInv : T.ink,
          border: `1px solid ${onDark ? T.lineInv2 : T.line2}`,
        }}
      >
        See how it works
      </Link>
    </div>
  );
}

export function TrustLine({ items, tone = 'dark', center }: { items: string[]; tone?: 'dark' | 'light'; center?: boolean }) {
  return (
    <div style={{
      marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: center ? 'center' : 'flex-start',
      fontFamily: FONT.body, fontSize: 13.5, color: tone === 'dark' ? T.inkInv2 : T.ink3,
    }}>
      {items.map((item, i) => (
        <React.Fragment key={item}>
          {i > 0 && <span aria-hidden style={{ opacity: 0.5 }}>·</span>}
          <span>{item}</span>
        </React.Fragment>
      ))}
    </div>
  );
}
