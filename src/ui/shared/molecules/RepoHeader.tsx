import { IconButton } from '../atoms/IconButton';
import {
  LABEL_NAVIGATE_REPO,
  LABEL_ADD_AGENT,
  LABEL_REMOVE_REPO,
  LABEL_COLLAPSE,
  LABEL_EXPAND,
} from '../../../constants/messages';

interface RepoHeaderProps {
  name: string;
  expanded: boolean;
  onRootClick: () => void;
  onAddAgentClick: () => void;
  onRemoveClick: () => void;
  onToggleClick: () => void;
}

export const RepoHeader = ({
  name,
  expanded,
  onRootClick,
  onAddAgentClick,
  onRemoveClick,
  onToggleClick,
}: RepoHeaderProps) => {
  return (
    <header className="repo-header">
      <span className="repo-header-name">{name}</span>
      <nav className="repo-header-actions">
        <IconButton icon="root-folder" onClick={onRootClick} title={LABEL_NAVIGATE_REPO} />
        <IconButton icon="add" onClick={onAddAgentClick} title={LABEL_ADD_AGENT} />
        <IconButton icon="close" onClick={onRemoveClick} title={LABEL_REMOVE_REPO} />
        <IconButton
          icon={expanded ? 'chevron-down' : 'chevron-right'}
          onClick={onToggleClick}
          title={expanded ? LABEL_COLLAPSE : LABEL_EXPAND}
        />
      </nav>
    </header>
  );
};
