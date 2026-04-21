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
  name?: string;
  id?: string;
  autoComplete?: string;
  required?: boolean;
  disabled?: boolean;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
}
export const VqInput = React.forwardRef<HTMLInputElement, InputProps>(function VqInput(
  { value, onChange, placeholder, type, name, id, autoComplete, required, disabled, onBlur },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type || 'text'}
      value={value ?? ''}
      onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder}
      name={name}
      id={id}
      autoComplete={autoComplete}
      required={required}
      disabled={disabled}
      onBlur={onBlur}
      style={{ width: '100%', padding: '14px 16px', border: '3px solid #111', borderRadius: 10, fontFamily: FONT.body, fontSize: 16, background: '#FFF9ED', color: '#111', outline: 'none', boxSizing: 'border-box' }}
      onFocus={e => (e.currentTarget.style.boxShadow = '4px 4px 0 #F06464')}
      onBlurCapture={e => (e.currentTarget.style.boxShadow = 'none')} />
  );
});

// ---- Textarea ----
interface TextareaProps {
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  rows?: number;
  name?: string;
  id?: string;
  required?: boolean;
  disabled?: boolean;
}
export function VqTextarea({ value, onChange, placeholder, rows = 3, name, id, required, disabled }: TextareaProps) {
  return (
    <textarea value={value ?? ''} onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder} rows={rows}
      name={name} id={id} required={required} disabled={disabled}
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

// ---- Veqiro Logo Tile ----
interface LogoTileProps { size?: number; rot?: number; shadow?: string; }
export function VqLogoTile({ size = 38, rot = -6, shadow = '#F5C518' }: LogoTileProps) {
  return (
    <div style={{
      width: size, height: size, background: '#111', borderRadius: Math.round(size * 0.24),
      display: 'grid', placeItems: 'center', transform: `rotate(${rot}deg)`,
      boxShadow: `3px 3px 0 ${shadow}`,
    }}>
      <span style={{ color: '#EFE7D6', fontFamily: FONT.display, fontSize: Math.round(size * 0.58) }}>v</span>
    </div>
  );
}

// ---- Section Label (e.g. "[ crew status ]") ----
interface SectionLabelProps { children: React.ReactNode; style?: React.CSSProperties; }
export function SectionLabel({ children, style = {} }: SectionLabelProps) {
  return (
    <div style={{
      fontFamily: FONT.mono, fontSize: 11, letterSpacing: 3,
      textTransform: 'uppercase', color: '#555', ...style,
    }}>{children}</div>
  );
}

// ---- Page Header (display title + optional kicker + subtitle + optional sticker) ----
interface PageHeaderProps {
  title: string;
  kicker?: string;
  subtitle?: string;
  sticker?: { label: string; rot?: number; color?: string };
  right?: React.ReactNode;
}
export function PageHeader({ title, kicker, subtitle, sticker, right }: PageHeaderProps) {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {kicker && (
          <SectionLabel style={{ marginBottom: 8 }}>[ {kicker} ]</SectionLabel>
        )}
        <h1 style={{
          fontFamily: FONT.display,
          fontSize: 'clamp(34px, 4vw, 52px)',
          lineHeight: 0.95, letterSpacing: -1, color: '#111', margin: 0,
        }}>{title}</h1>
        {subtitle && (
          <p style={{ fontFamily: FONT.body, fontSize: 15, color: '#444', margin: '10px 0 0', lineHeight: 1.5 }}>
            {subtitle}
          </p>
        )}
      </div>
      {sticker && (
        <div style={{ flexShrink: 0 }}>
          <Sticker rot={sticker.rot ?? 6} color={sticker.color ?? '#F5C518'}>{sticker.label}</Sticker>
        </div>
      )}
      {right && <div style={{ flexShrink: 0 }}>{right}</div>}
    </div>
  );
}

// ---- Veqiro Card (cream bg, 3px border, hard offset shadow, optional sticker) ----
interface VqCardProps {
  children: React.ReactNode;
  shadow?: string;
  padding?: number | string;
  style?: React.CSSProperties;
  sticker?: { label: string; rot?: number; color?: string; position?: 'top-left' | 'top-right' };
}
export function VqCard({ children, shadow = '#111', padding = 20, style = {}, sticker }: VqCardProps) {
  return (
    <div style={{
      position: 'relative',
      background: '#FFF9ED', border: '3px solid #111', borderRadius: 14,
      boxShadow: `5px 5px 0 ${shadow}`, padding, ...style,
    }}>
      {sticker && (
        <div style={{
          position: 'absolute',
          top: -16,
          [sticker.position === 'top-right' ? 'right' : 'left']: 16,
        }}>
          <Sticker rot={sticker.rot ?? -4} color={sticker.color ?? '#F5C518'}>
            {sticker.label}
          </Sticker>
        </div>
      )}
      {children}
    </div>
  );
}
