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

export const maxWaitlistSlots = 100;

export const waitlistUrl = '/waitlist';

export const contact = {
  email: 'info@veqiro.com',
  phone: '+1 (555) 010-0000',
  address: 'Made in a small room, loud — IN',
};

export const social = {
  twitter: 'https://x.com/veqiro?s=11',
  linkedin: 'https://www.linkedin.com/company/veqiro',
  instagram: 'https://www.instagram.com/veqiro._?igsh=MWowNDA5MWhrY2w1NQ==',
};

export const nav: { href: string; label: string }[] = [
  { href: '#crew', label: 'The Crew' },
  { href: '#how', label: 'How it Works' },
  { href: 'pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
];

export interface UseCaseNavItem {
  slug: string;
  persona: string;
  tagline: string;
  color: string;
}

export const useCaseNavItems: UseCaseNavItem[] = [
  { slug: 'founders',         persona: 'Founders',         tagline: '6 hires, no payroll',  color: '#F5C518' },
  { slug: 'marketing-teams',  persona: 'Marketing Teams',  tagline: 'Ship at 3x pace',       color: '#F06464' },
  { slug: 'agencies',         persona: 'Agencies',         tagline: 'Multi-client ready',    color: '#8A8AF0' },
  { slug: 'growing-startups', persona: 'Growing Startups', tagline: 'Scale without hiring', color: '#1DBC87' },
];

export const demoCtaHref = `mailto:${contact.email}?subject=Veqiro%20demo%20request`;

export const marqueeItems = [
  ' zero sick days', ' works at 3am', ' no payroll', ' ships fast',
  ' zero drama', ' never sleeps', ' no small talk', ' always on',
  ' no HR incidents', ' hire today',
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
    d: "Each has their own inbox, voice, and weirdly specific taste. Your whole crew, ready day one.",
    c: '#F5C518',
  },
  {
    n: '02',
    t: 'Brief them',
    d: "Drop in your brand kit — voice, goals, context. Then just talk to them. They brief themselves and show up ready every day.",
    c: '#F06464',
  },
  {
    n: '03',
    t: 'Go touch grass',
    d: "They get to work — no check-ins, no hand-holding. You hear from them when it's done.",
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
    name: 'Crew',
    monthly: 39,
    yearly: 29,
    tag: 'the full gang',
    color: '#F06464',
    includes: [
      'Your 6-Member AI Team (All Included)',
      'Lex, Maya, Rex, Sage, Scout & Vega — Ready to Work',
      'Everything Stays Connected (Shared Context)',
      'Faster Than Traditional Workflows',
      'Speaks Exactly Like Your Brand',
      'Works With Your Existing Tools',
    ],
    popular: true,
  },
];

export const faqItems = [
  {
    q: 'wait… are these real people?',
    a: "No. Real people need sleep, salaries, and validation. These don't.",
  },
  {
    q: "so they won't ghost me like freelancers?",
    a: "Exactly. They don't disappear mid-project or \"circle back next week.\"",
  },
  {
    q: 'will they replace my team?',
    a: "Only the part of your team that says \"let's do it tomorrow.\"",
  },
  {
    q: 'do they take breaks?',
    a: "No lunch. No coffee. No burnout. Just work. Constantly. Slightly terrifying.",
  },
  {
    q: 'what if they make mistakes?',
    a: "They fix them. Unlike that one guy who still blames \"miscommunication.\"",
  },
  {
    q: 'is my data safe?',
    a: "Safer than your \"123456\" password era. We take security more seriously than your last startup idea.",
  },
  {
    q: 'do they judge my ideas?',
    a: "Never. Even your \"Uber for dogs but crypto-powered\" idea is safe here.",
  },
  // {
  //   q: 'how fast are they?',
  //   a: "Faster than your motivation after watching one startup reel.",
  // },
  // {
  //   q: 'can they handle pressure?',
  //   a: "They don't feel pressure. They apply pressure — on your pending tasks.",
  // },
  {
    q: "what if I don't know what I'm doing?",
    a: "Perfect. That's literally why they exist.",
  },
  {
    q: 'is this just another AI tool?',
    a: "If it was, you'd already have 5 tabs open and still be confused.",
  },
  {
    q: 'why Veqiro?',
    a: "Because doing everything yourself was never a flex. It was just inefficient.",
  },
];

export const crewReplies: Record<string, string> = {
  vega: "Move the Thursday one — investor call takes priority.",
  scout: "Show me the weird one.",
  maya: "Deeper contrast on the hero. Logo bottom-right across all placements.",
  sage: "Do it. Coffee's on me.",
  lex: "Redline it, send to counsel.",
  rex: "Show me the weird thing.",
};

export const crewFollows: Record<string, string> = {
  vega: "Done. Also blocked 2hrs tomorrow for deep work — you're welcome.",
  scout: "K. Company in Tallinn, 4 employees, shipping faster than Stripe did in 2012. Worth a call.",
  maya: "All 4 updated — deeper contrast, logo anchored bottom-right on every placement. Launch campaign locked. Instagram square first?",
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
      { label: 'Vega', href: '/agents/vega' },
      { label: 'Scout', href: '/agents/scout' },
      { label: 'Maya', href: '/agents/maya' },
      { label: 'Sage', href: '/agents/sage' },
      { label: 'Lex', href: '/agents/lex' },
      { label: 'Rex', href: '/agents/rex' },
    ],
  },
  {
    h: 'Product',
    links: [
      { label: 'Pricing', href: '/pricing' },
      { label: 'How it works', href: '/#how' },
      { label: 'FAQ', href: '/#faq' },
    ],
  },
  {
    h: 'Use Cases',
    links: [
      { label: 'For Founders', href: '/use-cases/founders' },
      { label: 'For Marketing Teams', href: '/use-cases/marketing-teams' },
      { label: 'For Agencies', href: '/use-cases/agencies' },
      { label: 'For Growing Startups', href: '/use-cases/growing-startups' },
    ],
  },
  {
    h: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Blog', href: '/blog' },
    ],
  },
  {
    h: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
    ],
  },
];

export const footerBottom = {
  copyright: '© 2026 veqiro labs · made by humans (mostly)',
  links: [] as { label: string; href: string }[],
};

export const siteConfig = {
  consoleUrl,
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
