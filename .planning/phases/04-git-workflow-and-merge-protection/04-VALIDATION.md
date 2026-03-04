---
phase: 4
slug: git-workflow-and-merge-protection
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-04
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.4 |
| **Config file** | `vitest.config.ts` |
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
| 04-01-01 | 01 | 0 | GIT-03 | unit | `npx vitest run test/unit/diff.service.test.ts -t "getChangedFiles" -x` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 0 | GIT-03 | unit | `npx vitest run test/unit/git-content.provider.test.ts -x` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 0 | GIT-03, GIT-04, AGENT-04 | unit | `npx vitest run test/unit/diff.commands.test.ts -x` | ❌ W0 | ⬜ pending |
| 04-01-04 | 01 | 0 | UI-05 | unit | `npx vitest run test/unit/agent-tree-items.test.ts -t "contextValue" -x` | ✅ partial | ⬜ pending |
| 04-02-01 | 02 | 1 | GIT-03 | unit | `npx vitest run test/unit/diff.service.test.ts -x` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 1 | GIT-03 | unit | `npx vitest run test/unit/diff.commands.test.ts -t "reviewChanges" -x` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 1 | GIT-04 | unit | `npx vitest run test/unit/diff.commands.test.ts -t "createPR" -x` | ❌ W0 | ⬜ pending |
| 04-03-02 | 03 | 1 | AGENT-04 | unit | `npx vitest run test/unit/diff.commands.test.ts -t "merge guard" -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/unit/diff.service.test.ts` — stubs for GIT-03, AGENT-04 (DiffService unit tests)
- [ ] `test/unit/git-content.provider.test.ts` — stubs for GIT-03 (TextDocumentContentProvider tests)
- [ ] `test/unit/diff.commands.test.ts` — stubs for GIT-03, GIT-04, AGENT-04 (command handler tests)
- [ ] Update `test/unit/agent-tree-items.test.ts` — new contextValue tests for UI-05

*Existing infrastructure covers framework — Vitest already configured and operational.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Diff editor opens in VS Code | GIT-03 | Requires VS Code UI interaction | 1. Create agent with branch changes 2. Click "Review Changes" 3. Verify diff editor opens |
| PR created on GitHub | GIT-04 | Requires GitHub auth + network | 1. Review changes 2. Click "Create PR" 3. Verify PR appears on GitHub |
| Merge button appears on tile | UI-05 | Requires TreeView rendering | 1. Create agent with diffs vs staging 2. Verify merge button visible in sidebar |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
