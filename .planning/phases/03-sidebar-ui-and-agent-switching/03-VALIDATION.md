---
phase: 3
slug: sidebar-ui-and-agent-switching
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-04
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.4 |
| **Config file** | vitest.config.ts |
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
| 03-01-01 | 01 | 1 | UI-01 | unit | `npx vitest run test/unit/agent-tree-provider.test.ts -x` | No - Wave 0 | ⬜ pending |
| 03-01-02 | 01 | 1 | UI-01 | unit | `npx vitest run test/unit/agent-tree-provider.test.ts -x` | No - Wave 0 | ⬜ pending |
| 03-01-03 | 01 | 1 | UI-02 | unit | `npx vitest run test/unit/agent-tree-item.test.ts -x` | No - Wave 0 | ⬜ pending |
| 03-01-04 | 01 | 1 | UI-02 | unit | `npx vitest run test/unit/agent-tree-item.test.ts -x` | No - Wave 0 | ⬜ pending |
| 03-02-01 | 02 | 1 | UI-03 | unit | `npx vitest run test/unit/sidebar.commands.test.ts -x` | No - Wave 0 | ⬜ pending |
| 03-02-02 | 02 | 1 | UI-04 | unit | `npx vitest run test/unit/sidebar.commands.test.ts -x` | No - Wave 0 | ⬜ pending |
| 03-01-05 | 01 | 1 | UI-01 | manual-only | N/A - declarative package.json | N/A | ⬜ pending |
| 03-01-06 | 01 | 1 | UI-01 | manual-only | N/A - declarative package.json | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/unit/agent-tree-provider.test.ts` — stubs for UI-01 (TreeDataProvider children, grouping, sorting, refresh)
- [ ] `test/unit/agent-tree-item.test.ts` — stubs for UI-02 (TreeItem properties, status icons, description)
- [ ] `test/unit/sidebar.commands.test.ts` — stubs for UI-03/UI-04 (click handling, same-repo vs cross-repo)
- [ ] Update `test/__mocks__/vscode.ts` — add ThemeIcon constructor mock, ThemeColor mock, workspace.updateWorkspaceFolders mock, commands.executeCommand mock enhancements

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Welcome content shown when no agents exist | UI-01 | Declarative package.json, verified visually | Open extension with no agents, verify welcome message appears |
| Context menus and inline actions appear correctly | UI-01 | Declarative package.json, verified visually | Right-click agent tile, verify Delete/Copy Branch options; hover to verify trash icon |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
