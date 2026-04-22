import { BrandDnaPanel } from '@/components/brand-dna';
import { DnaTwinsPanel } from '@/components/dna-twins';

const mockDna = {
  brandId: 'acme',
  techStack: ['Next.js', 'React', 'Tailwind', 'PostgreSQL', 'Redis'],
  fontSignature: 'Roc Grotesk, Inter',
  industry: 'SaaS / Marketing',
  paletteSignature: [0.9, 0.4, 0.2, 0.7, 0.1, 0.8],
  updatedAt: new Date().toISOString(),
};

const mockTwins = [
  {
    brandId: 'competitor1',
    twinBrandId: 'competitor1',
    twinBrandName: 'Competitor One',
    twinDomain: 'competitor1.com',
    similarityScore: 0.89,
    tone: 'Professional & Direct',
    positioning: 'Enterprise-grade intelligence for large teams.',
    isExcluded: false,
    tagline: 'The smartest intelligence.',
    isCompetitor: true,
  },
  {
    brandId: 'competitor2',
    twinBrandId: 'competitor2',
    twinBrandName: 'Competitor Two',
    twinDomain: 'competitor2.co',
    similarityScore: 0.75,
    tone: 'Playful & Creative',
    positioning: 'Intelligence for startups.',
    isExcluded: false,
    tagline: 'Smart data.',
    isCompetitor: true,
  },
];

export default function UITestPage() {
  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8">
      <h1 className="mb-8 text-2xl font-bold text-white">UI Testing Environment</h1>
      <div className="grid gap-6 lg:grid-cols-[65%_1fr]">
        <div className="space-y-4">
          <BrandDnaPanel dna={mockDna} />
        </div>
        <div className="space-y-4">
          <DnaTwinsPanel twins={mockTwins} workspaceId="mock-ws" parentBrandId="acme" />
        </div>
      </div>
    </div>
  );
}
