import { buildPageMetadata } from '@/lib/seo';
import { UseCasePage } from '@/components/veqiro/use-case-page';
import type { UseCaseContent } from '@/components/veqiro/use-case-page';

export const metadata = buildPageMetadata({
  title: 'AI Tools for Growing Startups — Scale Output Without Adding Headcount | Veqiro',
  description: 'Veqiro gives Series A/B startups six AI employees for operations, content, finance, legal, and research — ship faster without growing the team.',
  path: '/use-cases/growing-startups',
  keywords: ['ai tools for startups', 'ai for growing companies', 'ai workforce automation', 'ai for series a startups', 'startup operations automation'],
});

const content: UseCaseContent = {
  path: '/use-cases/growing-startups',
  persona: 'Growing Startups',
  accentColor: '#1DBC87',
  accentInk: '#0E5C3F',
  hero: {
    h1: "Scale the output. Not the headcount.",
    subheading: 'AI tools for Series A/B startups who need more output from the team they already have.',
    stats: ['All 6 agents included', 'Deploys in under a day', '$39 / mo'],
  },
  painPoints: [
    'board deck takes all week', 'investor updates slip', 'content team bottlenecked',
    'legal reviews piling up', 'no CFO visibility', 'competitors moving faster',
    'exec inbox out of control', 'SEO not keeping pace',
  ],
  whyNow: "You've got product-market fit, a real team, and revenue coming in — but you're still running lean on the operational layer. Board decks get built by pulling three people off real work. Investor updates slip because the numbers are in a spreadsheet no one owns. Your content calendar is held hostage by whoever has the least meetings this week. Veqiro fixes the execution layer without adding headcount. Six AI specialists — each an expert in their domain, all sharing the same context about your business — handle the output so your team can focus on the judgment calls only humans make. That's what operational leverage looks like at 20–80 people.",
  agents: [
    { key: 'vega', name: 'Vega', color: '#6FCDE8', ink: '#0E5C74', blurb: 'Manages executive inbox and calendar at the speed a growing company demands. Investor emails never get lost in the noise.' },
    { key: 'scout', name: 'Scout', color: '#F5C518', ink: '#7A5A00', blurb: 'Feeds your sales and product teams live competitor intel, market scans, and lead research — so nobody gets blindsided.' },
    { key: 'maya', name: 'Maya', color: '#F06464', ink: '#7A1717', blurb: 'Publishes branded content at growth pace — LinkedIn, blog, social — without a full content team on payroll.' },
    { key: 'sage', name: 'Sage', color: '#F79FD4', ink: '#8E2A6A', blurb: 'Builds the SEO channel that compounds while you ship product — keyword research, articles, page and site audits.' },
    { key: 'lex', name: 'Lex', color: '#8A8AF0', ink: '#2A2A7A', blurb: 'Reviews vendor contracts, partner agreements, and NDA stacks as fast as your deal flow requires.' },
    { key: 'rex', name: 'Rex', color: '#1DBC87', ink: '#0E5C3F', blurb: 'Tracks MRR, burn, CAC, runway — and generates board decks and investor updates directly from your live data.' },
  ],
  steps: [
    {
      n: '01',
      title: 'Connect your tools',
      description: 'Stripe, Gmail, Google Calendar, brand kit. Rex, Vega, and the crew calibrate to your business in hours — not weeks.',
      color: '#1DBC87',
    },
    {
      n: '02',
      title: 'Brief the crew on what\'s coming',
      description: 'Board meeting Thursday? Competitor entered your market? New product launch? The agents coordinate the output. You don\'t.',
      color: '#F5C518',
    },
    {
      n: '03',
      title: 'Get operational leverage',
      description: 'Reports, content, research, legal reviews — all shipped. Your team focuses on the work that actually needs humans.',
      color: '#F06464',
    },
  ],
  scenario: {
    title: "Your week as a 30-person startup, before and after.",
    before: [
      "Monday: Board deck due Thursday. Three people are pulled off real work to build slides from scratch.",
      "Tuesday: Your investor update is two weeks late. The metrics are in a spreadsheet no one's touched since last month.",
      "Wednesday: A partnership deal stalled because legal review has been sitting for three weeks.",
      "Thursday: Your competitor launched a new feature. Nobody noticed until a customer mentioned it on a call.",
      "Friday: Your marketing lead spent the whole week on execution — no time for strategy, no content shipped.",
    ],
    after: [
      "Monday: Rex assembled the board deck from your live financial data. Your team spent 2 hours reviewing, not 3 days building.",
      "Tuesday: Investor update sent — real metrics, narrative, asks. Rex drafted it the moment you asked.",
      "Wednesday: Lex reviewed the partnership agreement in 10 minutes. You signed before the week was out.",
      "Thursday: Scout flagged the competitor feature launch the day it dropped. Your product lead had context before the call.",
      "Friday: Maya published 4 LinkedIn posts, 2 blog articles, and a Twitter thread. Your marketing lead reviewed strategy instead.",
    ],
  },
  outcomes: [
    {
      title: "Board-ready reporting on demand",
      body: "Rex generates board decks and investor updates from your live data. Nobody gets pulled off real work to build slides for a Tuesday meeting.",
    },
    {
      title: "Content at growth pace",
      body: "Maya and Sage publish consistently without a full content team. The SEO channel compounds while your team ships product.",
    },
    {
      title: "Legal reviews that don't block deals",
      body: "Lex turns 3-week legal queues into same-day turnarounds. Vendor contracts, NDAs, and partner agreements reviewed as fast as they arrive.",
    },
    {
      title: "Competitive awareness in the workflow",
      body: "Scout tracks your rivals daily and surfaces what matters — so your team stops being blindsided by moves you should have seen coming.",
    },
  ],
  faq: [
    { q: "Is Veqiro designed for companies our size (20–80 people)?", a: "This is the sweet spot. You have enough operational complexity to need specialized help, but lean enough that adding headcount for every function isn't the answer. Veqiro gives each team the AI specialist they need without adding to payroll." },
    { q: "How does this compare to hiring a specialist?", a: "A mid-level hire costs $80–120K fully loaded. Veqiro is $39/mo and covers all six functions. It doesn't replace senior judgment — your team still makes the calls. It replaces the execution work that was clogging everyone's calendar." },
    { q: "Can multiple team members use it at once?", a: "Yes. Every agent operates from your shared Brand Brain — company positioning, voice, competitors, KPIs. Different team members talk to different agents and everyone works from the same playbook. No re-briefing, no duplication." },
    { q: "How quickly can we integrate it with our existing tools?", a: "Vega connects to Gmail and Google Calendar in under a minute. Rex connects to Stripe, bank exports, and ad platforms. Everything else works immediately from your Brand Brain. No long IT projects, no enterprise onboarding." },
    { q: "What's the ROI case for a CFO or ops lead?", a: "One board deck rebuild = 3 days of 3 people's time. One late investor update = friction with backers. One unreviewed contract = legal risk. Veqiro handles all of that for $39/mo. The math isn't close." },
    { q: "Do we need to change how the team works?", a: "No. The agents slot into your existing workflow. Sales still closes. Product still ships. Legal still handles the high-stakes deals. Veqiro handles the execution layer that was blocking everyone else." },
  ],
};

export default function GrowingStartupsPage() {
  return <UseCasePage content={content} />;
}
