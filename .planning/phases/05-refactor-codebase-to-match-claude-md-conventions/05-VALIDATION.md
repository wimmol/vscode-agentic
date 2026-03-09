---
phase: 5
slug: refactor-codebase-to-match-claude-md-conventions
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green + `npm run compile` clean
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 0 | Test infra | config | `npx vitest run` | ❌ W0 | ⬜ pending |
| 5-01-02 | 01 | 0 | AgentsStore | unit | `npx vitest run test/unit/agents-store.test.ts` | ❌ W0 | ⬜ pending |
| 5-01-03 | 01 | 0 | ReposStore | unit | `npx vitest run test/unit/repos-store.test.ts` | ❌ W0 | ⬜ pending |
| 5-02-01 | 02 | 1 | React build | build | `npm run compile` | N/A | ⬜ pending |
| 5-02-02 | 02 | 1 | Webview HTML shell | unit | `npx vitest run test/unit/view.test.ts` | ❌ W0 | ⬜ pending |
| 5-03-01 | 03 | 1 | Feature: create-agent | unit | `npx vitest run test/unit/create-agent.test.ts` | ❌ W0 | ⬜ pending |
| 5-03-02 | 03 | 1 | Feature: delete-agent | unit | `npx vitest run test/unit/delete-agent.test.ts` | ❌ W0 | ⬜ pending |
| 5-03-03 | 03 | 1 | Feature: add-repo | unit | `npx vitest run test/unit/add-repo.test.ts` | ❌ W0 | ⬜ pending |
| 5-04-01 | 04 | 2 | gitignore migrated | unit | `npx vitest run test/unit/gitignore.test.ts` | ✅ (needs update) | ⬜ pending |
| 5-04-02 | 04 | 2 | workspace.service migrated | unit | `npx vitest run test/unit/workspace.service.test.ts` | ✅ (needs update) | ⬜ pending |
| 5-05-01 | 05 | 2 | Settings | unit | `npx vitest run test/unit/settings.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — configure to handle `.tsx` files and JSX
- [ ] `test/unit/agents-store.test.ts` — stubs for thin store CRUD
- [ ] `test/unit/repos-store.test.ts` — stubs for thin store CRUD
- [ ] `test/unit/create-agent.test.ts` — replaces agent.commands.test.ts + agent.service.test.ts portions
- [ ] `test/unit/delete-agent.test.ts` — replaces portions of above
- [ ] `test/unit/add-repo.test.ts` — replaces repo.commands.test.ts + repo-config.service.test.ts portions
- [ ] `test/unit/view.test.ts` — covers new HTML shell (replaces sidebar-html.test.ts)
- [ ] Update `test/unit/gitignore.test.ts` — mock vscode.workspace.fs instead of node:fs
- [ ] Update `test/unit/workspace.service.test.ts` — mock vscode.workspace.fs instead of node:fs

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Webview renders correctly | React migration | VS Code webview requires runtime | Open sidebar, verify agent tiles and repo sections render |
| Theme variable integration | CSS migration | Requires visual confirmation | Switch between light/dark themes, verify no broken colors |
| Timer updates live | useElapsedTime hook | Requires running agent | Start an agent, verify elapsed timer increments |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
