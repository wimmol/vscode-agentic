import { IconButton } from '../atoms/IconButton';

interface TabHeaderProps {
  onRootClick: () => void;
  onAddRepoClick: () => void;
}

export const TabHeader = ({ onRootClick, onAddRepoClick }: TabHeaderProps) => {
  return (
    <header className="tab-header">
      <span className="tab-header-title">Agentic</span>
      <nav className="tab-header-actions">
        <IconButton icon="root-folder" onClick={onRootClick} title="Navigate to workspace" />
        <IconButton icon="add" onClick={onAddRepoClick} title="Add repo" />
      </nav>
    </header>
  );
};
