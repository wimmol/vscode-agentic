import * as vscode from 'vscode';
import type { StateStorage } from '../db';
import { buildWebviewHtml } from '../utils/webview';
import {
  TE_CMD_CREATE,
  TE_CMD_READY,
  TE_CMD_REMOVE,
  TE_CMD_SET_DEFAULT,
  TE_CMD_UPDATE,
  TE_MSG_STATE,
  TE_VIEW_TYPE,
} from '../constants/templateEditor';
import type {
  TeExtensionToWebviewMessage,
  TeWebviewToExtensionMessage,
} from '../types/templateEditor';
import { logger } from './Logger';

/**
 * Editor panel for agent templates. Opens in the editor area (not the
 * sidebar) so the user has room for a multi-line prompt field alongside the
 * template list.
 *
 * Exists as a class because it keeps a single panel alive — reveal existing
 * instance on re-open rather than spawning duplicates — and owns listeners
 * scoped to that panel's lifetime.
 */
export class TemplateEditorProvider implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private readonly panelDisposables: vscode.Disposable[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly storage: StateStorage,
  ) {}

  /** Show the panel (reveal if already open, otherwise create). */
  open = (): void => {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Active);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      TE_VIEW_TYPE,
      'Agent Templates',
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: false,
        localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'out', 'ui')],
      },
    );

    panel.webview.html = buildWebviewHtml(
      panel.webview,
      this.extensionUri,
      'templateEditor.js',
      'templateEditor.css',
    );

    this.panel = panel;

    panel.webview.onDidReceiveMessage(
      (message: TeWebviewToExtensionMessage) => this.handle(message),
      null,
      this.panelDisposables,
    );

    this.panelDisposables.push(
      this.storage.onDidChange(() => void this.pushState()),
    );

    panel.onDidDispose(() => {
      for (const d of this.panelDisposables.splice(0)) d.dispose();
      this.panel = undefined;
    }, null, this.panelDisposables);
  };

  private handle = async (message: TeWebviewToExtensionMessage): Promise<void> => {
    try {
      switch (message.function) {
        case TE_CMD_READY:
          await this.pushState();
          break;
        case TE_CMD_CREATE: {
          const { name, prompt, color, isDefault } = message.args;
          await this.storage.addTemplate(name, prompt, { color, isDefault });
          break;
        }
        case TE_CMD_UPDATE: {
          const { templateId, patch } = message.args;
          await this.storage.updateTemplate(templateId, patch);
          break;
        }
        case TE_CMD_SET_DEFAULT:
          await this.storage.setDefaultTemplate(message.args.templateId);
          break;
        case TE_CMD_REMOVE:
          await this.storage.removeTemplate(message.args.templateId);
          break;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('TemplateEditorProvider handle', err, { function: message.function });
      vscode.window.showErrorMessage(msg);
    }
  };

  private pushState = async (): Promise<void> => {
    if (!this.panel) return;
    const payload: TeExtensionToWebviewMessage = {
      type: TE_MSG_STATE,
      templates: this.storage.getAllTemplates(),
    };
    await this.panel.webview.postMessage(payload);
  };

  dispose(): void {
    for (const d of this.panelDisposables.splice(0)) d.dispose();
    this.panel?.dispose();
    this.panel = undefined;
  }
}
