// Mock of VS Code API surfaces used by extension services
import { vi } from "vitest";

// Memento mock -- the core persistence API used by services
export function createMockMemento() {
	const store = new Map<string, unknown>();
	return {
		get: vi.fn((key: string, defaultValue?: unknown) => {
			return store.has(key) ? store.get(key) : defaultValue;
		}),
		update: vi.fn(async (key: string, value: unknown) => {
			store.set(key, value);
		}),
		keys: vi.fn(() => [...store.keys()]),
		// Expose store for test assertions
		_store: store,
	};
}

// Terminal mock factory -- creates mock terminal objects for tests
export function createMockTerminal(name: string) {
	return {
		name,
		show: vi.fn(),
		dispose: vi.fn(),
		exitStatus: undefined as { code: number | undefined; reason: number } | undefined,
		_setExitStatus(code: number | undefined, reason: number) {
			this.exitStatus = { code, reason };
		},
	};
}

// TerminalExitReason enum mock
export const TerminalExitReason = {
	Unknown: 0,
	Shutdown: 1,
	Process: 2,
	User: 3,
	Extension: 4,
};

// Window API mocks
export const window = {
	showInputBox: vi.fn(),
	showQuickPick: vi.fn(),
	showInformationMessage: vi.fn(),
	showWarningMessage: vi.fn(),
	showErrorMessage: vi.fn(),
	withProgress: vi.fn((_options: unknown, task: (progress: unknown) => Promise<unknown>) => {
		return task({ report: vi.fn() });
	}),
	createTerminal: vi.fn(),
	showTextDocument: vi.fn(),
	createTreeView: vi.fn(() => ({
		reveal: vi.fn(),
		dispose: vi.fn(),
		onDidChangeVisibility: vi.fn(),
	})),
	onDidCloseTerminal: vi.fn(),
	onDidChangeActiveTerminal: vi.fn(),
	terminals: [] as ReturnType<typeof createMockTerminal>[],
};

// Workspace API mocks
export const workspace = {
	workspaceFolders: undefined as unknown[] | undefined,
	updateWorkspaceFolders: vi.fn(),
	openTextDocument: vi.fn().mockResolvedValue({ uri: { fsPath: "/mock-doc" } }),
	getConfiguration: vi.fn(() => ({
		get: vi.fn(),
		update: vi.fn(),
	})),
	fs: {
		stat: vi.fn(),
		readFile: vi.fn(),
		writeFile: vi.fn(),
	},
};

// Commands API mock
export const commands = {
	registerCommand: vi.fn(),
	executeCommand: vi.fn(),
};

// URI mock
function parseUri(str: string) {
	try {
		const url = new URL(str);
		return {
			scheme: url.protocol.replace(/:$/, ""),
			authority: url.host,
			path: decodeURIComponent(url.pathname),
			query: url.search.replace(/^\?/, ""),
			fragment: url.hash.replace(/^#/, ""),
			fsPath: decodeURIComponent(url.pathname),
		};
	} catch {
		return { fsPath: str, scheme: "file", authority: "", path: str, query: "", fragment: "" };
	}
}

export const Uri = {
	file: vi.fn((path: string) => ({ fsPath: path, scheme: "file" })),
	parse: vi.fn((str: string) => parseUri(str)),
	joinPath: vi.fn((base: { fsPath: string }, ...pathSegments: string[]) => ({
		fsPath: [base.fsPath, ...pathSegments].join("/"),
		scheme: "file",
	})),
};

// ProgressLocation enum mock
export const ProgressLocation = {
	Notification: 15,
	SourceControl: 1,
	Window: 10,
};

// EventEmitter mock
export class EventEmitter<T> {
	event: (listener: (e: T) => void) => { dispose: () => void };
	private listeners: ((e: T) => void)[] = [];

	constructor() {
		this.event = (listener: (e: T) => void) => {
			this.listeners.push(listener);
			return {
				dispose: () => {
					const idx = this.listeners.indexOf(listener);
					if (idx >= 0) this.listeners.splice(idx, 1);
				},
			};
		};
	}

	fire(data: T): void {
		for (const listener of this.listeners) {
			listener(data);
		}
	}

	dispose(): void {
		this.listeners = [];
	}
}

// TreeItem mock
export class TreeItem {
	label?: string;
	collapsibleState?: number;
	constructor(label: string, collapsibleState?: number) {
		this.label = label;
		this.collapsibleState = collapsibleState;
	}
}

// TreeItemCollapsibleState enum mock
export const TreeItemCollapsibleState = {
	None: 0,
	Collapsed: 1,
	Expanded: 2,
};

// ThemeColor mock
export class ThemeColor {
	constructor(public id: string) {}
}

// ThemeIcon mock
export class ThemeIcon {
	constructor(
		public id: string,
		public color?: ThemeColor,
	) {}
}

// Environment API mocks
export const env = {
	clipboard: {
		writeText: vi.fn(),
		readText: vi.fn(),
	},
};

// Extensions mock
export const extensions = {
	getExtension: vi.fn(),
};
