import { beforeEach, describe, expect, it, vi } from "vitest";
import { GitContentProvider } from "../../src/providers/git-content.provider.js";
import type { GitService } from "../../src/services/git.service.js";

function createMockGitService(): {
	exec: ReturnType<typeof vi.fn>;
	branchExists: ReturnType<typeof vi.fn>;
} {
	return {
		exec: vi.fn(),
		branchExists: vi.fn(),
	};
}

describe("GitContentProvider", () => {
	let provider: GitContentProvider;
	let git: ReturnType<typeof createMockGitService>;

	beforeEach(() => {
		vi.clearAllMocks();
		git = createMockGitService();
		provider = new GitContentProvider(git as unknown as GitService);
	});

	describe("SCHEME", () => {
		it("static property equals 'agentic-git'", () => {
			expect(GitContentProvider.SCHEME).toBe("agentic-git");
		});
	});

	describe("provideTextDocumentContent", () => {
		it("calls git show with ref:path format", async () => {
			git.exec.mockResolvedValue("file content here");

			const uri = {
				query: "repo=%2Frepo&ref=staging&path=src%2Ffile.ts",
			};

			const result = await provider.provideTextDocumentContent(uri as any);

			expect(result).toBe("file content here");
			expect(git.exec).toHaveBeenCalledWith("/repo", ["show", "staging:src/file.ts"]);
		});

		it("extracts repo, ref, and path from URI query parameters", async () => {
			git.exec.mockResolvedValue("content");

			const uri = {
				query: `repo=${encodeURIComponent("/my/repo")}&ref=${encodeURIComponent("feature/branch")}&path=${encodeURIComponent("src/deep/file.ts")}`,
			};

			await provider.provideTextDocumentContent(uri as any);

			expect(git.exec).toHaveBeenCalledWith("/my/repo", [
				"show",
				"feature/branch:src/deep/file.ts",
			]);
		});

		it("returns empty string when git show throws (file not at ref)", async () => {
			git.exec.mockRejectedValue(new Error("fatal: path not found"));

			const uri = {
				query: "repo=%2Frepo&ref=staging&path=nonexistent.ts",
			};

			const result = await provider.provideTextDocumentContent(uri as any);

			expect(result).toBe("");
		});
	});

	describe("buildUri", () => {
		it("creates a URI with scheme 'agentic-git' and encoded query parameters", () => {
			const uri = GitContentProvider.buildUri("/repo", "staging", "src/file.ts");

			expect(uri.scheme).toBe("agentic-git");
			// The query should contain encoded repo, ref, and path
			const params = new URLSearchParams(uri.query);
			expect(params.get("repo")).toBe("/repo");
			expect(params.get("ref")).toBe("staging");
			expect(params.get("path")).toBe("src/file.ts");
		});

		it("roundtrips correctly -- provideTextDocumentContent can parse URIs built by buildUri", async () => {
			git.exec.mockResolvedValue("roundtrip content");

			const repoPath = "/my/repo path";
			const ref = "feature/branch";
			const filePath = "src/my file.ts";

			const uri = GitContentProvider.buildUri(repoPath, ref, filePath);
			const result = await provider.provideTextDocumentContent(uri as any);

			expect(result).toBe("roundtrip content");
			expect(git.exec).toHaveBeenCalledWith(repoPath, ["show", `${ref}:${filePath}`]);
		});
	});
});
