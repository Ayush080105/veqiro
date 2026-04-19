import type { PlatformSlug, SocialProvider } from "../integrations.types.js";
import { twitter } from "./twitter.js";
import { linkedin } from "./linkedin.js";
import { instagram } from "./instagram.js";

export const providers: Record<PlatformSlug, SocialProvider> = {
  twitter,
  linkedin,
  instagram,
};

export const getProvider = (slug: PlatformSlug): SocialProvider => {
  const p = providers[slug];
  if (!p) throw new Error(`Unknown provider: ${slug}`);
  return p;
};
