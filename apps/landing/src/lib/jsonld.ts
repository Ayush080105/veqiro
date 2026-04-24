import type { Employee } from '@/components/veqiro/data';
import type { PricingTier } from '@/lib/site-config';
import { contact, social } from '@/lib/site-config';

// ---------------------------------------------------------------------------
// Organization
// ---------------------------------------------------------------------------

export function organizationJsonLd(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': 'https://veqiro.com/#organization',
    name: 'Veqiro',
    url: 'https://veqiro.com',
    logo: 'https://veqiro.com/logo.png',
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
    '@id': 'https://veqiro.com/#website',
    url: 'https://veqiro.com',
    name: 'Veqiro',
    publisher: {
      '@id': 'https://veqiro.com/#organization',
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
      '@id': 'https://veqiro.com/#organization',
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
    brand: {
      '@type': 'Brand',
      name: 'Veqiro',
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
    image: `https://veqiro.com/${emp.name}.jpeg`,
    worksFor: {
      '@id': 'https://veqiro.com/#organization',
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
