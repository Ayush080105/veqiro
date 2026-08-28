// Single source of truth for marketing data.
// Edit copy, links, and content here; components consume from this file.

export const consoleUrl =
  process.env.NEXT_PUBLIC_CONSOLE_URL || 'http://localhost:3001';

export const landingUrl =
  process.env.NEXT_PUBLIC_LANDING_URL || 'http://localhost:3000';

export const serverUrl =
  process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:5000/api/v1';

export const isPreLaunch =
  process.env.NEXT_PUBLIC_PRE_LAUNCH === 'true';

export const launchDate =
  process.env.NEXT_PUBLIC_LAUNCH_DATE || '2026-06-17T00:00:00Z';

export const maxWaitlistSlots = 150;

export const waitlistUrl = '/waitlist';

export const contact = {
  email: 'info@veqiro.com',
  phone: '+1 (555) 010-0000',
  address: 'Made in a small room, loud — IN',
};

export const social = {
  twitter: 'https://x.com/veqiro_',
  linkedin: 'https://www.linkedin.com/company/veqiro',
  instagram: 'https://www.instagram.com/veqiro_',
};

export const nav: { href: string; label: string }[] = [
  { href: '#agents', label: 'Product' },
  { href: '#how', label: 'How it works' },
  { href: 'pricing', label: 'Pricing' },
];

export interface UseCaseNavItem {
  slug: string;
  persona: string;
  tagline: string;
  color: string;
}

export const useCaseNavItems: UseCaseNavItem[] = [
  { slug: 'founders',         persona: 'Founders',         tagline: 'Six hires, no payroll',  color: '#F5C518' },
  { slug: 'marketing-teams',  persona: 'Marketing Teams',  tagline: 'Ship at 3x pace',        color: '#F06464' },
  { slug: 'agencies',         persona: 'Agencies',         tagline: 'Multi-client ready',     color: '#8A8AF0' },
  { slug: 'growing-startups', persona: 'Growing Startups', tagline: 'Scale without hiring',   color: '#1DBC87' },
];

/* ──────────────────────────────────────────────────────────────
   Hero
   ────────────────────────────────────────────────────────────── */

export const heroCopy = {
  eyebrow: 'AI employees for small teams',
  headline: 'Six specialists. One shared brain. No headcount.',
  sub: 'Veqiro staffs the work that quietly eats your week — inbox and calendar, research, content, SEO, contracts, and numbers — with six AI employees that share your company context and work inside the tools you already use.',
  trust: ['No credit card', 'Set up in 9 minutes', 'From $9 per agent / month'],
};

/* ──────────────────────────────────────────────────────────────
   The problem
   ────────────────────────────────────────────────────────────── */

export interface ProblemItem {
  agent: string;
  label: string;
  pain: string;
  cost: string;
}

export const problemCopy = {
  eyebrow: 'The problem',
  title: 'Six jobs. One of you.',
  lede: "Every small team carries the same six workloads. Individually, none of them justifies a full-time hire — so they land on the founder, get done badly at 11pm, or quietly don't get done at all.",
  items: [
    { agent: 'vega',  label: 'Inbox & calendar',   pain: 'Threads pile up, replies slip, and the calendar double-books itself.',        cost: '~2 hrs a day' },
    { agent: 'scout', label: 'Research',           pain: "You hear about a competitor's launch from a customer, weeks after it shipped.", cost: 'Always late' },
    { agent: 'maya',  label: 'Content & campaigns', pain: 'The blog stalled in March. Social is three weeks stale. Launches slip.',       cost: 'Pipeline dries up' },
    { agent: 'sage',  label: 'SEO',                pain: "You rank on page four for the term that matters and can't say why.",           cost: 'Traffic you never see' },
    { agent: 'lex',   label: 'Contracts',          pain: 'The MSA gets signed without anyone reading clause 9.2.',                       cost: 'Unbounded risk' },
    { agent: 'rex',   label: 'Finance & reporting', pain: 'The Stripe export sits unopened. Churn shows up as a surprise.',              cost: 'Decisions made blind' },
  ] as ProblemItem[],
};

/* ──────────────────────────────────────────────────────────────
   The shared brain
   ────────────────────────────────────────────────────────────── */

export const brainCopy = {
  eyebrow: 'The difference',
  title: 'They never start from zero',
  lede: "Most AI tools forget you between prompts. Veqiro keeps one company brain that every agent reads before it does anything — so Maya writes in the voice Sage optimises for, and Rex reports on the goals Scout is tracking against.",
  contexts: [
    { label: 'Brand voice',      desc: 'Tone, style, and the words you refuse to use.' },
    { label: 'Company info',     desc: 'Products, services, positioning, and pricing.' },
    { label: 'Goals',            desc: 'Business objectives and the numbers that matter.' },
    { label: 'Competitors',      desc: 'Who you are up against and how you differ.' },
    { label: 'Previous work',    desc: 'Past content, docs, and approved assets.' },
    { label: 'Business context', desc: 'Operations, process, and standing preferences.' },
  ],
};

/* ──────────────────────────────────────────────────────────────
   Example delegations — cycles in the integrations composer.
   `slug` values must exist in @repo/integrations-catalog.
   ────────────────────────────────────────────────────────────── */

export type PromptSegment =
  | { text: string }
  | { tool: string; slug: string };

export interface ExamplePrompt {
  agent: string;
  agentLabel: string;
  outcome: string;
  segments: PromptSegment[];
}

export const examplePrompts: ExamplePrompt[] = [
  {
    agent: 'vega',
    agentLabel: 'Vega · Executive Assistant',
    outcome: 'One instruction, four systems, zero tab-switching.',
    segments: [
      { text: 'Check my ' },
      { tool: 'Google Calendar', slug: 'google-calendar' },
      { text: ' for tomorrow, pull each external attendee’s history from ' },
      { tool: 'LinkedIn', slug: 'linkedin' },
      { text: ' and ' },
      { tool: 'HubSpot', slug: 'hubspot-marketing' },
      { text: ', then leave me a one-page prep doc in ' },
      { tool: 'Notion', slug: 'notion' },
      { text: '.' },
    ],
  },
  {
    agent: 'scout',
    agentLabel: 'Scout · Research & Strategy',
    outcome: 'Competitive intel that arrives before the customer tells you.',
    segments: [
      { text: 'Track our top five competitors across ' },
      { tool: 'Reddit', slug: 'reddit' },
      { text: ' and ' },
      { tool: 'X (Twitter)', slug: 'twitter' },
      { text: ', then post a weekly signal digest to ' },
      { tool: 'Slack', slug: 'slack' },
      { text: '.' },
    ],
  },
  {
    agent: 'maya',
    agentLabel: 'Maya · Content & Marketing',
    outcome: 'A launch campaign built, written, and filed in one pass.',
    segments: [
      { text: 'Turn the launch post into six assets for ' },
      { tool: 'LinkedIn', slug: 'linkedin' },
      { text: ', ' },
      { tool: 'Instagram', slug: 'instagram' },
      { text: ' and ' },
      { tool: 'X (Twitter)', slug: 'twitter' },
      { text: ', then file the approved copy in ' },
      { tool: 'Google Docs', slug: 'google-docs' },
      { text: '.' },
    ],
  },
  {
    agent: 'sage',
    agentLabel: 'Sage · SEO',
    outcome: 'From ranking drop to a prioritised fix-list engineers can take.',
    segments: [
      { text: 'Audit our top twenty pages in ' },
      { tool: 'Google Search Console', slug: 'google-search-console' },
      { text: ', cross-check the rankings against ' },
      { tool: 'Ahrefs', slug: 'ahrefs' },
      { text: ', and open a prioritised fix-list in ' },
      { tool: 'Linear', slug: 'linear' },
      { text: '.' },
    ],
  },
  {
    agent: 'lex',
    agentLabel: 'Lex · Legal',
    outcome: 'Every contract read closely, before it gets signed.',
    segments: [
      { text: 'Read the MSA sitting in ' },
      { tool: 'Google Drive', slug: 'google-drive' },
      { text: ', flag anything non-standard against our playbook, and summarise the risk in ' },
      { tool: 'Notion', slug: 'notion' },
      { text: '.' },
    ],
  },
  {
    agent: 'rex',
    agentLabel: 'Rex · Data & Finance',
    outcome: 'A board-ready summary reconciled across three sources.',
    segments: [
      { text: 'Pull last quarter from ' },
      { tool: 'Stripe', slug: 'stripe' },
      { text: ' and ' },
      { tool: 'QuickBooks Online', slug: 'quickbooks-online' },
      { text: ', reconcile it against ' },
      { tool: 'Google Sheets', slug: 'google-sheets' },
      { text: ', and build the board summary.' },
    ],
  },
];

/* ──────────────────────────────────────────────────────────────
   Marquee (retained for inner pages)
   ────────────────────────────────────────────────────────────── */

export const marqueeItems = [
  'Always on', 'No onboarding lag', 'Shared company context',
  'Works in your stack', 'Billed per agent', 'Cancel anytime',
];

export const marqueeRedItems = [
  'Six specialists',
  'One shared brain',
  'Fifty-two integrations',
  'From $9 a month',
];

/* ──────────────────────────────────────────────────────────────
   How it works
   ────────────────────────────────────────────────────────────── */

export const howItWorksSteps = [
  {
    n: '01',
    t: 'Connect your stack',
    d: 'OAuth into mail, calendar, CRM, analytics, billing, and docs. Fifty-two integrations are supported out of the box — no middleware and no custom build.',
    c: '#6FCDE8',
  },
  {
    n: '02',
    t: 'Brief the brain once',
    d: 'Add your brand voice, positioning, goals, and competitors. Every agent reads that context before it acts, so you never re-explain your business.',
    c: '#F5C518',
  },
  {
    n: '03',
    t: 'Delegate in plain English',
    d: 'Ask the way you would ask a colleague. The agent does the work across your tools and comes back with the finished deliverable, not a to-do list.',
    c: '#1DBC87',
  },
];

/* ──────────────────────────────────────────────────────────────
   Outcomes
   ────────────────────────────────────────────────────────────── */

export const outcomeStats = [
  { v: '9 min',   k: 'Median time to first completed task' },
  { v: '52',      k: 'Integrations available on day one' },
  { v: '$9',      k: 'Per agent, per month, billed separately' },
  { v: '24/7',    k: 'Coverage across every timezone you sell into' },
];

/* ──────────────────────────────────────────────────────────────
   Pricing
   ────────────────────────────────────────────────────────────── */

export interface PricingTier {
  name: string;
  monthly: number;
  yearly: number;
  tag: string;
  color: string;
  includes: string[];
  popular?: boolean;
  custom?: boolean;
}

export interface AgentPricing {
  key: string;
  monthly: number | null;
}

const defaultAgentMonthlyDollars: Record<string, number> = {
  maya: 19,
  sage: 9,
  lex: 9,
  rex: 9,
  scout: 9,
  vega: 9,
};

function publicAgentPrice(key: string): number {
  const envKey = `NEXT_PUBLIC_AGENT_PRICE_${key.toUpperCase()}_MONTHLY_CENTS`;
  const cents = Number(process.env[envKey]);
  return Number.isInteger(cents) && cents > 0 ? Math.round(cents / 100) : defaultAgentMonthlyDollars[key];
}

export const agentPricing: AgentPricing[] = [
  { key: 'maya', monthly: publicAgentPrice('maya') },
  { key: 'sage', monthly: publicAgentPrice('sage') },
  { key: 'lex', monthly: publicAgentPrice('lex') },
  { key: 'rex', monthly: publicAgentPrice('rex') },
  { key: 'scout', monthly: publicAgentPrice('scout') },
  { key: 'vega', monthly: publicAgentPrice('vega') },
];

export const enterpriseTier: PricingTier = {
  name: 'Enterprise',
  monthly: 99,
  yearly: 0,
  tag: 'Built around your team',
  color: '#8A8AF0',
  includes: [
    'Custom SLAs',
    'Dedicated onboarding & support',
    'Custom integrations',
    'Volume / seat-based pricing',
    'Priority support channel',
    'Dedicated account manager',
  ],
  custom: true,
};

export const PRICING_FAQ = [
  { q: 'Is there a free trial?', a: 'Yes — seven days, no credit card required. Full access to all six agents from day one.' },
  { q: 'Can I cancel anytime?', a: 'Yes. Cancel any agent at any time from the billing portal; you keep access until the end of the period you have already paid for.' },
  { q: 'What integrations are included?', a: 'Fifty-two integrations across mail, calendar, social, CRM, analytics, billing, storage, docs, project management, and databases — all included at every price point.' },
  { q: 'Do agents share memory across tasks?', a: 'Yes. Your company brain — profile, brand voice, goals, competitors — is read by all six agents, so their work stays consistent with each other.' },
  { q: 'Is my data used to train your AI?', a: 'Never. Your content is used only to perform the tasks you ask for.' },
  { q: 'Can I buy just one agent?', a: 'Yes. Every agent is billed independently starting at $9/mo. Take only the ones you need and add more whenever you are ready.' },
];

/* ──────────────────────────────────────────────────────────────
   FAQ — buyer questions
   ────────────────────────────────────────────────────────────── */

export const faqItems = [
  {
    q: 'How is this different from ChatGPT or a general AI assistant?',
    a: 'A general assistant answers questions in a chat window and forgets you afterwards. Veqiro agents hold a persistent company brain, connect to your actual tools through OAuth, and return finished deliverables — a sent reply, a published post, a filed report — rather than text you still have to act on.',
  },
  {
    q: 'Do I have to buy all six agents?',
    a: 'No. Each agent is billed independently from $9/mo. Most teams start with one or two where the pain is sharpest, then add others as the workload shifts.',
  },
  {
    q: 'What happens to work I disagree with?',
    a: 'Nothing ships without your say-so on the actions that matter. Replies, posts, and documents land in a review queue by default; you approve, edit, or reject. You can widen autonomy per agent once you trust the output.',
  },
  {
    q: 'How long does setup actually take?',
    a: 'About nine minutes for the first agent: connect the tools it needs, fill in your company brain, and give it a task. Each additional agent inherits the same brain, so it is faster than the first.',
  },
  {
    q: 'Is my data used to train your models?',
    a: 'No. Your content is used solely to perform the tasks you request. Connections use OAuth, so we never hold your passwords, and data is encrypted in transit and at rest.',
  },
  {
    q: 'What if an agent gets something wrong?',
    a: 'You correct it once and the correction goes into the shared brain, so every agent applies it from then on. Accuracy compounds instead of resetting each session.',
  },
  {
    q: 'Will this replace people on my team?',
    a: 'It replaces the work that never got assigned to anyone. Teams typically use Veqiro to cover the six functions they could not justify hiring for yet, and redirect the people they do have to higher-value work.',
  },
  {
    q: 'Which tools do you integrate with?',
    a: 'Fifty-two, including Gmail, Outlook, Google Calendar, Slack, HubSpot, Stripe, QuickBooks, Google Analytics, Search Console, Ahrefs, Notion, Linear, Airtable, Supabase, and BigQuery. If your team already uses it, an agent can most likely reach it.',
  },
];

export const crewReplies: Record<string, string> = {
  vega: 'Move the Thursday one — the investor call takes priority.',
  scout: 'Show me the weird one.',
  maya: 'Deeper contrast on the hero. Logo bottom-right across all placements.',
  sage: 'Write the title tag, H1, and meta description.',
  lex: "What does 'indirect damages' mean here? And do we have GDPR exposure?",
  rex: 'What drove the April churn spike?',
};

export const crewFollows: Record<string, string> = {
  vega: "Done. I've also blocked two hours tomorrow for deep work.",
  scout: 'Company in Tallinn, four employees, shipping faster than Stripe did in 2012. Worth a call.',
  maya: 'All four updated — deeper contrast, logo anchored bottom-right on every placement. Launch campaign locked.',
  sage: "Title: 'AI Employees for Founders — Veqiro'. H1: 'Meet Your AI Employees.' Meta and content brief are ready too.",
  lex: 'Indirect damages = lost profits, reputational harm, business interruption — uncapped. GDPR: no DPA, no sub-processor list, three critical gaps.',
  rex: 'All eight churned from the same January cohort on the Starter plan. Fit issue, not product. Full breakdown and three recommendations are ready.',
};

export interface FooterColumn {
  h: string;
  links: { label: string; href: string }[];
}

export const footerColumns: FooterColumn[] = [
  {
    h: 'Agents',
    links: [
      { label: 'Vega — Executive Assistant', href: '/agents/vega' },
      { label: 'Scout — Research', href: '/agents/scout' },
      { label: 'Maya — Content', href: '/agents/maya' },
      { label: 'Sage — SEO', href: '/agents/sage' },
      { label: 'Lex — Legal', href: '/agents/lex' },
      { label: 'Rex — Finance', href: '/agents/rex' },
    ],
  },
  {
    h: 'Product',
    links: [
      { label: 'Pricing', href: '/pricing' },
      { label: 'Compare', href: '/compare' },
      { label: 'How it works', href: '/#how' },
      { label: 'Integrations', href: '/#integrations' },
      { label: 'FAQ', href: '/#faq' },
    ],
  },
  {
    h: 'Use cases',
    links: [
      { label: 'Founders', href: '/use-cases/founders' },
      { label: 'Marketing teams', href: '/use-cases/marketing-teams' },
      { label: 'Agencies', href: '/use-cases/agencies' },
      { label: 'Growing startups', href: '/use-cases/growing-startups' },
    ],
  },
  {
    h: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Blog', href: '/blog' },
      { label: 'Contact', href: '/about#contact' },
      { label: 'Feedback', href: `${consoleUrl}/feedback` },
    ],
  },
  {
    h: 'Legal',
    links: [
      { label: 'Privacy policy', href: '/privacy' },
      { label: 'Terms of service', href: '/terms' },
    ],
  },
];

export const footerBottom = {
  copyright: '© 2026 Veqiro Labs',
  links: [] as { label: string; href: string }[],
};

export const siteConfig = {
  consoleUrl,
  landingUrl,
  contact,
  social,
  nav,
  heroCopy,
  problemCopy,
  brainCopy,
  examplePrompts,
  marqueeItems,
  marqueeRedItems,
  howItWorksSteps,
  outcomeStats,
  agentPricing,
  enterpriseTier,
  faqItems,
  crewReplies,
  crewFollows,
  footerColumns,
  footerBottom,
};
