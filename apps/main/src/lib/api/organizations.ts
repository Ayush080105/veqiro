import { authClient } from '@/lib/auth-client';

export type CreateOrganizationInput = {
  name: string;
  slug: string;
  logo?: string | null;
};

export type CreateOrganizationResult =
  | { ok: true; id: string; slug: string }
  | { ok: false; code: 'slug_taken' | 'not_allowed' | 'unknown'; message: string };

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
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
