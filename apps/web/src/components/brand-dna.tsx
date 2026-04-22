import React from 'react';

export interface BrandDna {
  brandId: string;
  techStack: string[];
  fontSignature: string | null;
  industry: string | null;
  paletteSignature: number[];
  updatedAt: string;
}

interface BrandDnaProps {
  dna: BrandDna | null;
}

export function BrandDnaPanel({ dna }: BrandDnaProps) {
  if (!dna) {
    return (
      <div className="rounded-[.75rem] border border-[#535353] bg-[#111111] p-[16px] font-['Roc_Grotesk'] text-[14px] text-[#4a5464]">
        DNA data not yet computed for this brand.
      </div>
    );
  }

  // Helper to convert normalized color score to hex or similar (simplification)
  // Usually paletteSignature is an array of RGB/HSL or normalized scores.
  // The design requires a dark theme.

  return (
    <div className="rounded-[.75rem] border border-[#535353] bg-[#111111] p-[24px] font-['Roc_Grotesk']">
      <h3 className="mb-[24px] text-[20px] font-bold text-[#ffffff]">Core DNA</h3>

      <div className="flex flex-col gap-[24px]">
        {/* Industry */}
        <div>
          <h4 className="mb-[8px] text-[12px] uppercase tracking-wider text-[#4a5464]">Industry</h4>
          <div className="inline-block rounded-[.25rem] border border-[#535353] bg-[#1b1b1b] px-[12px] py-[6px] text-[14px] text-[#ffffff]">
            {dna.industry ?? 'Unknown'}
          </div>
        </div>

        {/* Font Signature */}
        <div>
          <h4 className="mb-[8px] text-[12px] uppercase tracking-wider text-[#4a5464]">
            Typography
          </h4>
          <div className="inline-block rounded-[.25rem] border border-[#535353] bg-[#1b1b1b] px-[12px] py-[6px] text-[14px] text-[#ffffff]">
            {dna.fontSignature ?? 'Default System'}
          </div>
        </div>

        {/* Tech Stack */}
        <div>
          <h4 className="mb-[8px] text-[12px] uppercase tracking-wider text-[#4a5464]">
            Tech Stack
          </h4>
          {dna.techStack.length > 0 ? (
            <div className="flex flex-wrap gap-[8px]">
              {dna.techStack.map((tech) => (
                <span
                  key={tech}
                  className="rounded-[.25rem] border border-[#535353] bg-[#1b1b1b] px-[10px] py-[4px] text-[12px] text-[#dadada]"
                >
                  {tech}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[14px] text-[#4a5464]">No tech stack detected.</p>
          )}
        </div>

        {/* Palette Signature */}
        <div>
          <h4 className="mb-[8px] text-[12px] uppercase tracking-wider text-[#4a5464]">
            Color Spectrum
          </h4>
          {dna.paletteSignature.length > 0 ? (
            <div className="flex h-[32px] items-center gap-[4px] overflow-hidden rounded-[.25rem] border border-[#535353]">
              {dna.paletteSignature.map((val, idx) => (
                <div
                  key={idx}
                  className="h-full flex-1"
                  style={{ opacity: 0.2 + val * 0.8, backgroundColor: '#ed6d40' }}
                  title={`Signal strength: ${val}`}
                />
              ))}
            </div>
          ) : (
            <p className="text-[14px] text-[#4a5464]">Spectrum data unavailable.</p>
          )}
        </div>
      </div>
    </div>
  );
}
