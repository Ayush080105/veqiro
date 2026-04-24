export interface DemoChatMessage {
  role: 'user' | 'agent';
  content: string;
  delayMs: number;
}

export interface AgentCapability {
  title: string;
  description: string;
}

export interface AgentOutcome {
  title: string;
  body: string;
}

export interface AgentFaq {
  q: string;
  a: string;
}

export interface AgentWorkflowStep {
  title: string;
  body: string;
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
  // SEO / content expansion fields
  howItHelps: string;         // deep paragraph tying to primary keyword
  workflow: AgentWorkflowStep[];
  outcomes: AgentOutcome[];
  faq: AgentFaq[];
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
    howItHelps: "Vega is an AI executive assistant built for founders and operators who lose two hours a day to inbox management and calendar tetris. She plugs into Gmail and Google Calendar, reads every thread, ranks what's urgent, drafts replies in your voice, and fills gaps in your schedule before someone else does. Think of her as an AI email assistant and AI scheduling assistant rolled into one — available at 3 AM when a client in another timezone pings you, and at 9 AM when you finally sit down with coffee.",
    workflow: [
      {
        title: "1. Connect your inbox and calendar",
        body: "Vega connects to Gmail and Google Calendar in under a minute. She reads the last 30 days to learn your writing style, who matters most, and what meetings you actually take.",
      },
      {
        title: "2. Set your rules",
        body: "Tell her who gets a same-day reply, who waits, and what your non-negotiable focus blocks look like. She respects them forever — no retraining required.",
      },
      {
        title: "3. Let her run mornings",
        body: "Every morning she sends a briefing: what's urgent, what she replied to, what needs your eyes, and what got moved on the calendar. You review in 5 minutes. You ship.",
      },
    ],
    outcomes: [
      {
        title: "Inbox zero without the grind",
        body: "Vega triages every email, drafts replies for the predictable ones, and flags the 3 that actually need your brain. You get your morning back.",
      },
      {
        title: "No more meeting pile-ups",
        body: "She spots the day that's stacking up before it happens, reshuffles the movable ones, and protects your deep-work blocks from creep.",
      },
      {
        title: "A briefing, not a chase",
        body: "Instead of chasing threads, you start the day with a one-screen summary: what's landed, what she handled, what's waiting for you.",
      },
      {
        title: "Emails that sound like you",
        body: "Vega writes in your voice — not a polite customer-service tone. Founders stop rewriting her drafts after the first week.",
      },
    ],
    faq: [
      {
        q: "How does an AI executive assistant actually work?",
        a: "Vega connects to your Gmail and Google Calendar, reads your existing correspondence to learn your style, and then starts triaging incoming mail — flagging urgency, drafting replies, booking meetings, and sending you a daily briefing. You review before anything goes out.",
      },
      {
        q: "Can AI really replace a virtual assistant?",
        a: "For inbox management, calendar scheduling, and daily briefings — yes. Vega is available 24/7, doesn't forget context, and costs a fraction of a human VA. For tasks that need judgment calls (HR, personal errands), keep a human. For the other 80% of the work, Vega is faster.",
      },
      {
        q: "How do I automate my inbox with AI without losing my voice?",
        a: "Vega learns your voice from your past 30 days of email. She drafts in that tone, uses your usual greetings and sign-offs, and even mirrors your punctuation style. You review each draft before it ships, so the voice stays yours.",
      },
      {
        q: "What does Vega do that Gmail's built-in AI doesn't?",
        a: "Gmail's AI writes surface-level replies. Vega understands context across threads, remembers your preferences, schedules meetings based on your priorities, and proactively blocks deep-work time. She's an agent, not an autocomplete.",
      },
      {
        q: "Is my email data safe?",
        a: "Yes. Veqiro uses OAuth to connect (no password sharing), encrypts all data in transit and at rest, and is SOC 2 Type II certified. Your emails are never used to train our models.",
      },
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
    howItHelps: "Scout is an AI competitor research tool and AI market research assistant in one. Instead of spending a Thursday in twenty browser tabs piecing together what your rivals are doing, you ask Scout — and ten minutes later you have a memo with sources, positioning shifts, pricing moves, and the weird signal your team would have missed. She's built for founders doing fundraise diligence, sales teams qualifying enterprise accounts, and product teams tracking feature launches without burning their day on it.",
    workflow: [
      {
        title: "1. Tell Scout who to watch",
        body: "Drop in your top 3–5 competitors, your target markets, and the topics you care about. Scout builds a watchlist and starts monitoring their websites, pricing pages, job boards, review sites, press mentions, and social.",
      },
      {
        title: "2. Ask the question",
        body: "\"How is Rival A positioning against us this quarter?\" or \"Who just raised in our category?\" Scout pulls from 20+ sources, synthesizes, and writes a memo — not a data dump.",
      },
      {
        title: "3. Get the memo, not the mess",
        body: "Every output is a crisp memo: headline finding, 3–5 key points, evidence links, and a recommendation. You read it in 3 minutes, act on it, move on.",
      },
    ],
    outcomes: [
      {
        title: "Weekly competitor teardowns",
        body: "A standing report on what your rivals shipped, priced, hired, or said publicly — without anyone on your team running a manual sweep.",
      },
      {
        title: "Fundraise-ready market memos",
        body: "Need a market-sizing note for an investor call by Friday? Scout produces it Thursday evening with citations you can trust.",
      },
      {
        title: "Lead research at scale",
        body: "Point her at a list of target accounts and get back profiles: size, funding, tech stack, key contacts, and why now.",
      },
      {
        title: "Trend radar",
        body: "She surfaces topics gaining momentum in your industry with evidence, so you jump on the wave instead of reading about it in someone's newsletter three months later.",
      },
    ],
    faq: [
      {
        q: "What's an AI competitor research tool actually good for?",
        a: "Running the kind of weekly competitive sweep your team should do but never has time for. Scout watches rival websites, pricing pages, job boards, and press — and tells you what changed, with evidence.",
      },
      {
        q: "How is Scout different from SimilarWeb or Crunchbase?",
        a: "Those are databases. Scout is an AI research assistant — she reads across sources and writes a memo with recommendations, not just raw numbers. Use her on top of those tools, or replace a $300/mo data subscription for most early-stage use.",
      },
      {
        q: "Can AI really do competitive intelligence?",
        a: "For monitoring, synthesis, and memo writing — yes. For strategic judgment calls (what to do with the intel), you still need a human. Scout handles the part that takes 80% of the hours so your team can spend time on the part that matters.",
      },
      {
        q: "What sources does Scout use?",
        a: "Competitor websites, pricing and changelog pages, press releases, job boards (a great signal for strategy), review sites like G2 and Capterra, public filings where available, and the open web. All sources are cited.",
      },
      {
        q: "How often should I ask Scout for updates?",
        a: "Most teams set up a weekly digest on their top 3 rivals, plus ad-hoc deep-dives when something specific breaks. The weekly cadence catches drift; the ad-hoc catches shocks.",
      },
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
    howItHelps: "Maya is an AI content generator and AI copywriter that actually respects brand voice. She reads your brand kit, your past posts, and your positioning — then writes LinkedIn posts, blogs, ad copy, and social threads that sound like you, not like the same generic AI content everyone's scrolling past. She's an AI social media post generator for the teams who've been burned by tools that ship robotic drafts and call it a week.",
    workflow: [
      {
        title: "1. Upload the brand",
        body: "Drop in your brand kit: tone of voice, target audience, taboo words, three examples of content you love. Maya calibrates to it in minutes.",
      },
      {
        title: "2. Ask for what you need",
        body: "\"Three LinkedIn posts about our feature launch.\" \"A thread on our category's biggest misconception.\" \"A 1,200-word blog on X.\" Maya ships drafts in minutes — usually with two or three angle options.",
      },
      {
        title: "3. Ship or remix",
        body: "Pick a direction. Maya writes the final version, generates on-brand images, suggests best-posting-time windows, and hands it off ready to publish.",
      },
    ],
    outcomes: [
      {
        title: "A content calendar that fills itself",
        body: "Instead of staring at an empty editorial calendar on Monday, you wake up to 5 drafts already written, each in your voice, ready to approve or remix.",
      },
      {
        title: "Platform-native content",
        body: "LinkedIn posts that use hooks and line breaks LinkedIn rewards. Twitter/X threads that pace correctly. Instagram captions that don't read like a press release. Each platform gets the tone it deserves.",
      },
      {
        title: "On-brand visuals",
        body: "Maya generates post images using your brand colors, logo, and typography. No more Canva detour.",
      },
      {
        title: "Ad copy that converts",
        body: "Feed her your ICP and past top performers, get back headline + body + CTA variations tuned for paid. She learns from what you actually ship.",
      },
    ],
    faq: [
      {
        q: "Can an AI content generator actually write in my brand voice?",
        a: "Yes — once it has enough samples. Maya reads 5–10 of your existing posts plus a short voice guide, and calibrates in minutes. Most teams stop rewriting her drafts by the second week.",
      },
      {
        q: "How is Maya different from Jasper or Copy.ai?",
        a: "Maya is an AI employee, not a prompt-driven tool. She remembers your campaigns, pulls context from Scout on competitors, and fits into a shared crew — not just another tab you open when you need copy.",
      },
      {
        q: "What platforms does Maya write for?",
        a: "LinkedIn, Twitter/X, Instagram, and long-form blog out of the box. She understands platform conventions (hooks, line breaks, hashtag etiquette, ideal length) for each.",
      },
      {
        q: "Does Maya replace our copywriter?",
        a: "She replaces the repetitive execution — 80% of the drafts that clog your queue. Your senior copywriter focuses on strategy, campaigns, and the 20% of work that needs human taste.",
      },
      {
        q: "How do I keep AI-generated content from sounding like AI?",
        a: "Two things: a strong brand voice guide (Maya uses it), and reviewing drafts before shipping. Maya writes first drafts; you decide what ships. The final voice is always yours.",
      },
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
    howItHelps: "Sage is an AI SEO tool and AI blog writer built around how search actually works today — not the playbook from 2019. She handles keyword research with intent classification, writes SEO-optimized articles with correct heading structure and schema, audits what you already have, and keeps track of what's ranking. Think of her as an AI SEO specialist and AI keyword research tool combined — cheaper than a solo SEO hire, faster than any retainer, and actually tuned for founder-led teams that need organic traffic to compound.",
    workflow: [
      {
        title: "1. Plug in your site and goals",
        body: "Sage scans your existing pages, maps your current keyword footprint, and cross-references against your competitors and your target audience. She surfaces gaps within an hour.",
      },
      {
        title: "2. Pick the wins",
        body: "She hands you a ranked list of high-intent, low-competition keyword clusters — organized by estimated time-to-rank. You pick the first 3. She takes it from there.",
      },
      {
        title: "3. Ship content that ranks",
        body: "Full article drafts with H2/H3 structure, meta descriptions, FAQ schema, internal links, and image alt text. You review, publish, and watch rankings climb over 3–6 weeks.",
      },
    ],
    outcomes: [
      {
        title: "Keyword research with intent classification",
        body: "Not a 5,000-row CSV. A filtered list: what to write first (quick wins), what to write next (medium-term), what to ignore (wasted effort).",
      },
      {
        title: "SEO-ready blog drafts",
        body: "Complete articles with proper H-tag structure, meta tags, schema markup, and internal link suggestions — ready to publish, not ready to edit for three more hours.",
      },
      {
        title: "Content audits with fix lists",
        body: "She grades your existing pages against current ranking factors and gives you specific, prioritized fixes — not generic advice like 'improve your E-E-A-T.'",
      },
      {
        title: "Content briefs for humans",
        body: "If you still want a human writer on certain pieces, Sage writes the brief: SERP analysis, competitor angles, questions to answer, target word count.",
      },
    ],
    faq: [
      {
        q: "Can an AI SEO tool actually rank content?",
        a: "Yes — when the content is well-targeted, well-structured, and paired with basic link building. Sage handles the targeting and structure; link building is still on you. Most pages she writes start ranking in 4–8 weeks.",
      },
      {
        q: "How is Sage different from SEMrush or Surfer?",
        a: "SEMrush is a data tool. Surfer is an optimization scorer. Sage is an SEO agent — she does the research, writes the content, handles the on-page SEO, and produces the briefs. She replaces the workflow, not just one step in it.",
      },
      {
        q: "Does Sage do keyword research too?",
        a: "Yes — that's her starting point. Intent-classified keyword lists with difficulty scores and volume estimates, filtered to what you can actually win given your domain authority.",
      },
      {
        q: "Can she audit my existing blog?",
        a: "Yes. She scores each page against current ranking factors and returns a prioritized list of specific edits — which pages to kill, which to refresh, which are close to a breakthrough.",
      },
      {
        q: "How long until SEO with AI actually pays off?",
        a: "First rankings typically show up in 3–6 weeks for low-competition keywords; compound growth starts around month 3; meaningful traffic usually hits by month 6. Sage won't promise overnight results — she'll promise a pipeline that doesn't stop.",
      },
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
    howItHelps: "Lex is AI contract review for founders who'd rather not pay a lawyer $600 just to read an NDA. She's an AI legal assistant that reads any contract — NDA, MSA, vendor agreement, offer letter — in minutes, flags risky clauses in plain English, and suggests redline edits you can send back. She's not a replacement for counsel on the big deals. She's what makes sure you don't walk into your counsel meeting blind, and she covers every routine document without a $300/hour bill.",
    workflow: [
      {
        title: "1. Drop in the contract",
        body: "Upload any PDF or Word doc. Lex reads the whole thing in under 5 minutes — NDAs, MSAs, SaaS agreements, vendor contracts, offer letters, independent contractor agreements.",
      },
      {
        title: "2. Get the flagged issues",
        body: "She returns a ranked list of risks: perpetual licenses, uncapped liability, one-sided indemnification, auto-renewal traps, unusual IP assignments — with the exact clause reference and a plain-English explanation.",
      },
      {
        title: "3. Take the redline",
        body: "Ask her to draft suggested edits. She generates redlines you can send back as a Word doc with track changes, or copy into your lawyer's response for acceleration.",
      },
    ],
    outcomes: [
      {
        title: "Contract review in minutes, not days",
        body: "A 40-page MSA that would sit on a lawyer's desk for 5 days gets a first-pass review in 5 minutes — so you know what matters before the billable meeting starts.",
      },
      {
        title: "Plain-English summaries",
        body: "Every clause translated: what it says, what it means, what it means for you. No legalese, no 'subject to section 14.3.b' circular references.",
      },
      {
        title: "Template library on tap",
        body: "NDAs, SaaS agreements, offer letters, contractor agreements — generated from proven templates, customized to your details, ready to send.",
      },
      {
        title: "Compliance spot-checks",
        body: "Evaluate your practices against GDPR, CCPA, SOC 2, HIPAA, and PCI-DSS with a prioritized gap list. Not a replacement for an audit — a cheat sheet before one.",
      },
    ],
    faq: [
      {
        q: "Can AI actually review legal contracts?",
        a: "For flagging risky clauses, unusual terms, and missing protections — yes, reliably. For nuanced negotiation or litigation strategy — no, you still need a human lawyer. Lex handles the 80% that's pattern recognition, so your lawyer focuses on the 20% that needs judgment.",
      },
      {
        q: "Is AI contract review safe?",
        a: "Safe in the sense of identifying risks — yes. Safe in the sense of replacing your lawyer for high-stakes deals — no. Treat Lex as a first-pass reviewer and a second opinion, not a legal decision-maker on anything that could sink the company.",
      },
      {
        q: "What's the best AI for NDA review for startups?",
        a: "Standard mutual NDAs are Lex's sweet spot — she reads them in 2 minutes, flags unusual confidentiality terms, and tells you whether it's safe to sign without counsel. Most founders stop routing routine NDAs to their lawyer.",
      },
      {
        q: "Will Lex replace our legal counsel?",
        a: "No — and she's explicit about that. She replaces the bottleneck of waiting 3 days to hear back on a vendor agreement. Your counsel still handles fundraising docs, employment disputes, and anything strategic.",
      },
      {
        q: "Does she draft contracts too?",
        a: "Yes. She generates NDAs, SaaS agreements, independent contractor agreements, offer letters, and standard startup docs — customized to your specifics, ready to send or pass to counsel for final review.",
      },
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
    howItHelps: "Rex is an AI financial analyst for SaaS founders who need to know their MRR, burn, CAC, and runway without staring at a dashboard every morning. He plugs into Stripe, your bank, and your ad platforms, tracks every SaaS metric that matters, and flags anomalies before they become bad news in a board deck. Think of him as an AI CFO-on-call: he doesn't close your books, but he'll tell you exactly where you stand, what changed, and what to pay attention to this week.",
    workflow: [
      {
        title: "1. Connect the money sources",
        body: "Stripe, bank accounts, ad platforms (Meta, Google), and your accounting tool if you have one. Rex reads the data and builds a baseline of your unit economics in hours, not weeks.",
      },
      {
        title: "2. Define what matters",
        body: "Tell Rex your KPIs — MRR growth, CAC, LTV, churn, burn rate, runway. He tracks them automatically and establishes normal ranges so anomalies stand out.",
      },
      {
        title: "3. Get the briefings",
        body: "Daily or weekly briefings on your financial health — what's up, what's down, what's weird, and what you should look into. Investor-update emails on demand.",
      },
    ],
    outcomes: [
      {
        title: "MRR, burn, and runway tracking on autopilot",
        body: "No more spreadsheet panic before a board meeting. Rex keeps a live read of your runway — number, not estimate — and tells you when it's slipping.",
      },
      {
        title: "CAC and LTV with actual math",
        body: "Not the back-of-napkin version. Rex breaks CAC by channel, tracks payback period, and flags when a channel's getting expensive before you've wasted another month's budget on it.",
      },
      {
        title: "Anomaly detection that catches the weird stuff",
        body: "A 3x CAC spike on one ad set on a Tuesday afternoon. Churn concentrated in one cohort. Revenue recognized on a refunded charge. Rex flags these the day they happen.",
      },
      {
        title: "Investor updates, done",
        body: "Monthly investor updates with real metrics, narrative, and the three things you want investors to notice. You approve, you send.",
      },
    ],
    faq: [
      {
        q: "How does an AI financial analyst track SaaS metrics?",
        a: "Rex connects to Stripe, your bank, your ad platforms, and (optionally) your accounting tool. He calculates MRR, ARR, churn, CAC, LTV, burn, and runway automatically — refreshed daily, with anomaly detection built in.",
      },
      {
        q: "Can AI replace a CFO?",
        a: "Not for strategic finance work — fundraising strategy, complex tax decisions, financial controls. But for tracking, reporting, anomaly detection, and routine forecasting? Yes, Rex replaces most of that work at 1/20th the cost.",
      },
      {
        q: "What metrics does Rex track out of the box?",
        a: "MRR, ARR, growth rate, churn rate, net revenue retention, CAC (by channel), LTV, LTV:CAC ratio, payback period, gross margin, burn rate, runway, and cash balance. Add custom KPIs anytime.",
      },
      {
        q: "How accurate is AI revenue forecasting?",
        a: "Rex's forecasts use your last 6–12 months of data, cohort behavior, and seasonality to project forward with confidence bands. For steady-state SaaS: very accurate. For step-function changes (new product, big campaign): always model scenarios.",
      },
      {
        q: "Will Rex catch fraud or errors?",
        a: "He catches statistical anomalies — spikes, drops, unusual patterns. That will surface most billing errors and some fraud. For a forensic audit, still hire humans. For day-to-day weirdness, he's vigilant.",
      },
    ],
  },
];
