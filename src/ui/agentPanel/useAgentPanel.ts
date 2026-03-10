import { useState, useEffect } from 'react';
import type { RepoWithAgents } from '../../types';
import type { ExtensionToWebviewMessage } from '../../types/messages';

export const useAgentPanel = (): RepoWithAgents[] => {
  const [repos, setRepos] = useState<RepoWithAgents[]>([]);

  useEffect(() => {
    const handler = (event: MessageEvent<ExtensionToWebviewMessage>) => {
      const message = event.data;
      if (message.type === 'update') {
        setRepos(message.repos);
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  return repos;
};
