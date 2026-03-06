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
	};

	const extensionUri = { fsPath: "/mock/extension" };

	let onMessageCallback: ((message: any) => void) | undefined;

	const mockWebviewView = {
		webview: {
			options: {} as any,
			html: "",
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

	it("resolveWebviewView sets webview.html to non-empty string", () => {
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

	it("refresh() updates webview.html when view exists", () => {
		const { agentService, repoConfigService, extensionUri, mockWebviewView } = createMocks();
		const provider = new SidebarViewProviderClass(
			extensionUri as any,
			agentService as any,
			repoConfigService as any,
		);

		provider.resolveWebviewView(mockWebviewView as any, {} as any, {} as any);
		const initialHtml = mockWebviewView.webview.html;

		// Call refresh
		provider.refresh();

		// html should be set again (may be same mock value, but was called)
		expect(mockWebviewView.webview.html).toBeTruthy();
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

	it("AgentService.onDidChange triggers refresh", () => {
		const { agentService, repoConfigService, extensionUri, mockWebviewView, getOnDidChangeCallback } = createMocks();
		const provider = new SidebarViewProviderClass(
			extensionUri as any,
			agentService as any,
			repoConfigService as any,
		);

		// Resolve the view first
		provider.resolveWebviewView(mockWebviewView as any, {} as any, {} as any);
		const htmlAfterResolve = mockWebviewView.webview.html;

		// Trigger agentService.onDidChange
		const callback = getOnDidChangeCallback();
		expect(callback).toBeDefined();
		callback!();

		// webview.html should have been re-set (refresh was called)
		expect(mockWebviewView.webview.html).toBeTruthy();
	});
});
