import Link from 'next/link';
import type { AgentKey } from '@/lib/blog';

const AGENT_DATA: Record<AgentKey, { name: string; tag: string; color: string; ink: string }> = {
  vega:  { name: 'Vega',  tag: 'AI Executive Assistant',   color: '#8A8AF0', ink: '#111' },
  scout: { name: 'Scout', tag: 'AI Research Specialist',   color: '#F5C518', ink: '#111' },
  maya:  { name: 'Maya',  tag: 'AI Content & Marketing',   color: '#F79FD4', ink: '#111' },
  sage:  { name: 'Sage',  tag: 'AI SEO Specialist',        color: '#1DBC87', ink: '#111' },
  lex:   { name: 'Lex',   tag: 'AI Legal Assistant',       color: '#6FCDE8', ink: '#111' },
  rex:   { name: 'Rex',   tag: 'AI Financial Analyst',     color: '#F06464', ink: '#111' },
};

export function BlogAgentCta({ agentKey }: { agentKey: AgentKey }) {
  const agent = AGENT_DATA[agentKey];
  return (
    <aside
      style={{
        margin: '3em 0',
        background: agent.color,
        border: '3px solid #111',
        borderRadius: 16,
        padding: '28px 32px',
        boxShadow: '8px 8px 0 #111',
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
            color: '#111',
            opacity: 0.65,
            margin: '0 0 6px',
          }}
        >
          [ meet the agent ]
        </p>
        <h3
          style={{
            fontFamily: 'var(--font-bagel), cursive',
            fontSize: 'clamp(28px, 3.5vw, 40px)',
            color: '#111',
            margin: '0 0 6px',
            lineHeight: 1,
          }}
        >
          {agent.name}
        </h3>
        <p
          style={{
            fontFamily: 'var(--font-space), sans-serif',
            fontSize: 15,
            color: '#111',
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
            background: '#111',
            color: 'var(--vq-cream)',
            border: '3px solid #111',
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
          background: '#111',
          border: '3px solid #111',
          borderRadius: 12,
          boxShadow: '4px 4px 0 rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-bagel), cursive',
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
