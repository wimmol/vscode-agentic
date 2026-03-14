import { IconButton } from '../atoms/IconButton';
import { LABEL_COLLAPSE, LABEL_EXPAND } from '../../../constants/messages';

interface ZoneHeaderProps {
  branch: string;
  isDevelop: boolean;
  expanded: boolean;
  onToggleClick: () => void;
}

export const ZoneHeader = ({
  branch,
  isDevelop,
  expanded,
  onToggleClick,
}: ZoneHeaderProps) => {
  const icon = isDevelop ? 'git-branch' : 'repo-forked';

  return (
    <header className={`zone-header${isDevelop ? ' zone-header--develop' : ''}`}>
      <IconButton
        icon={expanded ? 'chevron-down' : 'chevron-right'}
        onClick={onToggleClick}
        title={expanded ? LABEL_COLLAPSE : LABEL_EXPAND}
      />
      <i className={`codicon codicon-${icon} zone-header-icon`} />
      <span className="zone-header-name">{branch}</span>
    </header>
  );
};
