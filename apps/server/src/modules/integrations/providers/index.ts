import type { PlatformSlug, SocialProvider } from "../integrations.types.js";
import { twitter } from "./twitter.js";
import { linkedin } from "./linkedin.js";

/**
 * Platforms that still publish through a bespoke SocialAccount OAuth provider.
 *
 * Deliberately narrower than PlatformSlug: Instagram publishes over its
 * Composio MCP connection now (see providers/instagram.composio.ts) and has no
 * native provider, so a `Record<PlatformSlug, ...>` here would be a lie the
 * type system can only satisfy with a stub.
 */
export type NativePlatformSlug = Extract<PlatformSlug, "twitter" | "linkedin">;

export const providers: Record<NativePlatformSlug, SocialProvider> = {
  twitter,
  linkedin,
};

export const getProvider = (slug: PlatformSlug): SocialProvider => {
  const p = providers[slug as NativePlatformSlug];
  if (!p) {
    throw new Error(
      slug === "instagram"
        ? "Instagram publishes over its Composio connection, not a native provider"
        : `Unknown provider: ${slug}`,
    );
  }
  return p;
};
