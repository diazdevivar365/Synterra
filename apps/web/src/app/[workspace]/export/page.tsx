import { and, eq } from 'drizzle-orm';
import { Download, FileJson, FileSpreadsheet, FileText } from 'lucide-react';
import { redirect } from 'next/navigation';

import { workspaceMembers, workspaces } from '@synterra/db';

import { db } from '@/lib/db';
import { getInsightsSummary } from '@/lib/insights';
import { getWorkspaceContext } from '@/lib/workspace-context';

interface Props {
  params: Promise<{ workspace: string }>;
}

const FORMATS = [
  {
    format: 'json',
    label: 'JSON',
    description: 'Full portfolio data — brand DNA, tone, audience, tech stack, palette.',
    icon: FileJson,
  },
  {
    format: 'csv',
    label: 'CSV',
    description: 'Spreadsheet-friendly export — one row per brand, key fields as columns.',
    icon: FileSpreadsheet,
  },
  {
    format: 'md',
    label: 'Markdown',
    description: 'Notion-friendly export — structured brand profiles in readable Markdown.',
    icon: FileText,
  },
] as const;

export default async function ExportPage({ params }: Props) {
  const { workspace: slug } = await params;
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/workspaces');

  const ws = await db
    .select({ id: workspaces.id, name: workspaces.name })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, slug), eq(workspaceMembers.userId, ctx.userId)))
    .then((r) => r[0] ?? null);
  if (!ws) redirect('/workspaces');

  const summary = await getInsightsSummary(ws.id);

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8">
      <div className="mb-8">
        <h1 className="text-fg text-2xl font-bold">Portfolio Export</h1>
        <p className="text-muted-fg font-mono text-xs">
          {summary ? `${summary.brandsTracked} brands ready to export` : 'Download your brand data'}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {FORMATS.map(({ format, label, description, icon: Icon }) => (
          <div key={format} className="border-border bg-surface rounded-[8px] border p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="border-border bg-surface-elevated flex h-10 w-10 items-center justify-center rounded-[8px] border">
                <Icon className="text-muted-fg h-5 w-5" />
              </div>
              <div>
                <h3 className="text-fg text-sm font-semibold">{label}</h3>
                <p className="text-muted-fg font-mono text-[10px]">.{format}</p>
              </div>
            </div>
            <p className="text-muted-fg mb-5 text-xs">{description}</p>
            <a
              href={`/api/${slug}/export/${format}`}
              download
              className="border-border bg-surface-elevated text-fg hover:border-accent/40 hover:text-accent inline-flex w-full items-center justify-center gap-2 rounded-[6px] border px-4 py-2 font-mono text-xs transition-colors duration-150"
            >
              <Download className="h-3.5 w-3.5" />
              Download {label}
            </a>
          </div>
        ))}
      </div>

      <div className="border-border bg-surface mt-8 rounded-[8px] border p-4">
        <p className="text-muted-fg font-mono text-[10px]">
          Exports include all brands with available intelligence data. JSON contains the most
          detail; CSV is best for spreadsheets; Markdown is optimized for Notion import.
        </p>
      </div>
    </div>
  );
}
