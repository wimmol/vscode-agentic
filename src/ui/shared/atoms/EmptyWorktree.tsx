interface EmptyWorktreeProps {
  onClick: () => void;
}

/** Dashed inline button shown when a repo has no worktrees. */
export const EmptyWorktree = ({ onClick }: EmptyWorktreeProps) => (
  <button
    type="button"
    className="empty-wt"
    onClick={onClick}
    title="Create first worktree"
  >
    <i className="codicon codicon-add" />
    Worktree
  </button>
);
