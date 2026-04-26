import type { MouseEvent } from 'react';

interface IconButtonProps {
  icon: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  /** `sm` fits inside tight rows (repo head, scope labels). */
  size?: 'default' | 'sm';
  /** Optional extra class, e.g. 'tile-actions__btn--danger'. */
  className?: string;
}

/** Borderless icon-only button. Always carries a title for hover tooltip. */
export const IconButton = ({
  icon,
  title,
  onClick,
  disabled,
  size = 'default',
  className,
}: IconButtonProps) => {
  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onClick();
  };
  const cls = ['ic-btn', size === 'sm' ? 'ic-btn--sm' : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type="button"
      className={cls}
      onClick={handleClick}
      disabled={disabled}
      title={title}
      aria-label={title}
    >
      <i className={`codicon codicon-${icon}`} />
    </button>
  );
};
