import * as vscode from "vscode";
import type { GitService } from "../services/git.service.js";

export class GitContentProvider implements vscode.TextDocumentContentProvider {
	static readonly SCHEME = "agentic-git";

	constructor(private readonly git: GitService) {}

	/**
	 * Serves file content at a specific git ref.
	 * URI query params: repo, ref, path.
	 * Returns empty string if the file does not exist at the given ref.
	 */
	async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
		const params = new URLSearchParams(uri.query);
		const repoPath = params.get("repo") ?? "";
		const ref = params.get("ref") ?? "HEAD";
		const filePath = params.get("path") ?? "";

		try {
			return await this.git.exec(repoPath, ["show", `${ref}:${filePath}`]);
		} catch {
			return "";
		}
	}

	/**
	 * Builds a URI for a file at a specific git ref.
	 * Uses encodeURIComponent for all query parameter values to handle
	 * paths with spaces and special characters.
	 */
	static buildUri(repoPath: string, ref: string, filePath: string): vscode.Uri {
		const query = `repo=${encodeURIComponent(repoPath)}&ref=${encodeURIComponent(ref)}&path=${encodeURIComponent(filePath)}`;
		return vscode.Uri.parse(`${GitContentProvider.SCHEME}:/${filePath}?${query}`);
	}
}
