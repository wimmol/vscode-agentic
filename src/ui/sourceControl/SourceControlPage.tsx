import { useSourceControl } from './useSourceControl';
import { SourceControlView } from './SourceControlView';

export const SourceControlPage = () => {
  const {
    changes,
    repoName,
    isLoading,
    commitMessage,
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
      onCommitMessageChange={setCommitMessage}
      onCommit={commit}
      onPush={push}
      onPull={pull}
      onSuggest={suggest}
      onOpenDiff={openDiff}
    />
  );
};
