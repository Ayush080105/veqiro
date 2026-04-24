import { buildPageMetadata } from '@/lib/seo';
import { UseCasePage } from '@/components/veqiro/use-case-page';
import type { UseCaseContent } from '@/components/veqiro/use-case-page';

export const metadata = buildPageMetadata({
  title: 'AI Tools for Founders — Your 6-Person AI Team',
  description: 'Veqiro gives founders an AI executive assistant, researcher, content writer, SEO specialist, legal reviewer, and financial analyst — for $39/mo.',
  path: '/use-cases/founders',
  keywords: ['ai tools for founders', 'ai agent for founders', 'ai assistant for founders', 'ai for early-stage startups', 'ai team for business', 'all in one ai platform for startups'],
});

const content: UseCaseContent = {
  path: '/use-cases/founders',
  persona: 'Founders',
  accentColor: '#F5C518',
  accentInk: '#7A5A00',
  hero: {
    h1: 'Stop doing everything yourself.',
    subheading: 'AI tools for founders who need a full team — without the payroll.',
    stats: ['6 AI employees', '$39 / mo', '24/7 availability'],
  },
  painPoints: [
    'inbox never clears', 'no time for research', 'content goes cold',
    'contracts pile up', 'metrics are a mystery', 'SEO is untouched',
  ],
  agents: [
    { key: 'vega', name: 'Vega', color: '#6FCDE8', ink: '#0E5C74', blurb: 'Manages your inbox & calendar so you can focus on building.' },
    { key: 'scout', name: 'Scout', color: '#F5C518', ink: '#7A5A00', blurb: 'Does the competitor research you\'ve been putting off for weeks.' },
    { key: 'maya', name: 'Maya', color: '#F06464', ink: '#7A1717', blurb: 'Writes the content you keep saying you\'ll post tomorrow.' },
    { key: 'sage', name: 'Sage', color: '#F79FD4', ink: '#8E2A6A', blurb: 'Gets your pages ranking before your competitors do.' },
    { key: 'lex', name: 'Lex', color: '#8A8AF0', ink: '#2A2A7A', blurb: 'Reviews contracts so you don\'t sign something you shouldn\'t.' },
    { key: 'rex', name: 'Rex', color: '#1DBC87', ink: '#0E5C3F', blurb: 'Keeps your metrics honest so surprises don\'t end you.' },
  ],
  steps: [
    {
      n: '01',
      title: 'Tell them about your startup',
      description: 'Drop in your brand kit, goals, and context. They read everything and show up briefed — no hand-holding needed.',
      color: '#F5C518',
    },
    {
      n: '02',
      title: 'Assign the work',
      description: 'Say "Vega, handle my inbox this week" or "Scout, run a competitor deep-dive." Done. They don\'t need a manager.',
      color: '#F06464',
    },
    {
      n: '03',
      title: 'Ship faster than you thought possible',
      description: 'They run parallel. While you\'re on a call, Maya\'s writing, Rex is flagging a CAC spike, Sage is ranking.',
      color: '#1DBC87',
    },
  ],
  faq: [
    { q: 'Do I need all 6 agents?', a: "No — but most founders find all 6 get used within the first week. You won't go back." },
    { q: 'Is this better than hiring a VA?', a: "A VA works 8 hours/day. These work 24/7, never burn out, and cost less than one week of a contractor." },
    { q: 'Can I use it solo?', a: "Especially for solo founders. You get the leverage of a full team without a single hire." },
    { q: 'How fast is the setup?', a: "15 minutes to brief your crew. First output within the hour. Most founders are fully set up same-day." },
    { q: 'What if I only need one agent right now?', a: "You get all 6. You\'ll find a use for every one — or we\'ll refund you." },
  ],
};

export default function FoundersPage() {
  return <UseCasePage content={content} />;
}
