import * as vscode from 'vscode';
import type { StateStorage } from '../db';
import type { FileExplorerProvider } from '../services/FileExplorerProvider';
import type { TerminalService } from '../services/TerminalService';
import { INVALID_BRANCH_RE } from '../constants/git';
import { AGENT_CLI_CLAUDE_CODE } from '../constants/agent';
import {
  ERR_REPO_NOT_FOUND,
  ERR_WORKTREE_NOT_FOUND,
  ERR_BRANCH_EMPTY,
  ERR_BRANCH_INVALID,
  INPUT_ADD_AGENT_TITLE,
  INPUT_ADD_AGENT_PLACEHOLDER,
  PICK_ADD_AGENT_TITLE,
  PICK_ADD_AGENT_PLACEHOLDER,
  PICK_DEVELOP_DESCRIPTION,
  PICK_WORKTREE_DESCRIPTION,
  PICK_NEW_BRANCH_LABEL,
  PICK_NEW_BRANCH_DESCRIPTION,
  PICK_SEPARATOR_WORKTREES,
  PICK_NEW_BRANCH_VALUE,
} from '../constants/messages';
import { worktreePath, ensureBranch, createWorktree, removeWorktree } from '../services/GitService';
import { generateAgentName } from '../utils/nameGenerator';

const validateBranchName = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (!trimmed) {
    return ERR_BRANCH_EMPTY;
  }
  if (INVALID_BRANCH_RE.test(trimmed)) {
    return ERR_BRANCH_INVALID;
  }
  return undefined;
};

interface BranchPickItem extends vscode.QuickPickItem {
  branch: string;
}

export const addAgent = async (
  storage: StateStorage,
  explorer: FileExplorerProvider,
  terminalService: TerminalService,
  repoId: string,
): Promise<string | undefined> => {
  const repo = await storage.getRepository(repoId);
  if (!repo) {
    vscode.window.showErrorMessage(ERR_REPO_NOT_FOUND);
    return;
  }

  // Build quick pick items
  const items: BranchPickItem[] = [];

  // Develop branch — always first
  items.push({
    label: repo.developBranch,
    description: PICK_DEVELOP_DESCRIPTION,
    branch: repo.developBranch,
  });

  // Existing worktree branches
  const worktrees = (await storage.getAllWorktrees()).filter((w) => w.repoId === repoId);
  if (worktrees.length > 0) {
    items.push({
      label: PICK_SEPARATOR_WORKTREES,
      kind: vscode.QuickPickItemKind.Separator,
      branch: '',
    });
    for (const wt of worktrees) {
      items.push({
        label: wt.branch,
        description: PICK_WORKTREE_DESCRIPTION,
        branch: wt.branch,
      });
    }
  }

  // "New branch…" option
  items.push({
    label: '',
    kind: vscode.QuickPickItemKind.Separator,
    branch: '',
  });
  items.push({
    label: PICK_NEW_BRANCH_LABEL,
    description: PICK_NEW_BRANCH_DESCRIPTION,
    branch: PICK_NEW_BRANCH_VALUE,
  });

  const picked = await vscode.window.showQuickPick(items, {
    title: PICK_ADD_AGENT_TITLE,
    placeHolder: PICK_ADD_AGENT_PLACEHOLDER,
  });

  if (!picked) {
    return;
  }

  let branch: string;
  let cwd: string;
  const isDevelop = picked.branch === repo.developBranch;

  if (picked.branch === PICK_NEW_BRANCH_VALUE) {
    // Prompt for new branch name
    const input = await vscode.window.showInputBox({
      title: INPUT_ADD_AGENT_TITLE,
      placeHolder: INPUT_ADD_AGENT_PLACEHOLDER,
      validateInput: validateBranchName,
      ignoreFocusOut: true,
    });
    if (!input) {
      return;
    }
    branch = input.trim();

    // Create git branch + worktree
    const repoPath = repo.localPath;
    const wtPath = worktreePath(repoPath, branch);
    await ensureBranch(repoPath, branch);
    await createWorktree(repoPath, wtPath, branch);
    await storage.addWorktree(repoId, branch, wtPath);
    cwd = wtPath;
  } else if (isDevelop) {
    branch = repo.developBranch;
    cwd = repo.localPath;
  } else {
    // Existing worktree branch
    branch = picked.branch;
    const wt = await storage.getWorktreeByBranch(repoId, branch);
    if (!wt) {
      vscode.window.showErrorMessage(ERR_WORKTREE_NOT_FOUND);
      return;
    }
    cwd = wt.path;
  }

  // Generate a unique funny name
  const existingAgents = await storage.getAgentsByRepo(repoId);
  const existingNames = existingAgents.map((a) => a.name);
  const agentName = generateAgentName(existingNames);

  let agent;
  try {
    agent = await storage.addAgent(repoId, agentName, branch, AGENT_CLI_CLAUDE_CODE);
  } catch (err) {
    // Rollback worktree if we just created it
    if (picked.branch === PICK_NEW_BRANCH_VALUE) {
      await removeWorktree(repo.localPath, cwd);
      await storage.removeWorktreeByBranch(repoId, branch);
    }
    throw err;
  }

  explorer.showRepo(agent.agentId, cwd, repo.name, branch, !isDevelop);
  terminalService.createTerminal(agent.agentId, agentName, branch, repo.name, cwd);
  await storage.focusAgent(agent.agentId);
  return agent.agentId;
};
