import { T } from '@/components/veqiro/tokens';

/**
 * Single source of truth for blog category presentation. Previously
 * hand-copied (as raw hex) into blog-post-layout.tsx, blog-card.tsx, and
 * blog-agent-cta.tsx independently — import from here instead.
 */
export const CATEGORY_LABELS: Record<string, string> = {
  'ai-employees': 'AI Employees',
  'founders': 'Founders',
  'agents': 'Agents',
  'use-cases': 'Use Cases',
  'comparisons': 'Comparisons',
};

export const CATEGORY_COLORS: Record<string, { bg: string; ink: string }> = {
  'ai-employees': { bg: T.amber, ink: 'color-mix(in srgb, var(--vq-amber) 65%, black)' },
  'founders': { bg: T.red, ink: 'color-mix(in srgb, var(--vq-red) 55%, black)' },
  'agents': { bg: T.violet, ink: 'color-mix(in srgb, var(--vq-violet) 55%, black)' },
  'use-cases': { bg: T.green, ink: 'color-mix(in srgb, var(--vq-green) 60%, black)' },
  'comparisons': { bg: T.pink, ink: 'color-mix(in srgb, var(--vq-pink) 60%, black)' },
};
