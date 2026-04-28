import type { MouseEvent } from 'react';

interface TileActionsProps {
  onSendPrompt: () => void;
  onRename: () => void;
  onRemove: () => void;
  canRemove: boolean;
}

/**
 * Right-side action strip shown on tile hover (and permanently while the
 * tile is the selected one). Every icon is titled for tooltips.
 */
export const TileActions = ({
  onSendPrompt,
  onRename,
  onRemove,
  canRemove,
}: TileActionsProps) => {
  const stop = (fn: () => void) => (e: MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  return (
    <nav className="tile-actions" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="tile-actions__btn"
        onClick={stop(onSendPrompt)}
        title="Send prompt to this agent"
      >
        <i className="codicon codicon-comment-discussion" />
      </button>
      <button
        type="button"
        className="tile-actions__btn"
        onClick={stop(onRename)}
        title="Rename this agent"
      >
        <i className="codicon codicon-pencil" />
      </button>
      <button
        type="button"
        className="tile-actions__btn tile-actions__btn--danger"
        onClick={stop(onRemove)}
        disabled={!canRemove}
        title={canRemove ? 'Remove this agent' : 'Agent is running — cannot remove'}
      >
        <i className="codicon codicon-trash" />
      </button>
    </nav>
  );
};
