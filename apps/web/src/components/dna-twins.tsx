'use client';

import React, { useTransition } from 'react';

import { excludeTwinAction } from '@/actions/brands'; // Will create this

// Do not import from lib/brands (server-only)
export interface DnaTwin {
  brandId: string;
  tagline: string | null;
  tone: string | null;
  isCompetitor: boolean;
  positioning: string;
  similarityScore: number;
}

function brandNameFromId(brandId: string): string {
  return brandId
    .replace(/-com$|-io$|-net$|-org$|-co$|-app$/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface DnaTwinProps {
  twins: DnaTwin[];
  workspaceId: string;
  parentBrandId: string;
}

export function DnaTwinsPanel({ twins, workspaceId, parentBrandId }: DnaTwinProps) {
  const [isPending, startTransition] = useTransition();

  if (twins.length === 0) {
    return (
      <div className="rounded-[.75rem] border border-[#535353] bg-[#111111] p-[16px] font-['Roc_Grotesk'] text-[14px] text-[#4a5464]">
        No active twins found.
      </div>
    );
  }

  return (
    <div className="rounded-[.75rem] border border-[#535353] bg-[#111111] p-[24px] font-['Roc_Grotesk']">
      <h3 className="mb-[24px] text-[20px] font-bold text-[#ffffff]">DNA Twins</h3>

      <div className="flex flex-col gap-[16px]">
        {twins.map((twin) => (
          <div
            key={twin.brandId}
            className="flex flex-col gap-[12px] rounded-[.5rem] border border-[#535353] bg-[#000000] p-[16px] shadow-[0_.063rem_.125rem_#00000026] transition-colors duration-200 hover:border-[#cb3500]"
          >
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-[16px] font-bold text-[#ffffff]">
                  {brandNameFromId(twin.brandId)}
                </h4>
                <a
                  href={`https://${twin.brandId}.com`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[12px] text-[#cb3500] hover:text-[#ed6d40] hover:underline"
                >
                  {twin.brandId}.com
                </a>
              </div>
              <div className="flex items-center gap-[12px]">
                <div className="text-right">
                  <div className="font-mono text-[16px] font-bold text-[#59a993]">
                    {(twin.similarityScore * 100).toFixed(0)}%
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-[#4a5464]">
                    Similarity
                  </div>
                </div>
                <button
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      await excludeTwinAction(workspaceId, parentBrandId, twin.brandId);
                    })
                  }
                  className="rounded-[.25rem] border border-[#535353] bg-transparent px-[12px] py-[6px] text-[12px] text-[#dadada] outline-none transition-all hover:border-[#ed6d40] hover:text-[#ed6d40] focus:ring-1 focus:ring-[#cb3500] disabled:opacity-50"
                  title="Mark as wrong/irrelevant"
                >
                  Exclude
                </button>
              </div>
            </div>

            <div className="mt-[4px] flex flex-wrap gap-[8px]">
              {twin.tone && (
                <span className="rounded-[3px] border border-[#535353] bg-[#1b1b1b] px-[8px] py-[2px] text-[11px] text-[#dadada]">
                  {twin.tone}
                </span>
              )}
            </div>

            {twin.positioning && (
              <p className="mt-[4px] text-[14px] leading-[1.5] text-[#c1c8d1]">
                "{twin.positioning}"
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
