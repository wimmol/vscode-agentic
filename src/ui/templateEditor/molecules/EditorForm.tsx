import type { FormState } from '../TemplateEditorPage';

interface EditorFormProps {
  palette: string[];
  form: FormState;
  isDraft: boolean;
  canSave: boolean;
  canDelete: boolean;
  onChange: (patch: Partial<FormState>) => void;
  onSave: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}

/** Right-side editor form. Name + prompt + colour swatches + default toggle. */
export const EditorForm = ({
  palette,
  form,
  isDraft,
  canSave,
  canDelete,
  onChange,
  onSave,
  onDelete,
  onSetDefault,
}: EditorFormProps) => (
  <section className="te-form">
    <label className="te-field">
      <span className="te-field__label">Name</span>
      <input
        className="te-input"
        type="text"
        value={form.name}
        placeholder="fix, docs, review…"
        onChange={(e) => onChange({ name: e.target.value })}
      />
    </label>

    <label className="te-field te-field--grow">
      <span className="te-field__label">System prompt</span>
      <textarea
        className="te-textarea"
        value={form.prompt}
        placeholder="Written to .claude/CLAUDE.md in the worktree when an agent launches with this template."
        onChange={(e) => onChange({ prompt: e.target.value })}
        spellCheck={false}
      />
    </label>

    <div className="te-field">
      <span className="te-field__label">Colour</span>
      <div className="te-swatches" role="radiogroup" aria-label="Template colour">
        {palette.map((color) => {
          const selected = color.toLowerCase() === form.color.toLowerCase();
          return (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={color}
              className={`te-swatch${selected ? ' te-swatch--selected' : ''}`}
              style={{ ['--tc' as string]: color }}
              onClick={() => onChange({ color })}
            />
          );
        })}
      </div>
    </div>

    <div className="te-field te-field--row">
      <label className="te-check">
        <input
          type="checkbox"
          checked={form.isDefault}
          disabled={isDraft ? false : form.isDefault}
          onChange={(e) => {
            if (isDraft) {
              onChange({ isDefault: e.target.checked });
              return;
            }
            if (e.target.checked) onSetDefault();
          }}
        />
        <span>Default template (one-click launch)</span>
      </label>
    </div>

    <div className="te-actions">
      <button
        type="button"
        className="te-btn te-btn--primary"
        disabled={!canSave}
        onClick={onSave}
      >
        {isDraft ? 'Create' : 'Save'}
      </button>
      <button
        type="button"
        className="te-btn te-btn--ghost"
        disabled={!canDelete}
        onClick={onDelete}
      >
        {isDraft ? 'Discard' : 'Delete'}
      </button>
    </div>
  </section>
);
