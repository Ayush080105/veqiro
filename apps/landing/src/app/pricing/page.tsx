import { buildPageMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/veqiro/json-ld';
import { softwareApplicationJsonLd, productJsonLd, faqPageJsonLd } from '@/lib/jsonld';
import { pricingTiers } from '@/lib/site-config';
import PricingPageContent from '@/components/veqiro/pricing-page-content';

const PRICING_FAQ = [
  { q: 'Is there a free trial?', a: "Yes — 7 days, no credit card required. Full access to all six agents from day one." },
  { q: 'What does "billed annually" mean?', a: "You pay for 12 months upfront and save ~25% versus monthly. Cancel before renewal and we won't charge you again." },
  { q: 'Can I cancel anytime?', a: "On monthly billing: cancel before your next cycle. On annual: you keep access until the end of the paid period." },
  { q: 'What integrations are included?', a: "Gmail, Google Calendar, LinkedIn, Twitter/X, and Instagram out of the box. More on the roadmap." },
  { q: 'Do agents share memory across tasks?', a: "Yes. Your Brain (company profile, brand voice, competitors) is read by all six agents so they stay consistent." },
  { q: 'Is my data used to train your AI?', a: "Never. Your content is used only to perform the tasks you ask for." },
];

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
