---
phase: 1
slug: extension-foundation-and-git-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-04
---

# Phase 1 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.0 (unit) + @vscode/test-cli ^0.0.12 (integration) |
| **Config file** | `vitest.config.ts` (unit), `.vscode-test.mjs` (integration) -- Wave 0 installs |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test && npm run test:integration` |
| **Estimated runtime** | ~8 seconds (unit <5s, integration ~3s) |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test && npm run test:integration`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 8 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 0 | -- | infra | `npm test` | W0 | pending |
| 01-02-01 | 02 | 1 | GIT-01 | unit | `npx vitest run test/unit/repo-config.service.test.ts` | W0 | pending |
| 01-02-02 | 02 | 1 | GIT-01 | unit | `npx vitest run test/unit/repo-config.service.test.ts` | W0 | pending |
| 01-03-01 | 03 | 1 | GIT-02 | unit | `npx vitest run test/unit/worktree.service.test.ts` | W0 | pending |
| 01-03-02 | 03 | 1 | GIT-02 | unit | `npx vitest run test/unit/worktree-parser.test.ts` | W0 | pending |
| 01-04-01 | 04 | 2 | GIT-05 | unit | `npx vitest run test/unit/worktree.service.test.ts` | W0 | pending |
| 01-05-01 | 05 | 2 | GIT-06 | unit | `npx vitest run test/unit/worktree.service.test.ts` | W0 | pending |
| 01-05-02 | 05 | 2 | GIT-06 | unit | `npx vitest run test/unit/worktree.service.test.ts` | W0 | pending |
| 01-06-01 | 06 | 1 | PERF-04 | static | `npx vitest run test/unit/git.service.test.ts` | W0 | pending |
| 01-06-02 | 06 | 1 | GIT-01 | unit | `npx vitest run test/unit/gitignore.test.ts` | W0 | pending |

*Status: pending / green / red / flaky*

**Note on 01-06-01 (PERF-04):** The static analysis check for synchronous git calls is implemented inline within `test/unit/git.service.test.ts` as a dedicated test case that reads the source file and asserts no `execFileSync` or `spawnSync` calls exist. A dedicated `test/unit/perf-04.test.ts` is not needed -- the check lives alongside the other GitService tests.

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` -- with `vscode` alias pointing to mock file
- [ ] `.vscode-test.mjs` -- integration test config for @vscode/test-cli
- [ ] `test/__mocks__/vscode.ts` -- manual mock of VS Code API (Memento, window, workspace, commands)
- [ ] `test/unit/git.service.test.ts` -- skeleton with `vi.mock('node:child_process')` pattern (also hosts PERF-04 static check)
- [ ] `test/unit/worktree.service.test.ts` -- skeleton with mock GitService and mock Memento
- [ ] `test/unit/repo-config.service.test.ts` -- skeleton with mock Memento
- [ ] `test/unit/gitignore.test.ts` -- skeleton (uses real fs via `node:fs/promises` on temp dirs)
- [ ] `test/unit/worktree-parser.test.ts` -- skeleton for `parseWorktreeList` pure function
- [ ] `test/integration/extension.test.ts` -- minimal activation test skeleton
- [ ] Framework install: `npm install --save-dev vitest@^4.0.0 @vscode/test-cli@^0.0.12 @vscode/test-electron@^2.5.0`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Extension activates in VS Code | -- | Real runtime required | 1. `F5` launch extension dev host 2. Check extension is active in Extensions panel |

*All other phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 8s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
