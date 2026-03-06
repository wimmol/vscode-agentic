---
phase: 3
slug: agent-dashboard-ui-with-tiles-buttons-and-pickers
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-06
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 0 | -- | unit | `npx vitest run test/unit/sidebar-provider.test.ts` | No -- Wave 0 | ⬜ pending |
| 03-01-02 | 01 | 0 | -- | unit | `npx vitest run test/unit/sidebar-html.test.ts` | No -- Wave 0 | ⬜ pending |
| 03-01-03 | 01 | 0 | -- | unit | `npx vitest run test/unit/agent.service.test.ts` | Exists -- needs update | ⬜ pending |
| 03-02-01 | 02 | 1 | UI-01 | unit | `npx vitest run test/unit/sidebar-provider.test.ts` | No -- Wave 0 | ⬜ pending |
| 03-02-02 | 02 | 1 | UI-02 | unit | `npx vitest run test/unit/sidebar-html.test.ts` | No -- Wave 0 | ⬜ pending |
| 03-02-03 | 02 | 1 | UI-04 | unit | `npx vitest run test/unit/sidebar-provider.test.ts` | No -- Wave 0 | ⬜ pending |
| 03-03-01 | 03 | 1 | -- | unit | `npx vitest run test/unit/sidebar-html.test.ts` | No -- Wave 0 | ⬜ pending |
| 03-03-02 | 03 | 1 | -- | unit | `npx vitest run test/unit/sidebar-html.test.ts` | No -- Wave 0 | ⬜ pending |
| 03-03-03 | 03 | 1 | -- | unit | `npx vitest run test/unit/sidebar-html.test.ts` | No -- Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/unit/sidebar-provider.test.ts` — stubs for SidebarViewProvider (resolveWebviewView, message handling, refresh)
- [ ] `test/unit/sidebar-html.test.ts` — stubs for HTML generation, tile rendering, status icons, disabled states, CSP
- [ ] Update `test/unit/agent.service.test.ts` — add tests for EventEmitter (onDidChange fires on mutations)
- [ ] Update `test/__mocks__/vscode.ts` — add mock for `window.registerWebviewViewProvider`, `EventEmitter`, `Uri.joinPath`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Commands hidden from palette | UI-06 | VS Code runtime behavior | Verify `"when": "false"` in package.json menus |
| Theme adaptation (dark/light) | -- | Visual rendering | Open extension in both dark and light themes, verify readability |
| Animated spinner for running status | -- | CSS animation visual | Create an agent, verify spinner animates in sidebar |
| Tile click focuses terminal | UI-04 | Terminal focus behavior | Click agent tile, verify correct terminal gains focus |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
