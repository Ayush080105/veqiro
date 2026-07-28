import React from 'react';
import Link from 'next/link';
import { PageNav } from './page-nav';
import { Footer } from './sections';
import { consoleUrl, isPreLaunch, waitlistUrl } from '@/lib/site-config';

const F = {
  display: 'var(--font-bagel), cursive',
  head: 'var(--font-archivo), sans-serif',
  body: 'var(--font-space), sans-serif',
  mono: 'var(--font-mono), monospace',
};

type CellVal = '✅' | '❌' | 'Basic' | 'Limited';

interface Row {
  feature: string;
  v: CellVal;
  m: CellVal;
  s: CellVal;
}

interface Section {
  title: string;
  emoji: string;
  color: string;
  rows: Row[];
}

const SECTIONS: Section[] = [
  {
    title: 'Platform Overview',
    emoji: '⚙',
    color: '#111',
    rows: [
      { feature: 'Individual AI Employee Hiring', v: '✅', m: '❌', s: '✅' },
      { feature: 'Multiple AI Specialists in One Workspace', v: '✅', m: '✅', s: '✅' },
      { feature: 'Business Knowledge Base / Brand Context', v: '✅', m: '✅', s: '✅' },
      { feature: 'Personalized Brand Voice', v: '✅', m: '✅', s: '✅' },
      { feature: 'Business Integrations', v: '✅', m: '✅', s: '✅' },
    ],
  },
  {
    title: 'Executive Assistant',
    emoji: '📬',
    color: '#6FCDE8',
    rows: [
      { feature: 'Executive Assistant', v: '✅', m: '✅', s: '✅' },
      { feature: 'Smart Inbox Processing', v: '✅', m: '✅', s: '✅' },
      { feature: 'Email Drafting in Your Tone', v: '✅', m: '✅', s: '✅' },
      { feature: 'Email Composition', v: '✅', m: '✅', s: '✅' },
      { feature: 'Calendar Management', v: '✅', m: '✅', s: '✅' },
      { feature: 'Calendar Conflict Detection', v: '✅', m: 'Basic', s: 'Basic' },
      { feature: 'AI Event Creation', v: '✅', m: 'Basic', s: 'Basic' },
      { feature: 'Executive Daily Briefing', v: '✅', m: 'Basic', s: 'Basic' },
      { feature: 'VIP Contact Prioritization', v: '✅', m: 'Basic', s: '❌' },
      { feature: 'Smart Email Labels', v: '✅', m: 'Basic', s: '❌' },
      { feature: 'Auto Email Draft Queue', v: '✅', m: '❌', s: '❌' },
    ],
  },
  {
    title: 'Research & Intelligence',
    emoji: '🔍',
    color: '#F5C518',
    rows: [
      { feature: 'AI Research & Competitor Intelligence', v: '✅', m: '❌', s: 'Limited' },
      { feature: 'Topic Research with Live Sources', v: '✅', m: '❌', s: 'Basic' },
      { feature: 'Company Research', v: '✅', m: '❌', s: 'Basic' },
      { feature: 'Competitor Research', v: '✅', m: 'Limited', s: 'Limited' },
      { feature: 'Auto Competitor Discovery', v: '✅', m: '❌', s: '❌' },
      { feature: 'Competitor Watchlist', v: '✅', m: '❌', s: '❌' },
      { feature: 'Trending Topics Discovery', v: '✅', m: 'Basic', s: 'Basic' },
    ],
  },
  {
    title: 'SEO',
    emoji: '📈',
    color: '#1DBC87',
    rows: [
      { feature: 'AI SEO Specialist', v: '✅', m: '✅', s: '✅' },
      { feature: 'Keyword Research', v: '✅', m: 'Basic', s: '✅' },
      { feature: 'Blog Generation', v: '✅', m: '✅', s: '✅' },
      { feature: 'SEO Page Audit', v: '✅', m: '❌', s: 'Limited' },
      { feature: 'Website SEO Audit', v: '✅', m: '❌', s: '❌' },
      { feature: 'Content Analysis & Page Scoring', v: '✅', m: '❌', s: 'Limited' },
      { feature: 'Content Brief Generator', v: '✅', m: '❌', s: 'Basic' },
      { feature: 'Blog Ideas & Keyword Saving', v: '✅', m: '❌', s: 'Basic' },
    ],
  },
  {
    title: 'Content & Marketing',
    emoji: '✍',
    color: '#F79FD4',
    rows: [
      { feature: 'AI Marketing / Social Media Manager', v: '✅', m: '✅', s: '✅' },
      { feature: 'Full Content Drafting', v: '✅', m: '✅', s: '✅' },
      { feature: 'Direct Social Publishing', v: '✅', m: '✅', s: '✅' },
      { feature: 'Cross Platform Content Variants', v: '✅', m: 'Basic', s: 'Basic' },
      { feature: 'AI Image Generation', v: '✅', m: 'Basic', s: 'Basic' },
      { feature: 'AI Image Regeneration', v: '✅', m: '❌', s: '❌' },
      { feature: 'Product Campaign Creator', v: '✅', m: '❌', s: 'Limited' },
      { feature: 'Carousel Post Generator', v: '✅', m: '❌', s: 'Limited' },
      { feature: 'Video & Reel Generation', v: '✅', m: '❌', s: '❌' },
    ],
  },
  {
    title: 'Legal (Lex)',
    emoji: '⚖',
    color: '#8A8AF0',
    rows: [
      { feature: 'AI Legal Assistant', v: '✅', m: '✅', s: '❌' },
      { feature: 'Contract Analysis', v: '✅', m: '✅', s: '❌' },
      { feature: 'Contract Q&A', v: '✅', m: 'Limited', s: '❌' },
      { feature: 'Plain English Legal Explanation', v: '✅', m: 'Basic', s: '❌' },
      { feature: 'Legal Compliance Research', v: '✅', m: 'Limited', s: '❌' },
      { feature: 'Legal Document Drafting', v: '✅', m: '✅', s: '❌' },
      { feature: 'Letterhead Stamping on PDFs', v: '✅', m: '❌', s: '❌' },
      { feature: 'Document Library & Search', v: '✅', m: 'Basic', s: '❌' },
    ],
  },
  {
    title: 'Finance (Rex)',
    emoji: '💹',
    color: '#F06464',
    rows: [
      { feature: 'Financial Analyst / AI CFO', v: '✅', m: '❌', s: '✅' },
      { feature: 'Revenue Forecasting', v: '✅', m: '❌', s: '❌' },
      { feature: 'Financial KPI Dashboard', v: '✅', m: '❌', s: '❌' },
      { feature: 'Runway & Unit Economics', v: '✅', m: '❌', s: '❌' },
      { feature: 'Scenario Modeling', v: '✅', m: '❌', s: '❌' },
      { feature: 'Investor Updates', v: '✅', m: '❌', s: '❌' },
      { feature: 'Board Deck Generation', v: '✅', m: '❌', s: '❌' },
      { feature: 'Weekly Business Digest', v: '✅', m: '❌', s: '❌' },
      { feature: 'Upload CSV / Excel & Ask Questions', v: '✅', m: '❌', s: 'Limited' },
      { feature: 'AI Report Generation from Data', v: '✅', m: '❌', s: 'Limited' },
    ],
  },
];

function CellContent({ val }: { val: CellVal }) {
  if (val === '✅') {
    return (
      <span
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 28, height: 28, borderRadius: '50%',
          background: '#1DBC87', border: '2px solid #111',
          color: '#fff', fontSize: 14, fontWeight: 900, flexShrink: 0,
        }}
      >
        ✓
      </span>
    );
  }
  if (val === '❌') {
    return (
      <span
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 28, height: 28, borderRadius: '50%',
          background: '#F5F0E8', border: '2px solid #ddd',
          color: '#bbb', fontSize: 14,
        }}
      >
        ✕
      </span>
    );
  }
  if (val === 'Basic') {
    return (
      <span
        style={{
          display: 'inline-block',
          background: '#FEF3C7', color: '#92400E',
          border: '1.5px solid #D97706',
          borderRadius: 999, padding: '3px 10px',
          fontFamily: F.mono, fontSize: 10,
          letterSpacing: 1, textTransform: 'uppercase',
        }}
      >
        Basic
      </span>
    );
  }
  return (
    <span
      style={{
        display: 'inline-block',
        background: '#F3F4F6', color: '#666',
        border: '1.5px solid #ccc',
        borderRadius: 999, padding: '3px 10px',
        fontFamily: F.mono, fontSize: 10,
        letterSpacing: 1, textTransform: 'uppercase',
      }}
    >
      Limited
    </span>
  );
}

const EXCLUSIVES = [
  'Auto Email Draft Queue',
  'Auto Competitor Discovery',
  'Competitor Watchlist',
  'Website SEO Audit',
  'AI Image Regeneration',
  'Revenue Forecasting',
  'Financial KPI Dashboard',
  'Runway & Unit Economics',
  'Scenario Modeling',
  'Investor Updates',
  'Board Deck Generation',
  'Weekly Business Digest',
  'Video & Reel Generation',
];

const EXCLUSIVE_COLORS = [
  '#6FCDE8', '#F5C518', '#F5C518', '#1DBC87',
  '#F79FD4', '#F06464', '#F06464', '#F06464',
  '#F06464', '#F06464', '#F06464', '#F06464',
  '#F79FD4',
];

const VERDICTS = [
  {
    name: 'Veqiro',
    tag: '★ Per-Agent Pricing',
    tagColor: '#F5C518',
    highlight: true,
    color: '#F5C518',
    position: 'The all-in-one AI workforce for lean teams and founders.',
    price: 'From $9/mo',
    priceNote: 'per agent, no bundle',
    coverage: { count: '6 specialists', roles: 'EA · Research · SEO · Content · Legal · Finance' },
    ideal: 'Founders & lean startups needing full coverage',
  },
  {
    name: 'Marblism',
    tag: 'Lead Gen + Phone',
    tagColor: '#EEE',
    highlight: false,
    color: '#aaa',
    position: '6 employees incl. lead generation and a 24/7 phone receptionist. No finance or research agent.',
    price: '$44/mo',
    priceNote: 'monthly · all 6 included',
    coverage: { count: '6 employees (YC W24)', roles: 'EA · Lead Gen · SEO · Social · Legal · Phone' },
    ideal: 'Teams mainly needing lead gen + phone coverage',
  },
  {
    name: 'Sintra',
    tag: 'Widest Breadth',
    tagColor: '#EEE',
    highlight: false,
    color: '#aaa',
    position: 'Widest breadth — 12 helpers covering sales, support, recruiting, and eCommerce. No dedicated legal or CFO agent.',
    price: '$97/mo',
    priceNote: 'monthly · all 12 included',
    coverage: { count: '12 helpers', roles: 'Sales · Support · Social · Recruiting · eCommerce + more' },
    ideal: 'Solopreneurs wanting the widest range of AI helpers',
  },
];

export function ComparePageContent() {
  return (
    <div style={{ background: '#EFE7D6', minHeight: '100vh' }}>
      <PageNav />

      {/* ── HERO ── */}
      <section
        className="vq-section-pad"
        style={{ background: '#111', borderBottom: '3px solid #111', textAlign: 'center' }}
      >
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <div
            style={{
              fontFamily: F.mono, fontSize: 13, letterSpacing: 3,
              textTransform: 'uppercase', color: '#F5C518', marginBottom: 20,
            }}
          >
            [ COMPARE ]
          </div>
          <h1
            style={{
              fontFamily: F.display,
              fontSize: 'clamp(52px, 9vw, 120px)',
              lineHeight: 0.88,
              color: '#EFE7D6',
              margin: '0 0 28px',
              letterSpacing: -2,
            }}
          >
            the honest<br />
            <span style={{ color: '#F5C518' }}>comparison.</span>
          </h1>
          <p
            style={{
              fontFamily: F.body, fontSize: 'clamp(15px, 2vw, 18px)',
              color: '#888', maxWidth: 560, margin: '0 auto 36px', lineHeight: 1.65,
            }}
          >
            No spin. No cherry-picked stats. Three AI employee platforms, compared honestly across 7 business categories.
          </p>

          {/* stat strip */}
          <div
            style={{
              display: 'flex', gap: 'clamp(20px, 4vw, 48px)',
              justifyContent: 'center', flexWrap: 'wrap',
            }}
          >
            {[
              { v: '7', k: 'categories' },
              { v: '3', k: 'platforms' },
              { v: 'June 2026', k: 'updated' },
            ].map(s => (
              <div key={s.k} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: F.display, fontSize: 'clamp(32px, 5vw, 48px)', color: '#F5C518', lineHeight: 1 }}>{s.v}</div>
                <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#555', marginTop: 5 }}>{s.k}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── VERDICT CARDS ── */}
      <section
        className="vq-section-pad"
        style={{ borderBottom: '3px solid #111', background: '#FFF9ED' }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ marginBottom: 48, textAlign: 'center' }}>
            <div style={{ fontFamily: F.mono, fontSize: 13, letterSpacing: 3, textTransform: 'uppercase', color: '#888', marginBottom: 14 }}>
              [ QUICK VERDICT ]
            </div>
            <h2
              style={{
                fontFamily: F.display,
                fontSize: 'clamp(34px, 5vw, 60px)',
                margin: 0, lineHeight: 0.95,
              }}
            >
              what each one<br />
              <span
                style={{
                  background: '#F06464', padding: '0 14px',
                  display: 'inline-block', border: '3px solid #111',
                  borderRadius: 8, boxShadow: '4px 4px 0 #111',
                  transform: 'rotate(-1deg)',
                }}
              >
                actually is.
              </span>
            </h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 24,
            }}
          >
            {VERDICTS.map((p) => (
              <div
                key={p.name}
                style={{
                  border: `3px solid #111`,
                  borderRadius: 16,
                  overflow: 'hidden',
                  boxShadow: p.highlight ? '8px 8px 0 #111' : '4px 4px 0 #ccc',
                  transform: p.highlight ? 'translateY(-6px)' : 'none',
                  background: p.highlight ? '#111' : '#EFE7D6',
                  transition: 'transform 180ms',
                }}
              >
                {/* Header */}
                <div
                  style={{
                    padding: '20px 24px',
                    borderBottom: '3px solid #111',
                    background: p.highlight ? '#1a1a1a' : '#F5F0E8',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontFamily: F.display, fontSize: 32, color: p.highlight ? '#EFE7D6' : '#111' }}>
                    {p.name}
                  </span>
                  <span
                    style={{
                      fontFamily: F.mono, fontSize: 10, letterSpacing: 1.5,
                      textTransform: 'uppercase', padding: '4px 12px', borderRadius: 999,
                      background: p.tagColor, color: '#111', border: '2px solid #111',
                    }}
                  >
                    {p.tag}
                  </span>
                </div>

                {/* Coverage */}
                <div
                  style={{
                    padding: '20px 24px',
                    borderBottom: '3px solid #111',
                    background: p.highlight ? '#F5C518' : '#EFE7D6',
                  }}
                >
                  <div style={{ fontFamily: F.mono, fontSize: 13, fontWeight: 700, color: '#111', letterSpacing: 0.5, marginBottom: 8 }}>
                    {p.coverage.count}
                  </div>
                  <div style={{ fontFamily: F.body, fontSize: 12, color: p.highlight ? '#333' : '#555', lineHeight: 1.6 }}>
                    {p.coverage.roles}
                  </div>
                </div>

                {/* Body */}
                <div style={{ padding: '20px 24px', borderBottom: '3px solid #111' }}>
                  <p
                    style={{
                      fontFamily: F.body, fontSize: 14, lineHeight: 1.65,
                      color: p.highlight ? '#aaa' : '#555', margin: 0,
                    }}
                  >
                    {p.position}
                  </p>
                </div>

                {/* Price + ideal */}
                <div style={{ padding: '16px 24px' }}>
                  <div style={{ fontFamily: F.display, fontSize: 28, color: p.highlight ? '#F5C518' : '#111', lineHeight: 1 }}>
                    {p.price}
                  </div>
                  <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 1, color: p.highlight ? '#555' : '#888', textTransform: 'uppercase', marginTop: 4, marginBottom: 12 }}>
                    {p.priceNote}
                  </div>
                  <div style={{ fontFamily: F.body, fontSize: 12, color: p.highlight ? '#666' : '#888', lineHeight: 1.5 }}>
                    Best for: {p.ideal}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── THE BIG TABLE ── */}
      <section className="vq-section-pad" style={{ borderBottom: '3px solid #111' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ marginBottom: 40 }}>
            <div style={{ fontFamily: F.mono, fontSize: 13, letterSpacing: 3, textTransform: 'uppercase', color: '#888', marginBottom: 14 }}>
              [ FULL BREAKDOWN ]
            </div>
            <h2 style={{ fontFamily: F.display, fontSize: 'clamp(34px, 5vw, 60px)', margin: 0, lineHeight: 0.95 }}>
              feature by<br />feature.
            </h2>
          </div>

          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', borderRadius: 16, border: '3px solid #111', boxShadow: '6px 6px 0 #111' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 640 }}>
              <thead>
                <tr>
                  <th
                    style={{
                      background: '#111', color: '#EFE7D6',
                      fontFamily: F.mono, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase',
                      padding: '16px 20px', textAlign: 'left', position: 'sticky', top: 0,
                      whiteSpace: 'nowrap', minWidth: 220, zIndex: 10,
                      borderRight: '2px solid #222',
                    }}
                  >
                    Feature
                  </th>
                  {[
                    { name: 'Veqiro', badge: '★', bg: '#F5C518', ink: '#111' },
                    { name: 'Marblism', badge: '', bg: '#333', ink: '#EFE7D6' },
                    { name: 'Sintra', badge: '', bg: '#333', ink: '#EFE7D6' },
                  ].map(col => (
                    <th
                      key={col.name}
                      style={{
                        background: col.bg, color: col.ink,
                        fontFamily: F.head, fontSize: 14, letterSpacing: 1, textTransform: 'uppercase',
                        padding: '16px 20px', textAlign: 'center',
                        position: 'sticky', top: 0, whiteSpace: 'nowrap',
                        zIndex: 10, borderRight: '2px solid rgba(0,0,0,0.15)',
                        minWidth: 130,
                      }}
                    >
                      {col.badge && (
                        <span style={{ marginRight: 6 }}>{col.badge}</span>
                      )}
                      {col.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SECTIONS.map((section, si) => (
                  <React.Fragment key={section.title}>
                    {/* Section header row */}
                    <tr>
                      <td
                        colSpan={4}
                        style={{
                          background: section.color,
                          color: section.color === '#111' ? '#EFE7D6' : '#111',
                          fontFamily: F.head, fontSize: 12, letterSpacing: 2,
                          textTransform: 'uppercase', padding: '10px 20px',
                          borderTop: si > 0 ? '3px solid #111' : undefined,
                        }}
                      >
                        <span style={{ marginRight: 8 }}>{section.emoji}</span>
                        {section.title}
                      </td>
                    </tr>

                    {/* Data rows */}
                    {section.rows.map((row, ri) => {
                      const even = ri % 2 === 0;
                      return (
                        <tr key={row.feature}>
                          <td
                            style={{
                              padding: '14px 20px',
                              fontFamily: F.body, fontSize: 14, color: '#111',
                              background: even ? '#FFF9ED' : '#EFE7D6',
                              borderRight: '2px solid #111',
                              borderTop: '1px solid rgba(17,17,17,0.08)',
                            }}
                          >
                            {row.feature}
                          </td>
                          <td
                            style={{
                              padding: '14px 20px', textAlign: 'center',
                              background: even ? '#FEF9E7' : '#FEFCE8',
                              borderRight: '2px solid rgba(17,17,17,0.1)',
                              borderTop: '1px solid rgba(17,17,17,0.08)',
                            }}
                          >
                            <CellContent val={row.v} />
                          </td>
                          <td
                            style={{
                              padding: '14px 20px', textAlign: 'center',
                              background: even ? '#F9F9F9' : '#F3F3F3',
                              borderRight: '2px solid rgba(17,17,17,0.1)',
                              borderTop: '1px solid rgba(17,17,17,0.08)',
                            }}
                          >
                            <CellContent val={row.m} />
                          </td>
                          <td
                            style={{
                              padding: '14px 20px', textAlign: 'center',
                              background: even ? '#F9F9F9' : '#F3F3F3',
                              borderTop: '1px solid rgba(17,17,17,0.08)',
                            }}
                          >
                            <CellContent val={row.s} />
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <p
            style={{
              fontFamily: F.mono, fontSize: 11, letterSpacing: 1,
              color: '#999', marginTop: 16, textAlign: 'center',
              textTransform: 'uppercase',
            }}
          >
            Based on publicly available information · Updated June 2026
          </p>
        </div>
      </section>

      {/* ── VEQIRO EXCLUSIVES ── */}
      <section
        className="vq-section-pad"
        style={{ background: '#111', borderBottom: '3px solid #111' }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ marginBottom: 48, textAlign: 'center' }}>
            <div style={{ fontFamily: F.mono, fontSize: 13, letterSpacing: 3, textTransform: 'uppercase', color: '#F5C518', marginBottom: 14 }}>
              [ ONLY IN VEQIRO ]
            </div>
            <h2
              style={{
                fontFamily: F.display,
                fontSize: 'clamp(34px, 5vw, 60px)',
                color: '#EFE7D6', margin: 0, lineHeight: 0.95,
              }}
            >
              {EXCLUSIVES.length} features<br />
              <span style={{ color: '#F5C518' }}>nobody else has.</span>
            </h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 14,
            }}
          >
            {EXCLUSIVES.map((f, i) => (
              <div
                key={f}
                style={{
                  border: '2.5px solid #333',
                  borderRadius: 12, padding: '16px 18px',
                  background: '#1a1a1a',
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  transform: `rotate(${i % 3 === 0 ? -0.4 : i % 3 === 1 ? 0.3 : -0.2}deg)`,
                }}
              >
                <span
                  style={{
                    width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                    background: EXCLUSIVE_COLORS[i], border: '2px solid #555', marginTop: 3,
                  }}
                />
                <span style={{ fontFamily: F.body, fontSize: 13, color: '#EFE7D6', lineHeight: 1.4 }}>
                  {f}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING COMPARISON ── */}
      <section className="vq-section-pad" style={{ background: '#FFF9ED', borderBottom: '3px solid #111' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ marginBottom: 48, textAlign: 'center' }}>
            <div style={{ fontFamily: F.mono, fontSize: 13, letterSpacing: 3, textTransform: 'uppercase', color: '#888', marginBottom: 14 }}>
              [ PRICING ]
            </div>
            <h2 style={{ fontFamily: F.display, fontSize: 'clamp(34px, 5vw, 60px)', margin: 0, lineHeight: 0.95 }}>
              no bundle.<br />
              <span
                style={{
                  background: '#F5C518', padding: '0 14px',
                  display: 'inline-block', border: '3px solid #111',
                  borderRadius: 8, boxShadow: '4px 4px 0 #111',
                }}
              >
                six employees.
              </span>
            </h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 20,
            }}
          >
            {[
              {
                name: 'Veqiro',
                price: '$9',
                period: '/mo',
                note: 'per agent, billed independently',
                highlight: true,
                what: 'Every AI employee billed on its own, starting at $9/mo — no bundle, no per-seat nonsense.',
                color: '#F5C518',
              },
              {
                name: 'Marblism',
                price: '$44',
                period: '/mo',
                note: 'monthly · all 6 included',
                highlight: false,
                what: '6 AI employees all included in one flat plan. Lead gen and phone receptionist built in. $24/mo if billed annually.',
                color: '#aaa',
              },
              {
                name: 'Sintra',
                price: '$97',
                period: '/mo',
                note: 'monthly · all 12 included',
                highlight: false,
                what: '12 AI helpers all included in one flat plan. Sales, support, social, recruiting + more. $52/mo if billed annually.',
                color: '#aaa',
              },
            ].map(p => (
              <div
                key={p.name}
                style={{
                  border: '3px solid #111',
                  borderRadius: 14, overflow: 'hidden',
                  boxShadow: p.highlight ? '8px 8px 0 #111' : '4px 4px 0 #ccc',
                  transform: p.highlight ? 'translateY(-4px)' : 'none',
                }}
              >
                <div
                  style={{
                    padding: '18px 24px',
                    background: p.highlight ? '#111' : '#EFE7D6',
                    borderBottom: '3px solid #111',
                  }}
                >
                  <div style={{ fontFamily: F.head, fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', color: p.highlight ? '#888' : '#555' }}>
                    {p.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 6 }}>
                    <span style={{ fontFamily: F.display, fontSize: 'clamp(36px, 6vw, 52px)', color: p.highlight ? p.color : '#111', lineHeight: 1 }}>
                      {p.price}
                    </span>
                    <span style={{ fontFamily: F.body, fontSize: 16, color: p.highlight ? '#555' : '#888' }}>
                      {p.period}
                    </span>
                  </div>
                  <div style={{ fontFamily: F.mono, fontSize: 11, color: p.highlight ? '#555' : '#888', letterSpacing: 1, textTransform: 'uppercase', marginTop: 4 }}>
                    {p.note}
                  </div>
                </div>
                <div style={{ padding: '18px 24px', background: '#fff' }}>
                  <p style={{ fontFamily: F.body, fontSize: 14, color: '#444', lineHeight: 1.6, margin: 0 }}>
                    {p.what}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section
        className="vq-section-pad"
        style={{ background: '#111', textAlign: 'center' }}
      >
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <h2
            style={{
              fontFamily: F.display,
              fontSize: 'clamp(44px, 7vw, 96px)',
              color: '#EFE7D6', margin: '0 0 16px', lineHeight: 0.9,
            }}
          >
            made up<br />
            <span style={{ color: '#F5C518' }}>your mind?</span>
          </h2>
          <p
            style={{
              fontFamily: F.body, fontSize: 17,
              color: '#777', margin: '0 0 36px', lineHeight: 1.6,
            }}
          >
            6 AI employees, billed independently, starting at $9/mo.<br />7-day free trial. No credit card.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href={isPreLaunch ? waitlistUrl : `${consoleUrl}/signup`}
              style={{
                display: 'inline-block', background: '#F5C518', color: '#111',
                border: '3px solid #F5C518', borderRadius: 12,
                padding: '16px 36px', fontFamily: F.head,
                fontSize: 14, letterSpacing: 1, textTransform: 'uppercase',
                textDecoration: 'none', boxShadow: '5px 5px 0 #b89400',
              }}
            >
              {isPreLaunch ? 'Join the waitlist →' : 'Start free — 7 days on us →'}
            </a>
            <Link
              href="/pricing"
              style={{
                display: 'inline-block', background: 'transparent', color: '#EFE7D6',
                border: '3px solid #333', borderRadius: 12,
                padding: '16px 36px', fontFamily: F.head,
                fontSize: 14, letterSpacing: 1, textTransform: 'uppercase',
                textDecoration: 'none',
              }}
            >
              See pricing →
            </Link>
          </div>
          <p style={{ fontFamily: F.mono, fontSize: 11, color: '#444', marginTop: 20, letterSpacing: 1, textTransform: 'uppercase' }}>
            Also read: <Link href="/blog/veqiro-vs-sintra-vs-marblism" style={{ color: '#F5C518', textDecoration: 'underline', textDecorationColor: '#F5C518' }}>the full written comparison →</Link>
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
