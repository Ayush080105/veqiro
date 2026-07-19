'use client';
import { FONT } from './shared';
import { Marquee } from './hero';
import { integrationNames } from '@/lib/site-config';

export function IntegrationsSection() {
  return (
    <section id="integrations" className="vq-section-pad" style={{ background: '#EFE7D6', borderTop: '3px solid #111' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 'clamp(32px, 5vw, 48px)' }}>
          <div style={{ fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12, color: '#666' }}>
            [ INTEGRATIONS ]
          </div>
          <h2 style={{ fontFamily: FONT.display, fontSize: 'clamp(48px, 7vw, 96px)', margin: 0, lineHeight: 0.9, letterSpacing: -1 }}>
            1000+ tools your<br />
            <span style={{ background: '#1DBC87', padding: '0 16px', display: 'inline-block', transform: 'rotate(-2deg)', border: '3px solid #111', borderRadius: 8, boxShadow: '4px 4px 0 #111' }}>
              crew already speaks.
            </span>
          </h2>
          <p style={{ fontFamily: FONT.body, fontSize: 'clamp(15px, 2.2vw, 18px)', marginTop: 24, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto', color: '#333' }}>
            Gmail, Slack, Stripe, Notion, Postgres — if your team already uses it, your agents can connect to it. No custom integration work, no waiting on a roadmap.
          </p>
        </div>
      </div>
      <div style={{ marginTop: 8 }}>
        <Marquee items={integrationNames} bg="#111" color="#F5C518" speed={55} />
      </div>
    </section>
  );
}
