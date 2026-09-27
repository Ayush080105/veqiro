import type { Metadata } from 'next';
import { JsonLd } from '@/components/veqiro/json-ld';
import { softwareApplicationJsonLd, faqPageJsonLd } from '@/lib/jsonld';
import { TRUST_FAQ } from '@/components/veqiro/home/home-data';
import HomePageContent from '@/components/veqiro/home-page-content';

const TITLE = 'Veqiro — The AI workforce for lean businesses';
const DESCRIPTION =
  'AI employees that do the work behind the scenes — content, research, SEO, contracts, inbox and reporting. ' +
  'They learn your business once, work in your tools, and hand back finished work. From $9/month, 7 days free.';

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  // A page's openGraph/twitter replace the layout's wholesale, so the share image is repeated here.
  openGraph: {
    type: 'website', siteName: 'Veqiro', url: '/', title: TITLE, description: DESCRIPTION,
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: TITLE }],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: ['/og-image.png'] },
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
