import { useMemo, useState } from 'react';
import type { FileChange } from '../../types/sourceControl';

interface Props {
  changes: FileChange[];
  repoName: string;
  isLoading: boolean;
  commitMessage: string;
  branch: string | null;
  isWorktree: boolean;
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

const dirOf = (p: string): string => {
  const i = p.lastIndexOf('/');
  return i < 0 ? '' : p.substring(0, i);
};

const basenameOf = (p: string): string => {
  const i = p.lastIndexOf('/');
  return i < 0 ? p : p.substring(i + 1);
};

const FOLDER_THRESHOLD = 5;

type RenderItem =
  | { kind: 'file'; change: FileChange }
  | { kind: 'folder'; dir: string; files: FileChange[] };

/** Collapse directories with ≥5 changed files into expandable folder rows. */
const buildItems = (changes: FileChange[]): RenderItem[] => {
  const counts = new Map<string, number>();
  for (const c of changes) {
    const d = dirOf(c.path);
    if (d === '') continue;
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }

  const items: RenderItem[] = [];
  const seenFolder = new Set<string>();
  for (const change of changes) {
    const d = dirOf(change.path);
    const count = d !== '' ? counts.get(d) ?? 0 : 0;
    if (count >= FOLDER_THRESHOLD) {
      if (!seenFolder.has(d)) {
        seenFolder.add(d);
        const files = changes.filter((c) => dirOf(c.path) === d);
        items.push({ kind: 'folder', dir: d, files });
      }
    } else {
      items.push({ kind: 'file', change });
    }
  }
  return items;
};

const FileRow = ({
  change,
  indent,
  onOpenDiff,
}: {
  change: FileChange;
  indent: boolean;
  onOpenDiff: (absPath: string) => void;
}) => (
  <li className={`sc-file-item${indent ? ' sc-file-item--indent' : ''}`}>
    <button
      className="sc-file-button"
      onClick={() => onOpenDiff(change.path)}
      title={`Open diff: ${change.path}`}
    >
      <span className={`sc-file-status ${statusClass(change.status)}`}>
        {statusLabel(change.status)}
      </span>
      <span className="sc-file-path">{indent ? basenameOf(change.path) : change.path}</span>
    </button>
  </li>
);

export const SourceControlView = ({
  changes,
  repoName,
  isLoading,
  commitMessage,
  branch,
  isWorktree,
  onCommitMessageChange,
  onCommit,
  onPush,
  onPull,
  onSuggest,
  onOpenDiff,
}: Props) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const items = useMemo(() => buildItems(changes), [changes]);

  const toggleFolder = (dir: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(dir)) next.delete(dir);
      else next.add(dir);
      return next;
    });
  };

  return (
    <div className="sc-container">
      {repoName && (
        <div className="sc-branch-row" title={isWorktree ? 'Linked worktree' : 'Main worktree'}>
          <i className={`codicon codicon-${isWorktree ? 'repo-forked' : 'git-branch'}`} />
          <span className="sc-branch-name">{branch ?? '(detached)'}</span>
          {isWorktree && <span className="sc-worktree-badge">worktree</span>}
          <span className="sc-repo-name">{repoName}</span>
        </div>
      )}
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
            {items.map((item) => {
              if (item.kind === 'file') {
                return (
                  <FileRow
                    key={item.change.path}
                    change={item.change}
                    indent={false}
                    onOpenDiff={onOpenDiff}
                  />
                );
              }
              const isOpen = expanded.has(item.dir);
              return (
                <li key={`dir:${item.dir}`} className="sc-folder-group">
                  <button
                    className="sc-file-button sc-folder-button"
                    onClick={() => toggleFolder(item.dir)}
                    title={`${item.files.length} files in ${item.dir}`}
                    aria-expanded={isOpen}
                  >
                    <i className={`codicon codicon-chevron-${isOpen ? 'down' : 'right'}`} />
                    <i className="codicon codicon-folder sc-folder-icon" />
                    <span className="sc-file-path">{item.dir}</span>
                    <span className="sc-folder-count">{item.files.length}</span>
                  </button>
                  {isOpen && (
                    <ul className="sc-file-list sc-file-list--nested">
                      {item.files.map((f) => (
                        <FileRow
                          key={f.path}
                          change={f}
                          indent
                          onOpenDiff={onOpenDiff}
                        />
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {!repoName && (
        <div className="sc-empty">Select a repo or agent to see changes</div>
      )}
    </div>
  );
};
