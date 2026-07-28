import type { Employee } from '@/components/veqiro/data';
import type { PricingTier } from '@/lib/site-config';
import { contact, social } from '@/lib/site-config';
import { SITE_URL } from '@/lib/seo';

const ORG_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;

// ---------------------------------------------------------------------------
// Organization
// ---------------------------------------------------------------------------

export function organizationJsonLd(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORG_ID,
    name: 'Veqiro',
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    description:
      'Veqiro provides AI employees — autonomous AI agents that handle executive assistance, research, content, SEO, legal review, and financial analysis for founders and lean teams.',
    email: contact.email,
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'India',
      addressCountry: 'IN',
    },
    sameAs: [
      social.twitter,
      social.linkedin,
      social.instagram,
    ],
  };
}

// ---------------------------------------------------------------------------
// WebSite
// ---------------------------------------------------------------------------

export function websiteJsonLd(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: SITE_URL,
    name: 'Veqiro',
    publisher: {
      '@id': ORG_ID,
    },
  };
}

// ---------------------------------------------------------------------------
// SoftwareApplication
// ---------------------------------------------------------------------------

export function softwareApplicationJsonLd(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Veqiro',
    operatingSystem: 'Web',
    applicationCategory: 'BusinessApplication',
    description:
      'Veqiro is an AI workforce platform that gives founders and small teams a full crew of autonomous AI agents — covering executive assistance, research, content, SEO, legal, and finance.',
    offers: {
      '@type': 'Offer',
      price: 9.0,
      priceCurrency: 'USD',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        billingDuration: 'P1M',
      },
    },
    publisher: {
      '@id': ORG_ID,
    },
  };
}

// ---------------------------------------------------------------------------
// Product (pricing tiers)
// ---------------------------------------------------------------------------

export function productJsonLd(tiers: PricingTier[]): object {
  const offers = tiers.filter((tier) => !tier.custom).flatMap((tier) => {
    const monthlyOffer = {
      '@type': 'Offer',
      name: `${tier.name} — Monthly`,
      price: tier.monthly,
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: `${SITE_URL}/pricing`,
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        billingDuration: 'P1M',
      },
    };
    // Only emit an Annual offer when the tier actually has a distinct annual
    // rate. Per-agent tiers set `yearly === monthly` (no real annual cadence
    // exists for individual agents — see pricing/page.tsx's agentOffers), so
    // gating here avoids publishing an "Annual" Offer for a cadence nothing
    // in checkout can actually fulfill. A future tier with a real annual
    // discount (yearly !== monthly) still gets its Annual offer as before.
    if (tier.yearly === tier.monthly) return [monthlyOffer];
    return [
      monthlyOffer,
      {
        '@type': 'Offer',
        name: `${tier.name} — Annual`,
        price: tier.yearly * 12,
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        url: `${SITE_URL}/pricing`,
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          billingDuration: 'P1Y',
        },
      },
    ];
  });

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Veqiro AI Employees',
    description:
      'Six specialized AI employees — executive assistant, researcher, content writer, SEO specialist, legal reviewer, and financial analyst — each billed independently, starting at $9/mo.',
    brand: {
      '@id': ORG_ID,
    },
    offers,
  };
}

// ---------------------------------------------------------------------------
// Person (AI agent)
// ---------------------------------------------------------------------------

export function personAgentJsonLd(emp: Employee): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: emp.name,
    jobTitle: `${emp.role} (AI)`,
    description: emp.description,
    image: `${SITE_URL}/${emp.name}.jpeg`,
    url: `${SITE_URL}/agents/${emp.key}`,
    worksFor: {
      '@id': ORG_ID,
    },
    knowsAbout: emp.skills,
    disambiguatingDescription: `${emp.name} is an AI agent, not a human.`,
  };
}

// ---------------------------------------------------------------------------
// FAQPage
// ---------------------------------------------------------------------------

export function faqPageJsonLd(items: { q: string; a: string }[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  };
}

// ---------------------------------------------------------------------------
// BreadcrumbList
// ---------------------------------------------------------------------------

export function breadcrumbJsonLd(
  crumbs: { name: string; url: string }[],
): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  };
}

// ---------------------------------------------------------------------------
// BlogPosting (Article JSON-LD for blog posts)
// ---------------------------------------------------------------------------

interface ArticleJsonLdInput {
  title: string;
  description: string;
  slug: string;
  date: string;
  updatedDate?: string;
  ogImage?: string;
  keywords: string[];
  category: string;
}

export function articleJsonLd(post: ArticleJsonLdInput): object {
  const url = `${SITE_URL}/blog/${post.slug}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${url}#article`,
    headline: post.title,
    description: post.description,
    url,
    datePublished: post.date,
    dateModified: post.updatedDate ?? post.date,
    author: {
      '@type': 'Organization',
      '@id': ORG_ID,
      name: 'Veqiro',
    },
    publisher: {
      '@id': ORG_ID,
    },
    image: {
      '@type': 'ImageObject',
      url: `${SITE_URL}${post.ogImage ?? `/og/blog/${post.slug}.png`}`,
      width: 1200,
      height: 630,
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
    keywords: post.keywords.join(', '),
    articleSection: post.category,
    inLanguage: 'en-US',
  };
}
