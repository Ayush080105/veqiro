'use client';
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { EMPLOYEES, Employee } from '@/components/veqiro/data';
import { CHARACTER_COMPONENTS } from '@/components/veqiro/characters';
import { NavBar, FONT } from '@/components/veqiro/shared';

interface BrandKit {
  company_name?: string;
  company_description?: string;
  industry?: string;
  target_audience?: string;
  brand_voice?: string;
  logo_url?: string;
  mascot_url?: string;
  brand_colors?: string[];
  brand_fonts?: { display: string; body: string };
  competitors?: string;
  key_differentiators?: string;
  website_url?: string;
}

interface Message { who: 'me' | 'them'; text: string; t: string; }

function replyFor(empKey: string, userText: string, kit: BrandKit | null): string {
  const co = kit?.company_name || 'your company';
  const industry = kit?.industry || 'startup';
  const voice = kit?.brand_voice || 'playful';
  const bank: Record<string, string[]> = {
    vega: [
      `On it. I'll block 45 min tomorrow morning — your calendar's clear until the 11am standup.`,
      `Pulled your inbox. 3 emails actually need you today, the other 27 I can handle. Want a summary?`,
      `Booked. Confirmed with them via email, added a Zoom link, put it on your cal. Next.`,
    ],
    scout: [
      `Scanning the ${industry} space for ${co}... Found 4 comps doing something interesting. Want the 2-min teardown or the full memo?`,
      `Quick read: the weird one is a small team in Lisbon. They're doing this pricing thing that could hurt us in Q3. Should we talk?`,
      `Just shipped you a doc — 8 trends in ${industry}, sorted by "actually matters" vs "LinkedIn noise". Link in Slack.`,
    ],
    maya: [
      `Okay — drafting 3 hooks for ${co}. One safe, one on-brand (${voice.toLowerCase()}), one unhinged. Back in 4 min.`,
      `Your subject line is weak. Try "${co} hates ads. Here's one anyway." ← that's the one.`,
      `New blog post is live-ready. 1200 words, SEO keywords baked in. Sage already blessed it.`,
    ],
    sage: [
      `Keyword audit done. We're leaving traffic on the table with 3 long-tails. Easy wins — let me push the changes?`,
      `You ranked #11 → #6 for "best ${industry.toLowerCase()} tool for small teams" this week. Not bad, not done.`,
      `Backlink from a legit publisher incoming. I'll handle the outreach copy. Don't touch.`,
    ],
    lex: [
      `Read your draft NDA. Clause 4.2 is fine but oddly poetic. Clause 7 is a trap — redlined it.`,
      `This vendor contract has a 90-day auto-renew hidden in section 12. Do you want out in 90 or 30?`,
      `Policy audit complete. 2 things to fix before GDPR-anything ships. Want the fast version?`,
    ],
    rex: [
      `Pulled the numbers. Revenue up 12% MoM for ${co}. But CAC is doing something weird — mind if I dig?`,
      `Built you a forecast. Base case: 18% growth. Bear: 4%. Bull: 31%. The bull case depends on one thing — guess which?`,
      `Anomaly flagged. Last Tuesday's signup spike wasn't organic — looks like a bot farm. Blocking the IP range now.`,
    ],
  };
  const list = bank[empKey] || [`Got it. On it.`];
  const idx = (userText?.length || 0) % list.length;
  return list[idx];
}

function Avatar({ empKey, size = 44, ring = false }: { empKey: string; size?: number; ring?: boolean }) {
  const emp = EMPLOYEES.find(e => e.key === empKey);
  if (!emp) return null;
  const Comp = CHARACTER_COMPONENTS[emp.key];
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', overflow: 'hidden',
      border: '2.5px solid #111', background: emp.color, flexShrink: 0,
      boxShadow: ring ? `0 0 0 3px ${emp.color}, 0 0 0 5px #111` : 'none',
    }}>
      <Comp size={size} />
    </div>
  );
}

function ContactRow({ emp, active, unread, lastMsg, onClick }: { emp: Employee; active: boolean; unread: number; lastMsg: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12, width: '100%',
      padding: '14px 16px', background: active ? emp.color : 'transparent',
      border: 'none', borderBottom: '2px solid #111',
      cursor: 'pointer', textAlign: 'left',
    }}>
      <Avatar empKey={emp.key} size={48} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontFamily: FONT.head, fontSize: 15, color: '#111' }}>{emp.name}</div>
          <div style={{ fontFamily: FONT.mono, fontSize: 10, color: '#444' }}>now</div>
        </div>
        <div style={{
          fontFamily: FONT.body, fontSize: 13, color: active ? '#111' : '#555',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontWeight: unread ? 700 : 400, marginTop: 2,
        }}>{lastMsg || emp.role}</div>
      </div>
      {unread > 0 && (
        <div style={{
          background: '#F06464', color: '#111', border: '2px solid #111', borderRadius: 999,
          width: 22, height: 22, display: 'grid', placeItems: 'center',
          fontFamily: FONT.head, fontSize: 11,
        }}>{unread}</div>
      )}
    </button>
  );
}

function ProfileModal({ kit, close }: { kit: BrandKit | null; close: () => void }) {
  const rows: [string, string | undefined][] = [
    ['Company', kit?.company_name],
    ['Description', kit?.company_description],
    ['Industry', kit?.industry],
    ['Target audience', kit?.target_audience],
    ['Brand voice', kit?.brand_voice],
    ['Website', kit?.website_url],
    ['Competitors', kit?.competitors],
    ['Key differentiators', kit?.key_differentiators],
    ['Logo URL', kit?.logo_url],
    ['Mascot URL', kit?.mascot_url],
  ];
  return (
    <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.55)', zIndex: 100, display: 'grid', placeItems: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#FFF9ED', border: '3px solid #111', borderRadius: 16,
        boxShadow: '12px 12px 0 #F5C518', maxWidth: 640, width: '100%', maxHeight: '88vh', overflow: 'auto',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '3px solid #111', background: '#F06464', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' }}>Brand profile</div>
            <div style={{ fontFamily: FONT.display, fontSize: 36, lineHeight: 1, marginTop: 2 }}>
              {kit?.company_name || 'Your Company'}
            </div>
          </div>
          <button onClick={close} style={{ background: '#111', color: '#EFE7D6', border: '2px solid #111', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', fontFamily: FONT.head, fontSize: 16 }}>×</button>
        </div>
        <div style={{ padding: 24 }}>
          {kit?.logo_url && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#666', marginBottom: 6 }}>Logo</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={kit.logo_url} alt="logo" style={{ maxHeight: 80, border: '2px solid #111', borderRadius: 8, background: '#fff', padding: 8 }} onError={e => (e.currentTarget.style.display = 'none')} />
            </div>
          )}
          <div style={{ display: 'grid', gap: 12 }}>
            {rows.filter(r => r[1]).map(([k, v]) => (
              <div key={k} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12, borderBottom: '1px dashed #ccc', paddingBottom: 10 }}>
                <div style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#666' }}>{k}</div>
                <div style={{ fontFamily: FONT.body, fontSize: 14, whiteSpace: 'pre-wrap' }}>{v}</div>
              </div>
            ))}
            {(kit?.brand_colors?.length ?? 0) > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12 }}>
                <div style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#666' }}>Palette</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {kit!.brand_colors!.map((c, i) => (
                    <div key={i} style={{ textAlign: 'center' }}>
                      <div style={{ width: 48, height: 48, background: c, border: '2px solid #111', borderRadius: 8 }} />
                      <div style={{ fontFamily: FONT.mono, fontSize: 9, marginTop: 4 }}>{c}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {kit?.brand_fonts && (
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12, marginTop: 4 }}>
                <div style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#666' }}>Fonts</div>
                <div style={{ fontFamily: FONT.body, fontSize: 14 }}>
                  Display: <b>{kit.brand_fonts.display}</b> · Body: <b>{kit.brand_fonts.body}</b>
                </div>
              </div>
            )}
          </div>
        </div>
        <div style={{ padding: 16, borderTop: '3px solid #111', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Link href="/onboarding" style={{
            background: '#111', color: '#EFE7D6', padding: '10px 18px', textDecoration: 'none',
            fontFamily: FONT.head, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1,
            border: '2px solid #111', borderRadius: 8,
          }}>Edit brand kit</Link>
          <button onClick={close} style={{ background: '#F5C518', border: '2px solid #111', padding: '10px 18px', borderRadius: 8, fontFamily: FONT.head, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, cursor: 'pointer' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatPane({ emp, msgs, typing, sendMsg, input, setInput, kit }: {
  emp: Employee; msgs: Message[]; typing: boolean;
  sendMsg: (text: string) => void; input: string; setInput: (v: string) => void; kit: BrandKit | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const Comp = CHARACTER_COMPONENTS[emp.key];

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, typing]);

  const quickPrompts: Record<string, string[]> = {
    vega: ['Block 2hrs tomorrow for deep work', 'Summarize my inbox', 'Schedule team sync'],
    scout: ['Run a competitor teardown', "What's trending this week?", "Pull last week's news"],
    maya: ['Draft a launch tweet', 'Write a blog post outline', 'Rewrite my LinkedIn bio'],
    sage: ['Audit my top 10 pages', 'Find long-tail keywords', 'Review meta tags'],
    lex: ['Review this NDA', 'Draft a mutual NDA', 'Flag contract risks'],
    rex: ["Pull last month's MRR", 'Build a CAC dashboard', 'Spot anomalies'],
  };

  return (
    <section style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#FFF9ED', minWidth: 0 }}>
      {/* header */}
      <div style={{ padding: '16px 24px', borderBottom: '3px solid #111', background: emp.color, display: 'flex', alignItems: 'center', gap: 14 }}>
        <Avatar empKey={emp.key} size={52} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FONT.head, fontSize: 19 }}>{emp.name}</div>
          <div style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1DBC87', boxShadow: '0 0 0 2px #fff', display: 'inline-block' }} />
            online · {emp.role}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['📎', '⚙', '⋯'].map((x, i) => (
            <button key={i} style={{ width: 36, height: 36, background: '#fff', border: '2px solid #111', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>{x}</button>
          ))}
        </div>
      </div>

      {/* pinned context strip */}
      <div style={{ padding: '10px 24px', background: '#EFE7D6', borderBottom: '2px dashed #111', fontFamily: FONT.mono, fontSize: 11, color: '#333', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ letterSpacing: 2, textTransform: 'uppercase', color: '#888' }}>context:</span>
        <span>{kit?.company_name || '—'}</span>
        <span>·</span>
        <span>{kit?.industry || '—'}</span>
        <span>·</span>
        <span>voice: {kit?.brand_voice?.toLowerCase() || '—'}</span>
        {(kit?.brand_colors?.length ?? 0) > 0 && (
          <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
            {kit!.brand_colors!.map((c, i) => (
              <div key={i} style={{ width: 16, height: 16, background: c, border: '1.5px solid #111', borderRadius: 4 }} />
            ))}
          </div>
        )}
      </div>

      {/* messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {msgs.length === 0 && (
          <div style={{ margin: 'auto', textAlign: 'center', maxWidth: 400 }}>
            <Avatar empKey={emp.key} size={100} />
            <h3 style={{ fontFamily: FONT.display, fontSize: 48, lineHeight: 1, margin: '16px 0 8px' }}>
              Say hi to {emp.name}
            </h3>
            <p style={{ fontFamily: FONT.body, fontSize: 15, color: '#555' }}>
              {emp.tag}. They already read your brand brief. Go.
            </p>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', justifyContent: m.who === 'me' ? 'flex-end' : 'flex-start', animation: 'pop 240ms cubic-bezier(.2,.9,.3,1.4)' }}>
            {m.who !== 'me' && <Avatar empKey={emp.key} size={32} />}
            <div style={{
              maxWidth: '70%', background: m.who === 'me' ? '#111' : emp.color,
              color: m.who === 'me' ? '#EFE7D6' : '#111', padding: '12px 16px',
              border: '2.5px solid #111',
              borderRadius: m.who === 'me' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              fontFamily: FONT.body, fontSize: 15, lineHeight: 1.4, boxShadow: '3px 3px 0 #111',
            }}>
              {m.text}
              <div style={{ fontFamily: FONT.mono, fontSize: 9, letterSpacing: 1, opacity: 0.6, marginTop: 6, textTransform: 'uppercase' }}>{m.t}</div>
            </div>
          </div>
        ))}
        {typing && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <Avatar empKey={emp.key} size={32} />
            <div style={{ background: emp.color, padding: '12px 16px', border: '2.5px solid #111', borderRadius: '16px 16px 16px 4px', boxShadow: '3px 3px 0 #111', display: 'flex', gap: 4 }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{ width: 7, height: 7, background: '#111', borderRadius: '50%', display: 'inline-block', animation: `bounce 1.2s ${i * 0.15}s infinite ease-in-out` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* quick prompts */}
      {msgs.length === 0 && (
        <div style={{ padding: '0 24px 12px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {(quickPrompts[emp.key] || []).map(p => (
            <button key={p} onClick={() => sendMsg(p)} style={{ background: '#fff', border: '2.5px solid #111', borderRadius: 999, padding: '8px 14px', fontFamily: FONT.body, fontSize: 13, cursor: 'pointer' }}>
              {p}
            </button>
          ))}
        </div>
      )}

      {/* input */}
      <div style={{ padding: '14px 20px', borderTop: '3px solid #111', background: '#EFE7D6', display: 'flex', gap: 10, alignItems: 'center' }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && input.trim()) sendMsg(input); }}
          placeholder={`Message ${emp.name}...`}
          style={{ flex: 1, border: '2.5px solid #111', borderRadius: 999, padding: '12px 18px', fontFamily: FONT.body, fontSize: 15, background: '#fff', outline: 'none' }} />
        <button onClick={() => input.trim() && sendMsg(input)} style={{
          background: '#111', color: '#EFE7D6', border: '2.5px solid #111', borderRadius: 999,
          padding: '12px 22px', fontFamily: FONT.head, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1,
          cursor: 'pointer', boxShadow: '3px 3px 0 #F06464',
        }}>Send →</button>
      </div>
    </section>
  );
}

export default function DashboardPage() {
  const [kit, setKit] = useState<BrandKit | null>(null);
  const [active, setActive] = useState('maya');
  const [convos, setConvos] = useState<Record<string, Message[]>>(() =>
    Object.fromEntries(EMPLOYEES.map(e => [e.key, []]))
  );
  const [unread] = useState<Record<string, number>>({});
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    try {
      const s = localStorage.getItem('veqiro.brandKit');
      if (s) setKit(JSON.parse(s));
    } catch { /* empty */ }
  }, []);

  // Load persisted convos
  useEffect(() => {
    try {
      const s = localStorage.getItem('veqiro.convos');
      if (s) setConvos(JSON.parse(s));
    } catch { /* empty */ }
  }, []);

  // Persist convos
  useEffect(() => {
    localStorage.setItem('veqiro.convos', JSON.stringify(convos));
  }, [convos]);

  // Seed intro messages
  useEffect(() => {
    setConvos(prev => {
      const next = { ...prev };
      EMPLOYEES.forEach(e => {
        if (!next[e.key] || next[e.key].length === 0) {
          next[e.key] = [{
            who: 'them',
            text: `Hey — ${e.name} here. I read ${kit?.company_name ? `the brief for ${kit.company_name}` : 'your brand brief'}. Ready when you are.`,
            t: 'now',
          }];
        }
      });
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emp = EMPLOYEES.find(e => e.key === active)!;

  const sendMsg = (text: string) => {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setInput('');
    setConvos(prev => ({ ...prev, [active]: [...(prev[active] || []), { who: 'me', text, t: now }] }));
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setConvos(prev => ({
        ...prev,
        [active]: [...(prev[active] || []), {
          who: 'them', text: replyFor(active, text, kit),
          t: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }],
      }));
    }, 900 + Math.random() * 800);
  };

  const lastMsgs = Object.fromEntries(
    Object.entries(convos).map(([k, arr]) => [k, arr[arr.length - 1]?.text?.slice(0, 60) || ''])
  );

  return (
    <div style={{ background: '#EFE7D6', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="noise-overlay" aria-hidden />
      <NavBar active="dashboard" />
      <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative', overflow: 'hidden', height: 'calc(100vh - 75px)' }}>
        {/* Sidebar */}
        <aside style={{ width: 320, borderRight: '3px solid #111', background: '#EFE7D6', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto' }}>
          <div style={{ padding: '20px 16px', borderBottom: '3px solid #111', background: '#111', color: '#EFE7D6' }}>
            <div style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#F5C518' }}>Brand brief active</div>
            <div style={{ fontFamily: FONT.head, fontSize: 18, marginTop: 4 }}>{kit?.company_name || 'Your Company'}</div>
            <div style={{ fontFamily: FONT.mono, fontSize: 11, opacity: 0.7, marginTop: 2 }}>
              {kit?.industry || 'industry'} · voice: {kit?.brand_voice || '—'}
            </div>
          </div>
          <div style={{ padding: '12px 16px', fontFamily: FONT.mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#555', borderBottom: '2px dashed #111' }}>
            Contacts · 6 crew
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {EMPLOYEES.map(e => (
              <ContactRow key={e.key} emp={e} active={active === e.key}
                unread={unread[e.key] || 0} lastMsg={lastMsgs[e.key]}
                onClick={() => setActive(e.key)} />
            ))}
          </div>
          <div style={{ padding: 12, borderTop: '3px solid #111', background: '#F5C518', display: 'grid', gap: 8 }}>
            <button onClick={() => setShowProfile(true)} style={{
              display: 'block', textAlign: 'center', background: '#fff', color: '#111',
              border: '2px solid #111', padding: '10px', cursor: 'pointer',
              fontFamily: FONT.head, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, borderRadius: 8, width: '100%',
            }}>◎ View profile</button>
            <Link href="/onboarding" style={{
              display: 'block', textAlign: 'center', textDecoration: 'none',
              background: '#111', color: '#F5C518', padding: '10px',
              fontFamily: FONT.head, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, borderRadius: 8,
            }}>Edit brand kit</Link>
          </div>
        </aside>

        {showProfile && <ProfileModal kit={kit} close={() => setShowProfile(false)} />}

        <ChatPane emp={emp} msgs={convos[active] || []} typing={typing}
          sendMsg={sendMsg} input={input} setInput={setInput} kit={kit} />
      </div>
    </div>
  );
}
