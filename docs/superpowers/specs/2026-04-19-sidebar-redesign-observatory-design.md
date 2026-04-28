# Sidebar Redesign — "Observatory" — Design Spec

**Date:** 2026-04-19
**Scope:** Full visual + interaction redesign of the Agentic sidebar webview. Three new behaviours (one-click template launch, selected worktree per repo, worktree merge); one visual system (palette, type, tile/tab shapes). Implementation phased UI-first.

Interactive reference: `/tmp/agentic-redesign-preview/index.html` (variant A "File Tabs" is the locked direction).

---

## 1. Structure

Per repo (expanded):

```
Tab header          · brand + add repo + settings (no fleet pills)
Repo head           · caret · name · open-in-editor · kebab   (no status counters)
Current scope       · "Current — <branch>"
Template launcher   · horizontal-scroll chip row + manage-gear
Agent tiles         · current-branch agents
Worktree block      · file-tab strip + actions toolbar (scoped to active wt)
Template launcher   · same row, for the active worktree
Agent tiles         · active worktree's agents
```

Worktrees are "tabbed": exactly **one** worktree is open per repo at a time. Clicking a tab switches. Current branch is always visible; only the selected worktree's agents render.

---

## 2. Visual system

- **Type:** Geist (UI), Geist Mono (all data), Instrument Serif (italic accents, headings only).
- **Palette tokens** (CSS vars on `:root`):
  - Surfaces: `--bg #0d0f14`, `--bg-surface #131721`, `--bg-raised #1a1e29`, `--bg-inset #0a0c12`
  - Lines: `--line #1c212c`, `--line-strong #262c39`
  - Text: `--fg #d7dbe4`, `--fg-plus #ecedf2`, `--fg-muted #848b9e`, `--fg-dim #585e72`, `--fg-faint #3a3f4d`
  - Accent (brand + basic template): `--accent #8fb4cc`
  - Status rails only: `--run #c79a5f`, `--idle #82b199`, `--err #c07676`
  - Queue chip: `--queue #a090ba`
- **Template colours** (user-settable per template, defaults):
  `basic #8fb4cc`, `fix #7fb2a8`, `docs #9bb4c5`, `refactor #c8a080`, `plan #a494bf`, `migrate #c28894`, `review #b0aa7a`.
- **Motion:** only one animation — `fade-up` on tile enter (60 ms stagger). No pulses, no scanning, no flickers.

---

## 3. Components

### 3.1 Template launcher (`LaunchRow`)

- Horizontal-scroll track with left/right edge fade mask. Manage-gear pinned right.
- **Chip** (`TemplateChip`) — ghost pill, 26 px tall, mono 11 px, leading 6 px colour dot in template colour. Click = spawn agent with that template in the current scope.
- **Default chip** — the template marked `isDefault`. Rendered filled (colour-soft bg + colour-strong border + bold weight), slightly wider.
- No "blank" option. Every chip spawns an agent.

### 3.2 Agent tile (`AgentTile`)

Three-row layout, content on right of a 3 px status rail (rail = status only):

```
[tpl-label]  <name>                               <time>
<prompt-line>                                       (1-line, when result present)
<main-text — 2 lines>                   <ctx 47k/1M>
<queue-rows (if any)>
```

- **Template label** (`TemplateLabel`) — left of the name, colour dot + mono 10.5 px name.
- **Name** — Geist 13 px 600, ellipsed.
- **Time** (top-right):
  - Running: `MM:SS` elapsed, in `--run` colour.
  - Idle / error: last run duration (`2m 14s`, `48s`, `1m 3s`) in `--fg-muted`.
- **Main text area** — prompt if running (2-line clamp); result if completed/errored (2-line clamp). Result has no leading icon. Geist 12.5 px. `flex-end` baseline aligns with context.
- **Context badge** (`ContextBadge`) — `"47k/1M"` only. Colour threshold by `used / total`:
  - `< 50 %` → `--fg-muted`
  - `50–75 %` → `--run`
  - `> 75 %` → `--err`
- **Hover actions** — right-side icon strip, revealed on tile hover. Four buttons: `comment-discussion` (Send prompt), `repo-forked` (Fork), `pencil` (Rename), `trash` (Remove). All carry `title` tooltips. Disabled when impossible (e.g., Remove while running).
- **Queue rows** — dashed-border section under tile body; one row per queued prompt with index · text · remove-× (× appears on tile hover).
- **Fork chip removed.** `forkedFrom` still stored, no UI surface.

### 3.3 Worktree switcher — "File Tabs" (`WorktreeTabs`)

Top-edge flat tabs, horizontally scrollable:

- Tab = `[git-branch icon]` + `<branch>` + `<count>`. Inactive tabs sit on `--bg-inset`; active tab has a 2 px accent top-edge, `--bg` background, and seals into the content area below.
- Trailing `+` tab-slot creates a new worktree and auto-selects it.
- **Actions toolbar** directly under the tab strip, scoped to the active worktree: dashed bottom border, a `<branch-name>` label, and two `wa` buttons — `Merge` (`git-merge`) and `Delete` (`trash`). Both with tooltips.

### 3.4 Empty states

Minimalist:

- **No agents** in a scope — italic muted one-liner: *No agents. Pick a template.*
- **No worktrees** in a repo — single dashed row `⊕ WORKTREE` spanning where the worktree section would be. Click creates first worktree.

---

## 4. Data model changes

### 4.1 `AgentTemplate` (additions)

```ts
interface AgentTemplate {
  templateId: string
  name: string
  prompt: string
  color: string          // NEW — hex e.g. "#8fb4cc"
  isDefault: boolean     // NEW — exactly one template per user may be default
  createdAt: number
}
```

Migration (lazy): existing templates get `color` auto-assigned from a palette based on name hash, `isDefault: false`. First template becomes default if none is marked.

### 4.2 `Repository` (additions)

```ts
interface Repository {
  // ...existing
  selectedWorktreeBranch: string | null   // NEW — which worktree tab is open
}
```

Migration: defaults to `null` (nothing selected) on read. Setting it becomes the first worktree selection.

### 4.3 Storage methods

- `updateTemplate(templateId, patch): Promise<AgentTemplate>`
- `setDefaultTemplate(templateId): Promise<void>` — clears flag from others, sets on one
- `setSelectedWorktree(repoId, branch | null): Promise<void>`

### 4.4 Messages — webview protocol

New commands (webview → extension):

- `CMD_SELECT_WORKTREE` `{ repoId, branch }` — switch active tab
- `CMD_NEW_AGENT_WITH_TEMPLATE` `{ repoId, branch, templateId }` — one-click launch
- `CMD_MERGE_WORKTREE` `{ repoId, branch }` — merge wt branch into repo's current branch
- `CMD_MANAGE_TEMPLATES` — open template manager (opens a quick pick / web panel in v1, later a proper UI)

Changed: `CMD_ADD_AGENT` retains current behaviour but is now reserved for the **manage gear** flow; the chip click uses the new command.

Kept: `CMD_CLOSE_WORKTREE` = delete.

### 4.5 `RepoWithZones` replaced by `RepoWithScopes`

Zones mingled current + worktrees. Split explicitly:

```ts
interface RepoWithScopes extends Repository {
  currentAgents: Agent[]                      // agents on repo.currentBranch
  worktrees: Array<{
    branch: string
    path: string
    agentCount: number
    agents: Agent[]                           // only populated for selected one
  }>
  templates: AgentTemplate[]                  // full list, every repo has same
}
```

Extension computes `selectedWorktreeBranch` and only includes that worktree's `agents` in the snapshot (others ship `[]` + count only, saving size).

---

## 5. Implementation phases

**Phase 1 — Visual redesign (UI only, existing data)**
1. Load Geist / Geist Mono / Instrument Serif via webview CSP-safe font link.
2. Move palette / type tokens into a new `design-tokens.css`. Rewrite `reset.css` / `atoms.css` / `molecules.css` / `views.css` to the new spec. Hard-coded template colour mapping keyed by `templateName` (pending backend colour field).
3. New atoms: `TemplateLabel`, `ContextBadge`, `ScopeLabel`.
4. New molecules: `LaunchRow`, `WorktreeTabs` (replaces zone header + chip strip), `TileActions`.
5. Rewrite `AgentTile` molecule to new 3-row layout.
6. Rewrite `RepoSection` to use `currentAgents` + `worktrees` shapes, built from the current `zones` for now (extension still emits `zones`, UI adapts).
7. `AgentPanelView` unchanged at the top level.
8. Empty states.

**Phase 2 — Data model**
1. Add `color` + `isDefault` to `AgentTemplate`, with lazy migration. Auto-assign colours by palette cycle.
2. Add `selectedWorktreeBranch` to `Repository`, migrated as `null`.
3. Rewrite `StateStorage` method set for the above.
4. Change extension snapshot builder to emit `RepoWithScopes` instead of `RepoWithZones`.
5. Update webview state binding; remove `zones` usage.

**Phase 3 — New behaviours**
1. `CMD_SELECT_WORKTREE` — updates `selectedWorktreeBranch`, triggers snapshot push.
2. `CMD_NEW_AGENT_WITH_TEMPLATE` — skips the quick-pick flow in `addAgent`; routes directly through a new `launchAgent(repoId, branch, template)` feature.
3. `CMD_MERGE_WORKTREE` — new `mergeWorktree(repoId, branch)` feature. `git merge --no-ff <wt-branch>` into current branch; handle conflicts (user-visible message + output channel); refuse if wt has running agents.
4. Template manage: for v1, a `QuickPick`-based flow (add / edit / set-default / delete). Real UI deferred.

Each phase is independently shippable and each ends at a green `tsc`.

---

## 6. Out of scope (this design)

- Real template-management panel (colour picker UI, template editing form). Deferred.
- Merge conflict resolution beyond "surface the error".
- Global "fleet status" across repos (was removed in v3).
- Replacing the sourceControl webview.
- Theme variant for VS Code light theme (design is dark-first; light treatment comes after).

---

## 7. Risks

- **Font loading in webview.** Google-Fonts needs CSP entries. If the VS Code CSP blocks loading, fall back to self-hosted fonts in `resources/fonts/` (`@font-face` via `webview.asWebviewUri`). Plan for fallback from the start.
- **Schema migration.** Templates already in users' global state. The migration is additive (`??` defaults); no data is destroyed. Still, add a schema-version bump and a single-shot migration on activation.
- **`selectedWorktreeBranch` for first render.** If `null` and worktrees exist, auto-select the most recent one on snapshot build.
- **Merge UX.** `git merge` is destructive; behind a confirm dialog (`showWarningMessage` with `Merge / Cancel`). Not runnable while any agent on the wt is running.

---

## 8. Locked decisions (2026-04-19)

**Template fields — MVP only.**
- `name`, `prompt`, `color`, `isDefault`. Nothing else.
- **The template `prompt` is a *system* prompt**, written as a `CLAUDE.md` file into the worktree at agent start — *not* the user's first message. The user types their actual prompt in the terminal themselves. Phase 3 `launchAgent(repoId, branch, template)` is responsible for writing this file (to `<worktreePath>/.claude/CLAUDE.md` so it layers with the project `CLAUDE.md` rather than overwriting it).
- No icon, description, variables, or chained prompts in v1. Kept on the "defer" list.

**Editor surface — dedicated webview panel.**
- Opens in the editor area (not the sidebar) via `vscode.window.createWebviewPanel`. Own React bundle (`src/ui/templateEditor/index.tsx`) paralleling the existing `sourceControl` webview.
- Routes: `openTemplateEditor()` with `{ mode: 'create' | 'edit', templateId? }`.

**Summariser — `@xenova/transformers` + distilbart-cnn.**
- Model: `Xenova/distilbart-cnn-6-6` (~75 MB). Runs on CPU via ONNX.
- First activation: check `context.globalStorageUri/transformers/` for cached weights. If missing, download via the library, surfacing a single `withProgress` notification: *"Agentic: downloading summarisation model (one-time, ~75 MB)…"*.
- Runtime guard: every call tries the pipeline; if the model fails to load or the call throws, fall back to the existing simple truncation (`stripXmlTags` + char limit). No user-facing errors.
- Config keys: `agentic.summariser.enabled` (default `true`), `agentic.summariser.thresholdChars` (default `320`), `agentic.summariser.stabilityMs` (default `2000`).
- New stored fields on `Agent`: `lastPromptShort`, `outputShort`. Tiles prefer the short string when present.

**Selected tile style — as mocked in v7.**
- Accent-tinted background, 5 px accent rail, status colour kept as a 2 px inner sub-stripe on the rail, name flips to accent, subtle outer glow, actions stay revealed. No pulsing.

