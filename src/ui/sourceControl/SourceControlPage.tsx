import { useSourceControl } from './useSourceControl';
import { SourceControlView } from './SourceControlView';

export const SourceControlPage = () => {
  const {
    changes,
    repoName,
    isLoading,
    commitMessage,
    branch,
    isWorktree,
    setCommitMessage,
    commit,
    push,
    pull,
    suggest,
    openDiff,
  } = useSourceControl();

  return (
    <SourceControlView
      changes={changes}
      repoName={repoName}
      isLoading={isLoading}
      commitMessage={commitMessage}
      branch={branch}
      isWorktree={isWorktree}
      onCommitMessageChange={setCommitMessage}
      onCommit={commit}
      onPush={push}
      onPull={pull}
      onSuggest={suggest}
      onOpenDiff={openDiff}
    />
  );
};
