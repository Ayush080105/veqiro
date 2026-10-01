import type { Metadata } from 'next';
import { JsonLd } from '@/components/veqiro/json-ld';
import { softwareApplicationJsonLd, faqPageJsonLd } from '@/lib/jsonld';
import { TRUST_FAQ } from '@/components/veqiro/home/home-data';
import HomePageContent from '@/components/veqiro/home-page-content';

const TITLE = 'Veqiro: The AI workforce for lean businesses';
const DESCRIPTION =
  'AI employees that do the work behind the scenes: content, research, SEO, contracts, inbox and reporting. ' +
  'They learn your business once, work in your tools, and hand back finished work. From $9/month, 7 days free.';

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  // No explicit images: a page's openGraph/twitter replace the layout's wholesale,
  // but the root opengraph-image.tsx file convention still applies since neither
  // block below sets an `images` field.
  openGraph: {
    type: 'website', siteName: 'Veqiro', url: '/', title: TITLE, description: DESCRIPTION,
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

export default function LandingPage() {
  return (
    <>
      {/* The FAQ schema mirrors the questions visible on the page. */}
      <JsonLd data={[softwareApplicationJsonLd(), faqPageJsonLd(TRUST_FAQ)]} />
      <HomePageContent />
    </>
  );
}
