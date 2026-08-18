'use client';
import type { CSSProperties } from 'react';
import { FONT } from './shared';
import { ToolChip } from './tool-logo';
import { getIntegrationCategories, type AgentSlug } from '@repo/integrations-catalog';
import { getAllTools } from './native-tools';
import { EMPLOYEES } from './data';

const AGENT_COLOR: Record<string, string> = Object.fromEntries(EMPLOYEES.map(e => [e.key, e.color]));

// Social Media leads the list — everything else keeps the catalog's order.
function orderCategories(categories: string[]): string[] {
  return [
    'Social Media',
    ...categories.filter(c => c !== 'Social Media'),
  ];
}

export function IntegrationsSection() {
  const allTools = getAllTools();
  const toolCount = allTools.length;

  const categories = orderCategories(getIntegrationCategories());
  const groups = categories.map(category => {
    const tools = allTools.filter(t => t.category === category);
    return { category, tools, accent: AGENT_COLOR[tools[0]?.primaryAgent as AgentSlug] ?? '#111' };
  });

  return (
    <section id="integrations" className="vq-section-pad" style={{ background: '#EFE7D6', borderTop: '3px solid #111' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 'clamp(40px, 6vw, 64px)' }}>
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

        <div className="vq-timeline">
          {groups.map((group, i) => {
            const side = i % 2 === 0 ? 'left' : 'right';
            return (
              <div key={group.category} className={`vq-timeline-row ${side}`}>
                <div className="vq-timeline-node" style={{ '--accent': group.accent } as CSSProperties} />
                <div className="vq-timeline-content">
                  <div className="vq-category-pill" style={{ '--accent': group.accent } as CSSProperties}>
                    {group.category}
                  </div>
                  <div className="vq-chip-row">
                    {group.tools.map(tool => (
                      <ToolChip key={tool.slug} name={tool.name} logoUrl={tool.logoUrl} accent={group.accent} />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
