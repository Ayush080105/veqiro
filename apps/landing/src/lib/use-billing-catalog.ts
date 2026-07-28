'use client';
import { useEffect, useState } from 'react';
import { serverUrl } from './site-config';

export interface BillingCatalog {
  agents: Record<string, { priceCents: number }>;
  currency: string;
}

// Real prices come from the server's /billing/catalog (single source of
// truth, shared with apps/main) so marketing copy can never drift from what
// customers are actually charged. Returns null until the fetch resolves, or
// forever on failure — callers fall back to site-config's hardcoded defaults
// so the marketing site never hard-fails on an API blip.
export function useBillingCatalog(): BillingCatalog | null {
  const [catalog, setCatalog] = useState<BillingCatalog | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${serverUrl}/billing/catalog`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setCatalog(data);
      })
      .catch(() => {
        // Network error / API down — keep the hardcoded site-config defaults.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return catalog;
}
