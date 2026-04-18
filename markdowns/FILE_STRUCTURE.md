## File Structure

```
vscode-agentic/
├── src/
│   ├── extension.ts                 — activate/deactivate
│   ├── db/
│   │   ├── index.ts                 — async createStateStorage factory (with globalState migration)
│   │   ├── models.ts                — plain TS models (Repository, Agent, Worktree, AgentTemplate)
│   │   └── StateStorage.ts          — async CRUD, validation, serialized writes, schema migrations
│   ├── features/                    — feature-first command implementations (addAgent, forkAgent, …)
│   ├── services/                    — long-lived components: AgentPanelProvider, SourceControlProvider,
│   │                                  FileExplorerProvider, TerminalService, SessionWatcher,
│   │                                  WebviewCommandHandler, GitService, Logger
│   ├── types/
│   │   ├── index.ts                 — re-exports shared types (RepoWithZones, BranchZone, etc.)
│   │   ├── agent.ts                 — Agent, AgentStatus, AgentCli, ContextUsage
│   │   ├── messages.ts              — webview ↔ extension message types (agent panel)
│   │   └── sourceControl.ts         — webview ↔ extension message types (source control)
│   ├── constants/                   — string/number constants (agent, db, git, messages, timing, views, …)
│   ├── utils/                       — pure helpers (nameGenerator, stripXmlTags, webview)
│   └── ui/
│       ├── index.tsx                — Agent Panel webview root
│       ├── App.tsx                  — Agent Panel app (wraps with ErrorBoundary)
│       ├── shared/
│       │   ├── atoms/               — leaf components (ErrorBoundary, IconButton, StatusIcon, …)
│       │   ├── molecules/           — composed UI (AgentTile, Timer, …)
│       │   ├── styles/              — shared CSS
│       │   └── utils/               — UI-local helpers (formatTime, formatContext)
│       ├── agentPanel/              — agent panel page + hook
│       │   ├── AgentPanelPage.tsx
│       │   ├── AgentPanelView.tsx
│       │   └── useAgentPanel.ts
│       └── sourceControl/           — source control page (separate bundle)
│           ├── index.tsx
│           ├── SourceControlPage.tsx
│           ├── SourceControlView.tsx
│           └── styles/
├── markdowns/                       — project-level docs
├── docs/
│   └── decisions/                   — ADRs
├── package.json
├── tsconfig.json                    — extension TS config (commonjs, Node)
├── tsconfig.webview.json            — webview TS config (ESNext, DOM, JSX)
└── esbuild configs live in package.json `scripts`
```
