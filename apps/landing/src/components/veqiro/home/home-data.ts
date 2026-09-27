/**
 * Copy and data for the homepage. Every capability named here is one the product ships today:
 * checked against apps/ai (each agent's real tools) and @repo/integrations-catalog (live
 * connectors only). Edit the claims here, not inside the components.
 */
import {
  INTEGRATIONS_CATALOG,
  getIntegrationsByAgent,
  type AgentSlug,
  type IntegrationCatalogEntry,
} from '@repo/integrations-catalog';

/* ── Integrations that actually connect today ─────────────────────────────────────────────── */

/** Only connectors with a verified provider toolkit — "coming soon" rows are never advertised. */
export const LIVE_TOOLS: IntegrationCatalogEntry[] = INTEGRATIONS_CATALOG.filter(t => t.status === 'composio');
export const LIVE_TOOL_COUNT = LIVE_TOOLS.length;

export function liveToolsFor(agent: AgentSlug): IntegrationCatalogEntry[] {
  return getIntegrationsByAgent(agent).filter(t => t.status === 'composio');
}

/* ── Hero: work in → work out ─────────────────────────────────────────────────────────────── */

export const HERO_WORK: { agent: AgentSlug; pile: string; done: string }[] = [
  { agent: 'vega', pile: '47 unread emails', done: 'Inbox triaged · 6 replies drafted' },
  { agent: 'maya', pile: '12 content tasks', done: 'Week of posts ready for review' },
  { agent: 'scout', pile: '8 competitors to research', done: '8 competitor profiles filed' },
  { agent: 'sage', pile: 'SEO report pending', done: 'SEO brief completed' },
  { agent: 'lex', pile: 'Contract waiting for review', done: '3 risky clauses flagged' },
  { agent: 'rex', pile: 'Finance report pending', done: 'Monthly report generated' },
];

/* ── Pain ─────────────────────────────────────────────────────────────────────────────────── */

export const PAIN_CARDS: { agent: AgentSlug; label: string; pain: string; symptom: string }[] = [
  { agent: 'vega', label: 'Inbox', pain: 'Threads pile up. Replies slip.', symptom: '47 unread · 9 need you' },
  { agent: 'maya', label: 'Content', pain: 'Your social calendar goes quiet.', symptom: 'Last post · 23 days ago' },
  { agent: 'scout', label: 'Research', pain: 'You hear about competitors after they ship.', symptom: 'Rival launch · 3 weeks old' },
  { agent: 'sage', label: 'SEO', pain: "You know you should be ranking. You don't know why you're not.", symptom: 'Main keyword · page 4' },
  { agent: 'lex', label: 'Contracts', pain: 'The contract gets signed before anyone reads clause 9.', symptom: 'MSA · unread since Monday' },
  { agent: 'rex', label: 'Reporting', pain: 'Important numbers live in spreadsheets nobody opens.', symptom: 'Q3 export · never opened' },
];

/* ── The workforce ────────────────────────────────────────────────────────────────────────── */

export interface WorkforceRole {
  agent: AgentSlug;
  does: string;
  tasks: string[];
  output: string;
}

export const WORKFORCE: WorkforceRole[] = [
  {
    agent: 'vega',
    does: 'Triages your inbox, drafts replies in your voice, runs your calendar and starts your day with a briefing.',
    tasks: ['Triage my inbox and draft the urgent replies', 'Find 30 minutes with Priya next week', 'What needs my attention today?'],
    output: 'A morning briefing: 2 urgent threads with replies drafted, 1 calendar conflict resolved.',
  },
  {
    agent: 'scout',
    does: 'Researches markets, profiles competitors and spots trends — from live web sources, with the sources listed.',
    tasks: ['Who are we really competing with?', 'Profile these five competitors', 'What is trending in our category this month?'],
    output: 'A competitor profile: pricing, strengths, weaknesses and recent news, with sources.',
  },
  {
    agent: 'maya',
    does: 'Plans campaigns, writes posts, creates images, carousels and video, and publishes to your accounts.',
    tasks: ["Create this week's Instagram campaign", 'Turn this product launch into 5 posts', 'Plan next week’s content from what worked'],
    output: 'A four-image campaign with captions and hashtags, ready for your approval.',
  },
  {
    agent: 'sage',
    does: 'Finds the keywords worth winning, writes briefs and full blog posts, and audits your pages for what holds them back.',
    tasks: ['Which keywords should we target?', 'Write a post on our main keyword', 'Audit our pricing page'],
    output: 'A content brief: search intent, headings, questions to answer and title options.',
  },
  {
    agent: 'lex',
    does: 'Reviews contracts for risk, checks compliance, drafts documents and answers questions from your own documents.',
    tasks: ['Review this vendor contract', 'Are we GDPR-ready?', 'Draft a mutual NDA'],
    output: 'A risk review: overall risk level, the clauses that matter and what to ask for instead.',
  },
  {
    agent: 'rex',
    does: 'Answers questions from your spreadsheets and connected data, tracks runway and unit economics, and writes investor updates.',
    tasks: ['Which city brings us the most revenue?', 'How many months of runway do we have?', "Draft this month's investor update"],
    output: 'A performance report computed over every row of your data, with the charts.',
  },
];

/* ── Delegate, don't prompt ───────────────────────────────────────────────────────────────── */

export const CHATBOT_STEPS = [
  'Copy the draft',
  'Open Canva',
  'Make the image',
  'Open Instagram',
  'Write the caption',
  'Schedule the post',
];
export const VEQIRO_STEPS = ['Research', 'Ideas', 'Copy', 'Visuals', 'Review', 'Publish-ready'];

/* ── Real work examples ───────────────────────────────────────────────────────────────────── */

export interface WorkExample {
  agent: AgentSlug;
  ask: string;
  steps: string[];
}

export const WORK_EXAMPLES: WorkExample[] = [
  {
    agent: 'maya',
    ask: 'Create a social campaign for our Mumbai launch.',
    steps: ['Reads your brand and the product', 'Plans the campaign concept', 'Generates the visuals', 'Writes captions and hashtags', 'Returns it for your approval'],
  },
  {
    agent: 'vega',
    ask: 'Clear my inbox and set up my day.',
    steps: ['Reads every unread thread', 'Ranks what actually needs you', 'Drafts replies in your voice', 'Checks your calendar for conflicts', 'Sends your morning briefing'],
  },
  {
    agent: 'sage',
    ask: 'Write a content brief for “masala chai online”.',
    steps: ['Checks who ranks for it today', 'Works out what searchers want', 'Maps the questions people ask', 'Plans the headings', 'Writes the brief'],
  },
  {
    agent: 'scout',
    ask: 'Profile our top competitors before Friday’s pitch.',
    steps: ['Finds who you actually compete with', 'Reads their sites and pricing pages', 'Pulls recent news', 'Compares them with you', 'Files a profile per competitor'],
  },
  {
    agent: 'lex',
    ask: 'Review this contract before we sign.',
    steps: ['Reads the whole contract', 'Finds the risky clauses', 'Explains your obligations', 'Suggests the changes to ask for', 'Writes a clear risk summary'],
  },
  {
    agent: 'rex',
    ask: "Give me this month's business performance.",
    steps: ['Reads your uploaded data', 'Computes every metric over all rows', 'Finds what changed', 'Builds the charts', 'Writes the report'],
  },
];

/* ── Compare with a general AI chat ───────────────────────────────────────────────────────── */

export const COMPARE_ROWS: { topic: string; chat: string; veqiro: string }[] = [
  { topic: 'Your business', chat: 'Re-explained in every chat', veqiro: 'One company brain every agent reads first' },
  { topic: 'Your tools', chat: 'You copy and paste between them', veqiro: `Works inside ${LIVE_TOOL_COUNT} connected tools` },
  { topic: 'What you get', chat: 'An answer to act on', veqiro: 'The finished deliverable' },
  { topic: 'Who does the steps', chat: 'You do', veqiro: 'The agent does' },
  { topic: 'Before it goes out', chat: '—', veqiro: 'Sends and posts wait for your approval' },
];

/* ── Built for teams like yours ───────────────────────────────────────────────────────────── */

export const USE_CASES: { key: string; slug: string; label: string; line: string; pain: string; flow: string[]; outcome: string }[] = [
  {
    key: 'founders', slug: 'founders', label: 'Founders',
    line: 'Operate like a bigger team without adding headcount.',
    pain: 'You are the marketer, the analyst, the lawyer and the assistant — usually after 10pm.',
    flow: ['Vega clears the inbox before you wake', 'Rex answers the numbers question in chat', 'Lex reads the contract before you sign'],
    outcome: 'Your hours go back to customers and product.',
  },
  {
    key: 'marketing', slug: 'marketing-teams', label: 'Marketing teams',
    line: 'Ship campaigns without drowning in execution.',
    pain: 'The ideas are there. The hours to produce every asset for every channel are not.',
    flow: ['Scout brings the market and competitor context', 'Maya produces the campaign and visuals', 'Sage turns it into content that ranks'],
    outcome: 'More campaigns out the door, with the same team.',
  },
  {
    key: 'agencies', slug: 'agencies', label: 'Agencies',
    line: 'Handle more clients without multiplying your workload.',
    pain: 'Every new client means more research, more content and more reporting.',
    flow: ['A separate workspace and brand brain per client', 'Maya and Sage produce in each client’s voice', 'Rex turns their data into the client report'],
    outcome: 'Take on the next client without the next hire.',
  },
  {
    key: 'startups', slug: 'growing-startups', label: 'Lean startups',
    line: 'Cover critical functions before you’re ready to hire.',
    pain: 'Legal, finance and SEO all matter now — none of them justify a full-time hire yet.',
    flow: ['Start with the one function that hurts most', 'Every agent shares the same company brain', 'Add the next agent when the workload grows'],
    outcome: 'Critical work covered from day one, at a fraction of a hire.',
  },
];

/* ── Trust and objections ─────────────────────────────────────────────────────────────────── */

export const TRUST_FAQ: { q: string; a: string }[] = [
  {
    q: 'Can I trust it with my data?',
    a: 'Your tools connect through OAuth, so we never see or store your passwords. Your data is used only to do the work you ask for — never to train AI models — and it is encrypted in transit and at rest.',
  },
  {
    q: 'Can I review work before it goes out?',
    a: 'Yes. Anything that sends, posts or changes something in your connected tools — an email, a calendar invite, a message — is staged for your approval first. Drafts, campaigns and reports come back to you to review, edit or reject.',
  },
  {
    q: 'What happens if it gets something wrong?',
    a: 'You catch it at approval, and you tell the agent what was wrong. Facts and preferences you give it are saved to your company memory, which every agent reads, so the correction carries across the whole workforce.',
  },
  {
    q: 'Do I need to buy all six?',
    a: 'No. Every agent is billed on its own. Most teams start with the one job that hurts most and add others as the workload grows.',
  },
  {
    q: 'Does it replace my team?',
    a: 'It takes the repetitive execution off your team — the drafting, researching, formatting and reporting — so the people you have spend their time on the decisions and relationships only they can handle.',
  },
  {
    q: 'How long does setup take?',
    a: 'Minutes. Connect the tools the agent needs, add your company details once, and give it a task. Every agent you add later reads the same company brain, so it is faster each time.',
  },
  {
    q: 'What can the agents actually do?',
    a: 'Each one owns a real function: Vega runs inbox and calendar, Scout does research and competitor intelligence, Maya produces and publishes content, Sage handles SEO, Lex reviews contracts and compliance, and Rex works with your numbers. Their pages list every capability.',
  },
  {
    q: 'How is this different from ChatGPT?',
    a: 'A general AI chat gives you an answer to act on and forgets your business between conversations. Veqiro agents read your company brain, work inside your connected tools, and return the finished work — with anything outward-facing waiting for your approval.',
  },
];

/* ── Pricing: what each agent takes off your plate ───────────────────────────────────────── */

export const HIRE_FOR: Record<AgentSlug, string> = {
  vega: 'Inbox & calendar',
  scout: 'Research & competitors',
  maya: 'Content & campaigns',
  sage: 'SEO & blog',
  lex: 'Contracts & compliance',
  rex: 'Numbers & reporting',
};
