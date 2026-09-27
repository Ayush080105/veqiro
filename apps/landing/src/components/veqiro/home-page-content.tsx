'use client';
import { T } from '@/components/veqiro/shared';
import { NavShared } from '@/components/veqiro/nav-shared';
import { Footer } from '@/components/veqiro/sections';
import { IntegrationsSection } from '@/components/veqiro/integrations-section';
import { HeroWork } from '@/components/veqiro/home/hero-work';
import {
  PainSection, WorkforceSection, DelegateSection, WorkExamplesSection,
} from '@/components/veqiro/home/story-sections';
import {
  BrainSection, CompareSection, HowSection, UseCasesSection,
  CalculatorSection, PricingSection, TrustSection, FinalCtaSection,
} from '@/components/veqiro/home/proof-sections';
import '@/components/veqiro/home/home.css';

/**
 * The homepage sells the outcome, not the feature list. Every section answers one buyer
 * question, in the order a first-time visitor asks them:
 *
 *   Do I have this problem?        Hero (work piling up → done), Pain
 *   Can Veqiro actually solve it?  Workforce, Delegate, Work examples
 *   Why is it different?           Shared brain, Compare with a general AI chat
 *   How does it work?              Integrations, How it works
 *   Is it for me?                  Built for teams like yours, workload calculator
 *   How much does it cost?         Pricing
 *   Can I trust it?                Questions worth asking
 *   What do I do next?             Final CTA
 *
 * The nav sits outside the hero so it stays pinned for the whole page.
 */
export default function HomePageContent() {
  return (
    <div style={{ background: T.bg, minHeight: '100vh' }}>
      <NavShared variant="hero" />
      <main>
        <HeroWork />
        <PainSection />
        <WorkforceSection />
        <DelegateSection />
        <WorkExamplesSection />
        <BrainSection />
        <CompareSection />
        <IntegrationsSection />
        <HowSection />
        <UseCasesSection />
        <CalculatorSection />
        <PricingSection />
        <TrustSection />
        <FinalCtaSection />
      </main>
      <Footer />
    </div>
  );
}
