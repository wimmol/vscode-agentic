import { describe, it, expect, vi } from "vitest";
import { getNonce } from "../../src/utils/nonce";

// Mock vscode.Webview
function createMockWebview() {
	return {
		asWebviewUri: vi.fn((uri: { fsPath: string }) => uri.fsPath),
		cspSource: "https://test.csp",
	};
}

// Mock vscode.Uri
const mockUri = {
	joinPath: (base: { fsPath: string }, ...segments: string[]) => ({
		fsPath: [base.fsPath, ...segments].join("/"),
	}),
};

// Dynamically import after mocking
vi.mock("vscode", () => ({
	Uri: {
		joinPath: (base: { fsPath: string }, ...segments: string[]) => ({
			fsPath: [base.fsPath, ...segments].join("/"),
		}),
	},
}));

describe("getWebviewHtml", () => {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	let getWebviewHtml: typeof import("../../src/ui/view")["getWebviewHtml"];

	beforeAll(async () => {
		const mod = await import("../../src/ui/view");
		getWebviewHtml = mod.getWebviewHtml;
	});

	function render() {
		const webview = createMockWebview();
		const extensionUri = { fsPath: "/ext" };
		return getWebviewHtml(webview as any, extensionUri as any);
	}

	it("contains CSP meta tag with nonce", () => {
		const html = render();
		expect(html).toContain('<meta http-equiv="Content-Security-Policy"');
		expect(html).toMatch(/nonce-[A-Za-z0-9]{32}/);
	});

	it("contains script tag referencing webview.js with nonce", () => {
		const html = render();
		expect(html).toMatch(/<script nonce="[A-Za-z0-9]{32}"/);
		expect(html).toContain("webview.js");
	});

	it("contains a div#root mount point", () => {
		const html = render();
		expect(html).toContain('<div id="root"></div>');
	});

	it("contains codicons CSS reference", () => {
		const html = render();
		expect(html).toContain("codicon.css");
	});

	it("contains dashboard.css reference", () => {
		const html = render();
		expect(html).toContain("dashboard.css");
	});
});
