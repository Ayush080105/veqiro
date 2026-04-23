'use client';
import React, { useState, useEffect, useRef } from 'react';
import { FONT } from './shared';
import type { Employee, DemoChatMessage } from './data';

interface Props {
  employee: Employee;
}

interface DisplayMessage extends DemoChatMessage {
  id: number;
}

export function MobileChatDemo({ employee }: Props) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [done, setDone] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([]);
    setTyping(false);
    setDone(false);
    let cancelled = false;

    const run = async () => {
      for (let i = 0; i < employee.demoChat.length; i++) {
        const msg = employee.demoChat[i];
        await new Promise<void>(r => setTimeout(r, msg.delayMs));
        if (cancelled) return;
        if (msg.role === 'agent') {
          setTyping(true);
          await new Promise<void>(r => setTimeout(r, 900));
          if (cancelled) return;
          setTyping(false);
        }
        setMessages(prev => [...prev, { ...msg, id: i }]);
      }
      if (!cancelled) setDone(true);
    };

    run();
    return () => { cancelled = true; };
  }, [runKey, employee]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typing]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      {/* Phone frame */}
      <div style={{
        width: 300,
        height: 560,
        background: '#EFE7D6',
        borderRadius: 42,
        border: '3px solid #111',
        boxShadow: `8px 8px 0 ${employee.color}, 12px 12px 0 #111`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Status bar */}
        <div style={{
          padding: '14px 20px 8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
          background: '#EFE7D6',
        }}>
          <span style={{ color: '#111', fontFamily: FONT.mono, fontSize: 11, fontWeight: 600 }}>9:41</span>
          {/* Veqiro logo mark */}
          <div style={{
            width: 26, height: 26, background: '#111', borderRadius: 6,
            display: 'grid', placeItems: 'center', transform: 'rotate(-6deg)',
            boxShadow: '2px 2px 0 #F5C518', flexShrink: 0,
          }}>
            <span style={{ color: '#EFE7D6', fontFamily: FONT.display, fontSize: 15, lineHeight: 1 }}>v</span>
          </div>
          <span style={{ color: '#111', fontFamily: FONT.mono, fontSize: 11 }}>●●●</span>
        </div>

        {/* Chat header */}
        <div style={{
          padding: '6px 16px 12px',
          borderBottom: '2px solid #111',
          borderTop: '2px solid #111',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
        }}>
          <img
            src={`/${employee.name}.jpeg`}
            alt={employee.name}
            style={{
              width: 34, height: 34, borderRadius: '50%',
              border: '2px solid #111', objectFit: 'cover', flexShrink: 0,
            }}
          />
          <div>
            <div style={{ color: '#111', fontFamily: FONT.head, fontSize: 13, lineHeight: 1.2 }}>
              {employee.name}
            </div>
            <div style={{ color: '#1DBC87', fontFamily: FONT.mono, fontSize: 10 }}>● online</div>
          </div>
          <div style={{
            marginLeft: 'auto',
            fontFamily: FONT.mono, fontSize: 9, letterSpacing: 1,
            textTransform: 'uppercase', color: '#aaa',
          }}>
            veqiro
          </div>
        </div>

        {/* Messages area */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '14px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            scrollbarWidth: 'none',
            background: '#EFE7D6',
          }}
        >
          {messages.map(msg => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div style={{
                maxWidth: '80%',
                background: msg.role === 'user' ? employee.color : '#fff',
                color: '#111',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                padding: '9px 13px',
                fontFamily: FONT.body,
                fontSize: 12,
                lineHeight: 1.5,
                border: '2px solid #111',
                boxShadow: msg.role === 'agent' ? `2px 2px 0 ${employee.color}` : '2px 2px 0 #111',
              }}>
                {msg.content}
              </div>
            </div>
          ))}

          {typing && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{
                background: '#fff',
                borderRadius: '16px 16px 16px 4px',
                padding: '11px 16px',
                border: '2px solid #111',
                boxShadow: `2px 2px 0 ${employee.color}`,
                display: 'flex',
                gap: 5,
                alignItems: 'center',
              }}>
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: '#111',
                      animation: 'bounce 1s infinite',
                      animationDelay: `${i * 0.2}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Input bar */}
        <div style={{
          padding: '10px 12px',
          borderTop: '2px solid #111',
          background: '#fff',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          flexShrink: 0,
        }}>
          <div style={{
            flex: 1,
            background: '#EFE7D6',
            borderRadius: 999,
            padding: '9px 14px',
            color: '#888',
            fontFamily: FONT.body,
            fontSize: 12,
            border: '2px solid #111',
          }}>
            Message {employee.name}…
          </div>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: employee.color,
            border: '2px solid #111',
            boxShadow: '2px 2px 0 #111',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}>
            <span style={{ color: '#111', fontSize: 14, lineHeight: 1 }}>↑</span>
          </div>
        </div>
      </div>

      {/* Replay */}
      {done && (
        <button
          onClick={() => setRunKey(k => k + 1)}
          style={{
            background: 'transparent',
            border: '2px solid #111',
            borderRadius: 999,
            padding: '8px 20px',
            fontFamily: FONT.head,
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: 1,
            cursor: 'pointer',
            boxShadow: '3px 3px 0 #111',
          }}
        >
          ↺ Replay demo
        </button>
      )}
    </div>
  );
}
