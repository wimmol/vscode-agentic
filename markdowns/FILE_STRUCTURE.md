## File Structure

```
vscode-agentic/
├── src/
│   ├── extension.ts
│   ├── db/
│   │   ├── index.ts              — async createStateStorage factory, re-exports
│   │   ├── models.ts             — Sequelize models (RepositoryModel, AgentModel, WorktreeModel) + attribute interfaces
│   │   ├── relations.ts          — composite types (RepositoryWithAgents, AgentWithWorktree)
│   │   └── StateStorage.ts       — async CRUD methods, validation, events, backup
│   ├── features/
│   ├── services/
│   ├── types/
│   │   ├── index.ts              — re-exports all shared types
│   │   └── agent.ts              — Agent, AgentStatus, AgentCli
│   ├── errors/
│   └── ui/
│       ├── index.tsx
│       ├── App.tsx
│       ├── shared/
│       │   ├── atoms/
│       │   ├── molecules/
│       │   ├── hooks/
│       │   └── styles/
│       └── agentPanel/
│           ├── AgentPanelPage.tsx
│           ├── AgentPanelView.tsx
│           └── useAgentPanel.ts
├── package.json
├── tsconfig.json
├── tsconfig.webview.json
└── docs/decisions/
```
