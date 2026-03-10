interface IconButtonProps {
  icon: string;
  onClick: () => void;
  disabled?: boolean;
  title: string;
}

export const IconButton = ({ icon, onClick, disabled, title }: IconButtonProps) => {
  return (
    <button
      className="icon-button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
    >
      <i className={`codicon codicon-${icon}`} />
    </button>
  );
};
