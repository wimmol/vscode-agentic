# Project Research Summary

**Project:** VS Code Agentic — Multi-Repo Multi-Agent Workspace Manager
**Domain:** VS Code extension for orchestrating Claude Code CLI agents across git worktrees
**Researched:** 2026-03-04
**Confidence:** HIGH

## Executive Summary

VS Code Agentic is a VS Code extension that acts as an orchestration layer for Claude Code CLI agents, not a Claude Code wrapper or chat UI replacement. The critical context is that VS Code 1.107-1.109 shipped its own native multi-agent platform (Agent HQ) with background agents and worktree isolation, and Anthropic's official Claude Code extension already provides sidebar panels and multiple conversation tabs. This extension must carve a distinct niche: the tight coupling of agent lifecycle, git worktree management, and PR workflow across multiple repositories — a specific end-to-end workflow that no existing tool handles end-to-end. The competitive moat is cross-repo context switching, agent-aware PR workflow, and suspend/restore — none of which VS Code Agent HQ, Cline, or Roo Code provide.

The recommended approach is a service-event architecture built entirely on VS Code's native APIs: TreeView for the agent sidebar, real terminals (not Pseudoterminals) for Claude Code sessions, a thin `child_process` wrapper for git operations, and VS Code's Memento API for persistence. The stack is intentionally lean — no React, no external state management libraries, no git abstraction libraries. The architecture's five-layer build order (Foundation → Core Services → Domain Services → UI Layer → Integration) keeps components independently testable and prevents the spaghetti coupling that kills complex extensions at this scale.

The dominant risks are process lifecycle hazards: terminal output is opaque (no stdout capture via the terminal API — by VS Code design), agent processes can survive VS Code shutdown as orphans, and automated worktree creation can explode into hundreds of worktrees consuming gigabytes of disk (documented real incident: VS Code Copilot created 1,526 worktrees consuming ~800 GB in 16 hours). Every architectural decision in Phase 1 must account for these constraints — they cannot be retrofitted. Memory management via lazy terminal creation and avoiding `retainContextWhenHidden` on webviews is equally non-negotiable given Claude Code's own documented 11.6 GB per-window memory issues.

## Key Findings

### Recommended Stack

The extension requires zero production dependencies — VS Code's extension API provides everything needed at runtime. The dev toolchain is TypeScript 5.6+, esbuild for bundling (two targets: Node/CJS for extension host, browser/ESM for webviews), and a testing split between Mocha + `@vscode/test-cli` for VS Code API integration tests and Vitest for pure logic unit tests. Target engine `^1.96.0` in `package.json` to cover 95%+ of users without requiring VS Code 1.109+.

**Core technologies:**
- TypeScript 5.6+: extension language — required, type safety essential for complex multi-service state management
- VS Code Extension API `^1.96.0`: all terminal, TreeView, webview, SCM, workspace APIs — broadest compatibility baseline
- esbuild `^0.24.0`: bundler — 10-100x faster than webpack, now the official VS Code scaffolding default
- `@vscode-elements/elements` v2.5: webview UI components — replaces deprecated `@vscode/webview-ui-toolkit` (sunset Jan 2025)
- `child_process.execFile` (Node built-in): git CLI wrapper — simpler than simple-git, zero deps, full worktree support
- VS Code TreeView API (native): agent sidebar — zero-dependency, native UX, zero bundle size cost
- `vscode.window.createTerminal()` (real terminals): agent sessions — survives window reloads, unlike Pseudoterminal
- `ExtensionContext.workspaceState` + EventEmitter: state management — no external library needed at this scale
- `@vscode/test-cli` + Mocha: VS Code API integration tests
- Vitest 3+: pure logic unit tests (GitService parsing, state management, utilities)

### Expected Features

See `FEATURES.md` for the full competitive positioning table and feature dependency graph.

**Must have (table stakes):**
- Agent session creation (name agent, create worktree + branch, launch Claude Code CLI terminal)
- Agent tile sidebar (TreeView grouped by repo, status indicators, unread badges)
- One-click agent switching (same-repo: switch terminal + editor; cross-repo: switch full IDE context)
- Multiple concurrent agents (2-5 simultaneously via git worktree isolation)
- Agent lifecycle management (create, restart, delete with worktree cleanup and merge protection)
- Per-repo configuration (staging branch name, default settings)
- Persistent sessions across VS Code restarts (agent metadata + terminal reconnection)
- OS notifications when agent finishes or needs input

**Should have (competitive differentiators):**
- Cross-repo context switching — full IDE context swap; no existing tool does this
- Agent-to-staging PR workflow — diff view + merge button tied to agent lifecycle
- Merge protection — prevent deletion of agents with unmerged changes
- Suspend/restore — kill process to free RAM, restore in same worktree context on demand
- Agent resource monitoring — per-agent memory/CPU for users running 5+ agents
- Intelligent layout management — auto-arrange IDE panels for agent workflow

**Defer (v2+):**
- Multi-provider support (Copilot, Cline, Codex) — scope creep, each provider has different CLI interfaces
- Task queuing/scheduling — no user demand evidence, adds state machine complexity
- Built-in chat/conversation UI — Claude Code extension already does this better
- Real-time inter-agent communication — architectural complexity, race conditions, no clear use case
- GitHub/GitLab API integration for PR creation — GitHub PRs extension (20M installs) already covers this

### Architecture Approach

The recommended architecture is a 5-layer service-event system where services own domains and communicate exclusively via typed `vscode.EventEmitter` events — no direct cross-service method calls except at construction-time dependency injection. `AgentManager` is the single source of truth for agent state, firing events that `TerminalManager`, `AgentTreeProvider`, and `LayoutManager` react to independently. Terminals are created lazily (only on first focus) and disposed on suspend. All state persists through VS Code's Memento API. The extension entry point (`extension.ts`) stays under 50 lines — it only bootstraps the service container and registers disposables.

**Major components:**
1. `AgentManager` — agent CRUD, lifecycle state machine, single source of truth for all agent state
2. `WorktreeManager` — git worktree create/list/remove via thin `child_process.execFile` wrapper
3. `TerminalManager` — lazy terminal pool, terminal-to-agent mapping, show/hide/dispose lifecycle
4. `GitService` — branch operations, diff detection, merge status checks via typed git CLI wrapper
5. `AgentTreeProvider` — `TreeDataProvider<AgentTreeItem>` rendering agents grouped by repo
6. `LayoutManager` — orchestrates editor splits, workspace folder switches, panel focus on agent switching
7. `StateStore` — Memento-backed persistence with in-memory cache
8. `ConfigService` — per-repo and global extension settings

Build order respects hard dependencies: models/utils first (zero VS Code API coupling), then core services (minimal API surface), then domain services (AgentManager, TerminalManager), then UI layer (providers, layout), then integration wiring (`container.ts`, `extension.ts`). Each layer is independently testable.

### Critical Pitfalls

1. **Terminal output is opaque** — `terminal.sendText()` provides no stdout capture mechanism; this is closed as by-design in VS Code (issue #59384). Any design that reads terminal output to detect agent status or task completion fails fundamentally. Use `child_process.spawn()` for process management; use the VS Code terminal purely as a display layer.

2. **Orphan processes survive extension shutdown** — VS Code gives `deactivate()` only 4-5 seconds before forcible termination. Child processes not in tracked process groups become zombies. Prevention: PID file tracking on disk, `tree-kill` for process tree cleanup, and a "cleanup on activation" pattern that kills stale PIDs from previous sessions.

3. **Worktree explosion without cleanup** — automated worktree creation without hard limits creates runaway disk consumption. Documented incident: VS Code Copilot background agent created 1,526 worktrees consuming ~800 GB in 16 hours (issue #296194). Prevention: hard cap (e.g., 10 per repo), manifest tracking in extension state, reconcile against `git worktree list` on every activation, never create in retry/error loops.

4. **`retainContextWhenHidden` memory trap** — each retained webview holds its full DOM + JavaScript heap alive in memory. With 5-10 agent panels retained, this reaches 10+ GB (Claude Code's own extension had a documented 11.6 GB leak per conversation window). Prevention: use `getState()`/`setState()` for webview persistence instead, store authoritative state in extension host, implement webview pooling.

5. **Synchronous git operations block the extension host** — `execSync()` for git commands freezes the entire VS Code UI on large repos. Prevention: always async `execFile()` wrapped in Promises with timeouts. Non-negotiable from day one.

## Implications for Roadmap

The five-layer architecture build order maps directly to a natural phase structure. Dependencies are hard: you cannot build agent switching without the sidebar, cannot build the sidebar without the state layer, cannot build git workflow without the worktree layer. FEATURES.md phase recommendations align closely with architecture build order.

### Phase 1: Foundation and Core Agent Lifecycle

**Rationale:** Architecture research identifies a strict build order — models and utilities must exist before services, services before UI. Pitfalls research confirms that process lifecycle architecture (orphan prevention, terminal opacity, worktree limits) cannot be retrofitted. Features research designates this as "table stakes" without which the product feels broken or incomplete.

**Delivers:** A working extension where users can create agents, see them in the sidebar, switch between agents within the same repo, and delete them cleanly. The full process lifecycle is correct from day one: lazy terminals, PID tracking, worktree hard limits, worktree reconciliation on activation.

**Addresses features:** Agent session creation, agent tile sidebar (TreeView), one-click same-repo agent switching, agent lifecycle management (create/delete), per-repo configuration (staging branch name), basic status indicators.

**Avoids pitfalls:** Orphan processes (PID tracking + tree-kill pattern), worktree explosion (hard limits + manifest), terminal opacity (child_process for process management not terminal API), `*` activation event (use `onView:agentSidebar`), synchronous git operations (async `execFile` throughout).

**Architecture components built:** Foundation layer (models, types, constants, git-cli utils), Core Services (StateStore, GitService, ConfigService), Domain Services (WorktreeManager, TerminalManager, AgentManager), UI Layer (AgentTreeProvider, AgentTreeItem views).

### Phase 2: Full Git Workflow and Cross-Repo Switching

**Rationale:** Depends on Phase 1 state layer and agent lifecycle being stable. Cross-repo switching requires `workspace.updateWorkspaceFolders()` — PITFALLS.md confirms this must only be called on repo switches, not same-repo agent switches, requiring the same-repo/cross-repo distinction established in Phase 1 to be solid. PR workflow requires production-quality GitService diff detection. Any webview panels introduced here must use `getState()`/`setState()` from the start to avoid the memory trap.

**Delivers:** Complete end-to-end workflow: create agent, agent does work, user reviews diff in VS Code's native diff editor, merge to staging branch. Full cross-repo context switching (file tree, terminal, editor all swap). Merge protection prevents accidental deletion of unmerged work. Agent reuse (restart finished agents in same worktree/branch).

**Addresses features:** Cross-repo context switching, agent-to-staging PR workflow, merge protection, agent reuse, OS notifications.

**Avoids pitfalls:** Multi-root workspace API confusion (use `workspaceFolders` not deprecated `rootPath`, handle `onDidChangeWorkspaceFolders`), terminal visibility API bugs (maintain own visibility state flags, don't rely on VS Code visibility APIs), webview message queueing for hidden panels, `retainContextWhenHidden` memory bloat.

**Architecture components built:** LayoutManager (editor splits, workspace folder management), enhanced GitService (diff detection, merge status), workspace folder orchestration in AgentManager.

### Phase 3: Reliability, Performance, and Scale

**Rationale:** Once the core workflow is correct, users push it to limits: 5+ agents, sustained use, Remote SSH. Git lock contention becomes critical with multiple concurrent agents per repo. Suspend/restore is explicitly flagged in PITFALLS.md as a Phase 3 concern — defer until basic lifecycle works. Persistent sessions across restarts require terminal reconnection logic that is only meaningful with a stable agent lifecycle. Remote SSH doubles all resource problems and should be validated here.

**Delivers:** Extension that holds up under real usage: sessions survive VS Code restarts, idle agents can be suspended to free RAM, concurrent agents don't create git lock collisions, OS notifications surface completed agents, resource monitoring shows per-agent memory usage, configurable limits for Remote SSH environments.

**Addresses features:** Suspend/restore, persistent sessions across restarts, agent resource monitoring, configurable resource limits for Remote SSH.

**Avoids pitfalls:** Session suspend/restore complexity (define as "new session in same context" not "perfect resume" — terminal scrollback is not capturable via VS Code API), git lock contention (per-repo operation queue, retry with backoff), Remote SSH resource exhaustion (configurable max agents/worktrees, test on Remote SSH before shipping), tree view refresh hammering (debounce to 500ms, targeted element refresh).

### Phase 4: Advanced UX and Power User Features

**Rationale:** FEATURES.md categorizes intelligent layout management and smart agent naming as polish. These have no hard dependencies blocking earlier phases and are "make power users faster" improvements, not core workflow. VS Code's Custom Layout API (`vscode.setEditorLayout`) is well-documented. These can be deferred or done in parallel if earlier phases slip.

**Delivers:** Preset layout auto-arrangement for the agent workflow, configurable branch naming patterns (`agent/{repo}/{name}`), any UX polish backlog from earlier phases.

**Addresses features:** Intelligent layout management, smart agent naming with branch convention.

### Phase Ordering Rationale

- Phase 1 must come first because every subsequent phase depends on the agent state model, TreeView sidebar, and worktree management being correct. The architectural layers cannot be reordered without creating forward dependencies.
- Phase 2 follows because cross-repo switching and git workflow are the primary competitive differentiators — they deserve full attention after scaffolding is proven. Building them second ensures AgentManager and GitService are production-quality foundations.
- Phase 3 is explicitly "after basic lifecycle works" per PITFALLS.md. Resource concerns (git lock contention, Remote SSH quotas) only become real constraints at scale, which users reach after Phase 2.
- Phase 4 is pure polish. No architectural dependency on Phase 3. Could move earlier if specific layout features become blockers, but no research evidence suggests they are table stakes.

### Research Flags

Phases likely needing deeper research during planning:

- **Phase 2 (Cross-repo switching):** `workspace.updateWorkspaceFolders()` has tricky edge cases — needs API research into exactly when it triggers extension host restarts and what state is preserved vs. lost. PITFALLS.md flags this as a hard architectural decision.
- **Phase 3 (Suspend/restore):** The exact capabilities of Claude Code's `--resume` flag are not fully documented in the research. Understanding what `--resume` actually restores (conversation history? working directory? both?) vs. what must be re-initialized determines the implementation approach.
- **Phase 3 (Git lock contention):** PITFALLS.md rates this MEDIUM confidence. The operation queue design depends on which git operations require shared locks vs. per-worktree locks. Needs validation against real concurrent agent usage patterns.

Phases with standard patterns (skip research-phase):

- **Phase 1 (Foundation + Core):** VS Code extension architecture is extremely well-documented with HIGH confidence official API documentation. The service-event pattern, TreeView API, terminal creation, and Memento persistence are all established. No research-phase needed.
- **Phase 4 (Layout + Polish):** VS Code's Custom Layout API is documented. Smart branch naming is a string sanitization problem. Standard patterns apply throughout.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All primary recommendations backed by official VS Code documentation and confirmed reference implementations. One MEDIUM item: `@vscode-elements/elements` is community-maintained without official backing, but the predecessor's deprecation is confirmed. |
| Features | MEDIUM-HIGH | Table stakes validated against real competitors (Cline, Roo Code, VS Code Agent HQ). Differentiators are inferred from gap analysis, not user research — "users will want this" confidence is MEDIUM. |
| Architecture | HIGH | Service-event pattern matches VS Code's own Git extension architecture. Build order derived from hard API dependencies. Specific implementation details may need adjustment during Phase 1. |
| Pitfalls | HIGH | Every critical pitfall backed by a specific VS Code GitHub issue or confirmed incident with data. Worktree explosion has real-world numbers (1,526 worktrees, ~800 GB). Memory leak has confirmed Claude Code issue reference. |

**Overall confidence:** HIGH

### Gaps to Address

- **Claude Code `--resume` flag scope:** PITFALLS.md references `claude --resume ${agent.sessionId}` for session restoration, but the exact capabilities of this flag are not fully documented in the research. Validate during Phase 3 implementation — this determines whether suspend/restore can offer meaningful context continuation or is purely "new session in same directory."

- **Real terminal vs. Pseudoterminal tension:** STACK.md recommends real terminals (survive reloads). PITFALLS.md recommends Pseudoterminals in webviews (control over visibility). These are not necessarily in conflict — real terminals for actual Claude Code sessions, Pseudoterminals only if webview-rendered terminal display is needed — but the exact architecture needs explicit resolution in Phase 1 design before implementation.

- **Claude Code CLI programmatic interface:** The extension assumes `claude` runs as a terminal process. Whether Claude Code exposes any IPC, status file, or programmatic API beyond the terminal is not covered in the research. If it does, agent status detection (running/idle/waiting) becomes tractable. Investigate before locking in the process management design.

- **VS Code 1.109+ proposed Agent Sessions API:** The `chatSessionsProvider` proposed API could potentially be leveraged for native integration. Currently "proposed" status means it is unstable and cannot be relied on. Monitor, but do not build against it in v1.

- **`@vscode-elements/elements` component coverage:** The library is at v2.5 with 40+ components. Verify that all required UI components (progress indicators, badges, buttons, forms) exist and meet quality bar before committing to complex webview UIs in Phase 2.

## Sources

### Primary (HIGH confidence)
- [VS Code Extension API Reference](https://code.visualstudio.com/api/references/vscode-api) — terminal, TreeView, webview, SCM, workspace APIs
- [VS Code Extension Bundling Guide](https://code.visualstudio.com/api/working-with-extensions/bundling-extension) — esbuild recommendation
- [VS Code Tree View API Guide](https://code.visualstudio.com/api/extension-guides/tree-view) — TreeDataProvider patterns
- [VS Code Terminal Advanced Docs](https://code.visualstudio.com/docs/terminal/advanced) — real terminal vs. Pseudoterminal, persistence
- [VS Code Webview API Guide](https://code.visualstudio.com/api/extension-guides/webview) — retainContextWhenHidden, getState/setState
- [VS Code Activation Events Reference](https://code.visualstudio.com/api/references/activation-events) — startup performance patterns
- [VS Code Multi-Root Workspaces Docs](https://code.visualstudio.com/docs/editing/workspaces/multi-root-workspaces) — multi-repo workspace patterns
- [VS Code 1.109 Release Notes (Jan 2026)](https://code.visualstudio.com/updates/v1_109) — native multi-agent competitive context
- [VS Code Multi-Agent Development Blog (Feb 2026)](https://code.visualstudio.com/blogs/2026/02/05/multi-agent-development) — competitive landscape
- [Claude Code VS Code Extension Docs](https://code.claude.com/docs/en/vs-code) — official extension capabilities and differentiation
- [VS Code issue #59384](https://github.com/microsoft/vscode/issues/59384) — terminal output capture is impossible (closed as by-design)
- [VS Code issue #296194](https://github.com/microsoft/vscode/issues/296194) — worktree explosion incident (1,526 worktrees, ~800 GB in 16 hours)
- [VS Code issue #105484](https://github.com/microsoft/vscode/issues/105484) — 4-5 second shutdown window for extension deactivation
- [VS Code issue #11895](https://github.com/microsoft/vscode/issues/11895) — extension deactivation deadline confirmation
- [Claude Code issue #21182](https://github.com/anthropics/claude-code/issues/21182) — 11.6 GB memory leak per conversation window
- [VS Code issue #272656](https://github.com/microsoft/vscode/issues/272656) — terminal visibility API bugs (confirmed)
- [Webview UI Toolkit Deprecation Issue #561](https://github.com/microsoft/vscode-webview-ui-toolkit/issues/561) — toolkit sunset Jan 2025
- [Git Worktree Documentation](https://git-scm.com/docs/git-worktree) — worktree mechanics, lock behavior, requirements (git 2.5+)
- [VS Code Extension Testing Guide](https://code.visualstudio.com/api/working-with-extensions/testing-extension) — @vscode/test-cli, Mocha
- [VS Code Git Extension Architecture (DeepWiki)](https://deepwiki.com/microsoft/vscode/5.2-git-extension) — Model/Repository/CommandCenter pattern reference

### Secondary (MEDIUM confidence)
- [vscode-elements Library](https://github.com/vscode-elements/elements) — webview UI component replacement (community-maintained)
- [Building VS Code Extensions in 2026](https://abdulkadersafi.com/blog/building-vs-code-extensions-in-2026-the-complete-modern-guide) — modern tooling guide
- [Git Worktree Manager Extension](https://github.com/jackiotyu/git-worktree-manager) — reference implementation for worktree patterns
- [Cline CLI 2.0 Multi-Agent](https://devops.com/cline-cli-2-0-turns-your-terminal-into-an-ai-agent-control-plane/) — competitive feature set reference
- [Roo Code Multi-Agent Workflow](https://xebia.com/blog/multi-agent-workflow-with-roo-code/) — competitive feature set reference
- [WebdriverIO VS Code Extension Testing](https://webdriver.io/docs/extension-testing/vscode-extensions/) — e2e testing solution for webview/terminal interactions
- [Git lock contention patterns](https://oneuptime.com/blog/post/2026-01-24-git-cannot-lock-ref-errors/view) — concurrent git operation failure patterns

### Tertiary (LOW confidence)
- [Running Multiple Claude Instances](https://www.arsturn.com/blog/how-to-run-multiple-claude-instances-in-vs-code-a-developers-guide) — user workflow patterns (needs validation)
- [tmux VS Code Integration](https://george.honeywood.org.uk/blog/vs-code-and-tmux/) — suspend/restore alternative approach (not recommended for v1 due to added dependency)

---
*Research completed: 2026-03-04*
*Ready for roadmap: yes*
