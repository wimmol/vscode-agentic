import { IconButton } from '../atoms/IconButton';
import { LABEL_NAVIGATE_WORKSPACE, LABEL_ADD_REPO } from '../../../constants/messages';

interface TabHeaderProps {
  onRootClick: () => void;
  onAddRepoClick: () => void;
}

/** Top bar of the Agentic panel: brand glyph + label, then repo/tool actions. */
export const TabHeader = ({ onRootClick, onAddRepoClick }: TabHeaderProps) => (
  <nav className="tabbar">
    <div className="tabbar__brand">
      <span className="tabbar__glyph" aria-hidden />
      <span className="tabbar__label">Agentic</span>
    </div>
    <IconButton icon="root-folder" onClick={onRootClick} title={LABEL_NAVIGATE_WORKSPACE} />
    <IconButton icon="add" onClick={onAddRepoClick} title={LABEL_ADD_REPO} />
  </nav>
);
