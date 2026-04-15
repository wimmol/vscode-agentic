// ── Error messages ────────────────────────────────────────────────
export const ERR_NO_WORKSPACE = 'Agentic: Open a folder or workspace to use this extension.';
export const ERR_NO_WORKSPACE_STORAGE = 'No workspace storage available.';
export const ERR_NOT_GIT_REPO = 'Selected folder is not a git repository (no .git found).';
export const ERR_REPO_ALREADY_ADDED = 'Repository is already added.';
export const ERR_REPO_NOT_FOUND = 'Repository not found.';
export const ERR_NO_REPOS = 'No repositories added.';
export const ERR_AGENT_CONTEXT_NOT_FOUND = 'Agent or repository not found.';
export const ERR_AGENT_NOT_FOUND = 'Agent not found';
export const ERR_REPO_NAME_EMPTY = 'Repository name cannot be empty';
export const ERR_REPO_PATH_EMPTY = 'Repository path cannot be empty';
export const ERR_CURRENT_BRANCH_EMPTY = 'Current branch cannot be empty';
export const ERR_AGENT_NAME_EMPTY = 'Agent name cannot be empty';
export const ERR_WORKTREE_NOT_FOUND = 'Worktree not found for this branch.';
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
export const dialogCloseWorktree = (branch: string, agentCount: number) =>
  agentCount > 0
    ? `Delete worktree "${branch}"? This will kill ${agentCount} agent${agentCount > 1 ? 's' : ''} and delete the worktree and branch.`
    : `Delete worktree "${branch}"? This will delete the worktree and branch.`;

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
export const LABEL_CLOSE_WORKTREE = 'Close worktree';
export const LABEL_EMPTY_AGENTS = 'press + to add agent';
export const LABEL_EMPTY_REPOS = 'press + to add repo';

// ── Quick pick (add agent) ──────────────────────────────────────
export const PICK_ADD_AGENT_TITLE = 'Add Agent — select branch';
export const PICK_ADD_AGENT_PLACEHOLDER = 'Choose where to run the agent';
export const PICK_CURRENT_DESCRIPTION = 'main checkout';
export const PICK_WORKTREE_DESCRIPTION = 'existing worktree';
export const PICK_NEW_BRANCH_LABEL = '$(add) New branch…';
export const PICK_NEW_BRANCH_DESCRIPTION = 'create worktree';
export const PICK_SEPARATOR_WORKTREES = 'Worktrees';
export const PICK_NEW_BRANCH_VALUE = '__new__';

// ── New feature labels ──────────────────────────────────────────
export const LABEL_SEND_PROMPT = 'Send prompt';
export const LABEL_FORK_AGENT = 'Fork agent';
export const LABEL_RENAME_AGENT = 'Rename agent';
export const LABEL_REMOVE_QUEUE_ITEM = 'Remove queued prompt';
export const LABEL_QUEUED = 'queued';
export const LABEL_FORK = 'FORK';

// ── Template labels ─────────────────────────────────────────────
export const INPUT_TEMPLATE_NAME_PROMPT = 'Template name';
export const INPUT_TEMPLATE_NAME_PLACEHOLDER = 'e.g. Docs Writer, Test Writer';
export const INPUT_TEMPLATE_PROMPT_PROMPT = 'Template prompt';
export const INPUT_TEMPLATE_PROMPT_PLACEHOLDER = 'The prompt that will be sent to the agent';
export const PICK_TEMPLATE_TITLE = 'Select template';
export const PICK_TEMPLATE_PLACEHOLDER = 'Choose a template or start blank';
export const PICK_TEMPLATE_BLANK_LABEL = '$(code) Blank — no template';
export const PICK_TEMPLATE_BLANK_DESCRIPTION = 'enter your own prompt';
export const PICK_REMOVE_TEMPLATE_TITLE = 'Remove template';
export const PICK_REMOVE_TEMPLATE_PLACEHOLDER = 'Select template to remove';

// ── Notification messages ───────────────────────────────────────
export const notifAgentFinished = (name: string, repoName: string, duration: string) =>
  `Agent "${name}" finished on ${repoName} (${duration})`;

// ── Warning messages ───────────────────────────────────────────
export const WARN_TERMINAL_NOT_RUNNING = 'Agent terminal is not running.';

// ── Rename ──────────────────────────────────────────────────────
export const INPUT_RENAME_PROMPT = 'New agent name';
export const INPUT_RENAME_PLACEHOLDER = 'Enter a new name for the agent';

// ── Send prompt ─────────────────────────────────────────────────
export const INPUT_SEND_PROMPT_PROMPT = 'Send prompt to agent';
export const INPUT_SEND_PROMPT_PLACEHOLDER = 'Enter the prompt to send';
