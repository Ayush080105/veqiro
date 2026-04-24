import { JsonLd } from '@/components/veqiro/json-ld';
import { softwareApplicationJsonLd, faqPageJsonLd } from '@/lib/jsonld';
import { faqItems } from '@/lib/site-config';
import HomePageContent from '@/components/veqiro/home-page-content';

export default function LandingPage() {
  return (
    <>
      <JsonLd data={[softwareApplicationJsonLd(), faqPageJsonLd(faqItems)]} />
      <HomePageContent />
    </>
  );
}
