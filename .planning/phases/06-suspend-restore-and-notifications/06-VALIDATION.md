---
phase: 6
slug: suspend-restore-and-notifications
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-04
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | TERM-04 | unit | `npx vitest run src/services/agent.service.test.ts` | ✅ | ⬜ pending |
| 06-01-02 | 01 | 1 | TERM-04, TERM-05 | unit | `npx vitest run src/models/agent.test.ts` | ✅ | ⬜ pending |
| 06-02-01 | 02 | 2 | TERM-06 | unit | `npx vitest run src/services/terminal.service.test.ts` | ✅ | ⬜ pending |
| 06-02-02 | 02 | 2 | TERM-04, TERM-05 | unit | `npx vitest run src/views/agent-tree-items.test.ts` | ✅ | ⬜ pending |
| 06-02-03 | 02 | 2 | TERM-04, TERM-05 | unit | `npx vitest run src/views/agent-tree-provider.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Vitest is already configured, all test files exist from prior phases. Only the vscode mock needs `window.activeTerminal` property added (done inline in test setup).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| OS notification appears when background agent finishes | TERM-06 | VS Code notification API is mocked in tests; visual confirmation needed | 1. Create agent, focus a different terminal, wait for agent to finish. 2. Verify notification appears with "Show Agent" action button |
| Suspended agent icon in sidebar | TERM-04 | TreeView rendering is visual | 1. Suspend an agent. 2. Verify pause icon with muted color appears in sidebar |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
