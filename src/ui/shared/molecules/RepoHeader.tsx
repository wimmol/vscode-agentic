import { IconButton } from '../atoms/IconButton';
import { LABEL_NAVIGATE_REPO, LABEL_REMOVE_REPO } from '../../../constants/messages';

interface RepoHeaderProps {
  name: string;
  expanded: boolean;
  onRootClick: () => void;
  onRemoveClick: () => void;
  onToggleClick: () => void;
}

/**
 * Repo row: caret + name + navigate + remove. Agent creation is no longer
 * here — it's driven from the LaunchRow's template chips.
 */
export const RepoHeader = ({
  name,
  expanded,
  onRootClick,
  onRemoveClick,
  onToggleClick,
}: RepoHeaderProps) => (
  <header
    className="repo-head"
    onClick={onToggleClick}
    aria-expanded={expanded}
  >
    <span className="repo-head__caret" aria-hidden>
      <i className={`codicon codicon-${expanded ? 'chevron-down' : 'chevron-right'}`} />
    </span>
    <span className="repo-head__name">{name}</span>
    <IconButton
      icon="folder-opened"
      onClick={onRootClick}
      title={LABEL_NAVIGATE_REPO}
      size="sm"
    />
    <IconButton
      icon="close"
      onClick={onRemoveClick}
      title={LABEL_REMOVE_REPO}
      size="sm"
    />
  </header>
);
