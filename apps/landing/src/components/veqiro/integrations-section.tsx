'use client';
import { FONT } from './shared';
import { ToolTile } from './tool-logo';
import { INTEGRATIONS_CATALOG } from '@repo/integrations-catalog';
import { NATIVE_TOOLS } from './native-tools';

export function IntegrationsSection() {
  const allTools = [...INTEGRATIONS_CATALOG, ...NATIVE_TOOLS];
  const toolCount = allTools.length;

  return (
    <section id="integrations" className="vq-section-pad" style={{ background: '#EFE7D6', borderTop: '3px solid #111' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 'clamp(32px, 5vw, 48px)' }}>
          <div style={{ fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12, color: '#666' }}>
            [ INTEGRATIONS ]
          </div>
          <h2 style={{ fontFamily: FONT.display, fontSize: 'clamp(48px, 7vw, 96px)', margin: 0, lineHeight: 0.9, letterSpacing: -1 }}>
            {toolCount}+ tools your<br />
            <span style={{ background: '#1DBC87', padding: '0 16px', display: 'inline-block', transform: 'rotate(-2deg)', border: '3px solid #111', borderRadius: 8, boxShadow: '4px 4px 0 #111' }}>
              crew already speaks.
            </span>
          </h2>
          <p style={{ fontFamily: FONT.body, fontSize: 'clamp(15px, 2.2vw, 18px)', marginTop: 24, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto', color: '#333' }}>
            Gmail, Slack, Stripe, Notion, Postgres — if your team already uses it, your agents can connect to it. No custom integration work, no waiting on a roadmap.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))',
            gap: 'clamp(16px, 2.5vw, 28px) clamp(12px, 2vw, 20px)',
            justifyItems: 'center',
          }}
        >
          {allTools.map(tool => (
            <ToolTile key={tool.slug} name={tool.name} logoUrl={tool.logoUrl} size={80} />
          ))}
        </div>
      </div>
    </section>
  );
}
