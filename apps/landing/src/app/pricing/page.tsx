import { buildPageMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/veqiro/json-ld';
import { softwareApplicationJsonLd, productJsonLd, faqPageJsonLd } from '@/lib/jsonld';
import { pricingTiers, PRICING_FAQ } from '@/lib/site-config';
import PricingPageContent from '@/components/veqiro/pricing-page-content';

export const metadata = buildPageMetadata({
  title: 'AI Employee Pricing — One Plan, Six Agents',
  description: 'Veqiro pricing: one subscription, all six AI employees. $39/mo (or $29/mo billed yearly). 7-day free trial. No credit card.',
  path: '/pricing',
  keywords: ['ai employee pricing', 'ai agents pricing', 'hire ai agents cost', 'veqiro pricing'],
});

export default function PricingPage() {
  return (
    <>
      <JsonLd data={[softwareApplicationJsonLd(), productJsonLd(pricingTiers), faqPageJsonLd(PRICING_FAQ)]} />
      <PricingPageContent />
    </>
  );
}
