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
      addressLocality: 'Bengaluru',
      addressCountry: 'IN',
    },
    sameAs: [
      social.twitter,
      social.linkedin,
      social.instagram,
      social.github,
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
      price: 39.0,
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
  const offers = tiers.flatMap((tier) => [
    {
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
    },
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
  ]);

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Veqiro Crew',
    description:
      'One subscription, all six AI employees — executive assistant, researcher, content writer, SEO specialist, legal reviewer, and financial analyst.',
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
