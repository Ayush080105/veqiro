import { buildPageMetadata } from '@/lib/seo';
import { UseCasePage } from '@/components/veqiro/use-case-page';
import type { UseCaseContent } from '@/components/veqiro/use-case-page';

export const metadata = buildPageMetadata({
  title: 'AI Tools for Solopreneurs — Your Entire Team for $39/mo',
  description: "Veqiro gives solopreneurs six AI employees: executive assistant, researcher, content writer, SEO, legal, and finance — for the price of one tool.",
  path: '/use-cases/solopreneurs',
  keywords: ['ai tools for solopreneurs', 'ai assistant for solo founders', 'ai for solo business', 'virtual ai employees', 'ai employee platform'],
});

const content: UseCaseContent = {
  path: '/use-cases/solopreneurs',
  persona: 'Solopreneurs',
  accentColor: '#1DBC87',
  accentInk: '#0E5C3F',
  hero: {
    h1: "You're a team of one. Act like a team of six.",
    subheading: 'AI tools for solopreneurs who do it all — and need real help doing it.',
    stats: ['No employees needed', '24/7 output', '$39 / mo'],
  },
  painPoints: [
    'doing everything yourself', 'content never consistent', 'emails eat your mornings',
    'legal is intimidating', 'metrics get ignored', 'SEO never started',
  ],
  agents: [
    { key: 'vega', name: 'Vega', color: '#6FCDE8', ink: '#0E5C74', blurb: 'Your inbox manager, scheduler, and email writer. Never fall behind again.' },
    { key: 'scout', name: 'Scout', color: '#F5C518', ink: '#7A5A00', blurb: 'Researches your market, tracks your competition, finds your opportunities.' },
    { key: 'maya', name: 'Maya', color: '#F06464', ink: '#7A1717', blurb: 'Writes your newsletter, social posts, and blog content — in your voice.' },
    { key: 'sage', name: 'Sage', color: '#F79FD4', ink: '#8E2A6A', blurb: 'Gets you ranking on Google while you focus on delivering value to clients.' },
    { key: 'lex', name: 'Lex', color: '#8A8AF0', ink: '#2A2A7A', blurb: 'Reviews every contract before you sign. No lawyer bill every single time.' },
    { key: 'rex', name: 'Rex', color: '#1DBC87', ink: '#0E5C3F', blurb: 'Keeps your finances clear so you always know exactly where you stand.' },
  ],
  steps: [
    {
      n: '01',
      title: 'Set up your Brain in 15 minutes',
      description: 'Tell them who you are, what you sell, who your customers are. They\'re briefed from day one and never need reminding.',
      color: '#1DBC87',
    },
    {
      n: '02',
      title: 'Delegate the work that drains you',
      description: 'The inbox. The research. The content. The contracts. The metrics. All handled — without you babysitting any of it.',
      color: '#F5C518',
    },
    {
      n: '03',
      title: 'Focus on what only you can do',
      description: 'Your product. Your customers. Your vision. The work that actually needs a human. Everything else: handled.',
      color: '#F06464',
    },
  ],
  faq: [
    { q: 'Is this worth it if I\'m just one person?', a: "Especially if you\'re one person. You can\'t afford to hire six specialists. You can afford $39/mo — and that\'s the whole point." },
    { q: 'Will I have time to manage the agents?', a: "15 minutes a day. They\'re not interns who need constant guidance — they\'re specialists who need a brief and a direction." },
    { q: 'What\'s the first agent I should start with?', a: "Start with Vega for your inbox. Most solopreneurs get 2 hours back on day one. Then you\'ll see why the other five matter." },
    { q: 'Can I cancel if I don\'t love it?', a: "Yes. Monthly billing, cancel anytime. No contracts, no pressure. But most solopreneurs who try it don\'t go back." },
    { q: 'Do I need any technical knowledge?', a: "None. You talk to them like you\'d talk to a new hire. They take it from there — no prompts, no settings, no configuration required." },
  ],
};

export default function SolopreneursPage() {
  return <UseCasePage content={content} />;
}
