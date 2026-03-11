import { useState, useEffect } from 'react';
import { vscode } from '../index';
import type { RepoWithAgents } from '../../types';
import type { ExtensionToWebviewMessage } from '../../types/messages';

export const useAgentPanel = (): RepoWithAgents[] => {
  const [repos, setRepos] = useState<RepoWithAgents[]>([]);

  useEffect(() => {
    const handler = (event: MessageEvent<ExtensionToWebviewMessage>) => {
      const message = event.data;
      console.log('[useAgentPanel] received message:', message);
      if (message.type === 'update') {
        console.log('[useAgentPanel] setting repos:', message.repos);
        setRepos(message.repos);
      }
    };

    window.addEventListener('message', handler);
    vscode.postMessage({ function: 'ready', args: {} });
    return () => window.removeEventListener('message', handler);
  }, []);

  return repos;
};
