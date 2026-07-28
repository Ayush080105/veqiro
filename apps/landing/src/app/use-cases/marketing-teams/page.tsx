import { buildPageMetadata } from '@/lib/seo';
import { UseCasePage } from '@/components/veqiro/use-case-page';
import type { UseCaseContent } from '@/components/veqiro/use-case-page';

export const metadata = buildPageMetadata({
  title: 'AI Tools for Marketing Teams — Content, SEO & Social on Autopilot',
  description: 'Give your marketing team AI superpowers: Maya writes content in your brand voice, Sage handles SEO, Scout finds the angles. Each agent billed independently, starting at $9/mo.',
  path: '/use-cases/marketing-teams',
  keywords: ['ai tools for marketing teams', 'ai marketing assistant', 'ai content marketing tool', 'ai social media post generator', 'ai content calendar'],
});

const content: UseCaseContent = {
  path: '/use-cases/marketing-teams',
  persona: 'Marketing Teams',
  accentColor: '#F06464',
  accentInk: '#7A1717',
  hero: {
    h1: 'Your marketing team just got 6 new hires.',
    subheading: 'AI tools for marketing teams that need to ship more without burning out.',
    stats: ['3 content agents', 'Brand-consistent', 'Multi-platform'],
  },
  painPoints: [
    'content calendar always behind', 'brand voice inconsistent', 'SEO takes forever',
    'social goes quiet', 'competitor blindspot', 'ad copy bottleneck',
  ],
  whyNow: "Marketing teams at growth-stage companies are in an impossible spot: the CEO wants more content, more SEO, more channels — but the headcount conversation keeps getting pushed. You can either burn out your senior marketer reviewing copy at midnight, or lean on AI tools for marketing teams that actually understand brand voice. Veqiro is the second option, built specifically so your strategist stays strategic and execution happens in the background. Maya writes, Sage ranks, Scout researches, and your team spends their hours on the work that's worth paying them to do.",
  agents: [
    { key: 'maya', name: 'Maya', color: '#F06464', ink: '#7A1717', blurb: 'Writes blog posts, LinkedIn updates, and ad copy that sounds like your brand — not a robot.' },
    { key: 'sage', name: 'Sage', color: '#F79FD4', ink: '#8E2A6A', blurb: 'Does keyword research, writes SEO-ready articles, and tracks what\'s ranking.' },
    { key: 'scout', name: 'Scout', color: '#F5C518', ink: '#7A5A00', blurb: 'Finds the angles your competitors missed and the trends worth jumping on.' },
    { key: 'vega', name: 'Vega', color: '#6FCDE8', ink: '#0E5C74', blurb: 'Handles the email threads so your team doesn\'t get buried in comms.' },
    { key: 'rex', name: 'Rex', color: '#1DBC87', ink: '#0E5C3F', blurb: 'Tracks campaign metrics and flags what\'s actually working vs. what\'s theater.' },
    { key: 'lex', name: 'Lex', color: '#8A8AF0', ink: '#2A2A7A', blurb: 'Reviews influencer contracts and brand agreements before anything gets signed.' },
  ],
  steps: [
    {
      n: '01',
      title: 'Brief the brand',
      description: 'Upload your brand kit, tone guide, and target audience. Maya reads it, speaks your language from day one.',
      color: '#F06464',
    },
    {
      n: '02',
      title: 'Assign campaigns',
      description: 'Tell Maya what to write, Sage what to rank, Scout what to research. Parallel output, no handoffs, no bottlenecks.',
      color: '#F5C518',
    },
    {
      n: '03',
      title: 'Publish, rank, repeat',
      description: 'Your content calendar fills itself. Your SEO compounds. Your team focuses on strategy while the agents handle execution.',
      color: '#1DBC87',
    },
  ],
  scenario: {
    title: "A week of marketing output, before and after.",
    before: [
      "Content calendar has 12 slots; 4 are filled; publishing drift of 2–3 weeks on the rest.",
      "Social manager spends 6 hours a week 'adapting' blog content for LinkedIn and X.",
      "SEO strategy is a doc from 2024 that nobody opens anymore.",
      "Competitor intel = whatever someone noticed in their feed last Tuesday.",
      "Three campaigns stall waiting on copy review from your senior marketer.",
    ],
    after: [
      "Maya ships 12 drafts across LinkedIn, X, blog, and email by Monday noon.",
      "Sage has a running list of high-intent keywords and ships 2 SEO-ready blog posts a week.",
      "Scout runs the weekly competitor digest — who posted what, who raised, what trended.",
      "Your senior marketer reviews drafts in 20 minutes instead of writing them from scratch.",
      "Campaign velocity 3x without a single new hire.",
    ],
  },
  outcomes: [
    {
      title: "Content output without the bottleneck",
      body: "Your calendar fills itself from Maya's drafts. Reviews become edits, not rewrites.",
    },
    {
      title: "SEO that compounds",
      body: "Sage writes 2+ SEO-optimized articles a week with proper schema and internal linking. Rankings appear in 4–8 weeks.",
    },
    {
      title: "Competitor intel you can act on",
      body: "Scout's weekly digest means you stop being surprised by rival launches and pricing moves.",
    },
    {
      title: "Brand voice consistency at scale",
      body: "All agents read your brand Brain. A LinkedIn post and a blog intro both sound like you — even when Maya wrote one and you wrote the other.",
    },
  ],
  faq: [
    { q: "Will Maya's content actually sound like us?", a: "Yes. You upload your brand voice guide, 5–10 past posts you love, and a do-not-use list. Maya calibrates in minutes. You review every draft before it publishes — the final voice is always yours." },
    { q: 'Can Sage replace our SEO agency?', a: "For most lean marketing teams, yes. Keyword research, content briefs, optimized articles, and on-page recommendations — all covered at a fraction of a retainer. You still own strategy and link building; she handles the execution stack." },
    { q: 'What platforms does Maya write for?', a: "LinkedIn, Twitter/X, Instagram, and long-form blog out of the box. She also handles ad copy for paid channels (Meta, Google, LinkedIn Ads). Email newsletters next on the roadmap." },
    { q: 'How does Scout help a marketing team specifically?', a: "Competitive intelligence: what rivals are posting, what's trending in your category, what gaps exist in their content. Your next campaign angle — found before you start, backed by sources." },
    { q: 'How many pieces of content can Maya produce per week?', a: "As many as you ask for. Maya doesn't have a bandwidth ceiling. She'll flag if a deadline is aggressive — then deliver anyway. Most teams ship 10–20 pieces across channels per week." },
    { q: 'Does Maya integrate with our CMS or scheduling tool?', a: "Direct publishing is on the roadmap. Today she ships drafts into Veqiro with markdown/HTML that copies cleanly into WordPress, Webflow, Ghost, or Notion. Social is export-ready for Buffer/Hootsuite/native scheduling." },
  ],
};

export default function MarketingTeamsPage() {
  return <UseCasePage content={content} />;
}
