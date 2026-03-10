import * as vscode from "vscode";
import type { RepoConfig } from "../models/repo";
import type { GitService } from "../services/git.service";
import type { ReposStore } from "../services/repos-store";
import type { WorkspaceService } from "../services/workspace.service";
import { ensureGitignoreEntry } from "../utils/gitignore";

/**
 * Add repo feature -- command registration, handler, and all business logic.
 *
 * Absorbs: repo.commands.ts addRepo handler + RepoConfigService.addRepo interactive flow
 */

interface RepoPickItem extends vscode.QuickPickItem {
	_path: string;
}

const getDefaultStagingBranch = (): string => {
	return vscode.workspace
		.getConfiguration("vscode-agentic")
		.get<string>("defaultStagingBranch", "staging");
};

const getWorktreeLimit = (): number => {
	return vscode.workspace
		.getConfiguration("vscode-agentic")
		.get<number>("maxWorktreesPerRepo", 5);
};

export const registerAddRepo = (
	context: vscode.ExtensionContext,
	reposStore: ReposStore,
	gitService: GitService,
	workspaceService: WorkspaceService,
): void => {
	const disposable = vscode.commands.registerCommand(
		"vscode-agentic.addRepo",
		async () => {
			console.log("[feature:addRepo]");

			// Step 1: Build picker items from workspace folders
			const items: RepoPickItem[] = [];
			const folders = vscode.workspace.workspaceFolders;
			if (folders) {
				for (const folder of folders) {
					items.push({
						label: folder.name,
						description: folder.uri.fsPath,
						_path: folder.uri.fsPath,
					});
				}
			}
			items.push({ label: "Browse...", description: "Select a folder from disk", _path: "" });

			// Step 2: Show picker for repo selection
			const picked = await vscode.window.showQuickPick(items, {
				placeHolder: "Select a repository to add",
				title: "Add Repository",
			});

			if (!picked) {
				return;
			}

			let repoPath: string;

			if (picked.label === "Browse...") {
				const result = await vscode.window.showOpenDialog({
					canSelectFolders: true,
					canSelectFiles: false,
					canSelectMany: false,
					openLabel: "Select Repository",
				});
				if (!result || result.length === 0) {
					return;
				}
				repoPath = result[0].fsPath;
			} else {
				repoPath = picked._path;
			}

			// Step 3: Validate it's a git repo
			try {
				await gitService.exec(repoPath, ["rev-parse", "--git-dir"]);
			} catch {
				vscode.window.showErrorMessage(`"${repoPath}" is not a git repository.`);
				return;
			}

			// Step 4: Check if already configured
			const existing = reposStore.getForRepo(repoPath);
			if (existing) {
				vscode.window.showInformationMessage(
					`Repository "${repoPath}" is already configured (staging: ${existing.stagingBranch}).`,
				);
				return;
			}

			// Step 5: Prompt for staging branch name (with loop for existing branch)
			const defaultBranch = getDefaultStagingBranch();
			let stagingBranch = "";
			let branchConfirmed = false;

			while (!branchConfirmed) {
				const input = await vscode.window.showInputBox({
					prompt: "Enter staging branch name",
					value: defaultBranch,
					placeHolder: "Enter staging branch name",
				});

				if (input === undefined) {
					return; // User cancelled
				}
				stagingBranch = input;

				// Check if branch already exists
				const exists = await gitService.branchExists(repoPath, stagingBranch);

				if (exists) {
					const choice = await vscode.window.showQuickPick(
						[
							{ label: `Use existing branch '${stagingBranch}'` },
							{ label: "Pick a different name" },
						],
						{
							placeHolder: `Branch '${stagingBranch}' already exists in this repository`,
							title: "Branch exists",
						},
					);

					if (!choice) {
						return; // User cancelled
					}

					if (choice.label.startsWith("Use existing")) {
						branchConfirmed = true;
					}
					// Otherwise loop back to InputBox
				} else {
					branchConfirmed = true;
				}
			}

			// Step 6: Create and save config
			const config: RepoConfig = {
				path: repoPath,
				stagingBranch,
				worktreeLimit: getWorktreeLimit(),
			};

			const configs = reposStore.getAll();
			configs.push(config);
			await reposStore.save(configs);

			// Step 7: Ensure worktree dir is in .gitignore
			await ensureGitignoreEntry(repoPath);

			// Step 8: Sync workspace file
			await workspaceService.syncWorkspaceFile();

			// Step 9: Notify user
			console.log("[feature:addRepo] repo added", { repoPath, stagingBranch });
			vscode.window.showInformationMessage(
				`Repository added: ${repoPath} (staging: ${stagingBranch})`,
			);
		},
	);

	context.subscriptions.push(disposable);
};
