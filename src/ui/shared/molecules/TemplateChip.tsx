interface TemplateChipProps {
  name: string;
  /** Hex colour from `AgentTemplate.color`. Drives the leading dot and, for
   *  default chips, the filled background / border. */
  color: string;
  /** Emphasised styling for the repo's default template. */
  isDefault?: boolean;
  onClick: () => void;
}

/**
 * One-click launcher chip. Colour dot + mono name; clicking spawns a new
 * agent in the enclosing scope using this template.
 */
export const TemplateChip = ({ name, color, isDefault, onClick }: TemplateChipProps) => {
  const className = isDefault ? 'tmpl tmpl--default' : 'tmpl';
  return (
    <button
      type="button"
      className={className}
      style={{ ['--tc' as string]: color }}
      onClick={onClick}
      title={isDefault ? `${name} — default (one-click)` : name}
    >
      {name}
    </button>
  );
};
