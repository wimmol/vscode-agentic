---
phase: 4
slug: ui-polish-agentic-tab-folder-scope-sidebar-workspace-naming-root-navigation-buttons-smooth-rendering-without-glitches
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-07
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | WS-01 | unit | `npx vitest run test/unit/workspace.service.test.ts -t "creates workspace file"` | No -- Wave 0 | ⬜ pending |
| 04-01-02 | 01 | 1 | WS-02 | unit | `npx vitest run test/unit/workspace.service.test.ts -t "syncs folders"` | No -- Wave 0 | ⬜ pending |
| 04-01-03 | 01 | 1 | WS-03 | unit | `npx vitest run test/unit/workspace.service.test.ts -t "detects workspace"` | No -- Wave 0 | ⬜ pending |
| 04-01-04 | 01 | 1 | WS-04 | unit | `npx vitest run test/unit/workspace.service.test.ts -t "prompt reopen"` | No -- Wave 0 | ⬜ pending |
| 04-02-01 | 02 | 1 | ROOT-01 | unit | `npx vitest run test/unit/workspace.commands.test.ts -t "global root"` | No -- Wave 0 | ⬜ pending |
| 04-02-02 | 02 | 1 | ROOT-02 | unit | `npx vitest run test/unit/workspace.commands.test.ts -t "repo root"` | No -- Wave 0 | ⬜ pending |
| 04-02-03 | 02 | 1 | ROOT-03 | unit | `npx vitest run test/unit/sidebar-html.test.ts -t "root-folder"` | No -- Wave 0 | ⬜ pending |
| 04-03-01 | 03 | 2 | RENDER-01 | unit | `npx vitest run test/unit/sidebar-provider.test.ts -t "postMessage"` | No -- Wave 0 | ⬜ pending |
| 04-03-02 | 03 | 2 | RENDER-02 | unit | `npx vitest run test/unit/sidebar-provider.test.ts -t "initial render"` | Partial | ⬜ pending |
| 04-04-01 | 04 | 2 | SCOPE-01 | unit | `npx vitest run test/unit/agent.commands.test.ts -t "updateWorkspaceFolders"` | Yes | ⬜ pending |
| 04-04-02 | 04 | 2 | SCOPE-02 | unit | `npx vitest run test/unit/workspace.service.test.ts -t "scope sync"` | No -- Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/unit/workspace.service.test.ts` — stubs for WS-01, WS-02, WS-03, WS-04, SCOPE-02
- [ ] `test/unit/workspace.commands.test.ts` — stubs for ROOT-01, ROOT-02
- [ ] Update `test/unit/sidebar-html.test.ts` — stubs for ROOT-03
- [ ] Update `test/unit/sidebar-provider.test.ts` — stubs for RENDER-01, RENDER-02
- [ ] Update `test/__mocks__/vscode.ts` — add `workspace.workspaceFile` mock property

*Existing infrastructure covers SCOPE-01 (agent.commands.test.ts already exists).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Title bar shows "agentic (Workspace)" | WS-01 | VS Code window title not accessible via extension API | Open workspace file, verify title bar text |
| CSS transitions animate smoothly | RENDER-01 | Visual quality requires human judgment | Add/remove agent, verify fade-in/fade-out plays without flicker |
| Root button visual highlight | ROOT-03 | Active state styling requires visual check | Click global root, verify button highlight; click repo root, verify highlight switches |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
