'use client';
import { useMemo } from 'react';
import { T, SectionHead } from './shared';
import { ToolIcon } from './tool-logo';
import { getAllTools } from './native-tools';
import { PromptComposer } from './prompt-composer';

type Tool = ReturnType<typeof getAllTools>[number];

/** Split the catalogue into N visually balanced rows. */
function intoRows(tools: Tool[], rows: number): Tool[][] {
  const out: Tool[][] = Array.from({ length: rows }, () => []);
  tools.forEach((tool, i) => out[i % rows].push(tool));
  return out;
}

/**
 * A drifting row of app icons. The track holds two copies of the row so the
 * -50% translation loops seamlessly; direction alternates per row.
 */
function IconRow({ tools, reverse, duration }: { tools: Tool[]; reverse?: boolean; duration: number }) {
  const doubled = [...tools, ...tools];
  return (
    <div style={{ overflow: 'hidden', padding: '5px 0' }}>
      <div
        className="vq-icon-track"
        style={{
          display: 'flex',
          gap: 'clamp(10px, 1.4vw, 16px)',
          width: 'max-content',
          animation: `vq-drift-${reverse ? 'rev' : 'fwd'} ${duration}s linear infinite`,
        }}
      >
        {doubled.map((tool, i) => (
          <ToolIcon key={`${tool.slug}-${i}`} name={tool.name} logoUrl={tool.logoUrl} />
        ))}
      </div>
    </div>
  );
}

export function IntegrationsSection() {
  const allTools = useMemo(() => getAllTools(), []);
  const toolCount = allTools.length;
  const rows = useMemo(() => intoRows(allTools, 3), [allTools]);

  return (
    <section id="integrations" className="vq-section-pad" style={{ background: T.bg }}>
      <style>{`
        @keyframes vq-drift-fwd { from { transform: translateX(0); }      to { transform: translateX(-50%); } }
        @keyframes vq-drift-rev { from { transform: translateX(-50%); }   to { transform: translateX(0); } }
        .vq-icon-field:hover .vq-icon-track { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) {
          .vq-icon-track { animation: none !important; }
        }
      `}</style>

      <div className="vq-shell">
        <SectionHead
          center
          eyebrow="Integrations"
          title={<>They work inside the tools you already pay for</>}
          lede={
            <>
              {toolCount} integrations out of the box — mail, calendars, CRM, analytics,
              billing, docs, and databases. Connect once with OAuth; every agent that needs
              a tool can reach it. No middleware, no custom build.
            </>
          }
        />
      </div>

      {/* Drifting icon field, faded at both edges so it reads as "and many more" */}
      <div
        className="vq-icon-field"
        aria-hidden
        style={{
          marginTop: 'clamp(40px, 6vw, 64px)',
          display: 'grid',
          gap: 'clamp(10px, 1.4vw, 16px)',
          maskImage: 'linear-gradient(to right, transparent, #000 14%, #000 86%, transparent)',
          WebkitMaskImage: 'linear-gradient(to right, transparent, #000 14%, #000 86%, transparent)',
        }}
      >
        <IconRow tools={rows[0]} duration={64} />
        <IconRow tools={rows[1]} duration={78} reverse />
        <IconRow tools={rows[2]} duration={70} />
      </div>

      {/* Example delegations — cycles one real prompt per agent */}
      <div className="vq-shell" style={{ marginTop: 'clamp(36px, 5vw, 56px)' }}>
        <PromptComposer />
      </div>
    </section>
  );
}
