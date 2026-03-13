import { IconButton } from '../atoms/IconButton';

interface TabHeaderProps {
  onRootClick: () => void;
  onAddRepoClick: () => void;
}

export const TabHeader = ({ onRootClick, onAddRepoClick }: TabHeaderProps) => {
  return (
    <nav className="tab-header">
      <IconButton icon="root-folder" onClick={onRootClick} title="Navigate to workspace" />
      <IconButton icon="add" onClick={onAddRepoClick} title="Add repo" />
    </nav>
  );
};
