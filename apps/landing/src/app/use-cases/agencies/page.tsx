import { buildPageMetadata } from '@/lib/seo';
import { UseCasePage } from '@/components/veqiro/use-case-page';
import type { UseCaseContent } from '@/components/veqiro/use-case-page';

export const metadata = buildPageMetadata({
  title: 'AI for Agencies — Scale Client Work Without Scaling Headcount',
  description: 'Veqiro gives agencies an AI crew that handles content, research, SEO, and legal review across clients — without extra hires. From $39/mo.',
  path: '/use-cases/agencies',
  keywords: ['ai for agencies', 'ai tools for agencies', 'ai marketing agency tool', 'ai content agency', 'ai agency workflow'],
});

const content: UseCaseContent = {
  path: '/use-cases/agencies',
  persona: 'Agencies',
  accentColor: '#8A8AF0',
  accentInk: '#2A2A7A',
  hero: {
    h1: 'Run 10 clients like you have a team of 30.',
    subheading: 'AI for agencies that need to scale output without scaling overhead.',
    stats: ['6 specialized agents', 'Multi-client ready', 'Brand-isolated'],
  },
  painPoints: [
    'clients want more content', 'SEO scales poorly', 'research takes forever',
    'contracts need review', 'margins keep shrinking', 'team is stretched thin',
  ],
  agents: [
    { key: 'maya', name: 'Maya', color: '#F06464', ink: '#7A1717', blurb: 'Writes client-specific content in each brand\'s voice — fully isolated per client.' },
    { key: 'scout', name: 'Scout', color: '#F5C518', ink: '#7A5A00', blurb: 'Runs competitor research for every client account without burning your team\'s hours.' },
    { key: 'sage', name: 'Sage', color: '#F79FD4', ink: '#8E2A6A', blurb: 'Handles SEO strategy and content creation across your whole client portfolio.' },
    { key: 'lex', name: 'Lex', color: '#8A8AF0', ink: '#2A2A7A', blurb: 'Reviews client contracts and vendor agreements before they land on a desk.' },
    { key: 'vega', name: 'Vega', color: '#6FCDE8', ink: '#0E5C74', blurb: 'Manages the email and scheduling load that comes with 10 active accounts.' },
    { key: 'rex', name: 'Rex', color: '#1DBC87', ink: '#0E5C3F', blurb: 'Tracks client metrics and produces the performance reports they actually want to see.' },
  ],
  steps: [
    {
      n: '01',
      title: 'Set up each client\'s Brain',
      description: 'Each client gets their own brand kit: voice, competitors, goals. Agents switch client context instantly — no bleed, no confusion.',
      color: '#8A8AF0',
    },
    {
      n: '02',
      title: 'Delegate by account',
      description: '"Maya, write 4 LinkedIn posts for Client A in their tone." Parallel output. Isolated per client. On-brand every time.',
      color: '#F5C518',
    },
    {
      n: '03',
      title: 'Deliver more, bill more',
      description: 'More output per account, same team size. Margins improve. Clients see results faster. You take on more accounts without burning out.',
      color: '#1DBC87',
    },
  ],
  faq: [
    { q: 'Can we use this across multiple clients?', a: "Yes — each client has an isolated Brain (brand context) so there\'s no bleed between accounts. Client A\'s voice never leaks into Client B\'s content." },
    { q: 'Will it replace our junior team?', a: "It replaces the repetitive execution so your team focuses on strategy, relationships, and the work that actually requires human judgment." },
    { q: 'How does billing work for agencies?', a: "One flat $39/mo subscription. You manage the agents on behalf of your clients. No per-seat fees, no per-client charges." },
    { q: 'Can clients access it directly?', a: "Not currently — the agency manages the agents on the client\'s behalf. Client-facing portals are on the product roadmap." },
    { q: 'What\'s the ROI case for an agency?', a: "One subscription that does the work of a content writer, SEO specialist, researcher, and legal reviewer. What does each of those cost per month? You do the math." },
  ],
};

export default function AgenciesPage() {
  return <UseCasePage content={content} />;
}
