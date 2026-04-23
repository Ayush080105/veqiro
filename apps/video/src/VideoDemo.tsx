import React from "react";
import { Series } from "remotion";
import { ChaosHook } from "./scenes/ChaosHook";
import { PivotLine } from "./scenes/PivotLine";
import { BrandReveal } from "./scenes/BrandReveal";
import { CrewParade } from "./scenes/CrewParade";
import { HowItWorks } from "./scenes/HowItWorks";
import { PricingPunch } from "./scenes/PricingPunch";
import { CTAClose } from "./scenes/CTAClose";

export const VideoDemo: React.FC = () => (
  <Series>
    <Series.Sequence durationInFrames={90}  premountFor={30}><ChaosHook /></Series.Sequence>
    <Series.Sequence durationInFrames={90}  premountFor={30}><PivotLine /></Series.Sequence>
    <Series.Sequence durationInFrames={90}  premountFor={30}><BrandReveal /></Series.Sequence>
    <Series.Sequence durationInFrames={390} premountFor={30}><CrewParade /></Series.Sequence>
    <Series.Sequence durationInFrames={270} premountFor={30}><HowItWorks /></Series.Sequence>
    <Series.Sequence durationInFrames={150} premountFor={30}><PricingPunch /></Series.Sequence>
    <Series.Sequence durationInFrames={120} premountFor={30}><CTAClose /></Series.Sequence>
  </Series>
);
