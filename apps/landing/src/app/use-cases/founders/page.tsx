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
  whyNow: "Early-stage founders wear six hats. You can't hire a CFO, an EA, a marketing lead, an SEO specialist, a legal counsel, and a research analyst in the first year — and you shouldn't. But all six functions still need to happen, and right now they're happening at 2 AM on your laptop after everything else burns out. Veqiro is the specific, tactical answer to that problem: a crew of AI employees that take the routine execution off your plate so you can spend your time on the parts that actually need a founder — product decisions, customer conversations, and the vision only you can hold.",
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
  scenario: {
    title: "A typical Tuesday, before and after.",
    before: [
      "Start your day on 240 unread emails — answer 30, mentally bookmark 40, ignore the rest.",
      "Planned to do competitor research but the calendar shifted and it slipped again.",
      "The blog hasn't been updated in 6 weeks. You still owe that vendor a redlined contract.",
      "Stripe dashboard shows something weird on CAC but you'll look into it 'next week.'",
      "End the day feeling busy but not sure what actually shipped.",
    ],
    after: [
      "Wake up to Vega's briefing — she handled 80% of email, flagged 3 that need you.",
      "Scout dropped a 2-page competitor memo while you slept — you read it with coffee.",
      "Maya has 3 LinkedIn drafts and a blog post ready for review by 10 AM.",
      "Lex already reviewed the vendor contract and flagged two clauses before lunch.",
      "Rex pinged you about the CAC anomaly — with the fix, not just the problem.",
    ],
  },
  outcomes: [
    {
      title: "Your first 2 hours back",
      body: "Most founders reclaim at least 2 hours a day within the first week — mostly from not living inside their inbox.",
    },
    {
      title: "A research memo a week",
      body: "Scout produces a standing weekly memo on competitors and market movements. You stop being the last to know.",
    },
    {
      title: "A real content cadence",
      body: "Maya writes, you approve, the calendar fills itself. No more 'I'll post something tomorrow' cycles.",
    },
    {
      title: "Runway you can see",
      body: "Rex tracks MRR, burn, and runway daily. You stop being surprised by your own numbers.",
    },
  ],
  faq: [
    { q: 'Do I need all 6 AI agents to start?', a: "No — but most founders find all 6 get used within the first week. Vega and Rex usually pay for the subscription alone in saved time. The other four compound from there." },
    { q: 'Is this better than hiring a virtual assistant?', a: "A VA works 8 hours a day, forgets context between tasks, and charges $30–80/hour. Vega works 24/7, remembers every thread, and the whole crew costs less than a VA's first week. You still keep a human VA for personal tasks; Veqiro handles the company work." },
    { q: 'Can a solo founder really use all six?', a: "Especially a solo founder. Solo founders face the same six-function workload as a team of ten — just with nobody to delegate to. Veqiro is that delegation layer." },
    { q: 'How fast is the setup?', a: "15 minutes to brief your crew. First output within the hour. Most founders are fully set up same-day and see real output within 24 hours." },
    { q: 'What if I only need one agent right now?', a: "You get all 6 — there's no per-agent pricing. Start with the one you need most (usually Vega for inbox or Maya for content), then let the others activate as you hit the work they're built for." },
    { q: 'What tools does Veqiro need to connect to?', a: "Gmail and Google Calendar for full coverage. You can start with just Gmail — more integrations layer in as you're ready." },
  ],
};

export default function FoundersPage() {
  return <UseCasePage content={content} />;
}
