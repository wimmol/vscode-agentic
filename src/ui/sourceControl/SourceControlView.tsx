import type { FileChange } from '../../types/sourceControl';

interface Props {
  changes: FileChange[];
  repoName: string;
  isLoading: boolean;
  commitMessage: string;
  onCommitMessageChange: (msg: string) => void;
  onCommit: () => void;
  onPush: () => void;
  onPull: () => void;
  onSuggest: () => void;
  onOpenDiff: (absPath: string) => void;
}

/** Classify a porcelain XY pair into a single logical state. */
const classify = (status: string): { label: string; cls: string } => {
  if (status === '??') return { label: 'U', cls: 'sc-status-untracked' };
  // Porcelain pairs: X = staged, Y = unstaged. Fall back to whichever is set.
  const x = status.charAt(0);
  const y = status.charAt(1);
  const primary = x !== ' ' && x !== '' ? x : y;
  switch (primary) {
    case 'M':
      return { label: 'M', cls: 'sc-status-modified' };
    case 'A':
      return { label: 'A', cls: 'sc-status-added' };
    case 'D':
      return { label: 'D', cls: 'sc-status-deleted' };
    case 'R':
      return { label: 'R', cls: 'sc-status-renamed' };
    case 'C':
      return { label: 'C', cls: 'sc-status-copied' };
    case 'U':
      return { label: '!', cls: 'sc-status-conflict' };
    default:
      return { label: status.trim() || primary || '?', cls: 'sc-status-modified' };
  }
};

const statusLabel = (status: string): string => classify(status).label;
const statusClass = (status: string): string => classify(status).cls;

export const SourceControlView = ({
  changes,
  repoName,
  isLoading,
  commitMessage,
  onCommitMessageChange,
  onCommit,
  onPush,
  onPull,
  onSuggest,
  onOpenDiff,
}: Props) => (
  <div className="sc-container">
    <div className="sc-input-row">
      <input
        className="sc-commit-input"
        type="text"
        placeholder="Commit message..."
        value={commitMessage}
        onChange={(e) => onCommitMessageChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onCommit();
          }
        }}
        disabled={isLoading}
      />
    </div>
    <div className="sc-button-row">
      <button
        className="sc-btn sc-btn-suggest"
        onClick={onSuggest}
        disabled={isLoading || changes.length === 0}
        title="Suggest commit message"
      >
        <i className="codicon codicon-sparkle" />
      </button>
      <button
        className="sc-btn sc-btn-primary"
        onClick={onCommit}
        disabled={isLoading || !commitMessage.trim()}
        title="Commit all changes"
      >
        <i className="codicon codicon-check" /> Commit
      </button>
      <button
        className="sc-btn"
        onClick={onPush}
        disabled={isLoading}
        title="Push to remote"
      >
        <i className="codicon codicon-cloud-upload" />
      </button>
      <button
        className="sc-btn"
        onClick={onPull}
        disabled={isLoading}
        title="Pull from remote"
      >
        <i className="codicon codicon-cloud-download" />
      </button>
    </div>

    {changes.length > 0 && (
      <div className="sc-changes">
        <div className="sc-changes-header">
          Changes ({changes.length})
        </div>
        <ul className="sc-file-list">
          {changes.map((change) => (
            <li key={change.path} className="sc-file-item">
              <button
                className="sc-file-button"
                onClick={() => onOpenDiff(change.path)}
                title={`Open diff: ${change.path}`}
              >
                <span className={`sc-file-status ${statusClass(change.status)}`}>
                  {statusLabel(change.status)}
                </span>
                <span className="sc-file-path">{change.path}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    )}

    {!repoName && (
      <div className="sc-empty">Select a repo or agent to see changes</div>
    )}
  </div>
);
