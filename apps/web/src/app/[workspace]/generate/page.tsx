import { FileText, Swords, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { buttonVariants } from '@synterra/ui';

import { getWorkspaceContext } from '@/lib/workspace-context';

interface Props {
  params: Promise<{ workspace: string }>;
}

interface Tool {
  id: string;
  title: string;
  description: string;
  Icon: LucideIcon;
}

const TOOLS: Tool[] = [
  {
    id: 'brand-voice',
    title: 'Brand Voice Rewriter',
    description:
      "Paste any copy and rewrite it in your brand's exact voice using your DNA profile.",
    Icon: FileText,
  },
  {
    id: 'battlecard',
    title: 'Competitive Battlecard',
    description: 'Generate a head-to-head competitive battlecard between your brand and a rival.',
    Icon: Swords,
  },
];

export default async function GeneratePage({ params }: Props) {
  const { workspace: slug } = await params;
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/workspaces');

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8">
      <div className="mb-8">
        <h1 className="text-fg text-2xl font-bold">Generate</h1>
        <p className="text-muted-fg mt-0.5 font-mono text-xs">
          AI-powered content tools driven by your brand DNA.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {TOOLS.map(({ id, title, description, Icon }) => (
          <div
            key={id}
            className="border-border bg-surface flex flex-col gap-4 rounded-[8px] border p-6"
          >
            <div className="flex items-center gap-3">
              <div className="bg-surface-elevated text-muted-fg flex h-9 w-9 items-center justify-center rounded-[6px]">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="text-fg text-sm font-semibold">{title}</h2>
            </div>
            <p className="text-muted-fg flex-1 font-mono text-xs">{description}</p>
            <Link
              href={`/${slug}/generate/${id}`}
              className={buttonVariants({ variant: 'default', size: 'sm' })}
            >
              Open tool
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
