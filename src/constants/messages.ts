// ── Error messages ────────────────────────────────────────────────
export const ERR_NO_WORKSPACE = 'Agentic: Open a folder or workspace to use this extension.';
export const ERR_NO_WORKSPACE_STORAGE = 'No workspace storage available.';
export const ERR_NOT_GIT_REPO = 'Selected folder is not a git repository (no .git found).';
export const ERR_REPO_ALREADY_ADDED = 'Repository is already added.';
export const ERR_REPO_NOT_FOUND = 'Repository not found.';
export const ERR_NO_REPOS = 'No repositories added.';
export const ERR_AGENT_CONTEXT_NOT_FOUND = 'Agent, repository, or worktree not found.';
export const ERR_AGENT_NOT_FOUND = 'Agent not found';
export const ERR_REPO_NAME_EMPTY = 'Repository name cannot be empty';
export const ERR_REPO_PATH_EMPTY = 'Repository path cannot be empty';
export const ERR_DEVELOP_BRANCH_EMPTY = 'Develop branch cannot be empty';
export const ERR_AGENT_NAME_EMPTY = 'Agent name cannot be empty';
export const ERR_BRANCH_EMPTY = 'Branch name cannot be empty';
export const ERR_BRANCH_INVALID = 'Invalid branch name (contains forbidden characters)';
export const errRepoIdNotFound = (id: string) => `Repository ${id} not found`;
export const errAgentIdNotFound = (id: string) => `Agent ${id} not found`;

// ── Dialog / warning messages ────────────────────────────────────
export const dialogRemoveRepo = (name: string) =>
  `Remove repository "${name}"? This will also delete all its agents and worktrees.`;
export const dialogRemoveAgent = (name: string) => `Remove agent "${name}"?`;
export const DIALOG_UNCOMMITTED_REMOVE = ' The worktree has uncommitted changes that will be lost if deleted.';
export const dialogTerminalClosed = (name: string) =>
  `Closing the terminal kills the running agent "${name}".`;
export const DIALOG_UNCOMMITTED_TERMINAL = ' The worktree has uncommitted changes.';

// ── Button labels ────────────────────────────────────────────────
export const BTN_DELETE_WORKTREE = 'Delete Worktree';
export const BTN_KEEP_WORKTREE = 'Keep Worktree';
export const BTN_REMOVE_DELETE_WORKTREE = 'Remove & Delete Worktree';
export const BTN_REMOVE_KEEP_WORKTREE = 'Remove & Keep Worktree';
export const BTN_REOPEN_TERMINAL = 'Reopen Terminal';
export const BTN_REMOVE = 'Remove';
export const BTN_REMOVE_WITH_WORKSPACE = 'Remove & Workspace';

// ── Input box / quick pick ───────────────────────────────────────
export const INPUT_ADD_AGENT_TITLE = 'Add Agent';
export const INPUT_ADD_AGENT_PLACEHOLDER = 'Branch name for the agent';
export const INPUT_ADD_REPO_LABEL = 'Add Repository';
export const INPUT_REPO_PICKER_PLACEHOLDER = 'Select a workspace repository or browse…';
export const INPUT_REPO_PICKER_EMPTY = 'No workspace repositories found — browse to add one';

// ── UI labels ────────────────────────────────────────────────────
export const LABEL_REMOVE_AGENT = 'Remove agent';
export const LABEL_NAVIGATE_REPO = 'Navigate to repo';
export const LABEL_ADD_AGENT = 'Add agent';
export const LABEL_REMOVE_REPO = 'Remove repo';
export const LABEL_WORKSPACE = 'WORKSPACE';
export const LABEL_OPEN_FILE = 'Open File';
export const LABEL_AGENT_PREFIX = '› ';
export const LABEL_COLLAPSE = 'Collapse';
export const LABEL_EXPAND = 'Expand';
export const LABEL_NAVIGATE_WORKSPACE = 'Navigate to workspace';
export const LABEL_ADD_REPO = 'Add repo';
export const LABEL_EMPTY_AGENTS = 'press + to add agent';
export const LABEL_EMPTY_REPOS = 'press + to add repo';
