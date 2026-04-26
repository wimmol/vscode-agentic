import { useState, useEffect } from 'react';
import { vscode } from '../index';
import type { RepoWithScopes, AgentTemplate } from '../../types';
import type { ExtensionToWebviewMessage } from '../../types/messages';
import { MSG_TYPE_UPDATE, CMD_READY, PROTOCOL_VERSION } from '../../constants/commands';

interface PanelState {
  repos: RepoWithScopes[];
  templates: AgentTemplate[];
}

interface CachedPanelState extends PanelState {
  protocol: typeof PROTOCOL_VERSION;
}

const getCachedState = (): PanelState => {
  const cached = vscode.getState() as Partial<CachedPanelState> | undefined;
  if (!cached || cached.protocol !== PROTOCOL_VERSION) return { repos: [], templates: [] };
  return {
    repos: cached.repos ?? [],
    templates: cached.templates ?? [],
  };
};

export const useAgentPanel = (): PanelState => {
  const [state, setState] = useState<PanelState>(getCachedState);

  useEffect(() => {
    const handler = (event: MessageEvent<ExtensionToWebviewMessage>) => {
      const message = event.data;
      if (message.type !== MSG_TYPE_UPDATE) return;
      const next: PanelState = {
        repos: message.repos,
        templates: message.templates ?? [],
      };
      setState(next);
      const cached: CachedPanelState = { ...next, protocol: PROTOCOL_VERSION };
      vscode.setState(cached);
    };

    window.addEventListener('message', handler);
    vscode.postMessage({ function: CMD_READY, args: {} });
    return () => window.removeEventListener('message', handler);
  }, []);

  return state;
};
