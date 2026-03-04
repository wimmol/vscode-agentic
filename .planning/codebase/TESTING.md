# Testing Patterns

**Analysis Date:** 2026-03-04

## Test Framework

**Runner:**
- Vitest v3.2.4
- Config: `vitest.config.ts`

**Assertion Library:**
- Vitest built-in (`expect`) — no separate assertion library

**Run Commands:**
```bash
npm test               # Run all unit tests (vitest run)
npm run test:watch     # Watch mode (vitest)
npm run test:integration  # VS Code integration tests (vscode-test)
```

**Integration Test Runner:**
- `@vscode/test-cli` + `@vscode/test-electron` for integration tests
- Config: `.vscode-test.mjs`
- Integration tests run in a real VS Code instance

## Test File Organization

**Location:**
- Unit tests: `test/unit/` — separate from source, mirrors `src/` structure
- Integration tests: `test/integration/`
- Mocks: `test/__mocks__/`

**Naming:**
- `{source-file-name}.test.ts` — mirrors source filename exactly
- e.g., `src/services/agent.service.ts` → `test/unit/agent.service.test.ts`

**Structure:**
```
test/
├── __mocks__/
│   └── vscode.ts          # Manual mock for entire VS Code API
├── unit/
│   ├── agent.service.test.ts
│   ├── agent.commands.test.ts
│   ├── agent-tree-provider.test.ts
│   ├── agent-tree-items.test.ts
│   ├── branch-validation.test.ts
│   ├── diff.commands.test.ts
│   ├── diff.service.test.ts
│   ├── git-content.provider.test.ts
│   ├── git.service.test.ts
│   ├── gitignore.test.ts
│   ├── repo-config.service.test.ts
│   ├── sidebar.commands.test.ts
│   ├── terminal.service.test.ts
│   ├── workspace-switch.service.test.ts
│   ├── worktree-parser.test.ts
│   ├── worktree.commands.test.ts
│   └── worktree.service.test.ts
└── integration/
    └── extension.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockMemento, _clearConfig } from "../__mocks__/vscode.js";
import { AgentService } from "../../src/services/agent.service.js";

describe("AgentService", () => {
    let service: AgentService;
    let state: ReturnType<typeof createMockMemento>;

    beforeEach(() => {
        vi.clearAllMocks();   // Always first in beforeEach
        state = createMockMemento();
        service = new AgentService(state, worktreeService as never);
    });

    afterEach(() => {
        _clearConfig();       // Clear VS Code config mock store
    });

    describe("createAgent", () => {
        it("persists a new AgentEntry with status 'created'", async () => {
            const entry = await service.createAgent("/repo", "test-agent");
            expect(entry.status).toBe("created");
        });
    });
});
```

**Patterns:**
- `vi.clearAllMocks()` is called first in every `beforeEach`
- Config mock store is cleared with `_clearConfig()` in `afterEach` when tests set config values
- Nested `describe` blocks group tests by method name
- `it()` descriptions follow: verb + expected outcome (e.g., "returns false when...", "calls X when...")
- `afterEach` with `vi.useRealTimers()` when `vi.useFakeTimers()` is used

## Mocking

**Framework:** Vitest (`vi.fn()`, `vi.mock()`, `vi.spyOn()`, `vi.hoisted()`)

**VS Code API Mock:**
- Single manual mock at `test/__mocks__/vscode.ts`
- Aliased via `vitest.config.ts` — all `import * as vscode from "vscode"` resolves to this mock
- Exports: `window`, `workspace`, `commands`, `Uri`, `EventEmitter`, `TreeItem`, `ThemeIcon`, `ThemeColor`, `ProgressLocation`, `TerminalExitReason`, `env`, `extensions`
- Factory functions exported for stateful mocks: `createMockMemento()`, `createMockTerminal(name)`
- Config store helpers exported: `_setConfigValue(key, value)`, `_clearConfig()`

**Service Mock Pattern:**
```typescript
// Create typed mock factory functions per test file
function createMockWorktreeService() {
    return {
        addWorktree: vi.fn().mockResolvedValue({
            path: "/repo/.worktrees/test-agent",
            branch: "test-agent",
            agentName: "test-agent",
            repoPath: "/repo",
            createdAt: new Date().toISOString(),
        }),
        removeWorktree: vi.fn().mockResolvedValue(undefined),
        getManifest: vi.fn().mockReturnValue([...]),
    };
}
```

**Module Mock Pattern (for node built-ins):**
```typescript
// Use vi.hoisted() to ensure mock function is available before vi.mock() factory runs
const { mockExecFile } = vi.hoisted(() => ({
    mockExecFile: vi.fn(),
}));

vi.mock("node:child_process", () => ({
    execFile: mockExecFile,
}));
```

**Spy Pattern:**
```typescript
// Spy on process.kill for process-level operations
const killSpy = vi.spyOn(process, "kill").mockImplementation(() => true);
// ...assertions...
killSpy.mockRestore(); // Always restore spies
```

**What to Mock:**
- All VS Code API surfaces (`vscode.*`)
- Service dependencies passed via constructor (never construct real services)
- Node built-ins that perform I/O (`node:child_process`, `node:fs`)
- External CLI processes (`git`, `claude`)

**What NOT to Mock:**
- Pure utility functions (`isValidBranchName`, `parseWorktreeList`, `truncate`)
- Data models (interfaces, type aliases)
- The subject under test itself

**Type-Casting Mocks:**
```typescript
// Cast mock services to `never` to satisfy TypeScript without full interface implementation
service = new AgentService(state, worktreeService as never);
```

## Fixtures and Factories

**Test Data Pattern:**
```typescript
// Factory functions return fully-shaped objects with sensible defaults + overrides
function makeEntry(overrides: Partial<WorktreeEntry> = {}): WorktreeEntry {
    return {
        path: "/repo/.worktrees/agent-1",
        branch: "agent-1",
        agentName: "agent-1",
        repoPath: "/repo",
        createdAt: "2026-01-01T00:00:00.000Z",
        ...overrides,
    };
}

function makeAgent(
    agentName: string,
    repoPath: string,
    status: AgentEntry["status"],
    initialPrompt?: string,
): AgentEntry {
    return {
        agentName,
        repoPath,
        status,
        initialPrompt,
        createdAt: new Date().toISOString(),
    };
}
```

**Constants for Repeated Values:**
```typescript
const REPO_PATH = "/repo";
const AGENT_BRANCH = "agent/test-agent";
const STAGING_BRANCH = "staging";
const mockConfig: RepoConfig = { path: REPO_PATH, stagingBranch: STAGING_BRANCH };
```

**Location:**
- No shared fixture files — factories are defined inline per test file
- `createMockMemento()` and `createMockTerminal()` are shared utilities in `test/__mocks__/vscode.ts`

## Coverage

**Requirements:** Not explicitly configured — no coverage thresholds enforced

**View Coverage:**
```bash
npx vitest run --coverage  # If @vitest/coverage-v8 is added
```

## Test Types

**Unit Tests (`test/unit/`):**
- All services, commands, utils, views
- Run in Node.js environment (no VS Code runtime)
- VS Code API fully mocked via manual mock
- Fast, no I/O — all git/file operations mocked

**Integration Tests (`test/integration/`):**
- Located in `test/integration/extension.test.ts`
- Run via `vscode-test` in real VS Code Electron instance
- Uses `suite()`/`test()` (Mocha API) instead of `describe()`/`it()`
- Uses `node:assert` instead of `expect`
- Currently minimal — one smoke test for extension activation

## Common Patterns

**Async Testing:**
```typescript
// Standard async/await for Promise-returning methods
it("creates a new agent", async () => {
    const entry = await service.createAgent("/repo", "test-agent");
    expect(entry.status).toBe("created");
});

// vi.waitFor() for fire-and-forget async (e.g., PID tracking)
await vi.waitFor(() => {
    const pidMap = mockState.get(PID_REGISTRY_KEY, {}) as Record<string, number>;
    expect(pidMap["/repo::test-agent"]).toBe(12345);
});
```

**Error Testing:**
```typescript
// Pattern 1: expect().rejects.toThrow() for simple error type checks
await expect(service.addWorktree("/repo", "agent-overflow")).rejects.toThrow(WorktreeLimitError);

// Pattern 2: try/catch with expect.unreachable() for property assertions on error
try {
    await service.createAgent("/repo", "agent-3");
    expect.unreachable("Expected AgentLimitError to be thrown");
} catch (err) {
    expect(err).toBeInstanceOf(AgentLimitError);
    const limitErr = err as AgentLimitError;
    expect(limitErr.limitType).toBe("per-repo");
    expect(limitErr.limit).toBe(2);
}
```

**Order-of-Operations Testing:**
```typescript
// Capture call order with a shared array
it("calls disposeTerminal before removeWorktree", async () => {
    const callOrder: string[] = [];
    terminalService.disposeTerminal.mockImplementation(() => {
        callOrder.push("disposeTerminal");
    });
    worktreeService.removeWorktree.mockImplementation(async () => {
        callOrder.push("removeWorktree");
    });

    await service.deleteAgent("/repo", "test-agent");

    expect(callOrder).toEqual(["disposeTerminal", "removeWorktree"]);
});
```

**Timer Testing:**
```typescript
// Use vi.useFakeTimers() for debounce / TTL cache tests
beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
    providerWithDiff.dispose();
});

it("recomputes after TTL expires", async () => {
    await provider.updateDiffStatusForAgent("/repo", "agent1");
    vi.advanceTimersByTime(31_000);  // Advance past 30s TTL
    await provider.updateDiffStatusForAgent("/repo", "agent1");
    expect(diffService.hasUnmergedChanges).toHaveBeenCalledTimes(2);
});
```

**Source Code Inspection Tests:**
```typescript
// Some tests read source files directly to assert implementation details
it("does NOT contain execFileSync or spawnSync", () => {
    const sourceFile = resolve(__dirname, "../../src/services/git.service.ts");
    const source = readFileSync(sourceFile, "utf-8");
    expect(source).not.toContain("execFileSync");
    expect(source).not.toContain("spawnSync");
});
```

**Debounce Testing (without fake timers):**
```typescript
// For debounced events, wait with real setTimeout
it("calls refresh when agentService fires onDidChangeAgents", async () => {
    const listener = vi.fn();
    provider.onDidChangeTreeData(listener);

    agentService._emitter.fire();

    // Wait for debounce delay (150ms) to elapse
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(listener).toHaveBeenCalled();
});
```

---

*Testing analysis: 2026-03-04*
