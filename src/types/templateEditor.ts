import type { AgentTemplate } from './index';
import {
  TE_CMD_CREATE,
  TE_CMD_READY,
  TE_CMD_REMOVE,
  TE_CMD_SET_DEFAULT,
  TE_CMD_UPDATE,
  TE_MSG_STATE,
} from '../constants/templateEditor';

export interface TeStateMessage {
  type: typeof TE_MSG_STATE;
  templates: AgentTemplate[];
}

export type TeExtensionToWebviewMessage = TeStateMessage;

interface TeBase<F extends string, A> {
  function: F;
  args: A;
}

export type TeWebviewToExtensionMessage =
  | TeBase<typeof TE_CMD_READY, Record<string, never>>
  | TeBase<typeof TE_CMD_CREATE, { name: string; prompt: string; color: string; isDefault: boolean }>
  | TeBase<typeof TE_CMD_UPDATE, {
      templateId: string;
      patch: Partial<Pick<AgentTemplate, 'name' | 'prompt' | 'color'>>;
    }>
  | TeBase<typeof TE_CMD_SET_DEFAULT, { templateId: string }>
  | TeBase<typeof TE_CMD_REMOVE, { templateId: string }>;

export const teReadyMessage = (): TeWebviewToExtensionMessage => ({
  function: TE_CMD_READY,
  args: {},
});

export const teCreateMessage = (
  name: string,
  prompt: string,
  color: string,
  isDefault: boolean,
): TeWebviewToExtensionMessage => ({
  function: TE_CMD_CREATE,
  args: { name, prompt, color, isDefault },
});

export const teUpdateMessage = (
  templateId: string,
  patch: Partial<Pick<AgentTemplate, 'name' | 'prompt' | 'color'>>,
): TeWebviewToExtensionMessage => ({
  function: TE_CMD_UPDATE,
  args: { templateId, patch },
});

export const teSetDefaultMessage = (templateId: string): TeWebviewToExtensionMessage => ({
  function: TE_CMD_SET_DEFAULT,
  args: { templateId },
});

export const teRemoveMessage = (templateId: string): TeWebviewToExtensionMessage => ({
  function: TE_CMD_REMOVE,
  args: { templateId },
});
