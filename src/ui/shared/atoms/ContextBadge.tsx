import type { ContextUsage } from '../../../types';
import { contextLevel, formatCompact } from '../utils/formatContext';

interface ContextBadgeProps {
  usage: ContextUsage | null;
}

/**
 * Compact "47k/1M" badge. Colour carries the alert state — percent is
 * intentionally not shown.
 */
export const ContextBadge = ({ usage }: ContextBadgeProps) => {
  if (!usage || usage.total <= 0) return null;

  const level = contextLevel(usage.used, usage.total);
  const className =
    level === 'danger' ? 'ctx ctx--danger' : level === 'warn' ? 'ctx ctx--warn' : 'ctx';

  return (
    <span className={className}>
      {formatCompact(usage.used)}/{formatCompact(usage.total)}
    </span>
  );
};
