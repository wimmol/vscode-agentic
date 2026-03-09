import { describe, it, expect, beforeEach } from "vitest";
import type { AgentEntry } from "../../src/models/agent";
import type { RepoConfig } from "../../src/models/repo";

// Lazy import -- module doesn't exist yet (TDD RED phase)
let getHtmlForWebview: typeof import("../../src/views/sidebar-html").getHtmlForWebview;
let getStatusIcon: typeof import("../../src/views/sidebar-html").getStatusIcon;
let escapeHtml: typeof import("../../src/views/sidebar-html").escapeHtml;

const mockWebview = {
	cspSource: "https://mock.csp.source",
	asWebviewUri: (uri: any) => ({
		toString: () => `vscode-webview://mock/${uri.fsPath}`,
	}),
};
const mockExtensionUri = { fsPath: "/mock/extension" };

function makeAgent(overrides: Partial<AgentEntry> = {}): AgentEntry {
	return {
		agentName: "test-agent",
		repoPath: "/repos/my-project",
		status: "created",
		createdAt: "2026-01-01T00:00:00.000Z",
		...overrides,
	};
}

function makeRepo(overrides: Partial<RepoConfig> = {}): RepoConfig {
	return {
		path: "/repos/my-project",
		stagingBranch: "staging",
		worktreeLimit: 5,
		...overrides,
	};
}

beforeEach(async () => {
	const mod = await import("../../src/views/sidebar-html");
	getHtmlForWebview = mod.getHtmlForWebview;
	getStatusIcon = mod.getStatusIcon;
	escapeHtml = mod.escapeHtml;
});

describe("getHtmlForWebview", () => {
	it("returns valid HTML document with DOCTYPE, html, head, body tags", () => {
		const repos: RepoConfig[] = [];
		const agentsByRepo = new Map<string, AgentEntry[]>();
		const html = getHtmlForWebview(mockWebview as any, mockExtensionUri as any, repos, agentsByRepo);

		expect(html).toContain("<!DOCTYPE html>");
		expect(html).toContain("<html");
		expect(html).toContain("<head>");
		expect(html).toContain("<body>");
		expect(html).toContain("</html>");
	});

	it("contains CSP meta tag with nonce and webview.cspSource", () => {
		const repos: RepoConfig[] = [];
		const agentsByRepo = new Map<string, AgentEntry[]>();
		const html = getHtmlForWebview(mockWebview as any, mockExtensionUri as any, repos, agentsByRepo);

		expect(html).toContain("Content-Security-Policy");
		expect(html).toContain("https://mock.csp.source");
		expect(html).toMatch(/nonce-[A-Za-z0-9]{32}/);
	});

	it("contains codicon CSS link tag", () => {
		const repos: RepoConfig[] = [];
		const agentsByRepo = new Map<string, AgentEntry[]>();
		const html = getHtmlForWebview(mockWebview as any, mockExtensionUri as any, repos, agentsByRepo);

		expect(html).toContain("codicon.css");
	});

	it("renders agent tiles for agents in a repo", () => {
		const repo = makeRepo();
		const agent = makeAgent();
		const repos = [repo];
		const agentsByRepo = new Map<string, AgentEntry[]>();
		agentsByRepo.set(repo.path, [agent]);

		const html = getHtmlForWebview(mockWebview as any, mockExtensionUri as any, repos, agentsByRepo);

		expect(html).toContain("test-agent");
		expect(html).toContain("agent-tile");
	});

	it("uses VS Code CSS variables (not hardcoded colors)", () => {
		const repos: RepoConfig[] = [];
		const agentsByRepo = new Map<string, AgentEntry[]>();
		const html = getHtmlForWebview(mockWebview as any, mockExtensionUri as any, repos, agentsByRepo);

		expect(html).toContain("var(--vscode-editor-background)");
		expect(html).toContain("var(--vscode-panel-border)");
		expect(html).toContain("var(--vscode-sideBar-background)");
	});

	it("contains acquireVsCodeApi() and event delegation setup in script", () => {
		const repos: RepoConfig[] = [];
		const agentsByRepo = new Map<string, AgentEntry[]>();
		const html = getHtmlForWebview(mockWebview as any, mockExtensionUri as any, repos, agentsByRepo);

		expect(html).toContain("acquireVsCodeApi()");
		expect(html).toContain(".dashboard");
	});

	it("renders repo section with repo name, create button, settings, remove button", () => {
		const repo = makeRepo({ path: "/repos/awesome-project" });
		const repos = [repo];
		const agentsByRepo = new Map<string, AgentEntry[]>();
		agentsByRepo.set(repo.path, []);

		const html = getHtmlForWebview(mockWebview as any, mockExtensionUri as any, repos, agentsByRepo);

		expect(html).toContain("awesome-project");
		expect(html).toContain("codicon-add");
		expect(html).toContain("codicon-gear");
		expect(html).toContain("codicon-close");
	});

	it("renders per-repo root button with codicon-root-folder in repo header", () => {
		const repo = makeRepo({ path: "/repos/my-project" });
		const repos = [repo];
		const agentsByRepo = new Map<string, AgentEntry[]>();
		agentsByRepo.set(repo.path, []);

		const html = getHtmlForWebview(mockWebview as any, mockExtensionUri as any, repos, agentsByRepo);

		expect(html).toContain("codicon-root-folder");
		expect(html).toContain('data-action="rootRepo"');
	});

	it("root button has correct data-repo-path attribute", () => {
		const repo = makeRepo({ path: "/repos/my-project" });
		const repos = [repo];
		const agentsByRepo = new Map<string, AgentEntry[]>();
		agentsByRepo.set(repo.path, []);

		const html = getHtmlForWebview(mockWebview as any, mockExtensionUri as any, repos, agentsByRepo);

		// Find the rootRepo button and verify it has the right repo path
		const rootBtnMatch = html.match(/data-action="rootRepo"[^>]*data-repo-path="([^"]*)"/);
		expect(rootBtnMatch).toBeTruthy();
		expect(rootBtnMatch![1]).toBe("/repos/my-project");
	});

	it("root button appears before create button in repo-actions", () => {
		const repo = makeRepo({ path: "/repos/my-project" });
		const repos = [repo];
		const agentsByRepo = new Map<string, AgentEntry[]>();
		agentsByRepo.set(repo.path, []);

		const html = getHtmlForWebview(mockWebview as any, mockExtensionUri as any, repos, agentsByRepo);

		const rootIdx = html.indexOf('data-action="rootRepo"');
		const createIdx = html.indexOf('data-action="createAgent"');
		expect(rootIdx).toBeGreaterThan(-1);
		expect(createIdx).toBeGreaterThan(-1);
		expect(rootIdx).toBeLessThan(createIdx);
	});

	it("contains DOM patcher (patchDashboard function) in script", () => {
		const repos: RepoConfig[] = [];
		const agentsByRepo = new Map<string, AgentEntry[]>();
		const html = getHtmlForWebview(mockWebview as any, mockExtensionUri as any, repos, agentsByRepo);

		expect(html).toContain("patchDashboard");
		expect(html).toContain("addEventListener('message'");
	});

	it("contains animation CSS classes (.entering, .exiting, .scope-active)", () => {
		const repos: RepoConfig[] = [];
		const agentsByRepo = new Map<string, AgentEntry[]>();
		const html = getHtmlForWebview(mockWebview as any, mockExtensionUri as any, repos, agentsByRepo);

		expect(html).toContain(".agent-tile.entering");
		expect(html).toContain(".agent-tile.exiting");
		expect(html).toContain(".scope-active");
	});

	it("contains rootRepo click handler in event delegation", () => {
		const repos: RepoConfig[] = [];
		const agentsByRepo = new Map<string, AgentEntry[]>();
		const html = getHtmlForWebview(mockWebview as any, mockExtensionUri as any, repos, agentsByRepo);

		expect(html).toContain("action === 'rootRepo'");
		expect(html).toContain("command: 'rootRepo'");
	});
});

describe("renderAgentTile (via getHtmlForWebview)", () => {
	function renderSingleTile(agent: AgentEntry): string {
		const repo = makeRepo({ path: agent.repoPath });
		const repos = [repo];
		const agentsByRepo = new Map<string, AgentEntry[]>();
		agentsByRepo.set(repo.path, [agent]);
		return getHtmlForWebview(mockWebview as any, mockExtensionUri as any, repos, agentsByRepo);
	}

	it("includes agent name in .agent-name element", () => {
		const html = renderSingleTile(makeAgent({ agentName: "my-cool-agent" }));
		expect(html).toMatch(/class="[^"]*agent-name[^"]*"[^>]*>my-cool-agent/);
	});

	it("includes status icon with codicon-loading for running", () => {
		const html = renderSingleTile(makeAgent({ status: "running" }));
		expect(html).toContain("codicon-loading");
	});

	it("includes status icon with codicon-person for created", () => {
		const html = renderSingleTile(makeAgent({ status: "created" }));
		expect(html).toContain("codicon-person");
	});

	it("includes status icon with codicon-check for finished", () => {
		const html = renderSingleTile(makeAgent({ status: "finished" }));
		expect(html).toContain("codicon-check");
	});

	it("includes status icon with codicon-error for error", () => {
		const html = renderSingleTile(makeAgent({ status: "error" }));
		expect(html).toContain("codicon-error");
	});

	it("includes .spin class for running status icon", () => {
		const html = renderSingleTile(makeAgent({ status: "running" }));
		expect(html).toContain("spin");
	});

	it("includes data-repo-path and data-agent-name attributes", () => {
		const html = renderSingleTile(makeAgent({ repoPath: "/repos/proj", agentName: "agent-1" }));
		expect(html).toContain('data-repo-path="/repos/proj"');
		expect(html).toContain('data-agent-name="agent-1"');
	});

	it("includes data-status and data-created-at attributes for timer", () => {
		const html = renderSingleTile(makeAgent({ status: "running", createdAt: "2026-01-01T00:00:00.000Z" }));
		expect(html).toContain('data-status="running"');
		expect(html).toContain('data-created-at="2026-01-01T00:00:00.000Z"');
	});

	it("Stop button is disabled when agent is not running", () => {
		const html = renderSingleTile(makeAgent({ status: "created" }));
		// Match the stop button with disabled attribute
		expect(html).toMatch(/data-action="stopAgent"[^>]*disabled/);
	});

	it("Stop button is enabled when agent is running", () => {
		const html = renderSingleTile(makeAgent({ status: "running" }));
		// The stop button should NOT have disabled attribute
		const stopBtnMatch = html.match(/data-action="stopAgent"[^>]*/);
		expect(stopBtnMatch).toBeTruthy();
		expect(stopBtnMatch![0]).not.toContain("disabled");
	});

	it("Reset Changes and Clear Context buttons are disabled when created", () => {
		const html = renderSingleTile(makeAgent({ status: "created" }));
		expect(html).toMatch(/data-action="resetChanges"[^>]*disabled/);
		expect(html).toMatch(/data-action="clearContext"[^>]*disabled/);
	});

	it("Reset Changes and Clear Context buttons are disabled when running", () => {
		const html = renderSingleTile(makeAgent({ status: "running" }));
		expect(html).toMatch(/data-action="resetChanges"[^>]*disabled/);
		expect(html).toMatch(/data-action="clearContext"[^>]*disabled/);
	});

	it("Reset Changes and Clear Context buttons are enabled when finished", () => {
		const html = renderSingleTile(makeAgent({ status: "finished", finishedAt: "2026-01-01T01:00:00.000Z" }));
		const resetMatch = html.match(/data-action="resetChanges"[^>]*/);
		const clearMatch = html.match(/data-action="clearContext"[^>]*/);
		expect(resetMatch).toBeTruthy();
		expect(clearMatch).toBeTruthy();
		expect(resetMatch![0]).not.toContain("disabled");
		expect(clearMatch![0]).not.toContain("disabled");
	});

	it("Reset Changes and Clear Context buttons are enabled when error", () => {
		const html = renderSingleTile(makeAgent({ status: "error", exitCode: 1 }));
		const resetMatch = html.match(/data-action="resetChanges"[^>]*/);
		const clearMatch = html.match(/data-action="clearContext"[^>]*/);
		expect(resetMatch).toBeTruthy();
		expect(clearMatch).toBeTruthy();
		expect(resetMatch![0]).not.toContain("disabled");
		expect(clearMatch![0]).not.toContain("disabled");
	});

	it("Delete button is never disabled", () => {
		for (const status of ["created", "running", "finished", "error"] as const) {
			const html = renderSingleTile(makeAgent({ status }));
			const deleteMatch = html.match(/data-action="deleteAgent"[^>]*/);
			expect(deleteMatch).toBeTruthy();
			expect(deleteMatch![0]).not.toContain("disabled");
		}
	});

	it("placeholder metrics shown: +-- -- files, ctx: --%, RAM: --MB", () => {
		const html = renderSingleTile(makeAgent());
		expect(html).toContain("+-- -- files");
		expect(html).toContain("ctx: --%");
		expect(html).toContain("RAM: --MB");
	});

	it("exit code shown for error agents with exitCode", () => {
		const html = renderSingleTile(makeAgent({ status: "error", exitCode: 137 }));
		expect(html).toContain("137");
	});

	it("initial prompt text is present and has title attribute for tooltip", () => {
		const html = renderSingleTile(makeAgent({ initialPrompt: "Refactor the auth module" }));
		expect(html).toContain("Refactor the auth module");
		expect(html).toContain('title="Refactor the auth module"');
	});
});

describe("getStatusIcon", () => {
	it("returns codicon-loading with spin class for running", () => {
		const icon = getStatusIcon("running");
		expect(icon).toContain("codicon-loading");
		expect(icon).toContain("spin");
	});

	it("returns codicon-person for created", () => {
		const icon = getStatusIcon("created");
		expect(icon).toContain("codicon-person");
	});

	it("returns codicon-check for finished", () => {
		const icon = getStatusIcon("finished");
		expect(icon).toContain("codicon-check");
	});

	it("returns codicon-error for error", () => {
		const icon = getStatusIcon("error");
		expect(icon).toContain("codicon-error");
	});
});

describe("escapeHtml", () => {
	it("escapes < character", () => {
		expect(escapeHtml("<script>")).toContain("&lt;");
	});

	it("escapes > character", () => {
		expect(escapeHtml("<div>")).toContain("&gt;");
	});

	it("escapes & character", () => {
		expect(escapeHtml("a&b")).toContain("&amp;");
	});

	it('escapes " character', () => {
		expect(escapeHtml('"hello"')).toContain("&quot;");
	});

	it("escapes ' character", () => {
		expect(escapeHtml("it's")).toContain("&#39;");
	});

	it("leaves safe text unchanged", () => {
		expect(escapeHtml("hello world 123")).toBe("hello world 123");
	});
});
