export const formatCompact = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return `${n}`;
};

export type ContextLevel = 'normal' | 'warn' | 'danger';

export const contextLevel = (used: number, total: number): ContextLevel => {
  const pct = used / total;
  if (pct >= 0.75) return 'danger';
  if (pct >= 0.50) return 'warn';
  return 'normal';
};
