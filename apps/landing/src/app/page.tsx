'use client';
import { useState } from 'react';
import { Hero, Marquee } from '@/components/veqiro/hero';
import { CrewSection, DeskPanel } from '@/components/veqiro/crew';
import { HowItWorks, Pricing, FAQ, FinalCTA, Footer } from '@/components/veqiro/sections';

export default function LandingPage() {
  const [active, setActive] = useState('vega');

  return (
    <div style={{ background: '#EFE7D6', minHeight: '100vh' }}>
      <div className="noise-overlay" aria-hidden />
      <Hero />
      <Marquee
        items={['★ vega', '★ scout', '★ maya', '★ sage', '★ lex', '★ rex', '★ 6 AI hires, 1 bill', '★ veqiro']}
        bg="#111" color="#F5C518"
      />
      <CrewSection onSelect={setActive} activeKey={active} />
      <DeskPanel active={active} />
      <Marquee
        items={['they never sleep', 'they never slack off', 'they never ask for a raise', 'they do ask for coffee (jk)']}
        bg="#F06464" color="#111"
      />
      <HowItWorks />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}
