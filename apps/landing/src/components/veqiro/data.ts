export interface DemoChatMessage {
  role: 'user' | 'agent';
  content: string;
  delayMs: number;
}

export interface AgentCapability {
  title: string;
  description: string;
}

export interface Employee {
  key: string;
  name: string;
  role: string;
  tag: string;
  color: string;
  ink: string;
  skills: string[];
  quote: string;
  stats: { k: string; v: string }[];
  description: string;
  capabilities: AgentCapability[];
  useCases: string[];
  demoChat: DemoChatMessage[];
}

export const EMPLOYEES: Employee[] = [
  {
    key: 'vega',
    name: 'Vega',
    role: 'The Executive Assistant',
    tag: 'Your right hand, 24/7',
    color: '#6FCDE8',
    ink: '#0E5C74',
    skills: ['Inbox triage', 'Calendar tetris', 'Meeting prep', 'Follow-ups'],
    quote: "Sent you a calendar hold for Thursday. Also, Priya wants 15 min on Tuesday — added to your \"maybe\" pile.",
    stats: [{ k: 'Emails handled', v: '1.2M+' }, { k: 'Meetings booked', v: '340K' }, { k: 'Avg reply time', v: '47s' }],
    description: "Vega runs your inbox, books your calendar, and writes emails that actually sound like you — without you asking twice. She handles the scheduling chaos so your brain stays on the work that matters.",
    capabilities: [
      { title: "Inbox Triage", description: "Reads every email, flags the urgent ones, drafts replies for the rest. You review, approve, done." },
      { title: "Calendar Management", description: "Books meetings, spots conflicts, finds free slots, and blocks deep-work time before someone else does." },
      { title: "Daily Briefing", description: "Every morning: a crisp summary of your day, open threads, and what needs a decision." },
      { title: "Email Drafting", description: "Compose from scratch or reply to a thread — in your voice, with your usual sign-off." },
    ],
    useCases: [
      "Founders drowning in 300+ emails a day",
      "Sales leaders juggling back-to-back demos",
      "Operators coordinating across 4 time zones",
      "Anyone who loses 2 hours a day to scheduling",
    ],
    demoChat: [
      { role: 'user', content: "Vega, what's on my calendar this week?", delayMs: 800 },
      { role: 'agent', content: "You've got 11 events. Tuesday is brutal — 4 back-to-back. I moved the vendor sync to Thursday. Also: Sarah's been trying to reach you since Monday. Want me to draft a reply?", delayMs: 1600 },
      { role: 'user', content: "Yes, keep it short. And block Friday afternoon.", delayMs: 3200 },
      { role: 'agent', content: "Done. Reply sent. Friday 1–5pm blocked as 'Focus — do not book'. I also bumped the investor call to 10am before your block.", delayMs: 4800 },
    ],
  },
  {
    key: 'scout',
    name: 'Scout',
    role: 'Research & Strategist',
    tag: 'Finds the signal, skips the noise',
    color: '#F5C518',
    ink: '#7A5A00',
    skills: ['Market scans', 'Competitor teardowns', 'Memo writing', 'Trend spotting'],
    quote: "Pulled 23 comps, killed 18 that were noise. Here's the 5 that actually move the needle — and one weird one.",
    stats: [{ k: 'Reports written', v: '89K' }, { k: 'Sources cited', v: '4.1M' }, { k: 'Hours saved/week', v: '38' }],
    description: "Scout digs into competitors, markets, and companies so you don't have to spend a Thursday in browser tabs. She gives you a memo, not a data dump — with the stuff that actually matters highlighted.",
    capabilities: [
      { title: "Competitor Research", description: "Full teardown of any competitor: product, pricing, positioning, recent moves, and what their customers complain about." },
      { title: "Market Trends", description: "Spots rising topics in your industry with momentum scores and content angles to get ahead of the wave." },
      { title: "Lead Research", description: "Builds detailed profiles on target companies: size, funding, tech stack, key contacts, and why now." },
      { title: "Research Memos", description: "Synthesizes web sources into a clean memo with sources, key takeaways, and recommended actions." },
    ],
    useCases: [
      "Founders doing competitive diligence before a fundraise",
      "Sales teams qualifying enterprise accounts",
      "Product teams tracking competitor feature launches",
      "Marketers looking for trending content angles",
    ],
    demoChat: [
      { role: 'user', content: "Scout, what's happening with our top 3 competitors this month?", delayMs: 800 },
      { role: 'agent', content: "Pulled 23 sources. Two things worth flagging: Rival A just dropped pricing by 20% on their starter plan — probably responding to churn. Rival B launched a Salesforce integration last week.", delayMs: 1800 },
      { role: 'user', content: "How should we respond to the pricing move?", delayMs: 3400 },
      { role: 'agent', content: "Three options: match it (risky margin hit), reframe on value (safer), or stay quiet and let it play out — they might reverse it, it happened in Q3 last year. Want the full memo?", delayMs: 5000 },
    ],
  },
  {
    key: 'maya',
    name: 'Maya',
    role: 'Content & Marketing',
    tag: 'Writes like a human, ships like a machine',
    color: '#F06464',
    ink: '#7A1717',
    skills: ['Blog posts', 'Ad copy', 'Brand voice', 'Campaign plans'],
    quote: "Drafted 3 headlines, 1 is safe, 1 is spicy, 1 is cursed. I vote spicy. You pick.",
    stats: [{ k: 'Posts published', v: '210K' }, { k: 'Avg CTR lift', v: '+34%' }, { k: 'Brand voices', v: '900+' }],
    description: "Maya writes content that doesn't sound like it came from an AI — because she's trained on what actually gets engagement, not what sounds nice. Give her a topic and she'll have three versions ready before you finish your coffee.",
    capabilities: [
      { title: "Social Media Posts", description: "Platform-native drafts for LinkedIn, Twitter/X, and Instagram — with hooks, hashtags, and predicted engagement baked in." },
      { title: "Blog & Long-form", description: "Full-length articles with structure, flow, and a voice that matches your brand — not a Wikipedia entry." },
      { title: "Ad Copy", description: "Headlines, body copy, CTAs for paid campaigns — built around your ICP and brand tone." },
      { title: "Image Generation", description: "Auto-generates social images using your brand colors, logo, and mascot. No Canva required." },
    ],
    useCases: [
      "Marketing teams producing content across 3+ platforms",
      "Founders who need to post consistently but can't write daily",
      "Agencies managing content for multiple brands",
      "Product launches that need a blitz across channels",
    ],
    demoChat: [
      { role: 'user', content: "Maya, write me a LinkedIn post about our new feature — AI-powered onboarding.", delayMs: 800 },
      { role: 'agent', content: "Got it. I did 3 angles: (1) the 'before vs after' story, (2) a data-first hook with a stat, (3) a cheeky one that might get comments. Which direction?", delayMs: 1800 },
      { role: 'user', content: "Go with the cheeky one.", delayMs: 3200 },
      { role: 'agent', content: "\"We just made onboarding so fast, our users are confused why it's already over. New: AI that sets you up in 4 minutes. No wizard. No 47-step checklist. Just done.\" — image generated with your brand colors. Post it?", delayMs: 5000 },
    ],
  },
  {
    key: 'sage',
    name: 'Sage',
    role: 'The SEO Specialist',
    tag: 'Ranks pages in her sleep',
    color: '#F79FD4',
    ink: '#8E2A6A',
    skills: ['Keyword research', 'On-page SEO', 'Backlink ops', 'SERP tracking'],
    quote: "We're ranking #4 for \"best crm for tiny teams\". Give me a week and a coffee — we'll take #1.",
    stats: [{ k: 'Keywords ranked', v: '2.3M' }, { k: 'Avg position lift', v: '+11' }, { k: 'Traffic unlocked', v: '410M' }],
    description: "Sage knows how search actually works right now — not the theory from 2019. She does keyword research, writes SEO-optimized content, and audits what you already have so your pages actually show up.",
    capabilities: [
      { title: "Keyword Research", description: "Intent-classified keyword lists with difficulty scores, volume, and a clear picture of what to target first." },
      { title: "Blog Generation", description: "Full SEO-optimized articles with correct heading structure, meta tags, schema markup, and internal link suggestions." },
      { title: "Content Audits", description: "Scores your existing pages against ranking factors and surfaces specific improvements — not vague advice." },
      { title: "Content Briefs", description: "Strategic briefs for writers: SERP analysis, competitor gaps, questions to answer, and word count targets." },
    ],
    useCases: [
      "SaaS companies trying to rank for bottom-of-funnel keywords",
      "Startups with existing content that isn't converting",
      "Marketing teams without a dedicated SEO hire",
      "Blogs that need consistent output without sacrificing quality",
    ],
    demoChat: [
      { role: 'user', content: "Sage, what keywords should we target this quarter?", delayMs: 800 },
      { role: 'agent', content: "Ran the research. You're ignoring 3 high-intent, low-competition clusters your rivals haven't touched yet. Biggest: 'ai employee scheduling' — 2,400 searches/mo, difficulty 28. That's a 2-week win.", delayMs: 2000 },
      { role: 'user', content: "Write me a post targeting that keyword.", delayMs: 3600 },
      { role: 'agent', content: "Done — 1,400 words, H2 structure, FAQ schema, internal links to your pricing page. Ready in the content hub. Est. time to rank: 3–4 weeks if we get 3 backlinks.", delayMs: 5200 },
    ],
  },
  {
    key: 'lex',
    name: 'Lex',
    role: 'The Legal Assistant',
    tag: "Reads the fine print so you don't",
    color: '#8A8AF0',
    ink: '#2A2A7A',
    skills: ['NDA review', 'Contract drafting', 'Clause flagging', 'Policy audits'],
    quote: "Clause 7.3 is a trap. Redlined it. Also Clause 4 is fine but written by a poet — I cleaned it up.",
    stats: [{ k: 'Contracts reviewed', v: '180K' }, { k: 'Red flags caught', v: '41K' }, { k: 'Avg review time', v: '4 min' }],
    description: "Lex reads contracts, spots the traps, and explains what the clauses actually mean — in plain English, not legalese. She doesn't replace a lawyer, but she makes sure you don't go into a lawyer meeting blind.",
    capabilities: [
      { title: "Contract Review", description: "Flags risky clauses, missing protections, and unusual terms in NDAs, MSAs, vendor agreements, and employment contracts." },
      { title: "Document Drafting", description: "Generates legal templates for standard startup docs: NDAs, SaaS agreements, offer letters, contractor agreements." },
      { title: "Plain English Explanations", description: "Turns legalese into clear language with a key terms glossary. What it means, and what it means for you." },
      { title: "Compliance Checks", description: "Evaluates your practices against GDPR, CCPA, SOC2, HIPAA, and PCI-DSS — with a prioritized fix list." },
    ],
    useCases: [
      "Founders reviewing their first enterprise contract",
      "Startups about to sign a vendor agreement",
      "Teams preparing for a SOC2 or GDPR audit",
      "Anyone who needs an NDA fast but can't wait for counsel",
    ],
    demoChat: [
      { role: 'user', content: "Lex, I just got a 40-page MSA from an enterprise client. Can you review it?", delayMs: 800 },
      { role: 'agent', content: "Uploading now... Done. 6 flags. The big ones: Clause 12.4 gives them perpetual license to your IP — that needs to go. Clause 18 has uncapped liability. Indemnification is one-sided.", delayMs: 2400 },
      { role: 'user', content: "Draft suggested edits for clause 12.4.", delayMs: 4000 },
      { role: 'agent', content: "Redline ready: replaced 'perpetual, irrevocable' with 'limited, revocable license for the term of the agreement.' Added a clear ownership carve-out for your existing IP. Sending as a Word doc.", delayMs: 5600 },
    ],
  },
  {
    key: 'rex',
    name: 'Rex',
    role: 'Data Analyst & Finance',
    tag: 'Makes spreadsheets sing',
    color: '#1DBC87',
    ink: '#0E5C3F',
    skills: ['Financial models', 'Dashboards', 'Forecasts', 'Anomaly detection'],
    quote: "Revenue is up 12% MoM but your CAC is doing something weird. Want me to show you the weird thing?",
    stats: [{ k: 'Rows crunched', v: '8.9B' }, { k: 'Models built', v: '62K' }, { k: 'Anomalies flagged', v: '120K' }],
    description: "Rex turns your business numbers into a story you actually understand — and flags the weird stuff before it becomes a real problem. He looks at MRR, burn, CAC, and churn so you always know exactly where you stand.",
    capabilities: [
      { title: "Financial Analysis", description: "Full P&L breakdown: MRR, ARR, burn rate, runway, CAC, LTV — with health indicators and what to focus on." },
      { title: "Revenue Forecasting", description: "Project revenue, growth, and churn forward with confidence bands and scenario modeling." },
      { title: "Anomaly Detection", description: "Flags unusual spikes, drops, or patterns in your metrics before they show up in next month's board deck." },
      { title: "Investor Updates", description: "Generates polished investor update emails from your metrics — you just approve and send." },
    ],
    useCases: [
      "Founders preparing for a fundraise or board meeting",
      "Operators who need daily metric visibility without a CFO",
      "Teams trying to understand their unit economics",
      "Anyone who's ever been surprised by their burn rate",
    ],
    demoChat: [
      { role: 'user', content: "Rex, how's our financial health this month?", delayMs: 800 },
      { role: 'agent', content: "Revenue's up 12% MoM — good. But your CAC spiked 3x on Meta last Tuesday. Something changed. Churn is flat at 2.1%. Runway: 14 months at current burn.", delayMs: 1800 },
      { role: 'user', content: "What happened with Meta CAC?", delayMs: 3200 },
      { role: 'agent', content: "Your top-performing ad set got flagged and paused — budget shifted to a weaker creative. Anomaly started at 2pm Tuesday. Want me to model what happens if we pause Meta and double down on organic?", delayMs: 4800 },
    ],
  },
];
