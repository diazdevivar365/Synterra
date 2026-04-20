import { ProgressView } from './_components/ProgressView.js';

import type { Metadata } from 'next';

interface Props {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: 'Analyzing your brand… — Forgentic' };

export default async function OnboardingProgressPage({ params }: Props) {
  const { id } = await params;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-4">
      <div className="w-full max-w-2xl">
        <ProgressView inflightId={id} />
      </div>
    </main>
  );
}
