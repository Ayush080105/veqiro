import Link from 'next/link';
import type { AgentKey } from '@/lib/blog';
import { T } from './tokens';

const AGENT_DATA: Record<AgentKey, { name: string; tag: string; color: string }> = {
  vega:  { name: 'Vega',  tag: 'AI Executive Assistant',   color: T.violet },
  scout: { name: 'Scout', tag: 'AI Research Specialist',   color: T.amber },
  maya:  { name: 'Maya',  tag: 'AI Content & Marketing',   color: T.pink },
  sage:  { name: 'Sage',  tag: 'AI SEO Specialist',        color: T.green },
  lex:   { name: 'Lex',   tag: 'AI Legal Assistant',       color: T.blue },
  rex:   { name: 'Rex',   tag: 'AI Financial Analyst',     color: T.red },
};

export function BlogAgentCta({ agentKey }: { agentKey: AgentKey }) {
  const agent = AGENT_DATA[agentKey];
  return (
    <aside
      style={{
        margin: '3em 0',
        background: agent.color,
        border: `1px solid ${T.line}`,
        borderRadius: 16,
        padding: '28px 32px',
        boxShadow: T.shadow,
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 20,
        alignItems: 'center',
      }}
    >
      <div>
        <p
          style={{
            fontFamily: 'var(--font-mono), monospace',
            fontSize: 10,
            letterSpacing: 3,
            textTransform: 'uppercase',
            color: T.ink,
            opacity: 0.65,
            margin: '0 0 6px',
          }}
        >
          Meet the agent
        </p>
        <h3
          style={{
            fontFamily: 'var(--font-display), system-ui, sans-serif',
            fontSize: 'clamp(28px, 3.5vw, 40px)',
            color: T.ink,
            margin: '0 0 6px',
            lineHeight: 1,
          }}
        >
          {agent.name}
        </h3>
        <p
          style={{
            fontFamily: 'var(--font-body), system-ui, sans-serif',
            fontSize: 15,
            color: T.ink,
            margin: '0 0 20px',
            opacity: 0.8,
          }}
        >
          {agent.tag}
        </p>
        <Link
          href={`/agents/${agentKey}`}
          style={{
            display: 'inline-block',
            fontFamily: 'var(--font-mono), monospace',
            fontSize: 12,
            letterSpacing: 2,
            textTransform: 'uppercase',
            background: T.ink,
            color: 'var(--vq-cream)',
            border: `1px solid ${T.line}`,
            borderRadius: 999,
            padding: '8px 20px',
            textDecoration: 'none',
          }}
        >
          Work with {agent.name} →
        </Link>
      </div>
      <div
        aria-hidden="true"
        style={{
          width: 64,
          height: 64,
          background: T.ink,
          border: `1px solid ${T.line}`,
          borderRadius: 12,
          boxShadow: T.shadow,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-display), system-ui, sans-serif',
          fontSize: 28,
          color: agent.color,
          flexShrink: 0,
        }}
      >
        {agent.name[0]}
      </div>
    </aside>
  );
}
