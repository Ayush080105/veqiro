import type { Metadata } from 'next';

export const SITE_URL =
  process.env.NEXT_PUBLIC_LANDING_URL || 'https://veqiro.com';

export const SITE_KEYWORDS: string[] = [
  'AI employees',
  'hire AI employees',
  'AI workforce',
  'AI agents platform',
  'AI agents for startups',
  'AI tools for founders',
  'AI tools for small teams',
  'ai executive assistant',
  'ai content generator',
  'ai seo tool',
  'ai contract review',
  'ai financial analyst',
  'ai for founders',
  'ai for lean teams',
  'digital employees',
  'virtual ai employees',
  'autonomous ai agents',
  'veqiro',
];

export interface AgentMetaEntry {
  seoTitleSuffix: string;
  metaDescription: string;
  keywords: string[];
}

export const AGENT_META: Record<string, AgentMetaEntry> = {
  vega: {
    seoTitleSuffix: 'AI Executive Assistant | Veqiro',
    metaDescription:
      'Vega runs your inbox, books your calendar, and drafts emails in your voice. An AI executive assistant that ships 24/7.',
    keywords: [
      'ai executive assistant',
      'ai inbox management',
      'ai email assistant',
      'ai scheduling assistant',
      'ai calendar assistant',
      'virtual ai assistant for founders',
      'ai email labels',
      'ai vip inbox',
    ],
  },
  scout: {
    seoTitleSuffix: 'AI Research & Competitive Intelligence | Veqiro',
    metaDescription:
      'Scout runs competitor teardowns, market scans, and lead research. AI research assistant that gives you memos, not data dumps.',
    keywords: [
      'ai competitor research tool',
      'ai market research tool',
      'ai competitive intelligence',
      'ai research assistant',
      'competitor analysis ai',
    ],
  },
  maya: {
    seoTitleSuffix: 'AI Content Generator & Social Media Writer | Veqiro',
    metaDescription:
      'Maya writes blog posts, ads, and social content in your brand voice. AI content generator built for multi-platform publishing.',
    keywords: [
      'ai content generator',
      'ai social media post generator',
      'ai content marketing tool',
      'ai copywriter',
      'ai linkedin post generator',
      'brand voice ai',
      'ai product campaign generator',
      'ai carousel post generator',
    ],
  },
  sage: {
    seoTitleSuffix: 'AI SEO Specialist & Blog Writer | Veqiro',
    metaDescription:
      'Sage does keyword research, writes SEO-optimized blog posts, and audits pages and full sites for technical issues. An AI SEO tool that actually ranks.',
    keywords: [
      'ai seo tool',
      'ai seo assistant',
      'ai keyword research tool',
      'ai blog writer',
      'seo agent ai',
      'ai seo audit',
      'ai technical seo',
      'ai page audit tool',
      'ai site audit',
    ],
  },
  lex: {
    seoTitleSuffix: 'AI Legal Assistant & Contract Review | Veqiro',
    metaDescription:
      'Lex reviews contracts, flags risky clauses, and drafts legal documents in plain English. AI contract review for founders.',
    keywords: [
      'ai contract review',
      'ai legal assistant',
      'ai for contract analysis',
      'ai nda review',
      'legal ai for startups',
      'ai legal document library',
    ],
  },
  rex: {
    seoTitleSuffix: 'AI Financial Analyst for Startups | Veqiro',
    metaDescription:
      'Rex tracks MRR, burn, CAC, and runway — flags anomalies before they become problems. AI financial analyst for SaaS.',
    keywords: [
      'ai financial analyst',
      'ai for saas metrics',
      'ai revenue forecasting',
      'ai cfo',
      'mrr tracking ai',
      'ai board deck generator',
      'ai cfo digest',
      'ai variance analysis',
    ],
  },
};

export interface BuildMetaInput {
  title: string;
  description: string;
  path: string;
  ogImage?: string;
  ogImageAlt?: string;
  noindex?: boolean;
  keywords?: string[];
  type?: 'website' | 'article';
}

export function buildPageMetadata(i: BuildMetaInput): Metadata {
  const ogImage = i.ogImage ?? '/og-image.png';
  const type = i.type ?? 'website';
  const canonical = new URL(i.path, SITE_URL).toString();

  return {
    title: i.title,
    description: i.description,
    keywords: [...SITE_KEYWORDS, ...(i.keywords ?? [])],
    alternates: {
      canonical,
    },
    openGraph: {
      type,
      url: canonical,
      title: i.title,
      description: i.description,
      siteName: 'Veqiro',
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: i.ogImageAlt ?? i.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: i.title,
      description: i.description,
      images: [ogImage],
    },
    robots: i.noindex
      ? { index: false, follow: true }
      : { index: true, follow: true },
    authors: [{ name: 'Veqiro' }],
    creator: 'Veqiro',
    publisher: 'Veqiro',
    category: 'Technology',
  };
}
