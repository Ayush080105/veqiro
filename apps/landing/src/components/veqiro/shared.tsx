'use client';
import React from 'react';
import Link from 'next/link';

/**
 * Font roles. The keys are unchanged so the ~20 modules importing FONT keep
 * working; only the underlying faces moved to the professional stack
 * (Inter Tight / Inter / JetBrains Mono).
 */
export const FONT = {
  display: "var(--font-display), system-ui, sans-serif",
  head: "var(--font-display), system-ui, sans-serif",
  body: "var(--font-body), system-ui, sans-serif",
  mono: "var(--font-mono), monospace",
};

/** Shared tokens for inline-styled components. */
export const T = {
  bg: '#EFE7D6',
  surface: '#FBF7EF',
  surface2: '#F5EEE0',
  dark: '#14120E',
  dark2: '#1D1A14',
  dark3: '#2A251C',
  ink: '#14120E',
  ink2: '#56514A',
  ink3: '#8B857A',
  inkInv: '#F2ECE0',
  inkInv2: '#A9A192',
  line: 'rgba(20, 18, 14, 0.10)',
  line2: 'rgba(20, 18, 14, 0.17)',
  lineInv: 'rgba(242, 236, 224, 0.12)',
  lineInv2: 'rgba(242, 236, 224, 0.22)',
  amber: '#F5C518',
  red: '#F06464',
  green: '#1DBC87',
  pink: '#F79FD4',
  violet: '#8A8AF0',
  blue: '#6FCDE8',
  shadowSm: '0 1px 2px rgba(20, 18, 14, 0.05)',
  shadow: '0 1px 3px rgba(20, 18, 14, 0.05), 0 8px 24px -6px rgba(20, 18, 14, 0.09)',
  shadowLg: '0 2px 6px rgba(20, 18, 14, 0.06), 0 24px 48px -12px rgba(20, 18, 14, 0.14)',
  r: 12,
  rLg: 16,
} as const;

// ---- Button ----
interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  /** `light` / `ghost-light` are the on-dark pair — `dark` and `ghost` both
   *  disappear against an ink section. */
  variant?: 'primary' | 'dark' | 'ghost' | 'yellow' | 'light' | 'ghost-light';
  style?: React.CSSProperties;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  href?: string;
  size?: 'sm' | 'md' | 'lg';
}

const VARIANTS: Record<string, React.CSSProperties> = {
  primary: { background: T.ink, color: T.inkInv, border: `1px solid ${T.ink}` },
  dark:    { background: T.ink, color: T.inkInv, border: `1px solid ${T.ink}` },
  ghost:   { background: 'transparent', color: T.ink, border: `1px solid ${T.line2}` },
  yellow:  { background: T.amber, color: T.ink, border: `1px solid ${T.amber}` },
  light:   { background: T.inkInv, color: T.ink, border: `1px solid ${T.inkInv}` },
  'ghost-light': {
    background: 'rgba(242,236,224,0.08)',
    color: T.inkInv,
    border: `1px solid ${T.lineInv2}`,
  },
};

const SIZES: Record<string, React.CSSProperties> = {
  sm: { padding: '8px 14px', fontSize: 13 },
  md: { padding: '11px 20px', fontSize: 14 },
  lg: { padding: '14px 26px', fontSize: 15 },
};

export function Button({
  children, onClick, variant = 'primary', style = {}, disabled, type, href, size = 'md',
}: ButtonProps) {
  const base: React.CSSProperties = {
    fontFamily: FONT.body,
    fontWeight: 500,
    letterSpacing: '-0.005em',
    borderRadius: 10,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    whiteSpace: 'nowrap',
    transition: 'opacity 140ms ease, background 140ms ease, border-color 140ms ease',
    ...SIZES[size],
    ...VARIANTS[variant],
    ...style,
  };

  const hoverIn = (el: HTMLElement) => { if (!disabled) el.style.opacity = '0.85'; };
  const hoverOut = (el: HTMLElement) => { if (!disabled) el.style.opacity = disabled ? '0.45' : '1'; };

  if (href) {
    const external = href.startsWith('http') || href.startsWith('mailto:');
    if (external) {
      return (
        <a
          href={href}
          style={base}
          onMouseEnter={e => hoverIn(e.currentTarget)}
          onMouseLeave={e => hoverOut(e.currentTarget)}
        >
          {children}
        </a>
      );
    }
    return (
      <Link
        href={href}
        style={base}
        onMouseEnter={e => hoverIn(e.currentTarget)}
        onMouseLeave={e => hoverOut(e.currentTarget)}
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type || 'button'}
      onClick={onClick}
      disabled={disabled}
      style={base}
      onMouseEnter={e => hoverIn(e.currentTarget)}
      onMouseLeave={e => hoverOut(e.currentTarget)}
    >
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
    <label style={{ display: 'block', marginBottom: 18 }}>
      <div style={{
        fontFamily: FONT.body, fontSize: 13, fontWeight: 500,
        color: T.ink, marginBottom: 7,
      }}>
        {label}
      </div>
      {children}
      {hint && (
        <div style={{ fontFamily: FONT.body, fontSize: 12.5, color: T.ink3, marginTop: 6 }}>
          {hint}
        </div>
      )}
    </label>
  );
}

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  border: `1px solid ${T.line2}`,
  borderRadius: 10,
  fontFamily: FONT.body,
  fontSize: 15,
  background: T.surface,
  color: T.ink,
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 140ms ease, box-shadow 140ms ease',
};

// ---- Input ----
interface InputProps {
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  type?: string;
}
export function VqInput({ value, onChange, placeholder, type }: InputProps) {
  return (
    <input
      type={type || 'text'}
      value={value || ''}
      onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder}
      style={fieldStyle}
      onFocus={e => {
        e.currentTarget.style.borderColor = T.ink;
        e.currentTarget.style.boxShadow = `0 0 0 3px rgba(20,18,14,0.07)`;
      }}
      onBlur={e => {
        e.currentTarget.style.borderColor = T.line2;
        e.currentTarget.style.boxShadow = 'none';
      }}
    />
  );
}

// ---- Textarea ----
interface TextareaProps { value?: string; onChange?: (v: string) => void; placeholder?: string; rows?: number; }
export function VqTextarea({ value, onChange, placeholder, rows = 3 }: TextareaProps) {
  return (
    <textarea
      value={value || ''}
      onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{ ...fieldStyle, resize: 'vertical' }}
      onFocus={e => {
        e.currentTarget.style.borderColor = T.ink;
        e.currentTarget.style.boxShadow = `0 0 0 3px rgba(20,18,14,0.07)`;
      }}
      onBlur={e => {
        e.currentTarget.style.borderColor = T.line2;
        e.currentTarget.style.boxShadow = 'none';
      }}
    />
  );
}

// ---- Sticker ----
/**
 * Was a rotated, hard-shadowed sticker. Now a flat status pill; the `rot` prop
 * is accepted and ignored so existing call sites keep type-checking.
 */
interface StickerProps { children: React.ReactNode; rot?: number; color?: string; style?: React.CSSProperties; }
export function Sticker({ children, color = T.amber, style = {} }: StickerProps) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 7,
      background: T.surface, border: `1px solid ${T.line2}`,
      borderRadius: 999, padding: '6px 13px',
      fontFamily: FONT.mono, fontSize: 11, letterSpacing: '0.1em',
      textTransform: 'uppercase', color: T.ink2, ...style,
    }}>
      <span aria-hidden style={{
        width: 6, height: 6, borderRadius: '50%',
        background: color, flexShrink: 0,
      }} />
      {children}
    </span>
  );
}

// ---- Eyebrow ----
export function Eyebrow({ children, center, invert }: {
  children: React.ReactNode; center?: boolean; invert?: boolean;
}) {
  return (
    <div className={[
      'vq-eyebrow',
      center ? 'vq-eyebrow-center' : '',
      invert ? 'vq-eyebrow-inv' : '',
    ].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}

// ---- Section heading block ----
export function SectionHead({ eyebrow, title, lede, center, invert, style }: {
  eyebrow?: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  center?: boolean;
  invert?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ maxWidth: center ? 720 : undefined, marginInline: center ? 'auto' : undefined, ...style }}>
      {eyebrow && <Eyebrow center={center} invert={invert}>{eyebrow}</Eyebrow>}
      <h2
        className={`vq-h2${center ? ' vq-h2-center' : ''}`}
        style={{ color: invert ? T.inkInv : T.ink }}
      >
        {title}
      </h2>
      {lede && (
        <p className={[
          'vq-lede',
          center ? 'vq-lede-center' : '',
          invert ? 'vq-lede-inv' : '',
        ].filter(Boolean).join(' ')}>
          {lede}
        </p>
      )}
    </div>
  );
}
