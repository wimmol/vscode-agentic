---
phase: 2
slug: agent-lifecycle-terminal-mgmt
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-04
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.4 |
| **Config file** | `vitest.config.ts` (exists, includes `test/unit/**/*.test.ts`) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | AGENT-01 | unit | `npx vitest run test/unit/agent.service.test.ts -t "createAgent"` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | AGENT-02 | unit | `npx vitest run test/unit/agent.service.test.ts -t "deleteAgent"` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | AGENT-05 | unit | `npx vitest run test/unit/agent.service.test.ts -t "status"` | ❌ W0 | ⬜ pending |
| 02-01-04 | 01 | 1 | PERF-01 | unit | `npx vitest run test/unit/agent.service.test.ts -t "lazy"` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | TERM-01 | unit | `npx vitest run test/unit/terminal.service.test.ts -t "createTerminal"` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | TERM-01 | unit | `npx vitest run test/unit/terminal.service.test.ts -t "handleTerminalClose"` | ❌ W0 | ⬜ pending |
| 02-02-03 | 02 | 1 | TERM-02 | unit | `npx vitest run test/unit/terminal.service.test.ts -t "concurrent"` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | AGENT-01 | unit | `npx vitest run test/unit/agent.commands.test.ts -t "createAgent"` | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 2 | AGENT-02 | unit | `npx vitest run test/unit/agent.commands.test.ts -t "deleteAgent"` | ❌ W0 | ⬜ pending |
| 02-03-03 | 03 | 2 | N/A | unit | `npx vitest run test/unit/branch-validation.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/unit/agent.service.test.ts` — stubs for AGENT-01, AGENT-02, AGENT-05, PERF-01
- [ ] `test/unit/terminal.service.test.ts` — stubs for TERM-01, TERM-02
- [ ] `test/unit/agent.commands.test.ts` — stubs for AGENT-01 command flow, AGENT-02 command flow
- [ ] `test/unit/branch-validation.test.ts` — stubs for branch name validation utility
- [ ] `test/__mocks__/vscode.ts` — extend with: `window.createTerminal`, `window.onDidCloseTerminal`, `window.onDidChangeActiveTerminal`, `window.terminals`, `window.showWarningMessage` modal support, `TerminalExitReason` enum, `TerminalExitStatus` interface

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Claude Code CLI launches in terminal | TERM-01 | Requires real VS Code terminal | 1. Run "Create Agent" command 2. Focus agent 3. Verify `claude` process in terminal |
| Multiple agents run concurrently | TERM-02 | Requires real VS Code terminals + processes | 1. Create 2+ agents 2. Focus each to launch 3. Verify independent terminals |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
