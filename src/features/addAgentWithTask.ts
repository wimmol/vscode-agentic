import * as vscode from 'vscode';
import * as path from 'path';
import type { StateStorage } from '../db';
import type { FileExplorerProvider } from '../services/FileExplorerProvider';
import type { TerminalService } from '../services/TerminalService';
import type { FileItemLike } from './explorerFileOps';
import { addAgent } from './addAgent';
import { CONFIG_SECTION, CONFIG_GENERATE_MD_PROMPT, CONFIG_REFACTOR_PROMPT } from '../constants/views';
import { ERR_FILES_NO_REPO } from '../constants/messages';

// ── Output directory for generated docs ──────────────────────────

const getDocOutputDir = (items: FileItemLike[], repoRoot: string): string => {
  if (items.length === 1 && items[0].isDir) {
    return path.relative(repoRoot, items[0].filePath) || '.';
  }
  const locations = items.map((i) => (i.isDir ? i.filePath : path.dirname(i.filePath)));
  let common = locations[0];
  for (const loc of locations.slice(1)) {
    while (loc !== common && !loc.startsWith(common + path.sep)) {
      common = path.dirname(common);
    }
  }
  return path.relative(repoRoot, common) || '.';
};

// ── Prompt builders ──────────────────────────────────────────────

const buildPrompt = (base: string, custom: string, settingsPrompt: string): string => {
  let prompt = base;
  if (custom) prompt += ` ${custom}`;
  if (settingsPrompt) prompt += ` ${settingsPrompt}`;
  return prompt;
};

const buildDocPrompt = (relPaths: string[], outputRelDir: string, custom: string, settingsPrompt: string): string => {
  const files = relPaths.join(', ');
  const outputPath = outputRelDir === '.' ? 'DOCUMENTATION.md' : `${outputRelDir}/DOCUMENTATION.md`;
  return buildPrompt(
    `Create a comprehensive markdown documentation file at ${outputPath} that describes every file in these paths: ${files}. For each file, explain its purpose, exports, and key patterns.`,
    custom, settingsPrompt,
  );
};

const buildRefactorPrompt = (relPaths: string[], custom: string, settingsPrompt: string): string => {
  const files = relPaths.join(', ');
  return buildPrompt(
    `Refactor the code in these paths: ${files}. For each file, use /simplify to review for reuse, quality, and efficiency, then fix any issues found.`,
    custom, settingsPrompt,
  );
};

// ── Core ─────────────────────────────────────────────────────────

export const addAgentWithTask = async (
  storage: StateStorage,
  explorer: FileExplorerProvider,
  terminalService: TerminalService,
  items: FileItemLike[],
  taskType: 'doc' | 'refactor',
  customInstructions: string,
): Promise<string | undefined> => {
  if (items.length === 0) return;

  // Find which repo contains these paths
  const repos = await storage.getAllRepositories();
  const repo = repos
    .filter((r) => items.every((i) => i.filePath === r.localPath || i.filePath.startsWith(r.localPath + path.sep)))
    .sort((a, b) => b.localPath.length - a.localPath.length)[0];
  if (!repo) {
    vscode.window.showErrorMessage(ERR_FILES_NO_REPO);
    return;
  }

  // Build prompt
  const relPaths = items.map((i) => path.relative(repo.localPath, i.filePath));
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  let prompt: string;
  if (taskType === 'doc') {
    const outputDir = getDocOutputDir(items, repo.localPath);
    prompt = buildDocPrompt(relPaths, outputDir, customInstructions, config.get<string>(CONFIG_GENERATE_MD_PROMPT, ''));
  } else {
    prompt = buildRefactorPrompt(relPaths, customInstructions, config.get<string>(CONFIG_REFACTOR_PROMPT, ''));
  }

  // Use the standard agent creation flow with the prompt
  return addAgent(storage, explorer, terminalService, repo.repositoryId, prompt, taskType);
};
