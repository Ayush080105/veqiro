'use client';
import { useState } from 'react';
import { Hero, Marquee } from '@/components/veqiro/hero';
import { CrewSection, DeskPanel } from '@/components/veqiro/crew';
import { HowItWorks, Pricing, FAQ, FinalCTA, Footer } from '@/components/veqiro/sections';
import { marqueeItems, marqueeRedItems } from '@/lib/site-config';

export default function LandingPage() {
  const [active, setActive] = useState('vega');

  return (
    <div style={{ background: '#EFE7D6', minHeight: '100vh' }}>
      <div className="noise-overlay" aria-hidden />
      <Hero />
      <Marquee items={marqueeItems} bg="#111" color="#F5C518" />
      <CrewSection onSelect={setActive} activeKey={active} />
      <DeskPanel active={active} />
      <Marquee items={marqueeRedItems} bg="#F06464" color="#111" />
      <HowItWorks />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}
