import { Smithery } from "@smithery/api";

export const smitheryClient = new Smithery({
  apiKey: process.env.SMITHERY_API_KEY!,
});

/**
 * Single shared namespace for the whole app — Smithery's namespace ceiling
 * (Hobby=3, Pay-as-you-go=100) makes per-org namespacing impractical.
 * connectionId (see McpConnection) is the sole tenancy boundary instead.
 */
export const SMITHERY_NAMESPACE = process.env.SMITHERY_NAMESPACE!;
