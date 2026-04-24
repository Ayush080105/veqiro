import { buildPageMetadata } from '@/lib/seo';
import { UseCasePage } from '@/components/veqiro/use-case-page';
import type { UseCaseContent } from '@/components/veqiro/use-case-page';

export const metadata = buildPageMetadata({
  title: 'AI Tools for Marketing Teams — Content, SEO & Social on Autopilot',
  description: 'Give your marketing team AI superpowers: Maya writes content in your brand voice, Sage handles SEO, Scout finds the angles. All for $39/mo.',
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
  faq: [
    { q: 'Will Maya\'s content actually sound like us?', a: "Yes. You upload your brand voice guide and Maya calibrates to it. You review before anything goes live — nothing publishes without your say-so." },
    { q: 'Can Sage replace our SEO agency?', a: "For most lean marketing teams, yes. Keyword research, content briefs, optimized articles — all covered at a fraction of the cost." },
    { q: 'What platforms does Maya support?', a: "LinkedIn, Twitter/X, Instagram, and long-form blog. More platforms on the roadmap — email newsletters coming next." },
    { q: 'How does Scout help marketing specifically?', a: "Competitive intel: what rivals are posting, what\'s trending, what gaps exist in their content. Your next campaign angle, found before you start." },
    { q: 'How many pieces of content can Maya produce per week?', a: "As many as you ask for. Maya doesn\'t have a bandwidth ceiling. She does flag if a deadline is aggressive — then delivers anyway." },
  ],
};

export default function MarketingTeamsPage() {
  return <UseCasePage content={content} />;
}
