import { vi } from "vitest";

// EventEmitter mock -- real listener-array implementation for subscription tests
export class EventEmitter<T> {
	private listeners: Array<(e: T) => void> = [];

	event = (listener: (e: T) => void): { dispose: () => void } => {
		this.listeners.push(listener);
		return {
			dispose: () => {
				const idx = this.listeners.indexOf(listener);
				if (idx >= 0) {
					this.listeners.splice(idx, 1);
				}
			},
		};
	};

	fire(data: T): void {
		for (const listener of this.listeners) {
			listener(data);
		}
	}

	dispose(): void {
		this.listeners = [];
	}
}

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

// Terminal mock factory -- creates a mock terminal object tests can use
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
	onDidCloseTerminal: vi.fn(),
	onDidChangeActiveTerminal: vi.fn(),
	registerWebviewViewProvider: vi.fn(),
	terminals: [] as ReturnType<typeof createMockTerminal>[],
};

// Workspace API mocks
export const workspace = {
	workspaceFolders: undefined as unknown[] | undefined,
	getConfiguration: vi.fn(() => ({
		get: vi.fn(),
		update: vi.fn(),
	})),
	updateWorkspaceFolders: vi.fn(() => true),
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
export const Uri = {
	file: vi.fn((path: string) => ({ fsPath: path, scheme: "file" })),
	parse: vi.fn((str: string) => ({ fsPath: str, scheme: "file" })),
	joinPath: vi.fn((...parts: Array<string | { fsPath: string }>) => ({
		fsPath: parts.map((p) => (typeof p === "string" ? p : p.fsPath)).join("/"),
		scheme: "file",
	})),
};

// ProgressLocation enum mock
export const ProgressLocation = {
	Notification: 15,
	SourceControl: 1,
	Window: 10,
};

// TerminalExitReason enum mock
export const TerminalExitReason = {
	Unknown: 0,
	Shutdown: 1,
	Process: 2,
	User: 3,
	Extension: 4,
};
