import * as vscode from "vscode";
import {
	DEFAULT_STAGING_BRANCH,
	DEFAULT_WORKTREE_LIMIT,
	REPO_CONFIGS_KEY,
	type RepoConfig,
} from "../models/repo";
import { ensureGitignoreEntry } from "../utils/gitignore";
import type { GitService } from "./git.service";

interface RepoPickItem extends vscode.QuickPickItem {
	_path: string;
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
	 * Returns config for a specific repo path, or undefined if not configured.
	 */
	getForRepo(repoPath: string): RepoConfig | undefined {
		return this.getAll().find((c) => c.path === repoPath);
	}

	/**
	 * Interactive flow to add a new repository:
	 * 1. Pick workspace folder or browse
	 * 2. Validate it's a git repo
	 * 3. Prompt for staging branch name
	 * 4. Handle existing branch (confirm or pick different)
	 * 5. Save config and ensure .gitignore entry
	 */
	async addRepo(): Promise<RepoConfig | undefined> {
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
			return undefined;
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
				return undefined;
			}
			repoPath = result[0].fsPath;
		} else {
			repoPath = picked._path;
		}

		// Step 3: Validate it's a git repo
		try {
			await this.git.exec(repoPath, ["rev-parse", "--git-dir"]);
		} catch {
			vscode.window.showErrorMessage(`"${repoPath}" is not a git repository.`);
			return undefined;
		}

		// Step 4: Check if already configured
		const existing = this.getForRepo(repoPath);
		if (existing) {
			vscode.window.showInformationMessage(
				`Repository "${repoPath}" is already configured (staging: ${existing.stagingBranch}).`,
			);
			return existing;
		}

		// Step 5: Prompt for staging branch name (with loop for existing branch)
		let stagingBranch = "";
		let branchConfirmed = false;

		while (!branchConfirmed) {
			const input = await vscode.window.showInputBox({
				prompt: "Enter staging branch name",
				value: DEFAULT_STAGING_BRANCH,
				placeHolder: "Enter staging branch name",
			});

			if (input === undefined) {
				return undefined;
			}
			stagingBranch = input;

			// Check if branch already exists
			const exists = await this.git.branchExists(repoPath, stagingBranch);

			if (exists) {
				const choice = await vscode.window.showQuickPick(
					[{ label: `Use existing branch '${stagingBranch}'` }, { label: "Pick a different name" }],
					{
						placeHolder: `Branch '${stagingBranch}' already exists in this repository`,
						title: "Branch exists",
					},
				);

				if (!choice) {
					return undefined;
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
			worktreeLimit: DEFAULT_WORKTREE_LIMIT,
		};

		const configs = this.getAll();
		configs.push(config);
		await this.save(configs);

		// Step 7: Ensure .worktrees/ is in .gitignore
		await ensureGitignoreEntry(repoPath);

		// Step 8: Notify user
		vscode.window.showInformationMessage(
			`Repository added: ${repoPath} (staging: ${stagingBranch})`,
		);

		return config;
	}

	/**
	 * Remove a repository configuration.
	 */
	async removeRepo(repoPath: string): Promise<void> {
		const configs = this.getAll().filter((c) => c.path !== repoPath);
		await this.save(configs);
	}

	private async save(configs: RepoConfig[]): Promise<void> {
		await this.state.update(REPO_CONFIGS_KEY, configs);
	}
}
