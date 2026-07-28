import { buildPageMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/veqiro/json-ld';
import { softwareApplicationJsonLd, productJsonLd, faqPageJsonLd } from '@/lib/jsonld';
import { agentPricing, PRICING_FAQ } from '@/lib/site-config';
import type { PricingTier } from '@/lib/site-config';
import PricingPageContent from '@/components/veqiro/pricing-page-content';

export const metadata = buildPageMetadata({
  title: 'AI Employee Pricing — Starting at $9/mo',
  description: 'Veqiro pricing: every AI employee is billed independently, starting at $9/mo. Start with one, add the rest whenever you need them. 7-day free trial. No credit card.',
  path: '/pricing',
  keywords: ['ai employee pricing', 'ai agents pricing', 'hire ai agents cost', 'veqiro pricing'],
});

// productJsonLd expects PricingTier[]; each agent is now billed independently
// (no separate crew plan), so build one Offer per agent from its monthly
// price. Agents have no annual cadence of their own, so `yearly` mirrors
// `monthly` — productJsonLd multiplies it by 12 for the Annual offer, which
// correctly reflects "12 months at the same monthly rate, no discount."
const agentOffers: PricingTier[] = agentPricing
  .filter((a): a is { key: string; monthly: number } => a.monthly != null)
  .map((a) => ({
    name: a.key.charAt(0).toUpperCase() + a.key.slice(1),
    monthly: a.monthly,
    yearly: a.monthly,
    tag: '',
    color: '',
    includes: [],
  }));

export default function PricingPage() {
  return (
    <>
      <JsonLd data={[softwareApplicationJsonLd(), productJsonLd(agentOffers), faqPageJsonLd(PRICING_FAQ)]} />
      <PricingPageContent />
    </>
  );
}
