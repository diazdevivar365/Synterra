import { and, eq } from 'drizzle-orm';
import { MessageCircle } from 'lucide-react';
import { redirect } from 'next/navigation';

import { workspaceMembers, workspaces } from '@synterra/db';

import { ChatInterface } from '@/components/chat-interface';
import { getBrandsForWorkspace } from '@/lib/brands';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

export default async function ChatPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: slug } = await params;

  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/workspaces');

  const ws = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, slug), eq(workspaceMembers.userId, ctx.userId)))
    .then((r) => r[0] ?? null);
  if (!ws) redirect('/workspaces');

  const { brands } = await getBrandsForWorkspace(ws.id);
  const brandList = brands.map((b) => ({ id: b.id, name: b.name }));

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <div className="border-border flex shrink-0 items-center gap-3 border-b px-6 py-4">
        <MessageCircle className="text-accent h-5 w-5" />
        <div>
          <h1 className="text-fg text-base font-semibold">Brand Q&A</h1>
          <p className="text-muted-fg text-xs">Research assistant powered by Aquila intelligence</p>
        </div>
      </div>
      <ChatInterface slug={slug} brands={brandList} />
    </div>
  );
}
