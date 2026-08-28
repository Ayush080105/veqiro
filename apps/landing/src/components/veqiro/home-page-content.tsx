'use client';
import { useState } from 'react';
import { Hero } from '@/components/veqiro/hero';
import { CrewSection, DeskPanel } from '@/components/veqiro/crew';
import { ProblemSection, SharedBrainSection, OutcomesSection } from '@/components/veqiro/story';
import { IntegrationsSection } from '@/components/veqiro/integrations-section';
import { HowItWorks, Pricing, FAQ, FinalCTA, Footer } from '@/components/veqiro/sections';

/**
 * Narrative order: what the day looks like now (Hero) → what it costs
 * (Problem) → what makes Veqiro different (SharedBrain) → who does the work
 * (Crew) → what working with one feels like (DeskPanel) → how you set it up
 * (HowItWorks) → what it plugs into (Integrations) → what it costs (Pricing)
 * → objections (FAQ) → ask (FinalCTA).
 */
export default function HomePageContent() {
  const [active, setActive] = useState('vega');

  return (
    <div style={{ background: '#EFE7D6', minHeight: '100vh' }}>
      <Hero />
      <OutcomesSection />
      <ProblemSection />
      <SharedBrainSection />
      <CrewSection onSelect={setActive} activeKey={active} />
      <DeskPanel active={active} onNavigate={setActive} />
      <HowItWorks />
      <IntegrationsSection />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}
