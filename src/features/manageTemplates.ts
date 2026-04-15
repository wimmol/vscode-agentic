import * as vscode from 'vscode';
import type { StateStorage } from '../db';
import {
  INPUT_TEMPLATE_NAME_PROMPT,
  INPUT_TEMPLATE_NAME_PLACEHOLDER,
  INPUT_TEMPLATE_PROMPT_PROMPT,
  INPUT_TEMPLATE_PROMPT_PLACEHOLDER,
  PICK_REMOVE_TEMPLATE_TITLE,
  PICK_REMOVE_TEMPLATE_PLACEHOLDER,
} from '../constants/messages';

export const createTemplate = async (storage: StateStorage): Promise<void> => {
  const name = await vscode.window.showInputBox({
    prompt: INPUT_TEMPLATE_NAME_PROMPT,
    placeHolder: INPUT_TEMPLATE_NAME_PLACEHOLDER,
    ignoreFocusOut: true,
  });
  if (!name) return;

  const prompt = await vscode.window.showInputBox({
    prompt: INPUT_TEMPLATE_PROMPT_PROMPT,
    placeHolder: INPUT_TEMPLATE_PROMPT_PLACEHOLDER,
    ignoreFocusOut: true,
  });
  if (!prompt) return;

  await storage.addTemplate(name, prompt);
  vscode.window.showInformationMessage(`Template "${name}" created.`);
};

export const removeTemplate = async (storage: StateStorage): Promise<void> => {
  const templates = storage.getAllTemplates();
  if (templates.length === 0) {
    vscode.window.showInformationMessage('No templates to remove.');
    return;
  }

  const picked = await vscode.window.showQuickPick(
    templates.map((t) => ({ label: t.name, description: t.prompt.slice(0, 60), templateId: t.templateId })),
    { title: PICK_REMOVE_TEMPLATE_TITLE, placeHolder: PICK_REMOVE_TEMPLATE_PLACEHOLDER },
  );
  if (!picked) return;

  await storage.removeTemplate(picked.templateId);
  vscode.window.showInformationMessage(`Template "${picked.label}" removed.`);
};
