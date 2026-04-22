'use server';

import { and, eq } from 'drizzle-orm';

import { workspaceMembers, workspaces } from '@synterra/db';

import { aquilaFetch } from '@/lib/aquila-server';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

export interface MullvadCountry {
  code: string; // ISO 3166-1 alpha-2 (lowercase — matches Mullvad catalogue)
  relays: number;
}

export interface MullvadCountriesResponse {
  count: number;
  countries: MullvadCountry[];
}

async function resolveWorkspace(slug: string) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return null;
  return db
    .select({ id: workspaces.id })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, slug), eq(workspaceMembers.userId, ctx.userId)))
    .then((r) => r[0] ?? null);
}

/**
 * Fetch the Mullvad country catalogue via Aquila /mullvad/countries.
 * Returns null if hubs are unconfigured or unreachable — caller should
 * fall back to hiding the picker.
 */
export async function getMullvadCountries(slug: string): Promise<MullvadCountry[] | null> {
  const ws = await resolveWorkspace(slug);
  if (!ws) return null;
  const data = await aquilaFetch<MullvadCountriesResponse>(ws.id, '/mullvad/countries');
  return data?.countries ?? null;
}
