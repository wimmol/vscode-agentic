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
  PICK_CURRENT_DESCRIPTION,
  PICK_WORKTREE_DESCRIPTION,
  PICK_NEW_BRANCH_LABEL,
  PICK_NEW_BRANCH_DESCRIPTION,
  PICK_SEPARATOR_WORKTREES,
  PICK_NEW_BRANCH_VALUE,
  PICK_TEMPLATE_TITLE,
  PICK_TEMPLATE_PLACEHOLDER,
  PICK_TEMPLATE_BLANK_LABEL,
  PICK_TEMPLATE_BLANK_DESCRIPTION,
} from '../constants/messages';
import { worktreePath, ensureBranch, createWorktree, removeWorktree } from '../services/GitService';
import { generateAgentName } from '../utils/nameGenerator';

const nextBranchName = (prefix: string, existingBranches: Set<string>): string => {
  let n = 1;
  while (existingBranches.has(`${prefix}-${n}`)) n++;
  return `${prefix}-${n}`;
};

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
  initialPrompt?: string,
  branchHint?: string,
): Promise<string | undefined> => {
  const repo = await storage.getRepository(repoId);
  if (!repo) {
    vscode.window.showErrorMessage(ERR_REPO_NOT_FOUND);
    return;
  }

  // Build quick pick items
  const items: BranchPickItem[] = [];

  // Current branch — always first
  items.push({
    label: repo.currentBranch,
    description: PICK_CURRENT_DESCRIPTION,
    branch: repo.currentBranch,
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
  const isCurrent = picked.branch === repo.currentBranch;

  if (picked.branch === PICK_NEW_BRANCH_VALUE) {
    // Suggest a unique branch name based on context
    const existingBranches = new Set(worktrees.map((w) => w.branch));
    const prefix = branchHint || 'tree';
    const suggested = nextBranchName(prefix, existingBranches);

    const input = await vscode.window.showInputBox({
      title: INPUT_ADD_AGENT_TITLE,
      placeHolder: INPUT_ADD_AGENT_PLACEHOLDER,
      value: suggested,
      valueSelection: [0, suggested.length],
      validateInput: (v) => {
        const trimmed = v.trim();
        if (!trimmed) return `Press Enter to use "${suggested}"`;
        return validateBranchName(v);
      },
      ignoreFocusOut: true,
    });
    if (input === undefined) {
      return;
    }
    branch = input.trim() || suggested;

    // Create git branch + worktree
    const repoPath = repo.localPath;
    const wtPath = worktreePath(repoPath, branch);
    try {
      await ensureBranch(repoPath, branch);
      await createWorktree(repoPath, wtPath, branch);
      await storage.addWorktree(repoId, branch, wtPath);
    } catch (err) {
      // Best-effort cleanup on partial failure
      await removeWorktree(repoPath, wtPath);
      throw err;
    }
    cwd = wtPath;
  } else if (isCurrent) {
    branch = repo.currentBranch;
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

  // Template picker
  let templateName: string | null = null;
  if (!initialPrompt) {
    const templates = storage.getAllTemplates();
    if (templates.length > 0) {
      interface TemplatePickItem extends vscode.QuickPickItem {
        templatePrompt?: string;
        templateName?: string;
      }

      const templateItems: TemplatePickItem[] = [
        { label: PICK_TEMPLATE_BLANK_LABEL, description: PICK_TEMPLATE_BLANK_DESCRIPTION },
        ...templates.map((t) => ({
          label: t.name,
          description: t.prompt.slice(0, 60),
          templatePrompt: t.prompt,
          templateName: t.name,
        })),
      ];

      const templatePick = await vscode.window.showQuickPick(templateItems, {
        title: PICK_TEMPLATE_TITLE,
        placeHolder: PICK_TEMPLATE_PLACEHOLDER,
      });
      if (!templatePick) return;

      if (templatePick.templatePrompt) {
        initialPrompt = templatePick.templatePrompt;
        templateName = templatePick.templateName ?? null;
      }
    }
  }

  // Generate a unique funny name
  const existingAgents = await storage.getAgentsByRepo(repoId);
  const existingNames = existingAgents.map((a) => a.name);
  const agentName = generateAgentName(existingNames);

  let agent;
  try {
    agent = await storage.addAgent(repoId, agentName, branch, AGENT_CLI_CLAUDE_CODE);
    if (templateName) {
      await storage.updateAgent(agent.agentId, { templateName });
    }
  } catch (err) {
    if (picked.branch === PICK_NEW_BRANCH_VALUE) {
      await removeWorktree(repo.localPath, cwd);
      try { await storage.removeWorktreeByBranch(repoId, branch); } catch { /* best-effort */ }
    }
    throw err;
  }

  explorer.showRepo(cwd, repo.name, branch, !isCurrent);
  terminalService.createTerminal(agent.agentId, agentName, branch, repo.name, cwd, undefined, initialPrompt);
  await storage.focusAgent(agent.agentId);
  return agent.agentId;
};
