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
  },
];
