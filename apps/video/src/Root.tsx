import React from "react";
import { Composition } from "remotion";
import { VideoDemo } from "./VideoDemo";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="VeqiroDemo"
    component={VideoDemo}
    durationInFrames={1200}
    fps={30}
    width={1080}
    height={1920}
  />
);
