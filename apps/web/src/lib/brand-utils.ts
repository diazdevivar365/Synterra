export function getHealthColor(score: number): string {
  if (score >= 70) return 'text-accent';
  if (score < 40) return 'text-danger';
  return 'text-fg';
}

export function getHealthLabel(score: number): string {
  if (score >= 70) return 'Strong';
  if (score < 40) return 'At risk';
  return 'Developing';
}

export function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleIndex: number,
  total: number,
): { x: number; y: number } {
  const angle = (2 * Math.PI * angleIndex) / total - Math.PI / 2;
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

export function radarPolygonPoints(
  scores: number[],
  cx: number,
  cy: number,
  maxRadius: number,
): string {
  return scores
    .map((score, i) => {
      const r = (Math.max(0, Math.min(100, score)) / 100) * maxRadius;
      const { x, y } = polarToCartesian(cx, cy, r, i, scores.length);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

export function brandInitials(name: string): string {
  if (!name) return '??';
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return ((words[0]![0] ?? '') + (words[1]![0] ?? '')).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
