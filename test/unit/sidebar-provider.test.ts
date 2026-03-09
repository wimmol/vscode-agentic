import { describe, it, expect, vi, beforeEach } from "vitest";
import { commands } from "vscode";

// Mock the sidebar-html module so we don't need real webview/URI objects
vi.mock("../../src/views/sidebar-html", () => ({
	getHtmlForWebview: vi.fn(() => "<html>mock dashboard</html>"),
}));

import type { SidebarViewProvider } from "../../src/views/sidebar-provider";

// Create test mocks
function createMocks() {
	let onDidChangeCallback: (() => void) | undefined;

	const agentService = {
		onDidChange: vi.fn((cb: () => void) => {
			onDidChangeCallback = cb;
			return { dispose: vi.fn() };
		}),
		getAll: vi.fn(() => []),
		getForRepo: vi.fn(() => []),
	};

	const repoConfigService = {
		getAll: vi.fn(() => []),
		onDidChange: vi.fn(() => ({ dispose: vi.fn() })),
	};

	const extensionUri = { fsPath: "/mock/extension" };

	let onMessageCallback: ((message: any) => void) | undefined;

	const mockWebviewView = {
		webview: {
			options: {} as any,
			html: "",
			postMessage: vi.fn(),
			onDidReceiveMessage: vi.fn((cb: (message: any) => void) => {
				onMessageCallback = cb;
				return { dispose: vi.fn() };
			}),
			cspSource: "https://mock.csp.source",
			asWebviewUri: vi.fn((uri: any) => ({
				toString: () => `vscode-webview://mock/${uri?.fsPath}`,
			})),
		},
	};

	return {
		agentService,
		repoConfigService,
		extensionUri,
		mockWebviewView,
		getOnDidChangeCallback: () => onDidChangeCallback,
		sendMessage: (msg: any) => onMessageCallback?.(msg),
	};
}

let SidebarViewProviderClass: typeof SidebarViewProvider;

beforeEach(async () => {
	vi.clearAllMocks();
	const mod = await import("../../src/views/sidebar-provider");
	SidebarViewProviderClass = mod.SidebarViewProvider;
});

describe("SidebarViewProvider", () => {
	it("viewType equals 'vscode-agentic.agents'", () => {
		expect(SidebarViewProviderClass.viewType).toBe("vscode-agentic.agents");
	});

	it("resolveWebviewView sets webview options (enableScripts: true, localResourceRoots)", () => {
		const { agentService, repoConfigService, extensionUri, mockWebviewView } = createMocks();
		const provider = new SidebarViewProviderClass(
			extensionUri as any,
			agentService as any,
			repoConfigService as any,
		);

		provider.resolveWebviewView(mockWebviewView as any, {} as any, {} as any);

		expect(mockWebviewView.webview.options.enableScripts).toBe(true);
		expect(mockWebviewView.webview.options.localResourceRoots).toEqual([extensionUri]);
	});

	it("resolveWebviewView sets webview.html to non-empty string (initial full HTML render)", () => {
		const { agentService, repoConfigService, extensionUri, mockWebviewView } = createMocks();
		const provider = new SidebarViewProviderClass(
			extensionUri as any,
			agentService as any,
			repoConfigService as any,
		);

		provider.resolveWebviewView(mockWebviewView as any, {} as any, {} as any);

		expect(mockWebviewView.webview.html).toBeTruthy();
		expect(typeof mockWebviewView.webview.html).toBe("string");
	});

	it("resolveWebviewView registers onDidReceiveMessage handler", () => {
		const { agentService, repoConfigService, extensionUri, mockWebviewView } = createMocks();
		const provider = new SidebarViewProviderClass(
			extensionUri as any,
			agentService as any,
			repoConfigService as any,
		);

		provider.resolveWebviewView(mockWebviewView as any, {} as any, {} as any);

		expect(mockWebviewView.webview.onDidReceiveMessage).toHaveBeenCalled();
	});

	it("refresh() after resolveWebviewView sends postMessage with {type: 'update', data} instead of setting webview.html", () => {
		const { agentService, repoConfigService, extensionUri, mockWebviewView } = createMocks();
		const provider = new SidebarViewProviderClass(
			extensionUri as any,
			agentService as any,
			repoConfigService as any,
		);

		provider.resolveWebviewView(mockWebviewView as any, {} as any, {} as any);
		const htmlAfterResolve = mockWebviewView.webview.html;

		// Clear mocks to track only the refresh call
		mockWebviewView.webview.postMessage.mockClear();

		provider.refresh();

		// Should use postMessage, not set html again
		expect(mockWebviewView.webview.postMessage).toHaveBeenCalledTimes(1);
		const msg = mockWebviewView.webview.postMessage.mock.calls[0][0];
		expect(msg.type).toBe("update");
		expect(msg.data).toBeDefined();

		// html should NOT have changed from initial render
		expect(mockWebviewView.webview.html).toBe(htmlAfterResolve);
	});

	it("postMessage data contains repos array with agents nested, and scope string", () => {
		const { agentService, repoConfigService, extensionUri, mockWebviewView } = createMocks();

		repoConfigService.getAll.mockReturnValue([
			{ path: "/repos/proj-a", stagingBranch: "staging", worktreeLimit: 5 },
			{ path: "/repos/proj-b", stagingBranch: "staging", worktreeLimit: 5 },
		]);
		agentService.getForRepo.mockImplementation((repoPath: string) => {
			if (repoPath === "/repos/proj-a") {
				return [{ agentName: "agent-1", repoPath: "/repos/proj-a", status: "running", createdAt: "2026-01-01T00:00:00.000Z" }];
			}
			return [];
		});

		const provider = new SidebarViewProviderClass(
			extensionUri as any,
			agentService as any,
			repoConfigService as any,
		);

		provider.resolveWebviewView(mockWebviewView as any, {} as any, {} as any);
		provider.refresh();

		const msg = mockWebviewView.webview.postMessage.mock.calls[0][0];
		expect(msg.data.repos).toHaveLength(2);
		expect(msg.data.repos[0].path).toBe("/repos/proj-a");
		expect(msg.data.repos[0].name).toBe("proj-a");
		expect(msg.data.repos[0].agents).toHaveLength(1);
		expect(msg.data.repos[0].agents[0].agentName).toBe("agent-1");
		expect(msg.data.repos[1].path).toBe("/repos/proj-b");
		expect(msg.data.repos[1].agents).toHaveLength(0);
		expect(msg.data.scope).toBe("global");
	});

	it("refresh() is no-op when view is undefined (not yet resolved)", () => {
		const { agentService, repoConfigService, extensionUri } = createMocks();
		const provider = new SidebarViewProviderClass(
			extensionUri as any,
			agentService as any,
			repoConfigService as any,
		);

		// Should not throw
		expect(() => provider.refresh()).not.toThrow();
	});

	it("scope state defaults to 'global'", () => {
		const { agentService, repoConfigService, extensionUri, mockWebviewView } = createMocks();
		const provider = new SidebarViewProviderClass(
			extensionUri as any,
			agentService as any,
			repoConfigService as any,
		);

		provider.resolveWebviewView(mockWebviewView as any, {} as any, {} as any);
		provider.refresh();

		const msg = mockWebviewView.webview.postMessage.mock.calls[0][0];
		expect(msg.data.scope).toBe("global");
	});

	it("setScope(mode) updates internal scope and triggers postMessage with new scope value", () => {
		const { agentService, repoConfigService, extensionUri, mockWebviewView } = createMocks();
		const provider = new SidebarViewProviderClass(
			extensionUri as any,
			agentService as any,
			repoConfigService as any,
		);

		provider.resolveWebviewView(mockWebviewView as any, {} as any, {} as any);
		mockWebviewView.webview.postMessage.mockClear();

		provider.setScope("repo:/repos/proj-a");

		expect(mockWebviewView.webview.postMessage).toHaveBeenCalledTimes(1);
		const msg = mockWebviewView.webview.postMessage.mock.calls[0][0];
		expect(msg.data.scope).toBe("repo:/repos/proj-a");
	});

	it("AgentService.onDidChange triggers refresh via postMessage", () => {
		const { agentService, repoConfigService, extensionUri, mockWebviewView, getOnDidChangeCallback } = createMocks();
		const provider = new SidebarViewProviderClass(
			extensionUri as any,
			agentService as any,
			repoConfigService as any,
		);

		provider.resolveWebviewView(mockWebviewView as any, {} as any, {} as any);
		mockWebviewView.webview.postMessage.mockClear();

		// Trigger agentService.onDidChange
		const callback = getOnDidChangeCallback();
		expect(callback).toBeDefined();
		callback!();

		// Should have called postMessage (not set html)
		expect(mockWebviewView.webview.postMessage).toHaveBeenCalledTimes(1);
	});

	it("focusAgent message calls vscode.commands.executeCommand with correct args", () => {
		const { agentService, repoConfigService, extensionUri, mockWebviewView, sendMessage } = createMocks();
		const provider = new SidebarViewProviderClass(
			extensionUri as any,
			agentService as any,
			repoConfigService as any,
		);

		provider.resolveWebviewView(mockWebviewView as any, {} as any, {} as any);
		sendMessage({ command: "focusAgent", repoPath: "/repos/proj", agentName: "agent-1" });

		expect(commands.executeCommand).toHaveBeenCalledWith(
			"vscode-agentic.focusAgent",
			"/repos/proj",
			"agent-1",
		);
	});

	it("deleteAgent message calls vscode.commands.executeCommand with correct args", () => {
		const { agentService, repoConfigService, extensionUri, mockWebviewView, sendMessage } = createMocks();
		const provider = new SidebarViewProviderClass(
			extensionUri as any,
			agentService as any,
			repoConfigService as any,
		);

		provider.resolveWebviewView(mockWebviewView as any, {} as any, {} as any);
		sendMessage({ command: "deleteAgent", repoPath: "/repos/proj", agentName: "agent-1" });

		expect(commands.executeCommand).toHaveBeenCalledWith(
			"vscode-agentic.deleteAgent",
			"/repos/proj",
			"agent-1",
		);
	});

	it("createAgent message calls vscode.commands.executeCommand with correct args", () => {
		const { agentService, repoConfigService, extensionUri, mockWebviewView, sendMessage } = createMocks();
		const provider = new SidebarViewProviderClass(
			extensionUri as any,
			agentService as any,
			repoConfigService as any,
		);

		provider.resolveWebviewView(mockWebviewView as any, {} as any, {} as any);
		sendMessage({ command: "createAgent", repoPath: "/repos/proj" });

		expect(commands.executeCommand).toHaveBeenCalledWith(
			"vscode-agentic.createAgent",
			"/repos/proj",
		);
	});

	it("addRepo message calls vscode.commands.executeCommand with correct args", () => {
		const { agentService, repoConfigService, extensionUri, mockWebviewView, sendMessage } = createMocks();
		const provider = new SidebarViewProviderClass(
			extensionUri as any,
			agentService as any,
			repoConfigService as any,
		);

		provider.resolveWebviewView(mockWebviewView as any, {} as any, {} as any);
		sendMessage({ command: "addRepo" });

		expect(commands.executeCommand).toHaveBeenCalledWith("vscode-agentic.addRepo");
	});

	it("stopAgent message calls vscode.commands.executeCommand with correct args", () => {
		const { agentService, repoConfigService, extensionUri, mockWebviewView, sendMessage } = createMocks();
		const provider = new SidebarViewProviderClass(
			extensionUri as any,
			agentService as any,
			repoConfigService as any,
		);

		provider.resolveWebviewView(mockWebviewView as any, {} as any, {} as any);
		sendMessage({ command: "stopAgent", repoPath: "/repos/proj", agentName: "agent-1" });

		expect(commands.executeCommand).toHaveBeenCalledWith(
			"vscode-agentic.stopAgent",
			"/repos/proj",
			"agent-1",
		);
	});

	it("removeRepo message calls vscode.commands.executeCommand with correct args", () => {
		const { agentService, repoConfigService, extensionUri, mockWebviewView, sendMessage } = createMocks();
		const provider = new SidebarViewProviderClass(
			extensionUri as any,
			agentService as any,
			repoConfigService as any,
		);

		provider.resolveWebviewView(mockWebviewView as any, {} as any, {} as any);
		sendMessage({ command: "removeRepo", repoPath: "/repos/proj" });

		expect(commands.executeCommand).toHaveBeenCalledWith(
			"vscode-agentic.removeRepo",
			"/repos/proj",
		);
	});

	it("rootGlobal message calls vscode.commands.executeCommand for rootGlobal", () => {
		const { agentService, repoConfigService, extensionUri, mockWebviewView, sendMessage } = createMocks();
		const provider = new SidebarViewProviderClass(
			extensionUri as any,
			agentService as any,
			repoConfigService as any,
		);

		provider.resolveWebviewView(mockWebviewView as any, {} as any, {} as any);
		sendMessage({ command: "rootGlobal" });

		expect(commands.executeCommand).toHaveBeenCalledWith(
			"vscode-agentic.rootGlobal",
		);
	});

	it("rootRepo message calls vscode.commands.executeCommand with repoPath", () => {
		const { agentService, repoConfigService, extensionUri, mockWebviewView, sendMessage } = createMocks();
		const provider = new SidebarViewProviderClass(
			extensionUri as any,
			agentService as any,
			repoConfigService as any,
		);

		provider.resolveWebviewView(mockWebviewView as any, {} as any, {} as any);
		sendMessage({ command: "rootRepo", repoPath: "/repos/proj" });

		expect(commands.executeCommand).toHaveBeenCalledWith(
			"vscode-agentic.rootRepo",
			"/repos/proj",
		);
	});
});
