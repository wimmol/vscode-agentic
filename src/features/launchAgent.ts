import * as vscode from 'vscode';
import type { StateStorage } from '../db';
import type { FileExplorerProvider } from '../services/FileExplorerProvider';
import type { TerminalService } from '../services/TerminalService';
import type { AgentTemplate } from '../types';
import { AGENT_CLI_CLAUDE_CODE } from '../constants/agent';
import {
  ERR_REPO_NOT_FOUND,
  ERR_WORKTREE_NOT_FOUND,
} from '../constants/messages';
import { generateAgentName } from '../utils/nameGenerator';

/**
 * One-click agent launch on a pre-resolved branch — bypasses the branch and
 * template quick-picks that `addAgent` uses. Called from `CMD_LAUNCH_TEMPLATE`.
 * The template's `name`/`color`/`prompt` are snapshotted onto the agent record;
 * the prompt is re-applied via `--append-system-prompt` on every `claude`
 * invocation (launch, reopen, restore).
 */
export const launchAgent = async (
  storage: StateStorage,
  explorer: FileExplorerProvider,
  terminalService: TerminalService,
  repoId: string,
  branch: string,
  templateId: string | null,
): Promise<string | undefined> => {
  const repo = await storage.getRepository(repoId);
  if (!repo) {
    vscode.window.showErrorMessage(ERR_REPO_NOT_FOUND);
    return;
  }

  const isCurrent = branch === repo.currentBranch;
  let cwd: string;
  if (isCurrent) {
    cwd = repo.localPath;
  } else {
    const wt = await storage.getWorktreeByBranch(repoId, branch);
    if (!wt) {
      vscode.window.showErrorMessage(ERR_WORKTREE_NOT_FOUND);
      return;
    }
    cwd = wt.path;
  }

  const template: AgentTemplate | null = templateId
    ? storage.getTemplate(templateId) ?? null
    : null;
  const systemPrompt = template?.prompt ?? null;

  const existingAgents = await storage.getAgentsByRepo(repoId);
  const agentName = generateAgentName(existingAgents.map((a) => a.name));

  const agent = await storage.addAgent(repoId, agentName, branch, AGENT_CLI_CLAUDE_CODE, {
    templateName: template?.name ?? null,
    templateColor: template?.color ?? null,
    systemPrompt,
  });

  explorer.showRepo(cwd, repo.name, branch, !isCurrent);
  terminalService.createTerminal({
    agentId: agent.agentId,
    agentName,
    branch,
    repoName: repo.name,
    cwd,
    systemPrompt,
  });
  await storage.focusAgent(agent.agentId);
  return agent.agentId;
};
