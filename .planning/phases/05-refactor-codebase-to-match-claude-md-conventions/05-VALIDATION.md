---
phase: 5
slug: refactor-codebase-to-match-claude-md-conventions
status: draft
nyquist_compliant: true
wave_0_complete: true
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
| 5-01-01 | 01 | 1 | React build infra | config + build | `npm run compile && test -f dist/webview.js` | N/A | pending |
| 5-01-02 | 01 | 1 | AgentsStore + ReposStore | unit (TDD) | `npx vitest run test/unit/agents-store.test.ts test/unit/repos-store.test.ts` | Created in task | pending |
| 5-02-01 | 02 | 2 | React atoms + hooks + types | build | `npm run compile` | N/A | pending |
| 5-02-02 | 02 | 2 | React components + HTML shell | unit + build | `npx vitest run test/unit/view.test.ts` | Created in task | pending |
| 5-03-01 | 03 | 2 | Agent feature files + terminal util | build | `npm run compile` | N/A | pending |
| 5-03-02 | 03 | 2 | Repo features + fs migration + feature tests | unit | `npx vitest run test/unit/create-agent.test.ts test/unit/delete-agent.test.ts test/unit/add-repo.test.ts` | Created in task | pending |
| 5-04-01 | 04 | 3 | Rewire extension.ts + sidebar-provider | build | `npm run compile` | N/A | pending |
| 5-04-02 | 04 | 3 | Delete old files + update tests | unit + build | `npm run compile && npx vitest run` | Updated in task | pending |
| 5-04-03 | 04 | 3 | Human verification | manual | Human confirms 12 verification steps | N/A | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

All Wave 0 test files are created within their respective plan tasks:

- [x] `vitest.config.ts` — updated for TSX in Plan 01 Task 1
- [x] `test/unit/agents-store.test.ts` — created in Plan 01 Task 2 (TDD)
- [x] `test/unit/repos-store.test.ts` — created in Plan 01 Task 2 (TDD)
- [x] `test/unit/view.test.ts` — created in Plan 02 Task 2
- [x] `test/unit/create-agent.test.ts` — created in Plan 03 Task 2
- [x] `test/unit/delete-agent.test.ts` — created in Plan 03 Task 2
- [x] `test/unit/add-repo.test.ts` — created in Plan 03 Task 2
- [x] Update `test/unit/gitignore.test.ts` — updated in Plan 04 Task 2
- [x] Update `test/unit/workspace.service.test.ts` — updated in Plan 04 Task 2

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Webview renders correctly | React migration | VS Code webview requires runtime | Open sidebar, verify agent tiles and repo sections render |
| Theme variable integration | CSS migration | Requires visual confirmation | Switch between light/dark themes, verify no broken colors |
| Timer updates live | useElapsedTime hook | Requires running agent | Start an agent, verify elapsed timer increments |

---

## Nyquist Compliance Check

- [x] All tasks have `<automated>` verify commands
- [x] No 3 consecutive tasks without automated test feedback (Plans 02/03 now include unit tests)
- [x] Wave 0 test files are created within their respective plans (not deferred)
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
