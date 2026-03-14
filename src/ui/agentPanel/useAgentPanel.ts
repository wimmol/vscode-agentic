import { useState, useEffect } from 'react';
import { vscode } from '../index';
import type { RepoWithZones } from '../../types';
import type { ExtensionToWebviewMessage } from '../../types/messages';
import { MSG_TYPE_UPDATE, CMD_READY } from '../../constants/commands';

const getCachedRepos = (): RepoWithZones[] => {
  const state = vscode.getState();
  return state?.repos ?? [];
};

export const useAgentPanel = (): RepoWithZones[] => {
  const [repos, setRepos] = useState<RepoWithZones[]>(getCachedRepos);

  useEffect(() => {
    const handler = (event: MessageEvent<ExtensionToWebviewMessage>) => {
      const message = event.data;
      console.log('[useAgentPanel] received message:', message);
      if (message.type === MSG_TYPE_UPDATE) {
        console.log('[useAgentPanel] setting repos:', message.repos);
        setRepos(message.repos);
        vscode.setState({ repos: message.repos });
      }
    };

    window.addEventListener('message', handler);
    vscode.postMessage({ function: CMD_READY, args: {} });
    return () => window.removeEventListener('message', handler);
  }, []);

  return repos;
};
