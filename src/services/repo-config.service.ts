import * as vscode from "vscode";
import type { RepoConfig } from "../models/repo.js";
import { DEFAULT_STAGING_BRANCH, REPO_CONFIGS_KEY } from "../models/repo.js";
import { ensureGitignoreEntry } from "../utils/gitignore.js";
import type { GitService } from "./git.service.js";

interface RepoPickItem extends vscode.QuickPickItem {
	_path?: string;
}

export class RepoConfigService {
	constructor(
		private readonly state: vscode.Memento,
		private readonly git: GitService,
	) {}

	/**
	 * Returns all configured repositories.
	 */
	getAll(): RepoConfig[] {
		return this.state.get<RepoConfig[]>(REPO_CONFIGS_KEY, []);
	}

	/**
	 * Returns config for a specific repo path, or undefined if not found.
	 */
	getForRepo(repoPath: string): RepoConfig | undefined {
		return this.getAll().find((c) => c.path === repoPath);
	}

	/**
	 * Interactive flow to add a new repository:
	 * 1. Pick from workspace folders or browse
	 * 2. Prompt for staging branch name
	 * 3. Handle existing branch (confirm or pick different name)
	 * 4. Save config to workspaceState
	 * 5. Update .gitignore
	 */
	async addRepo(): Promise<RepoConfig | undefined> {
		// 1. Build picker items from workspace folders
		const items: RepoPickItem[] = [];

		if (vscode.workspace.workspaceFolders) {
			for (const folder of vscode.workspace.workspaceFolders) {
				items.push({
					label: folder.name,
					description: folder.uri.fsPath,
					_path: folder.uri.fsPath,
				});
			}
		}

		items.push({
			label: "$(folder) Browse...",
			description: "Select a folder from disk",
		});

		// 2. Show folder picker
		const selected = await vscode.window.showQuickPick(items, {
			placeHolder: "Select a repository to add",
			title: "Add Repository",
		});

		if (!selected) {
			return undefined;
		}

		let repoPath: string | undefined = selected._path;

		// Handle "Browse..." option
		if (!repoPath) {
			const folders = await vscode.window.showOpenDialog({
				canSelectFolders: true,
				canSelectFiles: false,
				canSelectMany: false,
				openLabel: "Select Repository",
			});
			if (!folders || folders.length === 0) {
				return undefined;
			}
			repoPath = folders[0].fsPath;
		}

		// 3. Validate it's a git repo
		try {
			await this.git.exec(repoPath, ["rev-parse", "--git-dir"]);
		} catch {
			vscode.window.showErrorMessage(`"${repoPath}" is not a git repository.`);
			return undefined;
		}

		// 4. Check if already configured
		const existing = this.getForRepo(repoPath);
		if (existing) {
			vscode.window.showInformationMessage(
				`Repository "${repoPath}" is already configured (staging: ${existing.stagingBranch}).`,
			);
			return existing;
		}

		// 5. Prompt for staging branch name with retry loop
		const stagingBranch = await this.promptForStagingBranch(repoPath);
		if (stagingBranch === undefined) {
			return undefined;
		}

		// 6. Create and save config
		const config: RepoConfig = {
			path: repoPath,
			stagingBranch,
		};

		const configs = this.getAll();
		configs.push(config);
		await this.state.update(REPO_CONFIGS_KEY, configs);

		// 7. Ensure .worktrees/ is in .gitignore
		await ensureGitignoreEntry(repoPath);

		// 8. Show success message
		vscode.window.showInformationMessage(
			`Repository added: ${repoPath} (staging: ${stagingBranch})`,
		);

		return config;
	}

	/**
	 * Prompts the user for a staging branch name, handling the case
	 * where the branch already exists (confirm or pick different name).
	 * Returns undefined if the user cancels.
	 */
	private async promptForStagingBranch(repoPath: string): Promise<string | undefined> {
		// eslint-disable-next-line no-constant-condition
		while (true) {
			const branchName = await vscode.window.showInputBox({
				prompt: "Enter staging branch name",
				value: DEFAULT_STAGING_BRANCH,
				placeHolder: "Enter staging branch name",
			});

			if (branchName === undefined) {
				return undefined;
			}

			// Check if branch already exists
			const exists = await this.git.branchExists(repoPath, branchName);
			if (!exists) {
				return branchName;
			}

			// Branch exists -- ask user what to do
			const choice = await vscode.window.showQuickPick(
				[{ label: `Use existing branch '${branchName}'` }, { label: "Pick a different name" }],
				{
					placeHolder: `Branch '${branchName}' already exists`,
					title: "Branch Already Exists",
				},
			);

			if (!choice) {
				return undefined;
			}

			if (choice.label.startsWith("Use existing")) {
				return branchName;
			}

			// Loop back for a different name
		}
	}

	/**
	 * Removes a repo from the configuration.
	 */
	async removeRepo(repoPath: string): Promise<void> {
		const configs = this.getAll().filter((c) => c.path !== repoPath);
		await this.state.update(REPO_CONFIGS_KEY, configs);
	}
}
