import { TemplateList } from '../molecules/TemplateList';
import { EditorForm } from '../molecules/EditorForm';
import type { AgentTemplate } from '../../../types';
import type { FormState } from '../TemplateEditorPage';

interface TemplateEditorViewProps {
  templates: AgentTemplate[];
  palette: string[];
  selectedId: string | null;
  isDraft: boolean;
  form: FormState;
  canSave: boolean;
  onSelect: (templateId: string) => void;
  onNew: () => void;
  onFormChange: (patch: Partial<FormState>) => void;
  onSave: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}

/** Two-column layout: sidebar with template list, main editor form. */
export const TemplateEditorView = ({
  templates,
  palette,
  selectedId,
  isDraft,
  form,
  canSave,
  onSelect,
  onNew,
  onFormChange,
  onSave,
  onDelete,
  onSetDefault,
}: TemplateEditorViewProps) => (
  <main className="te-shell">
    <header className="te-head">
      <h1 className="te-title">Agent Templates</h1>
      <p className="te-sub">
        System prompts written as <code>.claude/CLAUDE.md</code> when an agent launches.
      </p>
    </header>

    <section className="te-body">
      <aside className="te-sidebar">
        <button type="button" className="te-new-btn" onClick={onNew}>
          <i className="codicon codicon-add" aria-hidden />
          <span>New template</span>
        </button>
        <TemplateList
          templates={templates}
          selectedId={selectedId}
          isDraft={isDraft}
          onSelect={onSelect}
        />
      </aside>

      <EditorForm
        palette={palette}
        form={form}
        isDraft={isDraft}
        canSave={canSave}
        canDelete={selectedId !== null}
        onChange={onFormChange}
        onSave={onSave}
        onDelete={onDelete}
        onSetDefault={onSetDefault}
      />
    </section>
  </main>
);
