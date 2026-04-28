import { useCallback, useEffect, useMemo, useState } from 'react';
import { TemplateEditorView } from './views/TemplateEditorView';
import { vscode } from './index';
import type { AgentTemplate } from '../../types';
import type { TeExtensionToWebviewMessage } from '../../types/templateEditor';
import {
  teCreateMessage,
  teReadyMessage,
  teRemoveMessage,
  teSetDefaultMessage,
  teUpdateMessage,
} from '../../types/templateEditor';
import { TE_DRAFT_ID, TE_MSG_STATE } from '../../constants/templateEditor';
import { TEMPLATE_PALETTE, templateColorByIndex } from '../../constants/templateColor';

interface FormState {
  name: string;
  prompt: string;
  color: string;
  isDefault: boolean;
}

const EMPTY_FORM: FormState = { name: '', prompt: '', color: '', isDefault: false };

const formFromTemplate = (t: AgentTemplate): FormState => ({
  name: t.name,
  prompt: t.prompt,
  color: t.color,
  isDefault: t.isDefault,
});

export const TemplateEditorPage = () => {
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  useEffect(() => {
    const handler = (event: MessageEvent<TeExtensionToWebviewMessage>) => {
      if (event.data.type !== TE_MSG_STATE) return;
      setTemplates(event.data.templates);
    };
    window.addEventListener('message', handler);
    vscode.postMessage(teReadyMessage());
    return () => window.removeEventListener('message', handler);
  }, []);

  const isDraft = selectedId === TE_DRAFT_ID;

  const selected = useMemo(
    () =>
      selectedId && !isDraft
        ? templates.find((t) => t.templateId === selectedId) ?? null
        : null,
    [selectedId, isDraft, templates],
  );

  // Auto-select the default / first template on first load, and reseed the
  // form whenever the selected template's stored values change under us
  // (another edit, a set-default, etc.).
  useEffect(() => {
    if (selectedId === null && templates.length > 0) {
      const next = templates.find((t) => t.isDefault) ?? templates[0];
      setSelectedId(next.templateId);
      setForm(formFromTemplate(next));
      return;
    }
    if (selected) {
      setForm(formFromTemplate(selected));
    }
  }, [templates, selected, selectedId]);

  const onSelect = useCallback((templateId: string) => {
    setSelectedId(templateId);
    const t = templates.find((x) => x.templateId === templateId);
    if (t) setForm(formFromTemplate(t));
  }, [templates]);

  const onNew = useCallback(() => {
    setSelectedId(TE_DRAFT_ID);
    setForm({
      name: '',
      prompt: '',
      color: templateColorByIndex(templates.length),
      isDefault: false,
    });
  }, [templates.length]);

  const onFormChange = useCallback((patch: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const onSave = useCallback(() => {
    if (isDraft) {
      if (!form.name.trim()) return;
      vscode.postMessage(teCreateMessage(form.name, form.prompt, form.color, form.isDefault));
      setSelectedId(null);
      return;
    }
    if (!selected) return;
    const patch: Partial<Pick<AgentTemplate, 'name' | 'prompt' | 'color'>> = {};
    if (form.name !== selected.name) patch.name = form.name;
    if (form.prompt !== selected.prompt) patch.prompt = form.prompt;
    if (form.color !== selected.color) patch.color = form.color;
    if (Object.keys(patch).length > 0) {
      vscode.postMessage(teUpdateMessage(selected.templateId, patch));
    }
    if (form.isDefault && !selected.isDefault) {
      vscode.postMessage(teSetDefaultMessage(selected.templateId));
    }
  }, [form, selected, isDraft]);

  const onDelete = useCallback(() => {
    if (isDraft) {
      setSelectedId(templates[0]?.templateId ?? null);
      return;
    }
    if (!selected) return;
    vscode.postMessage(teRemoveMessage(selected.templateId));
    setSelectedId(null);
  }, [selected, isDraft, templates]);

  const onSetDefault = useCallback(() => {
    if (!selected || selected.isDefault) return;
    vscode.postMessage(teSetDefaultMessage(selected.templateId));
  }, [selected]);

  const canSave = isDraft
    ? form.name.trim().length > 0
    : selected !== null && (
        form.name !== selected.name ||
        form.prompt !== selected.prompt ||
        form.color !== selected.color ||
        (form.isDefault && !selected.isDefault)
      );

  return (
    <TemplateEditorView
      templates={templates}
      palette={TEMPLATE_PALETTE as unknown as string[]}
      selectedId={selectedId}
      isDraft={isDraft}
      form={form}
      canSave={canSave}
      onSelect={onSelect}
      onNew={onNew}
      onFormChange={onFormChange}
      onSave={onSave}
      onDelete={onDelete}
      onSetDefault={onSetDefault}
    />
  );
};

export type { FormState };
