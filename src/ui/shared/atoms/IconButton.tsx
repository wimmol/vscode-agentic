import type { MouseEvent } from 'react';

interface IconButtonProps {
  icon: string;
  onClick: () => void;
  disabled?: boolean;
  title: string;
}

export const IconButton = ({ icon, onClick, disabled, title }: IconButtonProps) => {
  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    onClick();
  };

  return (
    <button
      className="icon-button"
      onClick={handleClick}
      disabled={disabled}
      title={title}
      aria-label={title}
    >
      <i className={`codicon codicon-${icon}`} />
    </button>
  );
};
