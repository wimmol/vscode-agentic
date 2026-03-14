import { IconButton } from '../atoms/IconButton';
import { LABEL_COLLAPSE, LABEL_EXPAND, LABEL_CLOSE_WORKTREE } from '../../../constants/messages';

interface ZoneHeaderProps {
  branch: string;
  isDevelop: boolean;
  expanded: boolean;
  hasAgents: boolean;
  onToggleClick: () => void;
  onCloseClick?: () => void;
}

export const ZoneHeader = ({
  branch,
  isDevelop,
  expanded,
  hasAgents,
  onToggleClick,
  onCloseClick,
}: ZoneHeaderProps) => {
  const icon = isDevelop ? 'git-branch' : 'repo-forked';

  return (
    <header className={`zone-header${isDevelop ? ' zone-header--develop' : ''}`}>
      {hasAgents ? (
        <IconButton
          icon={expanded ? 'chevron-down' : 'chevron-right'}
          onClick={onToggleClick}
          title={expanded ? LABEL_COLLAPSE : LABEL_EXPAND}
        />
      ) : (
        <span className="zone-header-spacer" />
      )}
      <i className={`codicon codicon-${icon} zone-header-icon`} />
      <span className="zone-header-name">{branch}</span>
      {onCloseClick && (
        <span className="zone-header-actions">
          <IconButton icon="close" onClick={onCloseClick} title={LABEL_CLOSE_WORKTREE} />
        </span>
      )}
    </header>
  );
};
