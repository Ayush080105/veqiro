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
  actions: string[];
}

export const EMPLOYEES: Employee[] = [
  {
    key: 'vega',
    name: 'Vega',
    role: 'The Executive Assistant',
    tag: 'Your right hand, 24/7',
    color: '#6FCDE8',
    ink: '#0E5C74',
    skills: ['Inbox triage', 'Reply drafting', 'Calendar management', 'Morning briefings', 'VIP routing', 'Smart labels'],
    quote: "8 threads flagged, 2 urgent drafted, your 2pm conflict resolved. Briefing done — you can start your day.",
    stats: [{ k: 'Emails handled', v: '1.2M+' }, { k: 'Meetings booked', v: '340K' }, { k: 'Avg reply time', v: '47s' }],
    description: "Vega runs your inbox, books your calendar, and writes emails that actually sound like you — without you asking twice. She handles the scheduling chaos so your brain stays on the work that matters.",
    capabilities: [
      { title: "Inbox Processing", description: "Reads 100 emails at once, labels by priority, and queues replies — one run." },
      { title: "Reply Drafting", description: "Writes replies in your voice with the exact tone you set." },
      { title: "Calendar Summary & Event Creation", description: "30-day look-ahead, conflict detection, and natural-language event creation." },
      { title: "Executive Briefing", description: "Morning digest: what's urgent, what she handled, what needs your eyes." },
      { title: "Email Composition", description: "New email from scratch — recipient, topic, tone. Written and ready." },
      { title: "VIP Contacts & Priority Triage", description: "Flag key people — investors, clients, board — so their emails always surface first, no matter how buried the inbox." },
      { title: "Smart Labels with Auto-Draft", description: "Custom labels with auto-draft on — reply waiting in your queue before you even open the thread." },
    ],
    useCases: [
      "Founders drowning in 300+ emails a day",
      "Sales leaders juggling back-to-back demos",
      "Operators coordinating across 4 time zones",
      "Anyone who loses 2 hours a day to scheduling",
    ],
    demoChat: [
      { role: 'user', content: "Run my morning briefing.", delayMs: 800 },
      { role: 'agent', content: "8 threads flagged. 2 urgent: Marcus needs a decision on the contract by noon, and an investor replied to your follow-up — I drafted both. Calendar: 3 meetings today, the 2pm had a conflict I've already resolved. Focus block set 4–6pm.", delayMs: 1800 },
      { role: 'user', content: "Send the investor reply. Push the 2pm to Thursday.", delayMs: 3200 },
      { role: 'agent', content: "Investor reply sent. Thursday 2pm was free — moved and invite updated. Marcus's draft is in your review queue whenever you're ready.", delayMs: 4600 },
    ],
    howItHelps: "Vega is an AI executive assistant built for founders and operators who lose two hours a day to inbox management and calendar tetris. She plugs into Gmail and Google Calendar, reads every thread, ranks what's urgent, drafts replies in your voice, and fills gaps in your schedule before someone else does. Think of her as an AI email assistant and AI scheduling assistant rolled into one — available at 3 AM when a client in another timezone pings you, and at 9 AM when you finally sit down with coffee. Set her up once: add VIPs so investor emails always reach the top, create smart labels with auto-draft so replies are waiting the moment an email arrives. She's the inbox system you always meant to build — already running.",
    workflow: [
      {
        title: "1. Connect your inbox and calendar",
        body: "Vega connects to Gmail and Google Calendar in under a minute. She reads the last 30 days to learn your writing style, who matters most, and what meetings you actually take.",
      },
      {
        title: "2. Set your rules",
        body: "Tell her who gets a same-day reply, who waits, and what your non-negotiable focus blocks look like. Add VIP contacts so their emails always surface first. Create smart labels with auto-draft enabled — she'll have a reply waiting before you open the thread. She respects these rules forever, no retraining required.",
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
        a: "Yes. Veqiro uses OAuth to connect (no password sharing) and encrypts all data in transit and at rest. Your emails are never used to train our models.",
      },
    ],
    actions: [
      "Run my morning briefing",
      "Process my inbox and draft replies for urgent threads",
      "Draft a reply to [name]'s email — keep it short and firm",
      "What's on my calendar for the next 7 days?",
      "Create a 1-hour meeting with [person] on Thursday at 2pm — add Google Meet",
      "Compose an email to [address] about [topic] with a clear ask",
      "Add [name] at [email] to my VIP contacts",
      "Create a label 'Client Escalations' with auto-draft turned on",
    ],
  },
  {
    key: 'scout',
    name: 'Scout',
    role: 'Research & Strategist',
    tag: 'Finds the signal, skips the noise',
    color: '#F5C518',
    ink: '#7A5A00',
    skills: ['Competitor teardowns', 'Market research', 'Trend spotting', 'Company intel'],
    quote: "Found 5 competitors you didn't know existed. One just raised $8M and pivoted toward your ICP. You're welcome.",
    stats: [{ k: 'Reports written', v: '89K' }, { k: 'Sources cited', v: '4.1M' }, { k: 'Hours saved/week', v: '38' }],
    description: "Scout digs into competitors, markets, and companies so you don't have to spend a Thursday in browser tabs. He gives you a memo, not a data dump — with the stuff that actually matters highlighted.",
    capabilities: [
      { title: "Topic Research", description: "Deep-dives any topic with live sources, synthesis, and a clear recommendation." },
      { title: "Company Research", description: "Full profile on any company: funding, tech stack, pricing, key contacts, strengths, weaknesses, and recent news." },
      { title: "Trending Topics", description: "Top N trends in your industry with momentum signals and content hooks." },
      { title: "Competitor Watchlist", description: "Live list of tracked rivals — auto-populated as Scout discovers them. Trigger a fresh teardown on any competitor anytime." },
      { title: "Auto-Discover Competitors", description: "Describe your product — Scout finds who's eating your lunch in adjacent segments." },
    ],
    useCases: [
      "Founders doing competitive diligence before a fundraise",
      "Sales teams qualifying enterprise accounts",
      "Product teams tracking competitor feature launches",
      "Marketers looking for trending content angles",
    ],
    demoChat: [
      { role: 'user', content: "Who are our real competitors — not the obvious ones?", delayMs: 800 },
      { role: 'agent', content: "Found 7. Two you know. Five you don't — one just raised $8M and pivoted toward your exact ICP last month. Another is undercutting your starter plan by 70%. Want full teardowns on the dangerous two?", delayMs: 1800 },
      { role: 'user', content: "Yes — tear down the $8M raise.", delayMs: 3400 },
      { role: 'agent', content: "Done. 18 months behind you technically but their GTM is aggressive. Three things working for them — and one thing they're getting badly wrong that's your opening. Memo ready.", delayMs: 5000 },
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
    actions: [
      "Research [topic] — standard depth, cite your sources",
      "Build a full profile on [company name]",
      "What's trending in [industry] this week? Top 10",
      "Discover my competitors — here's our product: [description]",
      "Tear down [competitor] — pricing, positioning, recent moves",
      "Find companies that raised in our category in the last 90 days",
    ],
  },
  {
    key: 'maya',
    name: 'Maya',
    role: 'Content & Marketing',
    tag: 'Visuals first. Copy that matches.',
    color: '#F06464',
    ink: '#7A1717',
    skills: ['Image generation', 'Product campaigns', 'Carousels', 'Post drafting', 'Cross-platform', 'Direct publishing'],
    quote: "Launch campaign set ready — hero shot with product mockup, Instagram square, story with CTA, paid ad variant. Logo locked. Brand colors on. Want to review before it goes live?",
    stats: [{ k: 'Posts published', v: '210K' }, { k: 'Avg CTR lift', v: '+34%' }, { k: 'Brand voices', v: '900+' }],
    description: "Maya generates on-brand campaign images, carousels, and post visuals — with your logo, your palette, your font. Give her a product photo and she builds the full launch set. Give her a topic and she writes the post to match.",
    capabilities: [
      { title: "Product Campaign Creator", description: "Upload one product photo — get a full campaign set composed for every placement: hero, square, story, and ad variant, all with your logo locked in." },
      { title: "Image Generation & Regeneration", description: "Generate a post visual from any brief — or describe what to change and Maya redraws it. Brand colors, logo placement, and font stay locked across every iteration." },
      { title: "Carousel Post Creator", description: "Multi-slide carousels for LinkedIn or Instagram — each slide composed as a standalone image with on-brand layout, then captioned as a set." },
      { title: "Full Content Drafting", description: "Complete post for any platform with tone control, brand kit applied, and image auto-generated alongside the copy." },
      { title: "Cross-Platform Variants", description: "One post rewritten natively for every platform — correct length, tone, format, and a matching visual for each." },
      { title: "Direct Publishing", description: "Approve and it goes live. No copy-paste. No scheduling tool." },
    ],
    useCases: [
      "Product teams launching features and needing a full visual campaign fast",
      "Founders who need consistent branded visuals without a design team",
      "Marketing teams running content across 3+ platforms from one place",
      "Agencies managing brand visuals and copy for multiple clients",
    ],
    demoChat: [
      { role: 'user', content: "Maya, we're launching our dashboard feature next week. Need the full campaign.", delayMs: 800 },
      { role: 'agent', content: "Loading your brand kit — logo, coral palette, Geist. Building the launch set: hero shot with product mockup, Instagram square with feature headline, story with CTA, paid ad variant. Generating all 4 now.", delayMs: 1800 },
      { role: 'user', content: "Hero is perfect. Darker contrast on the square — and put the logo bottom-right on all of them.", delayMs: 3200 },
      { role: 'agent', content: "Square updated — deeper contrast, logo anchored bottom-right across all placements. Caption and hashtag set drafted for each. Launch day ready. Post the Instagram square first?", delayMs: 5000 },
    ],
    howItHelps: "Maya is an AI image generator and visual content creator built for teams that need brand-consistent campaigns without a design team. She reads your brand kit — logo, palette, typography, tone — and generates hero banners, Instagram squares, story formats, ad variants, and multi-slide carousels that look like they came from a proper creative agency. Upload a product photo and she builds the full launch set. Describe a visual and she draws it with your brand locked in. She also writes the copy to go with every image — platform-native captions, hooks, hashtags — and publishes directly to your connected accounts when you approve.",
    workflow: [
      {
        title: "1. Upload your brand kit",
        body: "Drop in your logo, brand colors, font, and a few examples of visuals you love. Maya locks these in — every image she generates from here is on-brand without you asking.",
      },
      {
        title: "2. Give her the brief",
        body: "\"Product campaign for our launch — here's the photo.\" \"5-slide carousel on our feature.\" \"Regenerate the square but darker, logo bottom-right.\" One instruction, full output.",
      },
      {
        title: "3. Approve and publish",
        body: "Review the campaign set, tweak any image with a plain-English brief, and publish directly to your connected social accounts. No Canva. No back-and-forth with a designer.",
      },
    ],
    outcomes: [
      {
        title: "A full campaign set from one photo",
        body: "Drop a product shot and get a hero banner, Instagram square, story format, and ad variant — all composed, all on-brand, all with your logo placed correctly.",
      },
      {
        title: "No more Canva detour",
        body: "Maya generates post images with your brand colors, logo, and typography built in. Every iteration stays consistent — no manual re-applying of brand elements.",
      },
      {
        title: "Carousels that look designed",
        body: "Multi-slide LinkedIn and Instagram carousels where each slide is a standalone on-brand visual — not a slide deck screenshotted and called a carousel.",
      },
      {
        title: "Copy that matches the visual",
        body: "Every image comes with a caption, hashtags, and a CTA written for that platform. The visual and the copy brief each other — they ship as a set.",
      },
    ],
    faq: [
      {
        q: "Can Maya actually generate on-brand images?",
        a: "Yes — once she has your brand kit (logo, color hex codes, font, visual style). She applies these to every image she generates. Most teams stop opening Canva for social posts within the first week.",
      },
      {
        q: "What image formats does she generate?",
        a: "Hero banners (16:9), Instagram squares (1:1), story formats (9:16), ad variants, and individual carousel slides. You can also request custom aspect ratios with a plain-English brief.",
      },
      {
        q: "How is Maya different from Canva's AI or Adobe Firefly?",
        a: "Those are design tools. Maya is an agent — she takes a brief, generates the full campaign set, writes the captions, and publishes directly. You don't drag and drop anything.",
      },
      {
        q: "Does she write copy too or just images?",
        a: "Both, and they're connected. Every image Maya generates comes with a platform-native caption. Give her a topic and she writes the post and generates the visual as a matched set.",
      },
      {
        q: "What if I don't like an image she generates?",
        a: "Describe the change in plain English — 'darker background', 'logo bottom-right', 'more whitespace around the product' — and she regenerates it. You can iterate as many times as needed.",
      },
    ],
    actions: [
      "Create a product campaign — here's the product photo: [file]",
      "Generate a hero banner for our [feature] launch with our logo",
      "Draft a 5-slide carousel for LinkedIn about [topic]",
      "Regenerate the image — darker, logo bottom-right, no text overlay",
      "Write a LinkedIn post about [topic] and generate a matching visual",
      "Take this post and rewrite it natively for Instagram and Twitter with new images",
      "Publish this campaign to my Instagram now",
    ],
  },
  {
    key: 'sage',
    name: 'Sage',
    role: 'The SEO Specialist',
    tag: 'Ranks pages in her sleep',
    color: '#F79FD4',
    ink: '#8E2A6A',
    skills: ['Keyword research', 'Blog writing', 'Content audits', 'SEO briefs', 'Technical SEO', 'Site audits'],
    quote: "That keyword has 2,400 searches a month and nobody's written a good article for it yet. We're writing it tonight.",
    stats: [{ k: 'Keywords ranked', v: '2.3M' }, { k: 'Avg position lift', v: '+11' }, { k: 'Traffic unlocked', v: '410M' }],
    description: "Sage knows how search actually works right now — not the theory from 2019. She does keyword research, writes SEO-optimized content, and audits what you already have so your pages actually show up.",
    capabilities: [
      { title: "Keyword Research", description: "Intent-classified keywords with difficulty scores and a prioritized hit list." },
      { title: "Full Blog Generation", description: "SEO-ready articles with H-tags, meta, FAQ schema — exported for your CMS." },
      { title: "Content Analysis & Page Scoring", description: "Score any page: keyword density, heading structure, missing topics, E-E-A-T signals — specific ranked fixes, not vague advice." },
      { title: "Content Briefs", description: "SERP gaps, heading structure, and target word count — everything a writer needs." },
      { title: "Blog Ideas & Saved Keywords", description: "Fresh blog ideas from your keyword list, tracked with search intent and volume." },
      { title: "Page SEO Audit", description: "Deep single-page audit: technical issues, speed signals, E-E-A-T score, featured snippet opportunities, and a head-to-head against the top-ranking competitor." },
      { title: "Site-Wide Audit", description: "Crawl your full sitemap for orphan pages, keyword cannibalization, and technical drag — domain health overview with prioritized fixes." },
    ],
    useCases: [
      "SaaS companies trying to rank for bottom-of-funnel keywords",
      "Startups with existing content that isn't converting",
      "Marketing teams without a dedicated SEO hire",
      "Blogs that need consistent output without sacrificing quality",
    ],
    demoChat: [
      { role: 'user', content: "Sage, what keyword should we target first?", delayMs: 800 },
      { role: 'agent', content: "Best quick win: 'ai employee scheduling' — 2,400/month, difficulty 28, no strong article ranking for it. Your competitors aren't touching it. Two-week window to own position 1.", delayMs: 2000 },
      { role: 'user', content: "Write the article.", delayMs: 3400 },
      { role: 'agent', content: "Done — 1,500 words, H2/H3 structure, FAQ schema, meta title and description, internal links to your pricing page. Exported as Markdown. Estimated ranking: 3–4 weeks with 2–3 backlinks.", delayMs: 5000 },
    ],
    howItHelps: "Sage is an AI SEO tool and AI blog writer built around how search actually works today — not the playbook from 2019. She handles keyword research with intent classification, writes SEO-optimized articles with correct heading structure and schema, audits what you already have, and keeps track of what's ranking. She also does deep single-page audits and full-site crawls — surfacing orphan pages, cannibalization conflicts, and E-E-A-T gaps that are quietly costing you rankings. Think of her as an AI SEO specialist, AI keyword research tool, and technical SEO auditor combined — cheaper than a solo SEO hire, faster than any retainer, and actually tuned for founder-led teams that need organic traffic to compound.",
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
    actions: [
      "Keyword research for [topic] — include [competitor URL]",
      "Write a 1,500-word SEO blog targeting '[keyword]' — export as Markdown",
      "Analyze this page against '[keyword]': [URL or paste content]",
      "Build a content brief for '[topic]'",
      "Generate 5 blog ideas from my saved keyword list",
      "Run a full page audit on [URL] — technical, speed, E-E-A-T, and competitor scores",
      "Audit my entire site — sitemap is at [url]",
    ],
  },
  {
    key: 'lex',
    name: 'Lex',
    role: 'The Legal Assistant',
    tag: "Reads the fine print so you don't",
    color: '#8A8AF0',
    ink: '#2A2A7A',
    skills: ['Contract analysis', 'Risk flagging', 'Doc drafting', 'Compliance checks', 'Document library'],
    quote: "Clause 7.3 is a trap. Redlined it. Also Clause 4 is fine but written by a poet — I cleaned it up.",
    stats: [{ k: 'Contracts reviewed', v: '180K' }, { k: 'Red flags caught', v: '41K' }, { k: 'Avg review time', v: '4 min' }],
    description: "Lex reads contracts, spots the traps, and explains what the clauses actually mean — in plain English, not legalese. He doesn't replace a lawyer, but she makes sure you don't go into a lawyer meeting blind.",
    capabilities: [
      { title: "Document Library & PDF Ingestion", description: "Contracts stored in your library with metadata — accessible for analysis, Q&A, and comparison anytime." },
      { title: "Contract Analysis", description: "Flags risky clauses — perpetual licenses, uncapped liability, IP traps — with exact clause references in plain English." },
      { title: "Document Q&A & Plain-English Explanations", description: "Ask anything about an uploaded contract and get the exact clause back — or paste any legal text for a plain-English translation with a key terms glossary." },
      { title: "Document Drafting", description: "Generates NDAs, SaaS agreements, and offer letters with custom clauses." },
      { title: "Legal Research & Compliance Check", description: "Research by jurisdiction with applicable laws and cases, or run a framework-by-framework gap check against GDPR, CCPA, SOC2, or HIPAA." },
    ],
    useCases: [
      "Founders reviewing their first enterprise contract",
      "Startups about to sign a vendor agreement",
      "Teams preparing for a GDPR or HIPAA audit",
      "Anyone who needs an NDA fast but can't wait for counsel",
    ],
    demoChat: [
      { role: 'user', content: "Lex, 40-page MSA just landed. Review it.", delayMs: 800 },
      { role: 'agent', content: "Read it. 6 flags — 3 serious. Clause 12.4 gives them a perpetual license to your IP. Clause 18 has uncapped liability on your side. Indemnification is fully one-sided. Risk level: HIGH.", delayMs: 2400 },
      { role: 'user', content: "Draft redlines for 12.4 and 18.", delayMs: 4000 },
      { role: 'agent', content: "Redlines ready. 12.4: 'perpetual, irrevocable' replaced with 'limited, revocable license for the term.' IP ownership carve-out added. 18: liability capped at fees paid in the prior 12 months. Word doc ready.", delayMs: 5600 },
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
        body: "Evaluate your practices against GDPR, CCPA, SOC2, and HIPAA with a prioritized gap list. Not a replacement for an audit — a cheat sheet before one.",
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
    actions: [
      "Review this contract and flag all risky clauses: [file]",
      "Analyze this contract text: [paste contract]",
      "Does this agreement include a non-solicitation clause?",
      "Draft a mutual NDA for a partnership — Delaware jurisdiction",
      "Research non-compete enforceability in California",
      "Run a GDPR and CCPA compliance check on our data practices",
      "Explain what this clause means in plain English: [paste clause]",
    ],
  },
  {
    key: 'rex',
    name: 'Rex',
    role: 'Data Analyst & Finance',
    tag: 'Makes spreadsheets sing',
    color: '#1DBC87',
    ink: '#0E5C3F',
    skills: ['Financial analysis', 'Forecasting', 'Runway calc', 'Anomaly detection', 'Board decks'],
    quote: "Revenue is up 12% MoM but your CAC is doing something weird. Want me to show you the weird thing?",
    stats: [{ k: 'Rows crunched', v: '8.9B' }, { k: 'Models built', v: '62K' }, { k: 'Anomalies flagged', v: '120K' }],
    description: "Rex turns your business numbers into a story you actually understand — and flags the weird stuff before it becomes a real problem. He looks at MRR, burn, CAC, and churn so you always know exactly where you stand.",
    capabilities: [
      { title: "Financial Analysis & Live KPI Dashboard", description: "MRR, ARR, burn, and margin from your raw data — with RED/AMBER/GREEN flags and a live KPI strip always visible." },
      { title: "Revenue Forecasting", description: "Projects any metric up to 365 days with confidence bands and seasonality." },
      { title: "Runway & Unit Economics", description: "Cash + burn + revenue → exact runway, CAC by channel, and LTV payback period." },
      { title: "Scenario Modeling", description: "Compare what-if assumptions side-by-side before making the call." },
      { title: "Investor Updates, Board Decks & Weekly Digest", description: "Investor emails, board-ready HTML decks, variance analysis, and Monday CFO digests — all auto-generated from live data." },
      { title: "Data Hub: Upload, Query & Report", description: "Upload any CSV or Excel file — ask questions in plain English or generate a full DOCX report with charts and strategic takeaways." },
    ],
    useCases: [
      "Founders preparing for a fundraise or board meeting",
      "Operators who need daily metric visibility without a CFO",
      "Teams trying to understand their unit economics",
      "Anyone who's ever been surprised by their burn rate",
    ],
    demoChat: [
      { role: 'user', content: "Rex, how are we doing this month?", delayMs: 800 },
      { role: 'agent', content: "Revenue up 12% MoM — solid. One problem: Meta CAC spiked 3× last Tuesday. Something changed. Churn flat at 2.1%. Runway: 14 months at current burn.", delayMs: 1800 },
      { role: 'user', content: "What happened with Meta?", delayMs: 3200 },
      { role: 'agent', content: "Top ad set got flagged and paused at 2pm Tuesday — budget shifted to a weaker creative. CAC went $140 → $430 overnight. Want me to model pausing Meta and doubling down on organic?", delayMs: 4800 },
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
    actions: [
      "Run a full financial analysis on last month's data",
      "Forecast my MRR for the next 90 days",
      "Calculate my runway — $420K cash, $38K burn, $12K MRR",
      "What's my CAC and LTV by channel?",
      "Model two scenarios: cut burn 25% vs raise a $500K bridge",
      "Generate my investor update for [month]",
      "Parse and store this Stripe CSV export",
      "Generate my board deck for [month] — pull from my latest dataset",
      "Run a variance analysis: actual results vs budget for last quarter",
      "Give me my Monday CFO digest — what moved and what looks weird",
    ],
  },
];
