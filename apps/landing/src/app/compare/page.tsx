import { buildPageMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/veqiro/json-ld';
import { ComparePageContent } from '@/components/veqiro/compare-page-content';

export const metadata = buildPageMetadata({
  title: 'Veqiro vs Sintra vs Marblism — AI Employee Platform Comparison',
  description:
    'An honest side-by-side comparison of Veqiro, Sintra, and Marblism across 7 business categories. See which AI employee platform actually covers your business.',
  path: '/compare',
  keywords: [
    'veqiro vs sintra',
    'veqiro vs marblism',
    'sintra alternative',
    'marblism alternative',
    'ai employee platform comparison',
    'best ai employee platform 2026',
    'sintra vs marblism vs veqiro',
    'ai agents for startups comparison',
  ],
});

const comparisonPageJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Veqiro vs Sintra vs Marblism — AI Employee Platform Comparison',
  description:
    'Side-by-side feature comparison of three AI employee platforms: Veqiro, Sintra, and Marblism.',
};

export default function ComparePage() {
  return (
    <>
      <JsonLd data={comparisonPageJsonLd} />
      <ComparePageContent />
    </>
  );
}
