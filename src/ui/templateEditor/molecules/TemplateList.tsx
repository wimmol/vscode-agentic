import type { AgentTemplate } from '../../../types';
import { TE_DRAFT_ID } from '../../../constants/templateEditor';

interface TemplateListProps {
  templates: AgentTemplate[];
  selectedId: string | null;
  isDraft: boolean;
  onSelect: (templateId: string) => void;
}

/** Sidebar list — one row per template, plus the active draft row when
 *  present. */
export const TemplateList = ({
  templates,
  selectedId,
  isDraft,
  onSelect,
}: TemplateListProps) => (
  <ul className="te-list" role="listbox">
    {isDraft && (
      <li
        className={`te-row te-row--draft${selectedId === TE_DRAFT_ID ? ' te-row--active' : ''}`}
        role="option"
        aria-selected={selectedId === TE_DRAFT_ID}
      >
        <span className="te-row__dot" style={{ ['--tc' as string]: '#848b9e' }} />
        <span className="te-row__name te-row__name--draft">New template</span>
      </li>
    )}
    {templates.map((t) => {
      const isActive = selectedId === t.templateId;
      return (
        <li
          key={t.templateId}
          className={`te-row${isActive ? ' te-row--active' : ''}`}
          role="option"
          aria-selected={isActive}
          tabIndex={0}
          onClick={() => onSelect(t.templateId)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelect(t.templateId);
            }
          }}
        >
          <span className="te-row__dot" style={{ ['--tc' as string]: t.color }} />
          <span className="te-row__name">{t.name}</span>
          {t.isDefault && <span className="te-row__tag">default</span>}
        </li>
      );
    })}
  </ul>
);
