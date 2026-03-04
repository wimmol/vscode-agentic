---
phase: 5
slug: session-persistence-and-agent-reuse
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-04
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.4 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | TERM-03 | unit | `npx vitest run test/unit/agent.service.test.ts -t "reconcileOnActivation"` | Exists (enhance) | ⬜ pending |
| 05-01-02 | 01 | 1 | TERM-03 | unit | `npx vitest run test/unit/agent.service.test.ts -t "lastFocused"` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | PERF-03 | unit | `npx vitest run test/unit/agent.service.test.ts -t "orphan"` | ❌ W0 | ⬜ pending |
| 05-01-04 | 01 | 1 | PERF-03 | unit | `npx vitest run test/unit/agent.service.test.ts -t "cross-reference"` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 1 | AGENT-03 | unit | `npx vitest run test/unit/agent.service.test.ts -t "focusAgent"` | Exists (enhance) | ⬜ pending |
| 05-02-02 | 02 | 1 | AGENT-03 | unit | `npx vitest run test/unit/terminal.service.test.ts -t "createTerminal"` | Exists (enhance) | ⬜ pending |
| 05-02-03 | 02 | 1 | PERF-03 | unit | `npx vitest run test/unit/agent.service.test.ts -t "reconcil"` | Exists (enhance) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] New test cases in `test/unit/agent.service.test.ts` — stubs for TERM-03 (lastFocused), PERF-03 (orphan cleanup, cross-reference)
- [ ] Enhanced test cases in `test/unit/terminal.service.test.ts` — covers AGENT-03 (--continue flag)
- [ ] Enhanced test cases in `test/unit/agent.service.test.ts` — covers AGENT-03 (restart detection via hasBeenRun)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Agent sidebar restored after VS Code restart | TERM-03 | Requires full VS Code restart | 1. Create agents 2. Close VS Code 3. Reopen 4. Verify sidebar shows agents with correct status |
| Claude Code --continue loads prior session | AGENT-03 | Requires real Claude Code CLI | 1. Run agent, complete task 2. Click finished agent tile 3. Verify Claude loads prior conversation |
| Orphan process killed on activation | PERF-03 | Requires real process lifecycle | 1. Force-kill VS Code while agent running 2. Reopen VS Code 3. Verify orphan process detected and cleaned up |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
