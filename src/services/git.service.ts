import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export class GitError extends Error {
	constructor(
		message: string,
		public readonly args: string[],
		public readonly exitCode?: number,
	) {
		super(message);
		this.name = "GitError";
	}
}

export class GitService {
	private readonly timeout = 30_000;
	private readonly maxBuffer = 10 * 1024 * 1024; // 10 MB

	async exec(repoPath: string, args: string[]): Promise<string> {
		try {
			const { stdout } = await execFileAsync("git", args, {
				cwd: repoPath,
				timeout: this.timeout,
				maxBuffer: this.maxBuffer,
			});
			return stdout.trim();
		} catch (err: unknown) {
			const error = err as { stderr?: string; code?: number };
			throw new GitError(
				error.stderr || String(err),
				args,
				typeof error.code === "number" ? error.code : undefined,
			);
		}
	}

	async branchExists(repoPath: string, branchName: string): Promise<boolean> {
		try {
			await this.exec(repoPath, [
				"rev-parse",
				"--verify",
				`refs/heads/${branchName}`,
			]);
			return true;
		} catch {
			return false;
		}
	}
}
