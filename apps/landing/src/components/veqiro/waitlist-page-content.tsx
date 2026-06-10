'use client';
import React, { useState, useEffect } from 'react';
import { NavShared } from './nav-shared';
import { Footer } from './sections';
import { FONT, Button, Sticker, VqInput } from './shared';
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
    <div style={{ textAlign: 'center', minWidth: 64 }}>
      <div style={{
        fontFamily: FONT.mono, fontSize: 'clamp(36px, 8vw, 64px)', fontWeight: 700,
        color: '#111', lineHeight: 1, border: '3px solid #111', borderRadius: 10,
        padding: '12px 16px', background: '#FFF9ED', boxShadow: '4px 4px 0 #111',
        minWidth: 72, display: 'inline-block', letterSpacing: -1,
      }}>
        {String(value).padStart(2, '0')}
      </div>
      <div style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#888', marginTop: 8 }}>
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
  const [cd, setCd] = useState<CountdownState>(() => getCountdown(launchDate));
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'already' | 'error'>('idle');

  useEffect(() => {
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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--vq-bg)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 'clamp(20px, 4vw, 32px)' }}>
        <NavShared variant="page" />
      </div>

      {/* Main */}
      <main style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'clamp(40px, 8vw, 80px) clamp(20px, 4vw, 32px)',
      }}>
        <div style={{ maxWidth: 680, width: '100%', textAlign: 'center' }}>

          {/* Badge */}
          <div style={{ marginBottom: 32 }}>
            <Sticker rot={-2} color="#F06464" style={{ color: '#111' }}>
              {cd.launched ? '🎉 We\'re live!' : 'Launching soon'}
            </Sticker>
          </div>

          {/* Headline */}
          <h1 style={{
            fontFamily: FONT.display,
            fontSize: 'clamp(52px, 10vw, 100px)',
            lineHeight: 0.9,
            margin: '0 0 24px',
            letterSpacing: -2,
            color: '#111',
          }}>
            {cd.launched ? (
              <>your crew<br />is ready.</>
            ) : (
              <>almost open<br />for business.</>
            )}
          </h1>

          {/* Subtext */}
          <p style={{
            fontFamily: FONT.body,
            fontSize: 'clamp(16px, 2.5vw, 20px)',
            color: '#444',
            maxWidth: 520,
            margin: '0 auto 48px',
            lineHeight: 1.5,
          }}>
            {cd.launched
              ? 'The doors are open. Go hire your crew.'
              : 'The crew is getting ready. Founding members lock in 30% off — priced in, forever.'}
          </p>

          {cd.launched ? (
            /* Post-launch CTA */
            <a
              href={`${consoleUrl}/signup`}
              style={{
                display: 'inline-block', background: '#111', color: '#F5C518',
                padding: '18px 40px', border: '3px solid #111', borderRadius: 12,
                fontFamily: FONT.head, fontSize: 16, textTransform: 'uppercase',
                letterSpacing: 1, textDecoration: 'none', boxShadow: '6px 6px 0 #F5C518',
              }}
            >
              Hire the crew →
            </a>
          ) : (
            <>
              {/* Slot counter */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 12,
                border: '3px solid #111', borderRadius: 12, padding: '14px 24px',
                background: '#FFF9ED', boxShadow: '5px 5px 0 #111',
                marginBottom: 48, transform: 'rotate(-0.5deg)',
              }}>
                <span style={{ fontFamily: FONT.mono, fontSize: 'clamp(22px, 4vw, 32px)', fontWeight: 700, color: '#111' }}>
                  {claimed}
                </span>
                <span style={{ fontFamily: FONT.mono, fontSize: 'clamp(18px, 3vw, 26px)', color: '#999' }}>/</span>
                <span style={{ fontFamily: FONT.mono, fontSize: 'clamp(18px, 3vw, 26px)', color: '#555' }}>{max}</span>
                <span style={{ fontFamily: FONT.body, fontSize: 14, color: '#555', marginLeft: 4 }}>
                  founding spots claimed
                </span>
              </div>

              {/* Countdown */}
              <div style={{ marginBottom: 52 }}>
                <div style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: '#888', marginBottom: 20 }}>
                  dropping in
                </div>
                <div style={{ display: 'flex', gap: 'clamp(10px, 3vw, 20px)', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <CountdownBox value={cd.days} label="days" />
                  <CountdownBox value={cd.hours} label="hours" />
                  <CountdownBox value={cd.minutes} label="min" />
                  <CountdownBox value={cd.seconds} label="sec" />
                </div>
              </div>

              {/* Email form */}
              {status === 'success' ? (
                <div style={{
                  border: '3px solid #1DBC87', borderRadius: 14, padding: '28px 32px',
                  background: '#FFF9ED', boxShadow: '5px 5px 0 #1DBC87',
                }}>
                  <div style={{ fontFamily: FONT.display, fontSize: 'clamp(28px, 5vw, 40px)', marginBottom: 8 }}>you&apos;re in. 🎉</div>
                  <p style={{ fontFamily: FONT.body, fontSize: 16, color: '#444', margin: 0 }}>
                    We&apos;ll email you the moment we open the doors — along with your 30% off code.
                  </p>
                </div>
              ) : status === 'already' ? (
                <div style={{
                  border: '3px solid #F5C518', borderRadius: 14, padding: '28px 32px',
                  background: '#FFF9ED', boxShadow: '5px 5px 0 #F5C518',
                }}>
                  <div style={{ fontFamily: FONT.display, fontSize: 'clamp(24px, 4vw, 36px)', marginBottom: 8 }}>already in line.</div>
                  <p style={{ fontFamily: FONT.body, fontSize: 16, color: '#444', margin: 0 }}>
                    You&apos;re already on the list — we&apos;ve got you. Sit tight.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 480, margin: '0 auto' }}>
                  <VqInput
                    type="email"
                    value={email}
                    onChange={setEmail}
                    placeholder="your@email.com"
                  />
                  <Button
                    type="submit"
                    variant="dark"
                    disabled={status === 'loading' || !email.trim()}
                    style={{ width: '100%', boxShadow: '5px 5px 0 #F5C518' }}
                  >
                    {status === 'loading' ? 'Saving your spot…' : 'Save my spot →'}
                  </Button>
                  {status === 'error' && (
                    <p style={{ fontFamily: FONT.mono, fontSize: 12, color: '#F06464', margin: 0, textAlign: 'center' }}>
                      Something went wrong. Try again in a sec.
                    </p>
                  )}
                  <p style={{ fontFamily: FONT.mono, fontSize: 11, color: '#888', margin: 0, textAlign: 'center', letterSpacing: 0.5 }}>
                    No spam · Just the launch email + your 30% off code
                  </p>
                </form>
              )}
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
