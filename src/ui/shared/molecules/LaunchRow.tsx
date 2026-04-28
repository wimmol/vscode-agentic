import { TemplateChip } from './TemplateChip';

export interface LaunchTemplate {
  templateId: string;
  name: string;
  color: string;
  isDefault?: boolean;
}

interface LaunchRowProps {
  templates: LaunchTemplate[];
  /** Pass a real templateId or null if no template is meaningful. */
  onLaunch: (templateId: string | null) => void;
  onManage: () => void;
}

/**
 * Horizontal, scrollable row of template launchers plus a manage gear.
 * Default template renders first and is emphasised. A fade-mask on the track
 * edges reveals that content scrolls when the row overflows.
 */
export const LaunchRow = ({ templates, onLaunch, onManage }: LaunchRowProps) => {
  const ordered = [...templates].sort((a, b) => {
    if (a.isDefault && !b.isDefault) return -1;
    if (!a.isDefault && b.isDefault) return 1;
    return 0;
  });

  return (
    <div className="launch">
      <div className="launch__track">
        {ordered.map((t) => (
          <TemplateChip
            key={t.templateId}
            name={t.name}
            color={t.color}
            isDefault={t.isDefault}
            onClick={() => onLaunch(t.templateId)}
          />
        ))}
      </div>
      <button
        type="button"
        className="launch__manage"
        onClick={onManage}
        title="Manage templates"
      >
        <i className="codicon codicon-settings-gear" />
      </button>
    </div>
  );
};
