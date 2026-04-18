'use client';
import React from 'react';
import Link from 'next/link';

export const FONT = {
  display: "var(--font-bagel), cursive",
  head: "var(--font-archivo), sans-serif",
  body: "var(--font-space), sans-serif",
  mono: "var(--font-mono), monospace",
};

// ---- Button ----
interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'dark' | 'ghost' | 'yellow';
  style?: React.CSSProperties;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  href?: string;
}

const VARIANTS = {
  primary: { background: '#F06464', color: '#111', boxShadow: '5px 5px 0 #111' },
  dark:    { background: '#111',    color: '#EFE7D6', boxShadow: '5px 5px 0 #F5C518' },
  ghost:   { background: 'transparent', color: '#111' },
  yellow:  { background: '#F5C518', color: '#111', boxShadow: '5px 5px 0 #111' },
};

export function Button({ children, onClick, variant = 'primary', style = {}, disabled, type, href }: ButtonProps) {
  const base: React.CSSProperties = {
    padding: '14px 26px',
    fontFamily: FONT.head,
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
    border: '3px solid #111',
    borderRadius: 10,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    textDecoration: 'none',
    display: 'inline-block',
    transition: 'transform 120ms, box-shadow 120ms',
    ...VARIANTS[variant],
    ...style,
  };

  if (href) {
    return <Link href={href} style={base}>{children}</Link>;
  }

  return (
    <button type={type || 'button'} onClick={onClick} disabled={disabled} style={base}
      onMouseDown={e => (e.currentTarget.style.transform = 'translate(2px,2px)')}
      onMouseUp={e => (e.currentTarget.style.transform = '')}
      onMouseLeave={e => (e.currentTarget.style.transform = '')}>
      {children}
    </button>
  );
}

// ---- Field ----
interface FieldProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
}
export function FieldLabel({ label, hint, children }: FieldProps) {
  return (
    <label style={{ display: 'block', marginBottom: 20 }}>
      <div style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: '#555', marginBottom: 6 }}>
        {label}
      </div>
      {children}
      {hint && <div style={{ fontFamily: FONT.body, fontSize: 12, color: '#888', marginTop: 6, fontStyle: 'italic' }}>{hint}</div>}
    </label>
  );
}

// ---- Input ----
interface InputProps {
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  type?: string;
}
export function VqInput({ value, onChange, placeholder, type }: InputProps) {
  return (
    <input type={type || 'text'} value={value || ''} onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder}
      style={{ width: '100%', padding: '14px 16px', border: '3px solid #111', borderRadius: 10, fontFamily: FONT.body, fontSize: 16, background: '#FFF9ED', color: '#111', outline: 'none', boxSizing: 'border-box' }}
      onFocus={e => (e.currentTarget.style.boxShadow = '4px 4px 0 #F06464')}
      onBlur={e => (e.currentTarget.style.boxShadow = 'none')} />
  );
}

// ---- Textarea ----
interface TextareaProps { value?: string; onChange?: (v: string) => void; placeholder?: string; rows?: number; }
export function VqTextarea({ value, onChange, placeholder, rows = 3 }: TextareaProps) {
  return (
    <textarea value={value || ''} onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder} rows={rows}
      style={{ width: '100%', padding: '14px 16px', border: '3px solid #111', borderRadius: 10, fontFamily: FONT.body, fontSize: 16, background: '#FFF9ED', color: '#111', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
      onFocus={e => (e.currentTarget.style.boxShadow = '4px 4px 0 #F06464')}
      onBlur={e => (e.currentTarget.style.boxShadow = 'none')} />
  );
}

// ---- Sticker ----
interface StickerProps { children: React.ReactNode; rot?: number; color?: string; style?: React.CSSProperties; }
export function Sticker({ children, rot = -4, color = '#F5C518', style = {} }: StickerProps) {
  return (
    <div style={{
      display: 'inline-block', background: color, border: '3px solid #111',
      borderRadius: 999, padding: '8px 16px', fontFamily: FONT.head, fontSize: 12,
      textTransform: 'uppercase', letterSpacing: 1, color: '#111',
      transform: `rotate(${rot}deg)`, boxShadow: '4px 4px 0 #111', ...style,
    }}>{children}</div>
  );
}

// ---- NavBar ----
interface NavBarProps { active: 'onboarding' | 'dashboard' | 'landing'; }
export function NavBar({ active }: NavBarProps) {
  return (
    <nav style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '20px 32px', borderBottom: '3px solid #111', background: '#EFE7D6',
      position: 'sticky', top: 0, zIndex: 50,
    }}>
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: '#111' }}>
        <div style={{
          width: 38, height: 38, background: '#111', borderRadius: 9,
          display: 'grid', placeItems: 'center', transform: 'rotate(-6deg)',
          boxShadow: '3px 3px 0 #F5C518',
        }}>
          <span style={{ color: '#EFE7D6', fontFamily: FONT.display, fontSize: 22 }}>v</span>
        </div>
        <span style={{ fontFamily: FONT.head, fontSize: 20, letterSpacing: -0.5 }}>veqiro</span>
      </Link>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {(['onboarding', 'dashboard'] as const).map(x => (
          <Link key={x} href={x === 'onboarding' ? '/onboarding' : '/dashboard'}
            style={{
              textDecoration: 'none', fontFamily: FONT.mono, fontSize: 11, letterSpacing: 2,
              textTransform: 'uppercase', padding: '8px 14px', borderRadius: 999,
              background: active === x ? '#111' : 'transparent',
              color: active === x ? '#EFE7D6' : '#111',
              border: '2px solid #111',
            }}>{x}</Link>
        ))}
      </div>
    </nav>
  );
}
