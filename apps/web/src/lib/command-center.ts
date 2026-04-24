import 'server-only';

import {
  toCommandCenter,
  type CommandCenter,
  type CommandCenterWire,
} from '@synterra/aquila-client';

import { aquilaFetch } from '@/lib/aquila-server';

export async function getCommandCenter(workspaceId: string): Promise<CommandCenter | null> {
  const wire = await aquilaFetch<CommandCenterWire>(workspaceId, '/portal/command-center');
  if (!wire) return null;
  return toCommandCenter(wire);
}

export type { CommandCenter } from '@synterra/aquila-client';
