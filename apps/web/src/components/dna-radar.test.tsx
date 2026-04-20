import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DnaRadar } from './dna-radar';

const SCORES = {
  voiceClarity: 80,
  toneConsistency: 65,
  marketPresence: 72,
  competitivePosition: 58,
  audienceAlignment: 88,
  visualIdentity: 45,
};

describe('DnaRadar', () => {
  it('renders an SVG', () => {
    const { container } = render(<DnaRadar scores={SCORES} />);
    expect(container.querySelector('svg')).not.toBeNull();
  });
  it('renders all 6 dimension labels', () => {
    render(<DnaRadar scores={SCORES} />);
    for (const label of [
      'Voice Clarity',
      'Tone Consistency',
      'Market Presence',
      'Competitive Position',
      'Audience Alignment',
      'Visual Identity',
    ]) {
      expect(screen.getByText(label)).toBeDefined();
    }
  });
  it('renders the data polygon', () => {
    const { container } = render(<DnaRadar scores={SCORES} />);
    expect(container.querySelector('[data-testid="radar-data"]')).not.toBeNull();
  });
});
