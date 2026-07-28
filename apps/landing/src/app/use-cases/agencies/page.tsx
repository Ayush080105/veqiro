import { buildPageMetadata } from '@/lib/seo';
import { UseCasePage } from '@/components/veqiro/use-case-page';
import type { UseCaseContent } from '@/components/veqiro/use-case-page';

export const metadata = buildPageMetadata({
  title: 'AI for Agencies — Scale Client Work Without Scaling Headcount',
  description: 'Veqiro gives agencies an AI crew that handles content, research, SEO, and legal review across clients — without extra hires. Each agent billed independently, from $9/mo.',
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
  whyNow: "Agency economics are broken when output per client goes up and your team stays the same. You either raise prices (and lose clients), hire (and lose margin), or find leverage. Veqiro is the leverage play. Each client gets an isolated Brain — brand voice, competitors, goals — so Maya writes for Client A in Client A's voice, Client B in Client B's voice, zero bleed between accounts. Scale content, SEO, research, and legal review across your entire client portfolio without adding a single junior hire. Every agent billed independently starting at $9/mo, unlimited client brands.",
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
  scenario: {
    title: "10 clients on retainer, before and after.",
    before: [
      "Your content team is drowning — 8 pieces per client per month feels impossible.",
      "SEO deliverables stall because keyword research eats your strategist's week.",
      "One senior handles all client-facing work; there's no room for a new account.",
      "Junior team burns out copying-and-pasting templates across brands.",
      "Margins have dropped 8% over the year and you can't raise prices.",
    ],
    after: [
      "Maya ships 20+ pieces of content per client per month, each in the correct brand voice.",
      "Sage runs keyword research, content briefs, and SEO posts for every client in parallel.",
      "Scout produces monthly competitor reports for each account — a new deliverable you can bill for.",
      "Your senior team focuses on strategy, reviews, and client calls — where the relationship happens.",
      "Margins climb. You take on two more accounts without hiring.",
    ],
  },
  outcomes: [
    {
      title: "Client output per retainer goes 3x",
      body: "Deliverables per account multiply without adding hours. Your strategist reviews, your AI crew executes.",
    },
    {
      title: "Zero brand bleed",
      body: "Each client's Brain is isolated. Client A's voice, tone, and taboos never leak into Client B's content. Switch context instantly.",
    },
    {
      title: "A new report to sell",
      body: "Scout's competitor intel becomes a monthly deliverable clients pay extra for — net-new revenue line on the same subscription.",
    },
    {
      title: "Margin recovery",
      body: "Revenue stays flat or grows, delivery cost drops. Most agencies recover 10–20% margin in the first quarter.",
    },
  ],
  faq: [
    { q: 'Can we run this across 10+ clients?', a: "Yes — each client has an isolated Brain (brand context) so there's no bleed between accounts. Client A's voice never leaks into Client B's content. Switch client context with one click." },
    { q: 'Will Veqiro replace our junior team?', a: "It replaces the repetitive execution — 80% of what juniors do today. Your team focuses on strategy, client relationships, QA, and the judgment work that justifies agency margins. Most agencies keep their juniors and promote them into better roles." },
    { q: 'How does billing work for agencies?', a: "Every agent bills independently, starting at $9/mo — pick the ones you need. You manage the agents on behalf of your clients. No per-seat fees, no per-client charges. Bill clients at whatever rate your market supports." },
    { q: 'Can clients log in and see the work in progress?', a: "Not directly today — the agency manages the agents on the client's behalf. Client-facing portals are on the product roadmap, targeted for late 2026." },
    { q: "What's the ROI case for an agency?", a: "A handful of agents billed independently, starting at $9/mo each, does the work of a content writer, an SEO specialist, a research analyst, and a paralegal-grade contract reviewer. At agency rates, each of those costs $5–15K/mo. The math is obvious at 2+ clients." },
    { q: "How do we bill clients for AI work?", a: "Most agencies bill at their existing rate — clients don't care whether execution is AI or human, they care about output and quality. A handful bill a lower 'AI-assisted' tier for price-sensitive accounts. Your call." },
  ],
};

export default function AgenciesPage() {
  return <UseCasePage content={content} />;
}
