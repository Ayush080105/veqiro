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
//
// One request per page load, shared: the homepage renders prices in more than
// one section, and each used to fetch the catalog on its own.
let pending: Promise<BillingCatalog | null> | null = null;

function loadCatalog(): Promise<BillingCatalog | null> {
  if (!pending) {
    pending = fetch(`${serverUrl}/billing/catalog`)
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null); // Network error / API down — keep the hardcoded defaults.
  }
  return pending;
}

export function useBillingCatalog(): BillingCatalog | null {
  const [catalog, setCatalog] = useState<BillingCatalog | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadCatalog().then((data) => {
      if (!cancelled && data) setCatalog(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return catalog;
}
