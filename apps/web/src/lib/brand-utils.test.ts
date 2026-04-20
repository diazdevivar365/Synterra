import { describe, expect, it } from 'vitest';

import {
  brandInitials,
  getHealthColor,
  getHealthLabel,
  polarToCartesian,
  radarPolygonPoints,
} from './brand-utils';

describe('getHealthColor', () => {
  it('returns text-accent for scores >= 70', () => {
    expect(getHealthColor(70)).toBe('text-accent');
    expect(getHealthColor(100)).toBe('text-accent');
    expect(getHealthColor(85)).toBe('text-accent');
  });
  it('returns text-danger for scores < 40', () => {
    expect(getHealthColor(39)).toBe('text-danger');
    expect(getHealthColor(0)).toBe('text-danger');
  });
  it('returns text-fg for 40–69', () => {
    expect(getHealthColor(40)).toBe('text-fg');
    expect(getHealthColor(69)).toBe('text-fg');
  });
});

describe('getHealthLabel', () => {
  it('returns Strong for >= 70', () => {
    expect(getHealthLabel(70)).toBe('Strong');
  });
  it('returns At risk for < 40', () => {
    expect(getHealthLabel(39)).toBe('At risk');
  });
  it('returns Developing for 40–69', () => {
    expect(getHealthLabel(55)).toBe('Developing');
  });
});

describe('polarToCartesian', () => {
  it('returns top vertex for index 0 of 6 at radius 100', () => {
    const { x, y } = polarToCartesian(160, 160, 100, 0, 6);
    expect(x).toBeCloseTo(160, 1);
    expect(y).toBeCloseTo(60, 1);
  });
  it('returns bottom vertex for index 3 of 6 at radius 100', () => {
    const { x, y } = polarToCartesian(160, 160, 100, 3, 6);
    expect(x).toBeCloseTo(160, 1);
    expect(y).toBeCloseTo(260, 1);
  });
});

describe('radarPolygonPoints', () => {
  it('returns a string with 6 x,y pairs', () => {
    const result = radarPolygonPoints([80, 60, 70, 50, 90, 40], 160, 160, 120);
    expect(result.trim().split(' ')).toHaveLength(6);
  });
  it('maps score 0 to center point', () => {
    const result = radarPolygonPoints([0, 0, 0, 0, 0, 0], 160, 160, 120);
    result.split(' ').forEach((pair: string) => {
      const [x, y] = pair.split(',').map(Number);
      expect(x).toBeCloseTo(160, 1);
      expect(y).toBeCloseTo(160, 1);
    });
  });
});

describe('brandInitials', () => {
  it('returns first letter of each of first two words', () => {
    expect(brandInitials('Acme Corp')).toBe('AC');
  });
  it('handles single word by taking first two chars', () => {
    expect(brandInitials('Nike')).toBe('NI');
  });
  it('handles empty string', () => {
    expect(brandInitials('')).toBe('??');
  });
});
