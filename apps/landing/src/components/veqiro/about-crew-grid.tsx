'use client';
import React from 'react';
import Link from 'next/link';
import { FONT } from './shared';
import { EMPLOYEES } from './data';
import { CHARACTER_COMPONENTS } from './characters';

export function AboutCrewGrid() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 20 }}>
      {EMPLOYEES.map(emp => {
        const Comp = CHARACTER_COMPONENTS[emp.key];
        return (
          <Link key={emp.key} href={`/agents/${emp.key}`} style={{ textDecoration: 'none' }}>
            <div
              className="crew-card"
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.boxShadow = `6px 10px 0 ${emp.color}`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.boxShadow = '5px 5px 0 #111';
              }}
            >
              <div style={{ aspectRatio: '1/1', overflow: 'hidden', background: emp.color }}>
                <Comp size="100%" />
              </div>
              <div style={{ padding: '14px 16px' }}>
                <div style={{ fontFamily: FONT.display, fontSize: 26, color: '#111', lineHeight: 1 }}>
                  {emp.name}
                </div>
                <div style={{
                  fontFamily: FONT.mono, fontSize: 10, letterSpacing: 2,
                  textTransform: 'uppercase', color: '#888', marginTop: 5,
                }}>
                  {emp.role}
                </div>
                <div style={{ fontFamily: FONT.mono, fontSize: 10, color: emp.ink, marginTop: 10 }}>
                  Meet {emp.name} →
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
