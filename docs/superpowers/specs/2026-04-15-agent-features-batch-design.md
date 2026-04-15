# Agent Features Batch — Design Spec

**Date:** 2026-04-15
**Scope:** 9 features implemented in layer-by-layer approach (data → extension logic → UI)

---

## Features

| # | Feature | Summary |
|---|---------|---------|
| 3 | Agent Templates | User-defined templates (name + prompt). Replace hardcoded Docs/Refactor tasks. |
| 4 | Agent Queue | Stack prompts for sequential execution. Auto-drains on agent idle. |
| 5 | Session Forking | Fork an agent to a new branch with context carried over. Full branch picker. |
| 11 | Output Summary | Show last assistant message (truncated 200 chars) when agent finishes. |
| 13 | Notifications | VS Code notifications on agent idle or error. |
| 17 | Expandable Tile | Click tile to both focus terminal AND expand inline detail section. Second click collapses. |
| 21 | Strip XML Tags | Remove `<tag>` markup from prompt/summary display. UI-only transform. |
| 22 | Human Names | Replace adjective-animal generator with short human names (under 6 letters). |
| 23 | Rename Agent | Rename via input box from expanded tile detail actions. |
| — | Context Usage | Show token usage (e.g. `47k / 1M`) with color thresholds + thin progress bar. |

---

## Layer 1: Data Model

### Agent model additions (`db/models.ts`)

Existing fields unchanged. New fields:

```typescript
templateName: string | null    // #3 — template name used to create agent
outputSummary: string | null   // #11 — last assistant message text, set on idle/error
forkedFrom: string | null      // #5 — agentId of the parent agent
promptQueue: string[]          // #4 — queued prompts awaiting execution
contextUsage: { used: number; total: number } | null  // token usage from session
```

All new fields default to `null` (or `[]` for promptQueue). Existing agents in storage get defaults via `??` at read time — no migration needed.

### New model: AgentTemplate

```typescript
interface AgentTemplate {
  templateId: string
  name: string      // user-defined, e.g. "Docs Writer"
  prompt: string    // the template prompt text
  createdAt: number
}
```

Stored in `globalState` under key `templates` as `AgentTemplate[]`.

### StateStorage additions

Templates:
- `addTemplate(name: string, prompt: string): Promise<AgentTemplate>`
- `getAllTemplates(): AgentTemplate[]`
- `removeTemplate(templateId: string): Promise<void>`

Queue helpers:
- `pushToQueue(agentId: string, prompt: string): Promise<void>` — appends to promptQueue
- `shiftFromQueue(agentId: string): Promise<string | undefined>` — removes and returns first item
- `removeFromQueue(agentId: string, index: number): Promise<void>` — removes item at index

All queue helpers clone the array, mutate, then save via `updateAgent`.

### New constants (`constants/commands.ts`)

```typescript
export const CMD_SEND_PROMPT = 'sendPrompt';
export const CMD_FORK_AGENT = 'forkAgent';
export const CMD_RENAME_AGENT = 'renameAgent';
export const CMD_REMOVE_QUEUE_ITEM = 'removeQueueItem';
```

### New message types (`types/messages.ts`)

Webview → Extension:
- `sendPromptMessage(agentId: string)` — extension shows input box, handles prompt text
- `forkAgentMessage(agentId: string)`
- `renameAgentMessage(agentId: string)` — extension shows input box with current name
- `removeQueueItemMessage(agentId: string, index: number)`

Extension → Webview:
- Existing `StateUpdateMessage` unchanged. Agent objects in `RepoWithZones` now include the new fields: `templateName`, `outputSummary`, `forkedFrom`, `promptQueue`, `contextUsage`.

### Types (`types/agent.ts`)

```typescript
export interface ContextUsage {
  used: number;
  total: number;
}
```

---

## Layer 2: Extension Logic

### #21 Strip XML Tags — new utility

**File:** `src/utils/stripXmlTags.ts`

```typescript
export const stripXmlTags = (text: string): string =>
  text.replace(/<\/?[a-zA-Z][^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
```

Applied at **display time only** in the UI (AgentTile). Stored `lastPrompt` and `outputSummary` remain raw.

### #11 Output Summary — SessionWatcher enhancement

When SessionWatcher detects `end_turn` and transitions agent to IDLE or ERROR:
1. Read the last assistant message from the JSONL session file
2. Extract text content (same approach as `extractPromptText` but for role `assistant`)
3. Truncate to 200 characters
4. Store via `storage.updateAgent(agentId, { outputSummary: text })`

New private method: `extractAssistantSummary(lines: string[]): string | null`

### Context Usage — SessionWatcher enhancement

Parse `usage` field from assistant JSONL messages containing `{ input_tokens, output_tokens }`.
- `used` = `input_tokens` from the latest assistant message (represents current context window consumption)
- `total` = determined by model identifier in session or default `1_000_000`
- Store via `storage.updateAgent(agentId, { contextUsage: { used, total } })`
- Updated on every poll cycle while agent is running

### #13 Notifications — SessionWatcher enhancement

On status transition:
- → IDLE: `vscode.window.showInformationMessage(\`Agent "\${name}" finished on \${repoName} (\${duration})\`)`
- → ERROR: `vscode.window.showWarningMessage(\`Agent "\${name}" encountered an error on \${repoName}\`)`

Added inline in the existing status-change logic. No new setting.

### #3 Templates — feature changes

**Delete:** `src/features/addAgentWithTask.ts`

**Delete from `package.json`:**
- Commands: `vscode-agentic.explorer.generateDocs`, `vscode-agentic.explorer.refactor`
- Their menu entries in `view/item/context`
- Their keybindings (if any)

**New file:** `src/features/manageTemplates.ts`
- `createTemplate(storage)`: shows input box for name → input box for prompt → saves via `storage.addTemplate()`
- `removeTemplate(storage)`: shows quick pick of existing templates → confirms → removes

**New commands in `package.json`:**
- `vscode-agentic.createTemplate` — "Agentic: Create Agent Template"
- `vscode-agentic.removeTemplate` — "Agentic: Remove Agent Template"

**Modified:** `src/features/addAgent.ts`

After branch picker, before creating the agent:
1. Fetch `storage.getAllTemplates()`
2. Show quick pick: "Blank (no template)" + list of templates
3. If template selected: use `template.prompt` as `initialPrompt`, set `templateName` on agent
4. If blank: show input box for optional initial prompt (existing behavior)

### #4 Agent Queue — feature + SessionWatcher

**New file:** `src/features/sendPrompt.ts`
- `sendPrompt(storage, terminalService, agentId, prompt)`:
  - If agent status is RUNNING → `storage.pushToQueue(agentId, prompt)`
  - If agent status is IDLE/CREATED/ERROR → send directly to terminal via `terminal.sendText(prompt, true)`, update status to RUNNING

**SessionWatcher auto-drain:**
- When agent transitions RUNNING → IDLE, check `storage.getAgent(agentId).promptQueue`
- If non-empty: wait 1500ms, `shiftFromQueue()`, `terminal.sendText(prompt, true)`, set status back to RUNNING
- If empty: normal idle (trigger notification)

### #5 Session Forking — new feature

**New file:** `src/features/forkAgent.ts`
- `forkAgent(storage, terminalService, explorer, agentId)`:
  1. Get source agent context via `storage.getAgentContext(agentId)`
  2. Show branch picker (same as `addAgent` — current branch, existing worktrees, new branch)
  3. Create new branch/worktree if needed (same logic as `addAgent`)
  4. Generate new agent name
  5. Create agent with `forkedFrom: agentId`, `templateName: source.templateName`
  6. Build initial prompt: `"Continue from the previous agent's work. Last task: ${source.lastPrompt}. Result: ${source.outputSummary ?? 'unknown'}"`
  7. Create terminal, open explorer

### #22 Human Names — replace nameGenerator

**Replace contents of:** `src/utils/nameGenerator.ts`

```typescript
const NAMES = [
  'Alice', 'James', 'Nora', 'Max', 'Clara', 'Leo', 'Ivy', 'Oscar',
  'Ruby', 'Finn', 'Ada', 'Hugo', 'Mila', 'Noah', 'Zara', 'Owen',
  'Luna', 'Eli', 'Rosa', 'Sam', 'Iris', 'Axel', 'Mia', 'Cole',
  'Eva', 'Liam', 'Aria', 'Seth', 'Ava', 'Dean', 'Lily', 'Jack',
  'Cora', 'Ben', 'Nina', 'Rex', 'Tara', 'Ian', 'Vera', 'Kurt',
];

const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

const MAX_ATTEMPTS = 200;

export const generateAgentName = (existingNames: string[]): string => {
  const taken = new Set(existingNames.map((n) => n.toLowerCase()));

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const name = pick(NAMES);
    if (!taken.has(name.toLowerCase())) return name;
  }

  const base = pick(NAMES);
  let suffix = 2;
  while (taken.has(`${base} ${suffix}`.toLowerCase())) suffix++;
  return `${base} ${suffix}`;
};
```

### #23 Rename Agent — new command

Handled in `WebviewCommandHandler`:
- `CMD_RENAME_AGENT` → show `vscode.window.showInputBox({ value: currentName, prompt: 'New agent name' })`
- Validate: non-empty, under 20 chars
- `storage.updateAgent(agentId, { name: newName })`
- Terminal display name can't be changed after creation in VS Code API — the tile shows the new name, terminal keeps old name (acceptable trade-off)

### WebviewCommandHandler routing additions

```typescript
CMD_SEND_PROMPT       → showInputBox() → sendPrompt(storage, terminalService, args.agentId, inputResult)
CMD_FORK_AGENT        → forkAgent(storage, terminalService, explorer, args.agentId)
CMD_RENAME_AGENT      → showInputBox({ value: currentName }) → storage.updateAgent(agentId, { name })
CMD_REMOVE_QUEUE_ITEM → storage.removeFromQueue(args.agentId, args.index)
```

---

## Layer 3: UI Changes

### AgentTile (`ui/shared/molecules/AgentTile.tsx`)

**New props** (all from agent model):
- `templateName: string | null`
- `outputSummary: string | null`
- `forkedFrom: string | null`
- `promptQueue: string[]`
- `contextUsage: { used: number; total: number } | null`
- `branch: string`
- `worktreePath: string | null`

**New local state:**
- `isExpanded: boolean` — toggled on click (alongside existing `onClick` which focuses terminal)

**Header row (always visible):**
```
[StatusIcon] [Name] [TemplateBadge?] [ForkBadge?] [QueueBadge?] [ContextUsage] [Timer/Elapsed]
```

- **TemplateBadge** — `<span class="template-badge">{templateName}</span>` when set
- **ForkBadge** — `<span class="fork-badge">FORK</span>` when `forkedFrom` is set
- **QueueBadge** — `<span class="queue-badge">{n} queued</span>` when `promptQueue.length > 0`
- **ContextUsage** — `<span class="context-usage context-usage--{level}">{formatted}</span>`
  - Format: compact numbers (`1.2k`, `128k`, `1M`)
  - Color thresholds: normal (< 80%), `--warn` (80-95%), `--danger` (> 95%)

**Prompt section (always visible):**
- `lastPrompt` passed through `stripXmlTags()` before rendering
- `outputSummary` passed through `stripXmlTags()`, shown as green summary line below prompt

**Context progress bar (always visible):**
- Thin 2px bar under prompt section
- Fill width = `(used / total) * 100%`
- Color matches context usage thresholds

**Expanded section (when `isExpanded`):**
- Detail rows: Branch, Worktree (if set), Session duration, Context (full numbers + percentage), Full prompt (unwrapped)
- Queue list (if items): numbered, each with remove button (x)
- Action buttons row:
  - **Send Prompt** — posts `CMD_SEND_PROMPT` (extension shows input box, sends result back)
  - **Fork** — posts `CMD_FORK_AGENT`
  - **Rename** — posts `CMD_RENAME_AGENT`
  - **View Diff** — posts existing command or opens diff view
  - Context warning highlighted "Fork Again" when usage > 80%

### New utility: `formatContextUsage`

**File:** `src/ui/shared/utils/formatContext.ts`

```typescript
export const formatCompact = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return `${n}`;
};

export const contextLevel = (used: number, total: number): 'normal' | 'warn' | 'danger' => {
  const pct = used / total;
  if (pct >= 0.95) return 'danger';
  if (pct >= 0.80) return 'warn';
  return 'normal';
};
```

### New utility: `stripXmlTags` (UI import)

Imported from `src/utils/stripXmlTags.ts` — applied to `lastPrompt` and `outputSummary` in AgentTile render.

### RepoSection changes

Pass new agent fields through to AgentTile. Add handlers for new commands.

### AgentPanelPage / AgentPanelView

New callbacks:
- `onSendPrompt(agentId: string)` — posts message, extension shows input box
- `onForkAgent(agentId: string)`
- `onRenameAgent(agentId: string)`
- `onRemoveQueueItem(agentId: string, index: number)`

### CSS additions (`molecules.css`)

```css
/* Context usage */
.context-usage { font-size: 10px; flex-shrink: 0; white-space: nowrap; font-variant-numeric: tabular-nums; }
.context-usage--normal { color: var(--vscode-descriptionForeground); }
.context-usage--warn { color: var(--vscode-charts-orange); }
.context-usage--danger { color: var(--vscode-charts-red); font-weight: 600; }

/* Context bar */
.context-bar { height: 2px; border-radius: 1px; background: rgba(255,255,255,0.06); margin-top: 2px; overflow: hidden; }
.context-bar-fill { height: 100%; border-radius: 1px; transition: width 0.3s; }
.context-bar-fill--normal { background: var(--vscode-descriptionForeground); }
.context-bar-fill--warn { background: var(--vscode-charts-orange); }
.context-bar-fill--danger { background: var(--vscode-charts-red); }

/* Badges */
.template-badge { font-size: 9px; padding: 1px 5px; border-radius: 2px; background: rgba(55,148,255,0.15); color: var(--vscode-charts-blue); font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; flex-shrink: 0; }
.fork-badge { font-size: 9px; padding: 1px 5px; border-radius: 2px; background: rgba(209,134,22,0.15); color: var(--vscode-charts-orange); font-weight: 600; flex-shrink: 0; }
.queue-badge { font-size: 9px; padding: 1px 5px; border-radius: 8px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); font-weight: 600; flex-shrink: 0; }

/* Output summary */
.agent-summary { font-size: 10px; color: var(--vscode-charts-green); padding: 3px 0 0; border-top: 1px solid rgba(255,255,255,0.04); margin-top: 2px; display: flex; align-items: center; gap: 4px; }

/* Expanded detail */
.agent-detail { font-size: 11px; color: var(--vscode-descriptionForeground); border-top: 1px solid rgba(255,255,255,0.06); margin-top: 2px; padding-top: 6px; display: flex; flex-direction: column; gap: 4px; }
.detail-row { display: flex; align-items: center; gap: 6px; }
.detail-label { font-size: 10px; color: var(--vscode-descriptionForeground); width: 54px; flex-shrink: 0; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.6; }
.detail-value { font-size: 11px; color: var(--vscode-foreground); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.detail-actions { display: flex; gap: 4px; margin-top: 4px; padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.04); }
.detail-btn { font-size: 10px; padding: 2px 8px; border-radius: 3px; border: 1px solid var(--vscode-panel-border); background: transparent; color: var(--vscode-descriptionForeground); cursor: pointer; }

/* Queue list */
.queue-list { font-size: 10px; color: var(--vscode-descriptionForeground); padding: 4px 0 0; border-top: 1px solid rgba(255,255,255,0.04); margin-top: 2px; }
.queue-item { display: flex; align-items: center; gap: 6px; padding: 2px 0; }
.queue-num { font-size: 9px; color: var(--vscode-descriptionForeground); width: 14px; text-align: right; opacity: 0.5; }
.queue-remove { font-size: 10px; color: var(--vscode-descriptionForeground); cursor: pointer; background: none; border: none; opacity: 0.5; }
.queue-remove:hover { color: var(--vscode-charts-red); opacity: 1; }
```

---

## Files Changed Summary

### New files
- `src/utils/stripXmlTags.ts`
- `src/features/sendPrompt.ts`
- `src/features/forkAgent.ts`
- `src/features/manageTemplates.ts`
- `src/ui/shared/utils/formatContext.ts`

### Modified files
- `src/db/models.ts` — new fields on Agent, new AgentTemplate interface
- `src/db/StateStorage.ts` — template CRUD, queue helpers, defaults for new fields
- `src/types/agent.ts` — ContextUsage interface
- `src/types/messages.ts` — new message constructors
- `src/constants/commands.ts` — new CMD constants
- `src/constants/messages.ts` — new labels
- `src/services/SessionWatcher.ts` — output summary, context usage, notifications
- `src/services/WebviewCommandHandler.ts` — route new commands
- `src/features/addAgent.ts` — template picker integration
- `src/utils/nameGenerator.ts` — replace with human names
- `src/ui/shared/molecules/AgentTile.tsx` — expandable, badges, context, summary, tag stripping
- `src/ui/agentPanel/RepoSection.tsx` — pass new props/handlers
- `src/ui/agentPanel/AgentPanelView.tsx` — new callback props
- `src/ui/agentPanel/AgentPanelPage.tsx` — new handlers
- `src/ui/shared/styles/molecules.css` — new styles
- `package.json` — remove old commands, add template commands

### Deleted files
- `src/features/addAgentWithTask.ts`

---

## Implementation Order

1. **Data layer** — models, types, constants, StateStorage methods
2. **Utilities** — stripXmlTags, formatContext, nameGenerator rewrite
3. **Extension logic** — SessionWatcher enhancements, manageTemplates, sendPrompt, forkAgent, renameAgent
4. **Wiring** — WebviewCommandHandler routing, addAgent template integration, package.json cleanup
5. **UI** — AgentTile expansion, badges, context bar, CSS, RepoSection/Page/View prop threading
6. **Build & verify** — compile both extension + webview, fix any type errors
