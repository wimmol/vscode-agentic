import { describe, expect, it } from "vitest";
import { TreeItemCollapsibleState } from "../__mocks__/vscode.js";
import {
	AgentTreeItem,
	RepoGroupItem,
	getStatusIcon,
} from "../../src/views/agent-tree-items.js";

describe("getStatusIcon", () => {
	it("returns circle-filled with green color for running", () => {
		const icon = getStatusIcon("running");
		expect(icon.id).toBe("circle-filled");
		expect(icon.color?.id).toBe("testing.iconPassed");
	});

	it("returns circle-outline with gray color for created", () => {
		const icon = getStatusIcon("created");
		expect(icon.id).toBe("circle-outline");
		expect(icon.color?.id).toBe("disabledForeground");
	});

	it("returns check with green color for finished", () => {
		const icon = getStatusIcon("finished");
		expect(icon.id).toBe("check");
		expect(icon.color?.id).toBe("testing.iconPassed");
	});

	it("returns warning with red color for error", () => {
		const icon = getStatusIcon("error");
		expect(icon.id).toBe("warning");
		expect(icon.color?.id).toBe("testing.iconFailed");
	});
});

describe("RepoGroupItem", () => {
	it("has id set to repo:{repoPath}", () => {
		const item = new RepoGroupItem("/home/user/my-repo");
		expect(item.id).toBe("repo:/home/user/my-repo");
	});

	it("has contextValue set to repoGroup", () => {
		const item = new RepoGroupItem("/home/user/my-repo");
		expect(item.contextValue).toBe("repoGroup");
	});

	it("uses last path segment as label", () => {
		const item = new RepoGroupItem("/home/user/my-repo");
		expect(item.label).toBe("my-repo");
	});

	it("has collapsibleState Expanded", () => {
		const item = new RepoGroupItem("/home/user/my-repo");
		expect(item.collapsibleState).toBe(TreeItemCollapsibleState.Expanded);
	});

	it("has tooltip set to full repoPath", () => {
		const item = new RepoGroupItem("/home/user/my-repo");
		expect(item.tooltip).toBe("/home/user/my-repo");
	});

	it("stores repoPath property", () => {
		const item = new RepoGroupItem("/home/user/my-repo");
		expect(item.repoPath).toBe("/home/user/my-repo");
	});
});

describe("AgentTreeItem", () => {
	it("has id set to agent:{repoPath}::{agentName}", () => {
		const item = new AgentTreeItem("fix-bug", "/repo", "running");
		expect(item.id).toBe("agent:/repo::fix-bug");
	});

	it("has contextValue set to agentItem", () => {
		const item = new AgentTreeItem("fix-bug", "/repo", "running");
		expect(item.contextValue).toBe("agentItem");
	});

	it("has label set to agentName", () => {
		const item = new AgentTreeItem("fix-bug", "/repo", "running");
		expect(item.label).toBe("fix-bug");
	});

	it("has description set to truncated prompt when provided", () => {
		const longPrompt = "Fix the authentication bug in the login service handler module";
		const item = new AgentTreeItem("fix-bug", "/repo", "running", longPrompt);
		// 40 chars: "Fix the authentication bug in the login " + "..."
		expect(item.description).toBe("Fix the authentication bug in the login ...");
		expect((item.description as string).length).toBe(43); // 40 chars + "..."
	});

	it("has description as full prompt when short enough", () => {
		const shortPrompt = "Fix the bug";
		const item = new AgentTreeItem("fix-bug", "/repo", "running", shortPrompt);
		expect(item.description).toBe("Fix the bug");
	});

	it("has description 'Interactive session' when no prompt", () => {
		const item = new AgentTreeItem("fix-bug", "/repo", "running");
		expect(item.description).toBe("Interactive session");
	});

	it("has collapsibleState None", () => {
		const item = new AgentTreeItem("fix-bug", "/repo", "running");
		expect(item.collapsibleState).toBe(TreeItemCollapsibleState.None);
	});

	it("has iconPath set to status icon", () => {
		const item = new AgentTreeItem("fix-bug", "/repo", "running");
		expect(item.iconPath).toBeDefined();
		expect((item.iconPath as { id: string }).id).toBe("circle-filled");
	});

	it("has command to focus agent", () => {
		const item = new AgentTreeItem("fix-bug", "/repo", "running");
		expect(item.command).toEqual({
			command: "vscode-agentic.focusAgent",
			title: "Focus Agent",
			arguments: ["/repo", "fix-bug"],
		});
	});

	it("stores repoPath and agentName properties", () => {
		const item = new AgentTreeItem("fix-bug", "/repo", "running");
		expect(item.repoPath).toBe("/repo");
		expect(item.agentName).toBe("fix-bug");
	});
});
