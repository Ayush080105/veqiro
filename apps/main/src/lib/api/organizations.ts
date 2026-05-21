import { authClient } from '@/lib/auth-client';
import { toast } from 'sonner';

type Router = { push: (href: string) => void; replace: (href: string) => void };
const SESSION_REFRESH_QUERY = '__session=refresh';

export type CreateOrganizationInput = {
  name: string;
  slug: string;
  logo?: string | null;
};

export type CreateOrganizationResult =
  | { ok: true; id: string; slug: string }
  | { ok: false; code: 'slug_taken' | 'not_allowed' | 'unknown'; message: string };

export function slugify(name: string): string {
  const base = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 35);

  const root = base || 'workspace';
  const suffix = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `${root}-${suffix}`;
}

export async function createOrganization(input: CreateOrganizationInput): Promise<CreateOrganizationResult> {
  try {
    const res = await authClient.organization.create({
      name: input.name,
      slug: input.slug,
      onboarded: false,
      ...(input.logo ? { logo: input.logo } : {}),
    });

    const err = (res as { error?: { code?: string; message?: string } | null }).error;
    if (err) {
      const code = err.code ?? '';
      if (code === 'ORGANIZATION_SLUG_ALREADY_TAKEN' || code === 'ORGANIZATION_ALREADY_EXISTS') {
        return { ok: false, code: 'slug_taken', message: 'That workspace URL is taken. Try another.' };
      }
      if (code === 'YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_ORGANIZATION' || code === 'YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_ORGANIZATIONS') {
        return { ok: false, code: 'not_allowed', message: err.message ?? "You can't create another workspace right now." };
      }
      return { ok: false, code: 'unknown', message: err.message ?? 'Could not create workspace.' };
    }

    const data = (res as { data?: { id: string; slug: string } | null }).data;
    if (!data?.id) {
      return { ok: false, code: 'unknown', message: 'Workspace created but no id returned.' };
    }
    return { ok: true, id: data.id, slug: data.slug };
  } catch (e) {
    return { ok: false, code: 'unknown', message: e instanceof Error ? e.message : 'Could not create workspace.' };
  }
}

export async function setActiveOrganization(organizationId: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await authClient.organization.setActive({ organizationId });
    const err = (res as { error?: { message?: string } | null }).error;
    if (err) return { ok: false, message: err.message ?? 'Could not set active workspace.' };
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Could not set active workspace.' };
  }
}

/**
 * Clears the session's active organization. After this, useSession()
 * and the proxy middleware see no active org until the user picks one.
 *
 * Better-auth 1.5.6 supports null via setActive's body schema (see
 * node_modules/better-auth/dist/plugins/organization/routes/crud-org.mjs:340-373).
 */
export async function clearActiveOrganization(): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await authClient.organization.setActive({ organizationId: null });
    const err = (res as { error?: { message?: string } | null }).error;
    if (err) return { ok: false, message: err.message ?? 'Could not clear active workspace.' };
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Could not clear active workspace.' };
  }
}

/**
 * Sets `organizationId` as the active org, refreshes the session
 * cache so useActiveOrganization() picks up the change, and
 * navigates to /dashboard. The proxy decides the final destination
 * based on the new org's onboarded flag.
 */
export async function switchToOrganization(
  organizationId: string,
  router: Router,
): Promise<void> {
  const result = await setActiveOrganization(organizationId);
  if (!result.ok) {
    toast.error(result.message ?? 'Could not switch workspace.');
    return;
  }
  try {
    await authClient.getSession({ query: { disableCookieCache: true } });
  } catch {
    // Proxy will gate the next page anyway.
  }
  router.replace(`/dashboard?${SESSION_REFRESH_QUERY}`);
}

/**
 * Clears the active org, refreshes the session cache, and navigates
 * to /onboarding/step1 so the user can create a new workspace. Step1
 * sees no active org and renders its create form.
 */
export async function clearActiveAndStartNew(router: Router): Promise<void> {
  const result = await clearActiveOrganization();
  if (!result.ok) {
    toast.error(result.message ?? 'Could not start new workspace.');
    return;
  }
  try {
    await authClient.getSession({ query: { disableCookieCache: true } });
  } catch {
    // Proxy will gate the next page anyway.
  }
  router.push(`/onboarding/step1?${SESSION_REFRESH_QUERY}`);
}
