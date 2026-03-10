import { IconButton } from '../atoms/IconButton';

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
        <IconButton icon="root-folder" onClick={onRootClick} title="Navigate to repo" />
        <IconButton icon="add" onClick={onAddAgentClick} title="Add agent" />
        <IconButton icon="close" onClick={onRemoveClick} title="Remove repo" />
        <IconButton
          icon={expanded ? 'chevron-down' : 'chevron-right'}
          onClick={onToggleClick}
          title={expanded ? 'Collapse' : 'Expand'}
        />
      </nav>
    </header>
  );
};
