export interface WorktreeTab {
  branch: string;
  agentCount: number;
}

interface WorktreeTabsProps {
  tabs: WorktreeTab[];
  selectedBranch: string | null;
  onSelect: (branch: string) => void;
  onNew: () => void;
  onMerge: (branch: string) => void;
  onDelete: (branch: string) => void;
}

/**
 * File-tab style worktree switcher. Active tab seals into the content below.
 * A short action bar underneath scopes merge / delete to the active tab.
 */
export const WorktreeTabs = ({
  tabs,
  selectedBranch,
  onSelect,
  onNew,
  onMerge,
  onDelete,
}: WorktreeTabsProps) => {
  const active = selectedBranch ?? tabs[0]?.branch ?? null;

  return (
    <>
      <div className="wt-tabs" role="tablist">
        {tabs.map((t) => {
          const isActive = t.branch === active;
          const className = isActive ? 'wt-tab wt-tab--active' : 'wt-tab';
          return (
            <div
              key={t.branch}
              className={className}
              role="tab"
              aria-selected={isActive}
              tabIndex={0}
              onClick={() => onSelect(t.branch)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(t.branch);
                }
              }}
            >
              <i className="codicon codicon-git-branch" />
              <span>{t.branch}</span>
              <span className="wt-tab__count">{t.agentCount}</span>
            </div>
          );
        })}
        <button
          type="button"
          className="wt-tab--new"
          onClick={onNew}
          title="New worktree"
        >
          <i className="codicon codicon-add" />
        </button>
      </div>

      {active !== null && (
        <div className="wt-actions">
          <span className="wt-actions__label">{active}</span>
          <button
            type="button"
            className="wt-actions__btn wt-actions__btn--merge"
            onClick={() => onMerge(active)}
            title={`Merge ${active} into the current branch`}
          >
            <i className="codicon codicon-git-merge" />
            Merge
          </button>
          <button
            type="button"
            className="wt-actions__btn wt-actions__btn--del"
            onClick={() => onDelete(active)}
            title="Delete this worktree"
          >
            <i className="codicon codicon-trash" />
            Delete
          </button>
        </div>
      )}
    </>
  );
};
