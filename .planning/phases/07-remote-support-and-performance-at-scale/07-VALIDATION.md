---
phase: 7
slug: remote-support-and-performance-at-scale
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-04
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~5 seconds |

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
| 07-01-01 | 01 | 1 | REMOTE-02 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 1 | REMOTE-02 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 1 | REMOTE-01, PERF-02 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 07-02-02 | 02 | 1 | PERF-02 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements.

*Vitest already configured with vscode mock, all test patterns established from prior phases.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Remote SSH agent management | REMOTE-01 | Requires actual VS Code Remote SSH connection | Connect via Remote SSH, create agent, verify terminal launches on remote |
| 5 concurrent agents responsiveness | PERF-02 | Requires multiple real terminal processes | Create 5 agents, verify sidebar remains responsive, switch between agents |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
