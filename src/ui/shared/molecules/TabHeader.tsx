import { IconButton } from '../atoms/IconButton';
import { LABEL_NAVIGATE_WORKSPACE, LABEL_ADD_REPO } from '../../../constants/messages';

interface TabHeaderProps {
  onRootClick: () => void;
  onAddRepoClick: () => void;
}

export const TabHeader = ({ onRootClick, onAddRepoClick }: TabHeaderProps) => {
  return (
    <nav className="tab-header">
      <IconButton icon="root-folder" onClick={onRootClick} title={LABEL_NAVIGATE_WORKSPACE} />
      <IconButton icon="add" onClick={onAddRepoClick} title={LABEL_ADD_REPO} />
    </nav>
  );
};
