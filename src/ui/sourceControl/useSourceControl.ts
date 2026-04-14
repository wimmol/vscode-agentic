import { useState, useEffect, useCallback } from 'react';
import { vscode } from './index';
import type { FileChange, ScExtensionToWebviewMessage } from '../../types/sourceControl';
import {
  SC_CMD_COMMIT,
  SC_CMD_PUSH,
  SC_CMD_PULL,
  SC_CMD_SUGGEST,
  SC_CMD_OPEN_DIFF,
  SC_CMD_READY,
  SC_MSG_UPDATE,
  SC_MSG_SUGGEST_RESULT,
} from '../../constants/sourceControl';

interface SourceControlState {
  changes: FileChange[];
  repoName: string;
  isLoading: boolean;
  commitMessage: string;
}

export const useSourceControl = () => {
  const [state, setState] = useState<SourceControlState>({
    changes: [],
    repoName: '',
    isLoading: false,
    commitMessage: '',
  });

  useEffect(() => {
    const handler = (event: MessageEvent<ScExtensionToWebviewMessage>) => {
      const message = event.data;
      if (message.type === SC_MSG_UPDATE) {
        setState((prev) => ({
          ...prev,
          changes: message.changes,
          repoName: message.repoName,
          isLoading: message.isLoading,
        }));
      } else if (message.type === SC_MSG_SUGGEST_RESULT) {
        setState((prev) => ({
          ...prev,
          commitMessage: message.message,
        }));
      }
    };

    window.addEventListener('message', handler);
    vscode.postMessage({ function: SC_CMD_READY, args: {} });

    return () => window.removeEventListener('message', handler);
  }, []);

  const setCommitMessage = useCallback((msg: string) => {
    setState((prev) => ({ ...prev, commitMessage: msg }));
  }, []);

  const commit = useCallback(() => {
    if (!state.commitMessage.trim()) return;
    vscode.postMessage({ function: SC_CMD_COMMIT, args: { message: state.commitMessage } });
    setState((prev) => ({ ...prev, commitMessage: '' }));
  }, [state.commitMessage]);

  const push = useCallback(() => {
    vscode.postMessage({ function: SC_CMD_PUSH, args: {} });
  }, []);

  const pull = useCallback(() => {
    vscode.postMessage({ function: SC_CMD_PULL, args: {} });
  }, []);

  const suggest = useCallback(() => {
    vscode.postMessage({ function: SC_CMD_SUGGEST, args: {} });
  }, []);

  const openDiff = useCallback((relPath: string) => {
    vscode.postMessage({ function: SC_CMD_OPEN_DIFF, args: { path: relPath } });
  }, []);

  return {
    ...state,
    setCommitMessage,
    commit,
    push,
    pull,
    suggest,
    openDiff,
  };
};
