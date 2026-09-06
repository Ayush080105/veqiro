'use client';
import React, { useState, useEffect } from 'react';
import { NavShared } from './nav-shared';
import { Footer } from './sections';
import { FONT, T, Button, Sticker, VqInput } from './shared';
import { serverUrl, consoleUrl, launchDate } from '@/lib/site-config';

interface CountdownState {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  launched: boolean;
}

function getCountdown(target: string): CountdownState {
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, launched: true };
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1_000);
  return { days, hours, minutes, seconds, launched: false };
}

function CountdownBox({ value, label }: { value: number; label: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        fontFamily: FONT.mono,
        fontSize: 'clamp(32px, 7vw, 56px)',
        fontWeight: 700,
        color: T.amber,
        lineHeight: 1,
        background: T.ink,
        border: `1px solid ${T.line}`,
        borderRadius: 10,
        padding: '14px 18px',
        boxShadow: T.shadow,
        minWidth: 68,
        display: 'inline-block',

      }}>
        {String(value).padStart(2, '0')}
      </div>
      <div style={{
        fontFamily: FONT.mono,
        fontSize: 10,
        letterSpacing: 2,
        textTransform: 'uppercase',
        color: T.ink3,
        marginTop: 8,
      }}>
        {label}
      </div>
    </div>
  );
}

interface Props {
  count: number;
  max: number;
}

export default function WaitlistPageContent({ count, max }: Props) {
  const [cd, setCd] = useState<CountdownState | null>(null);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'already' | 'error' | 'full'>('idle');

  useEffect(() => {
    setCd(getCountdown(launchDate));
    const id = setInterval(() => setCd(getCountdown(launchDate)), 1_000);
    return () => clearInterval(id);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('loading');
    try {
      const res = await fetch(`${serverUrl}/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        if (res.status === 400) {
          const data = await res.json().catch(() => ({}));
          if (data.message === "All waitlist spots are fully booked") {
            setStatus('full');
            return;
          }
        }
        setStatus('error');
        return;
      }
      const data = (await res.json()) as { alreadyJoined: boolean };
      setStatus(data.alreadyJoined ? 'already' : 'success');
    } catch {
      setStatus('error');
    }
  };

  const claimed = Math.min(count, max);
  const pct = Math.round((claimed / max) * 100);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--vq-bg)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 'clamp(20px, 4vw, 32px)' }}>
        <NavShared variant="page" />
      </div>

      <main style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(32px, 6vw, 72px) clamp(20px, 4vw, 32px)',
      }}>
        <div style={{ maxWidth: 640, width: '100%', textAlign: 'center' }}>

          {/* Badge */}
          <div style={{ marginBottom: 28 }}>
            <Sticker rot={-2} color={T.red} style={{ color: T.ink }}>
              {cd?.launched ? "we're live!" : 'launching soon'}
            </Sticker>
          </div>

          {/* Headline */}
          <h1 style={{
            fontFamily: FONT.display, fontWeight: 600, letterSpacing: '-0.03em',
            fontSize: 'clamp(48px, 10vw, 96px)',
            lineHeight: 0.9,
            margin: '0 0 20px',

            color: T.ink,
          }}>
            {cd?.launched ? (
              <>Your crew<br />is ready.</>
            ) : (
              <>Almost open<br />for business.</>
            )}
          </h1>

          {/* Subtext */}
          <p style={{
            fontFamily: FONT.body,
            fontSize: 'clamp(15px, 2.2vw, 18px)',
            color: T.ink2,
            maxWidth: 500,
            margin: '0 auto 44px',
            lineHeight: 1.55,
          }}>
            {cd?.launched
              ? 'The doors are open. Go hire your crew.'
              : <>
                  The crew is getting ready. Founding members lock in{' '}
                  <span style={{
                    background: T.amber,
                    color: T.ink,
                    fontFamily: FONT.head,
                    fontWeight: 700,
                    padding: '1px 7px',
                    borderRadius: 4,
                    fontSize: '1em',
                    letterSpacing: 0.5,
                    whiteSpace: 'nowrap',
                  }}>30% off</span>
                  {' '}— on your first plan. Launch confetti included.
                </>
            }
          </p>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', margin: '-32px 0 44px' }}>
            {['✓ Start free', '7-day trial', 'No payment method needed'].map((label) => (
              <span key={label} style={{
                background: T.surface, color: T.ink2,
                border: `1px solid ${T.line}`,
                fontFamily: FONT.body, fontWeight: 500, fontSize: 12.5,
                padding: '5px 12px', borderRadius: 99,
              }}>{label}</span>
            ))}
          </div>


          {cd?.launched ? (
            <a
              href={`${consoleUrl}/signup`}
              style={{
                display: 'inline-block',
                background: T.dark,
                color: T.inkInv,
                padding: '15px 30px',
                border: `1px solid ${T.dark}`,
                borderRadius: 11,
                fontFamily: FONT.body,
                fontSize: 15,
                fontWeight: 550,
                textDecoration: 'none',
                boxShadow: T.shadow,
              }}
            >
              Hire the crew →
            </a>
          ) : (
            <>
              {/* Countdown */}
              <div style={{ marginBottom: 44 }}>
                <div style={{
                  fontFamily: FONT.mono,
                  fontSize: 10,
                  letterSpacing: 3,
                  textTransform: 'uppercase',
                  color: T.ink3,
                  marginBottom: 18,
                }}>
                  dropping in
                </div>
                <div style={{
                  display: 'flex',
                  gap: 'clamp(8px, 2.5vw, 16px)',
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                }}>
                  <CountdownBox value={cd?.days ?? 0} label="days" />
                  <CountdownBox value={cd?.hours ?? 0} label="hours" />
                  <CountdownBox value={cd?.minutes ?? 0} label="min" />
                  <CountdownBox value={cd?.seconds ?? 0} label="sec" />
                </div>
              </div>

              {/* Email form */}
              {status === 'success' ? (
                <div
                  role="status"
                  aria-live="polite"
                  style={{
                    border: `1px solid ${T.green}`,
                    borderRadius: 14,
                    padding: '28px 32px',
                    background: T.surface,
                    boxShadow: T.shadow,
                  }}>
                  <div style={{ fontFamily: FONT.display, fontWeight: 600, letterSpacing: '-0.03em', fontSize: 'clamp(28px, 5vw, 40px)', marginBottom: 8 }}>
                    you&apos;re in.
                  </div>
                  <p style={{ fontFamily: FONT.body, fontSize: 16, color: T.ink2, margin: 0 }}>
                    We&apos;ll email you the moment the doors open — along with your{' '}
                    <span style={{ fontFamily: FONT.head, fontWeight: 700 }}>30% off on your first plan</span>.
                  </p>
                </div>
              ) : status === 'already' ? (
                <div
                  role="status"
                  aria-live="polite"
                  style={{
                    border: `1px solid ${T.amber}`,
                    borderRadius: 14,
                    padding: '28px 32px',
                    background: T.surface,
                    boxShadow: T.shadow,
                  }}>
                  <div style={{ fontFamily: FONT.display, fontWeight: 600, letterSpacing: '-0.03em', fontSize: 'clamp(24px, 4vw, 36px)', marginBottom: 8 }}>
                    already in line.
                  </div>
                  <p style={{ fontFamily: FONT.body, fontSize: 16, color: T.ink2, margin: 0 }}>
                    You&apos;re already on the list — we&apos;ve got you. Sit tight.
                  </p>
                </div>
              ) : status === 'full' || count >= max ? (
                <div style={{ maxWidth: 520, margin: '0 auto' }}>
                  <div
                    role="status"
                    aria-live="polite"
                    style={{
                    border: `1px solid ${T.red}`,
                    borderRadius: 14,
                    padding: '28px 32px',
                    background: T.surface,
                    boxShadow: T.shadow,
                    textAlign: 'center',
                    marginBottom: 24,
                  }}>
                    <div style={{ fontFamily: FONT.display, fontWeight: 600, letterSpacing: '-0.03em', fontSize: 'clamp(24px, 4vw, 36px)', marginBottom: 8, color: T.ink }}>
                      founding spots filled.
                    </div>
                    <p style={{ fontFamily: FONT.body, fontSize: 16, color: T.ink2, margin: '0 0 16px', lineHeight: 1.5 }}>
                      All {max} founding member spots have been claimed! Thank you for the incredible support. We will be opening general access very soon.
                    </p>
                    <div style={{
                      display: 'inline-block',
                      fontFamily: FONT.mono,
                      fontSize: 11,
                      background: T.red,
                      color: 'white',
                      fontWeight: 700,
                      padding: '6px 14px',
                      borderRadius: 99,
                      letterSpacing: 0.5,
                      textTransform: 'uppercase',
                    }}>
                      Closed for Pre-Launch
                    </div>
                  </div>

                  {/* Spots counter + progress bar */}
                  <div style={{ marginTop: 20 }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      marginBottom: 8,
                    }}>
                      <span style={{ fontFamily: FONT.mono, fontSize: 12, color: T.ink2, letterSpacing: 0.5 }}>
                        <span style={{ fontFamily: FONT.head, fontWeight: 700, color: T.ink, fontSize: 14 }}>{claimed}</span>
                        {' '}/ {max} founding spots claimed
                      </span>
                      <span style={{ fontFamily: FONT.mono, fontSize: 11, color: T.ink3 }}>
                        {max - claimed} left
                      </span>
                    </div>
                    <div style={{
                      height: 8,
                      background: `color-mix(in srgb, ${T.ink} 12%, ${T.bg})`,
                      borderRadius: 999,
                      border: `1px solid ${T.line}`,
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: T.green,
                        borderRadius: 999,
                        transition: 'width 600ms ease',
                      }} />
                    </div>
                    <p style={{ fontFamily: FONT.mono, fontSize: 11, color: T.ink3, margin: '10px 0 0', letterSpacing: 0.3 }}>
                      We are gearing up for launch. Get ready.
                    </p>
                  </div>
                </div>
              ) : (
                <div style={{ maxWidth: 520, margin: '0 auto' }}>
                  <form
                    onSubmit={handleSubmit}
                    style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}
                  >
                    <div style={{ flex: 1, minWidth: 200, textAlign: 'left' }}>
                      <label
                        htmlFor="waitlist-email"
                        style={{
                          display: 'block',
                          fontFamily: FONT.body,
                          fontSize: 13,
                          fontWeight: 500,
                          color: T.ink2,
                          marginBottom: 6,
                        }}
                      >
                        Email address
                      </label>
                      <VqInput
                        id="waitlist-email"
                        type="email"
                        value={email}
                        onChange={setEmail}
                        placeholder="your@email.com"
                        required
                        aria-describedby={status === 'error' ? 'waitlist-email-error' : undefined}
                      />
                    </div>
                    <Button
                      type="submit"
                      variant="dark"
                      disabled={status === 'loading' || !email.trim()}
                      style={{ boxShadow: T.shadow, whiteSpace: 'nowrap' }}
                    >
                      {status === 'loading' ? 'Saving…' : 'Save my spot →'}
                    </Button>
                  </form>

                  {status === 'error' && (
                    <p
                      id="waitlist-email-error"
                      role="alert"
                      style={{ fontFamily: FONT.mono, fontSize: 12, color: T.red, margin: '8px 0 0', textAlign: 'center' }}
                    >
                      Something went wrong. Try again in a sec.
                    </p>
                  )}

                  {/* Spots counter + progress bar */}
                  <div style={{ marginTop: 20 }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      marginBottom: 8,
                    }}>
                      <span style={{ fontFamily: FONT.mono, fontSize: 12, color: T.ink2, letterSpacing: 0.5 }}>
                        <span style={{ fontFamily: FONT.head, fontWeight: 700, color: T.ink, fontSize: 14 }}>{claimed}</span>
                        {' '}/ {max} founding spots claimed
                      </span>
                      <span style={{ fontFamily: FONT.mono, fontSize: 11, color: T.ink3 }}>
                        {max - claimed} left
                      </span>
                    </div>
                    <div style={{
                      height: 8,
                      background: `color-mix(in srgb, ${T.ink} 12%, ${T.bg})`,
                      borderRadius: 999,
                      border: `1px solid ${T.line}`,
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: T.green,
                        borderRadius: 999,
                        transition: 'width 600ms ease',
                      }} />
                    </div>
                    <p style={{ fontFamily: FONT.mono, fontSize: 11, color: T.ink3, margin: '10px 0 0', letterSpacing: 0.3 }}>
                      No spam · Just the launch email + 30% off on your first plan
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
