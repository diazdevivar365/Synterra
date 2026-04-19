// Tailwind-aware className combiner. Wraps clsx + tailwind-merge so the last
// utility class of each conflicting group wins — the standard shadcn pattern.

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
