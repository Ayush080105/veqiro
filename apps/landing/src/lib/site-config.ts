// Single source of truth for marketing data.
// Edit copy, links, and content here; components consume from this file.

export const mainAppUrl =
  process.env.NEXT_PUBLIC_MAIN_APP_URL || 'http://localhost:3001';

export const landingUrl =
  process.env.NEXT_PUBLIC_LANDING_URL || 'http://localhost:3000';

export const contact = {
  email: 'hello@veqiro.com',
  phone: '+1 (555) 010-0000',
  address: 'Made in a small room, loud — Bengaluru, IN',
};

export const social = {
  twitter: 'https://twitter.com/veqiro',
  linkedin: 'https://www.linkedin.com/company/veqiro',
  instagram: 'https://www.instagram.com/veqiro',
  github: 'https://github.com/veqiro',
};

export const nav: { href: string; label: string }[] = [
  { href: '#crew', label: 'The Crew' },
  { href: '#how', label: 'How it Works' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
];

export const demoCtaHref = `mailto:${contact.email}?subject=Veqiro%20demo%20request`;

export const marqueeItems = [
  '★ vega', '★ scout', '★ maya', '★ sage', '★ lex', '★ rex',
  '★ 6 AI hires, 1 bill', '★ veqiro',
];

export const marqueeRedItems = [
  'they never sleep',
  'they never slack off',
  'they never ask for a raise',
  'they do ask for coffee (jk)',
];

export const howItWorksSteps = [
  {
    n: '01',
    t: 'Pick your crew',
    d: "Hire all six or start with one. Each has their own inbox, voice, and weirdly specific taste.",
    c: '#F5C518',
  },
  {
    n: '02',
    t: 'Brief them',
    d: "Forward an email. Paste a doc. Share a Loom. They read. They ask questions. They get it.",
    c: '#F06464',
  },
  {
    n: '03',
    t: 'Go touch grass',
    d: "They ping you on Slack when they're stuck or shipping. Everyone else, they handle.",
    c: '#1DBC87',
  },
];

export interface PricingTier {
  name: string;
  monthly: number;
  yearly: number;
  tag: string;
  color: string;
  includes: string[];
  popular?: boolean;
}

export const pricingTiers: PricingTier[] = [
  {
    name: 'Solo',
    monthly: 24,
    yearly: 19,
    tag: 'pick one crew member',
    color: '#6FCDE8',
    includes: ['1 AI employee', 'Slack + email + docs', 'Unlimited tasks', 'Cancel anytime'],
  },
  {
    name: 'Crew',
    monthly: 99,
    yearly: 79,
    tag: 'the full gang',
    color: '#F06464',
    includes: [
      'All 6 AI employees',
      'Shared memory + context',
      'Priority processing',
      'Custom brand voice',
      'Slack + CRM + 30 tools',
    ],
    popular: true,
  },
  {
    name: 'Studio',
    monthly: 299,
    yearly: 249,
    tag: 'for small teams',
    color: '#1DBC87',
    includes: [
      'Everything in Crew',
      '5 human seats',
      'SSO + audit logs',
      'Custom integrations',
      'A human in the loop',
    ],
  },
];

export const faqItems = [
  {
    q: 'wait, are these real people?',
    a: "Nope. They're AI agents — but they have names, personalities, and specialties so you don't have to keep retyping \"act as a senior copywriter with 10 years of experience...\".",
  },
  {
    q: 'what do they actually do?',
    a: "Real work. Vega books meetings via email. Sage pushes SEO changes to your CMS. Rex pulls data from your warehouse. They connect to the tools you already use.",
  },
  {
    q: 'will they replace my team?',
    a: "Your team will become a 3x team. They take the grunt work, your humans stay on the strategy. Also your humans can sleep.",
  },
  {
    q: 'is my data safe?',
    a: "SOC 2 Type II. Zero training on your data. EU + US regions. Delete any time. Lex will quote the fine print at you if you ask.",
  },
  {
    q: 'can I hire just one?',
    a: "Yep — the Solo plan gets you one employee. Most teams start with Maya or Sage and add the rest within a month.",
  },
];

export const crewReplies: Record<string, string> = {
  vega: "Move the Thursday one — investor call takes priority.",
  scout: "Show me the weird one.",
  maya: "Spicy. Always spicy.",
  sage: "Do it. Coffee's on me.",
  lex: "Redline it, send to counsel.",
  rex: "Show me the weird thing.",
};

export const crewFollows: Record<string, string> = {
  vega: "Done. Also blocked 2hrs tomorrow for deep work — you're welcome.",
  scout: "K. Company in Tallinn, 4 employees, shipping faster than Stripe did in 2012. Worth a call.",
  maya: "Drafting now. I'll slack you 3 options in 6 minutes. Brace.",
  sage: "Cool. Starting with the long-tails. First wins in ~10 days.",
  lex: "Redlined. Sending to counsel with a summary. Est read time: 3 min.",
  rex: "Paid CAC spiked 3x on Meta last Tuesday. Want the chart or just the fix?",
};

export interface FooterColumn {
  h: string;
  links: { label: string; href: string }[];
}

export const footerColumns: FooterColumn[] = [
  {
    h: 'The Crew',
    links: [
      { label: 'Vega', href: '#crew' },
      { label: 'Scout', href: '#crew' },
      { label: 'Maya', href: '#crew' },
      { label: 'Sage', href: '#crew' },
      { label: 'Lex', href: '#crew' },
      { label: 'Rex', href: '#crew' },
    ],
  },
  {
    h: 'Company',
    links: [
      { label: 'About', href: demoCtaHref },
      { label: 'Careers', href: demoCtaHref },
      { label: 'Manifesto', href: demoCtaHref },
      { label: 'Press kit', href: demoCtaHref },
    ],
  },
  {
    h: 'Resources',
    links: [
      { label: 'Docs', href: demoCtaHref },
      { label: 'Changelog', href: demoCtaHref },
      { label: 'Status', href: demoCtaHref },
      { label: 'Security', href: demoCtaHref },
    ],
  },
];

export const footerBottom = {
  copyright: '© 2026 veqiro labs · made by humans (mostly)',
  links: [
    { label: 'terms', href: demoCtaHref },
    { label: 'privacy', href: demoCtaHref },
    { label: 'cookies (chocolate chip)', href: demoCtaHref },
  ],
};

export const siteConfig = {
  mainAppUrl,
  landingUrl,
  contact,
  social,
  nav,
  demoCtaHref,
  marqueeItems,
  marqueeRedItems,
  howItWorksSteps,
  pricingTiers,
  faqItems,
  crewReplies,
  crewFollows,
  footerColumns,
  footerBottom,
};
