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
};

// Workspace API mocks
export const workspace = {
	workspaceFolders: undefined as unknown[] | undefined,
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
export const Uri = {
	file: vi.fn((path: string) => ({ fsPath: path, scheme: "file" })),
	parse: vi.fn((str: string) => ({ fsPath: str, scheme: "file" })),
};

// ProgressLocation enum mock
export const ProgressLocation = {
	Notification: 15,
	SourceControl: 1,
	Window: 10,
};
