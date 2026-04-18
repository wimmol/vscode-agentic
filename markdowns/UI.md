## UI

### Layout

```
┌─────────────────────────────────────────┐
│ Agentic                      [root] [+] │  ← Tab Header
├─────────────────────────────────────────┤
│ my-app              [root] [+] [×] [▾]  │  ← Repo Header
│ ┌─────────────────────────────────────┐ │
│ │ ● agent-1                    2m 34s │ │  ← Agent Tile
│ │ fix login bug on the auth...        │ │
│ │              [clone] [stop] [×] [⌧] │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ ○ agent-2                           │ │
│ │ refactor user service to...         │ │
│ │              [clone] [stop] [×] [⌧] │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ backend-api          [root] [+] [×] [▸] │  ← Collapsed repo
├─────────────────────────────────────────┤
│ utils-lib            [root] [+] [×] [▾] │
│                                         │
│         press + to add agent            │  ← Empty state
│                                         │
└─────────────────────────────────────────┘
```

When no repos are added:

```
┌─────────────────────────────────────────┐
│ Agentic                      [root] [+] │
│                                         │
│           press + to add repo           │
│                                         │
└─────────────────────────────────────────┘
```

---

### Tab Header

Top-level bar. Always visible.

| Element   | Codicon            | Handler (stub)       | Description                              |
|-----------|--------------------|----------------------|------------------------------------------|
| Title     | —                  | —                    | Text "Agentic"                           |
| Root      | `$(root-folder)`   | `onRootClick()`      | Navigate to workspace scope in Explorer  |
| Add Repo  | `$(add)`           | `onAddRepoClick()`   | Add a git folder to the workspace        |

---

### Repo Header

One per repo. Ordered by insertion (order added).

| Element     | Codicon              | Handler (stub)                  | Description                            |
|-------------|----------------------|---------------------------------|----------------------------------------|
| Title       | —                    | —                               | Repo folder name                       |
| Root        | `$(root-folder)`     | `onRepoRootClick(repoId)`       | Navigate to repo scope in Explorer     |
| Add Agent   | `$(add)`             | `onAddAgentClick(repoId)`       | Create new agent for this repo         |
| Remove Repo | `$(close)`           | `onRemoveRepoClick(repoId)`     | Remove repo from workspace             |
| Toggle      | `$(chevron-down)` / `$(chevron-right)` | `onToggleRepoClick(repoId)` | Show/hide agents list          |

---

### Agent Tile

Displayed under repo header when expanded. Ordered by creation time.

#### Info

| Field       | Description                                             |
|-------------|---------------------------------------------------------|
| Status icon | Codicon representing current status (see table below)   |
| Name        | Agent name (e.g. `agent-1`)                             |
| Last prompt | Single line, truncated. Last prompt given to the agent  |
| Timer       | Elapsed time of current task. Format: `2m 34s`. Shown only when status is `running` |

#### Status Icons

| Status      | Codicon             |
|-------------|---------------------|
| created     | `$(circle-outline)` |
| running     | `$(sync~spin)`      |
| completed   | `$(check)`          |
| error       | `$(error)`          |

#### Action Buttons

| Button        | Codicon             | Handler                         | Description                                                          |
|---------------|---------------------|---------------------------------|----------------------------------------------------------------------|
| Send Prompt   | `$(edit)`           | `onSendPrompt(agentId)`         | Send a new prompt to the agent (or queue it if running).             |
| Fork          | `$(repo-forked)`    | `onForkAgent(agentId)`          | Create a fresh agent seeded with this one's last prompt and summary. |
| Rename        | `$(pencil)`         | `onRenameAgent(agentId)`        | Rename the agent.                                                    |
| Remove        | `$(trash)`          | `onRemoveClick(agentId)`        | Remove the agent. Disabled while status is `running`.                |

#### Tile Click

Clicking the tile body (not action buttons) triggers `focusAgent(agentId)`.

---

### Empty States

| Condition              | Text                    |
|------------------------|-------------------------|
| No repos added         | `press + to add repo`   |
| Repo has no agents     | `press + to add agent`  |

---

### Style Rules

- All colors use VS Code CSS custom properties (`var(--vscode-*)`).
- All icons use Codicons (`@vscode/codicons`).
- No hardcoded colors.
