import * as os from "node:os";
import * as vscode from "vscode";
import type { RepoConfig } from "../models/repo";

/** Minimal interface for repo data source -- satisfied by both ReposStore and RepoConfigService. */
interface RepoDataSource {
	getAll(): RepoConfig[];
}

interface WorkspaceFolder {
	path: string;
	name: string;
}

interface WorkspaceFileContent {
	folders: WorkspaceFolder[];
	settings: Record<string, unknown>;
}

/** Extract the last segment of a path (like path.basename but without node:path). */
function basename(p: string): string {
	return p.split("/").pop() ?? p;
}

export class WorkspaceService {
	private readonly workspaceDirUri: vscode.Uri;
	private readonly workspaceFileUri: vscode.Uri;
	private readonly workspaceFilePath: string;
	private writeLock: Promise<void> = Promise.resolve();

	constructor(private readonly reposStore: RepoDataSource) {
		const homeUri = vscode.Uri.file(os.homedir());
		this.workspaceDirUri = vscode.Uri.joinPath(homeUri, ".agentic");
		this.workspaceFileUri = vscode.Uri.joinPath(this.workspaceDirUri, "agentic.code-workspace");
		this.workspaceFilePath = this.workspaceFileUri.fsPath;
	}

	/**
	 * Returns the absolute path to the workspace file.
	 */
	getWorkspaceFilePath(): string {
		return this.workspaceFilePath;
	}

	/**
	 * Checks whether VS Code is currently in workspace mode with our workspace file.
	 */
	isInWorkspaceMode(): boolean {
		const wsFile = vscode.workspace.workspaceFile;
		if (!wsFile) {
			return false;
		}
		if (wsFile.scheme !== "file") {
			return false;
		}
		return wsFile.fsPath.endsWith("agentic.code-workspace");
	}

	/**
	 * Creates or updates the .code-workspace file if repos exist.
	 * Returns true if file was created for the first time (caller should prompt reopen).
	 */
	async ensureWorkspaceFile(): Promise<boolean> {
		console.log("[WorkspaceService.ensureWorkspaceFile]");
		return this.withWriteLock(async () => {
			const repos = this.reposStore.getAll();
			if (repos.length === 0) {
				return false;
			}

			const desiredFolders = repos.map((r) => ({
				path: r.path,
				name: basename(r.path),
			}));

			const desiredContent: WorkspaceFileContent = {
				folders: desiredFolders,
				settings: {},
			};

			// Try to read existing file
			let isNew = false;
			try {
				const rawBytes = await vscode.workspace.fs.readFile(this.workspaceFileUri);
				const existingRaw = new TextDecoder().decode(rawBytes);
				const existing = JSON.parse(existingRaw) as WorkspaceFileContent;

				// Compare folders to see if update needed
				if (this.foldersMatch(existing.folders, desiredFolders)) {
					return false; // No-op
				}
			} catch {
				// File doesn't exist -- this is a new creation
				isNew = true;
			}

			await vscode.workspace.fs.createDirectory(this.workspaceDirUri);
			await vscode.workspace.fs.writeFile(
				this.workspaceFileUri,
				new TextEncoder().encode(JSON.stringify(desiredContent, null, "\t")),
			);

			return isNew;
		});
	}

	/**
	 * Writes the workspace file with the current repo list.
	 */
	async syncWorkspaceFile(): Promise<void> {
		console.log("[WorkspaceService.syncWorkspaceFile]");
		return this.withWriteLock(async () => {
			const repos = this.reposStore.getAll();
			const folders = repos.map((r) => ({
				path: r.path,
				name: basename(r.path),
			}));

			const content: WorkspaceFileContent = {
				folders,
				settings: {},
			};

			await vscode.workspace.fs.createDirectory(this.workspaceDirUri);
			await vscode.workspace.fs.writeFile(
				this.workspaceFileUri,
				new TextEncoder().encode(JSON.stringify(content, null, "\t")),
			);
		});
	}

	/**
	 * Prompts the user to reopen VS Code in workspace mode.
	 */
	async promptReopenInWorkspace(): Promise<void> {
		const choice = await vscode.window.showInformationMessage(
			"Agentic works best in workspace mode. Reopen to see the \"Agentic\" title and managed folders.",
			"Reopen in Workspace",
			"Later",
		);

		if (choice === "Reopen in Workspace") {
			await vscode.commands.executeCommand("vscode.openFolder", this.workspaceFileUri);
		}
	}

	/**
	 * Sets the Explorer to show a single folder.
	 */
	setExplorerScope(folderPath: string, name?: string): void {
		console.log("[WorkspaceService.setExplorerScope]", { folderPath, name });
		const currentCount = vscode.workspace.workspaceFolders?.length ?? 0;
		vscode.workspace.updateWorkspaceFolders(0, currentCount, {
			uri: vscode.Uri.file(folderPath),
			name: name ?? basename(folderPath),
		});
	}

	/**
	 * Resets the Explorer to show all configured repo roots.
	 */
	resetExplorerScope(): void {
		console.log("[WorkspaceService.resetExplorerScope]");
		const repos = this.reposStore.getAll();
		if (repos.length === 0) return;
		const currentCount = vscode.workspace.workspaceFolders?.length ?? 0;
		vscode.workspace.updateWorkspaceFolders(
			0,
			currentCount,
			...repos.map((r) => ({
				uri: vscode.Uri.file(r.path),
				name: basename(r.path),
			})),
		);
	}

	/**
	 * Promise-chain mutex for file writes (prevents race conditions).
	 */
	private async withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
		const pending = this.writeLock;
		let resolve!: () => void;
		this.writeLock = new Promise<void>((r) => {
			resolve = r;
		});

		await pending;
		try {
			return await fn();
		} finally {
			resolve();
		}
	}

	/**
	 * Compares two folder arrays for equality.
	 */
	private foldersMatch(a: WorkspaceFolder[], b: WorkspaceFolder[]): boolean {
		if (a.length !== b.length) {
			return false;
		}
		return a.every((af, i) => af.path === b[i].path && af.name === b[i].name);
	}
}
