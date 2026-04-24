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
  whyNow: "You're running a business alone. You can't hire specialists — every dollar out the door matters — and most AI tools for solopreneurs are one-trick utilities that don't talk to each other. Veqiro is the opposite: a single subscription that gives you six specialists with shared context. Your AI executive assistant knows about your content calendar. Your AI financial analyst sees what Scout found in your market. It's less like buying six tools and more like hiring six specialists who actually know each other's work.",
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
  scenario: {
    title: "Your week as a team of one, before and after.",
    before: [
      "Monday: 180 unread emails. You spend the morning triaging and answering the urgent ones.",
      "Tuesday: Wanted to write a blog post. Ended up doing tax paperwork and client onboarding instead.",
      "Wednesday: A prospect asks for your NDA. You ghost them for 2 days while you dig up a template.",
      "Thursday: Your most-read newsletter in 3 weeks — because you skipped weeks 1 and 2.",
      "Friday: You have no idea what your real MRR is. Or runway. Or CAC.",
    ],
    after: [
      "Monday: Vega has cleared the inbox. Your first read is her 5-line briefing with 3 items that need you.",
      "Tuesday: Maya drafted 2 newsletters, a LinkedIn post, and a blog opener. You edit, you ship.",
      "Wednesday: Lex reviewed the prospect's NDA in 4 minutes. You sign and send back before lunch.",
      "Thursday: Your newsletter is out. Your blog post is indexed. Your LinkedIn is active.",
      "Friday: Rex sends the weekly financial read — MRR, runway, CAC by channel. You know where you stand.",
    ],
  },
  outcomes: [
    {
      title: "Your mornings back",
      body: "Vega handles the inbox triage that used to eat the first two hours of your day.",
    },
    {
      title: "A consistent content rhythm",
      body: "Maya makes it possible to actually publish weekly — newsletter, blog, social — without it becoming a second job.",
    },
    {
      title: "Legal comfort",
      body: "Lex reviews contracts and generates standard docs so you stop avoiding the legal side of running a business.",
    },
    {
      title: "Finance visibility",
      body: "Rex tracks MRR, burn, runway, and CAC — finally you know the numbers without hiring an accountant or building a spreadsheet.",
    },
  ],
  faq: [
    { q: "Is Veqiro worth it if I'm just one person?", a: "Especially if you're one person. You can't afford to hire six specialists and don't need full-time versions of any of them. $39/mo gets you all six — cheaper than a single part-time contractor, and they don't sleep." },
    { q: 'Will I have time to manage the agents?', a: "15 minutes a day. They're not interns who need constant guidance — they're specialists who need a brief and a direction. Most solopreneurs spend more time reading Veqiro's briefings than giving instructions." },
    { q: "What's the first AI agent I should start with as a solopreneur?", a: "Vega, for inbox and calendar. Most solopreneurs get 2 hours back on day one. Once that's reclaimed, you have the bandwidth to actually use Maya for content and Rex for finances." },
    { q: 'Can I cancel if I don\'t love it?', a: "Yes. Monthly billing, cancel anytime. 7-day free trial with no credit card required. No contracts, no pressure. But most solopreneurs who try it don't go back." },
    { q: 'Do I need any technical knowledge to use Veqiro?', a: "None. You talk to the agents like you'd talk to a new hire. They take it from there — no prompts, no settings, no configuration. If you can write an email, you can run the crew." },
    { q: "Can Veqiro replace all the separate AI tools I'm using?", a: "For most solopreneurs, yes — ChatGPT, Jasper, Surfer, Motion, and a contract template tool all collapse into one subscription. The bigger win is that Veqiro's agents share context, so they don't ask you to re-explain your business six times." },
  ],
};

export default function SolopreneursPage() {
  return <UseCasePage content={content} />;
}
