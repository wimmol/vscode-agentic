---
phase: quick
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - src/ui/agenticTab.tsx
  - src/ui/components/Dashboard.tsx
  - src/ui/components/RepoSection.tsx
  - src/ui/components/AgentTile.tsx
  - src/ui/hooks/useDashboardData.ts
  - src/ui/hooks/useRepoActions.ts
  - src/ui/hooks/useAgentActions.ts
autonomous: true
requirements: [QUICK-1]

must_haves:
  truths:
    - "Dashboard, RepoSection, AgentTile have zero useState/useEffect/postCommand calls -- purely props-driven"
    - "All logic (message listener, state, event handlers) lives in custom hooks called from agenticTab"
    - "agenticTab is the single smart container, renders Dashboard with all data and callbacks as props"
    - "App renders and functions identically to before the refactor"
  artifacts:
    - path: "src/ui/hooks/useDashboardData.ts"
      provides: "Message listener, DashboardData state, toolbar callbacks"
    - path: "src/ui/hooks/useRepoActions.ts"
      provides: "Factory for repo-level callbacks (root, create, remove, collapse toggle)"
    - path: "src/ui/hooks/useAgentActions.ts"
      provides: "Factory for agent-level callbacks (focus, stop, delete)"
    - path: "src/ui/agenticTab.tsx"
      provides: "Smart container using all hooks, passing props to Dashboard"
    - path: "src/ui/components/Dashboard.tsx"
      provides: "Pure presentational -- receives data + callbacks as props"
    - path: "src/ui/components/RepoSection.tsx"
      provides: "Pure presentational -- receives repo + scope + callbacks as props"
    - path: "src/ui/components/AgentTile.tsx"
      provides: "Pure presentational -- receives agent + callbacks as props"
  key_links:
    - from: "src/ui/agenticTab.tsx"
      to: "src/ui/hooks/useDashboardData.ts"
      via: "hook call"
      pattern: "useDashboardData\\(\\)"
    - from: "src/ui/agenticTab.tsx"
      to: "src/ui/components/Dashboard.tsx"
      via: "JSX render with props"
      pattern: "<Dashboard"
    - from: "src/ui/components/Dashboard.tsx"
      to: "src/ui/components/RepoSection.tsx"
      via: "JSX composition"
      pattern: "<RepoSection"
---

<objective>
Refactor the UI layer to enforce a strict "smart container / dumb components" pattern.

Purpose: All React state and side effects move into custom hooks in src/ui/hooks/. Components (Dashboard, RepoSection, AgentTile) become pure presentational (props in, JSX out). agenticTab.tsx becomes the single smart container that wires hooks to the presentational tree.

Output: Refactored UI with 3 new hooks, 3 updated components, and updated agenticTab entry point.
</objective>

<execution_context>
@/Users/norules/.claude/get-shit-done/workflows/execute-plan.md
@/Users/norules/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/ui/types.ts
@src/ui/agenticTab.tsx
@src/ui/components/Dashboard.tsx
@src/ui/components/RepoSection.tsx
@src/ui/components/AgentTile.tsx
@src/ui/hooks/useVsCodeApi.ts
@src/ui/hooks/useElapsedTime.ts
@src/ui/atoms/ActionButton.tsx
@src/ui/atoms/StatusIcon.tsx
@src/ui/atoms/ElapsedTimer.tsx

<interfaces>
<!-- Existing types the executor needs -->

From src/ui/types.ts:
```typescript
export interface AgentData {
  agentName: string;
  repoPath: string;
  status: "created" | "running" | "finished" | "error";
  initialPrompt?: string;
  createdAt: string;
  finishedAt?: string;
  exitCode?: number;
}

export interface RepoData {
  path: string;
  name: string;
  agents: AgentData[];
}

export interface DashboardData {
  repos: RepoData[];
  scope: string;
}
```

From src/ui/hooks/useVsCodeApi.ts:
```typescript
export const postCommand = (command: string, data?: Record<string, string>) => void;
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create custom hooks extracting all logic from components</name>
  <files>src/ui/hooks/useDashboardData.ts, src/ui/hooks/useRepoActions.ts, src/ui/hooks/useAgentActions.ts</files>
  <action>
Create three custom hooks that extract ALL logic currently embedded in Dashboard, RepoSection, and AgentTile. All functions must use arrow function declaration per CLAUDE.md: `const name = (args) => {}`.

**src/ui/hooks/useDashboardData.ts:**
- Move the useState<DashboardData | null> and useEffect message listener from Dashboard.tsx into this hook.
- Return `{ data, onRootGlobal, onAddRepo }` where:
  - `data` is the DashboardData | null state
  - `onRootGlobal` calls `postCommand("rootGlobal")` with console.log
  - `onAddRepo` calls `postCommand("addRepo")` with console.log
- Import useState, useEffect from "react" and postCommand from "./useVsCodeApi"

**src/ui/hooks/useRepoActions.ts:**
- Export a single hook `useRepoActions` that returns a factory function.
- The hook manages a `collapsedRepos` state as `Record<string, boolean>` (keyed by repo.path) so collapse state for ALL repos is centralized in one place (not per-component).
- Return type: `{ collapsedRepos: Record<string, boolean>, getRepoCallbacks: (repoPath: string) => RepoCallbacks }`
- `RepoCallbacks` type (export it): `{ onRoot: () => void; onCreate: () => void; onRemove: () => void; onToggleCollapse: () => void }`
- `getRepoCallbacks(repoPath)` returns an object with:
  - `onRoot`: calls `postCommand("rootRepo", { repoPath })` with console.log
  - `onCreate`: calls `postCommand("createAgent", { repoPath })` with console.log
  - `onRemove`: calls `postCommand("removeRepo", { repoPath })` with console.log
  - `onToggleCollapse`: toggles `collapsedRepos[repoPath]` (default false)
- Import useState from "react" and postCommand from "./useVsCodeApi"

**src/ui/hooks/useAgentActions.ts:**
- Export a single hook `useAgentActions` that returns a factory function.
- Return type: `{ getAgentCallbacks: (repoPath: string, agentName: string) => AgentCallbacks }`
- `AgentCallbacks` type (export it): `{ onFocus: () => void; onStop: () => void; onDelete: () => void }`
- `getAgentCallbacks(repoPath, agentName)` returns:
  - `onFocus`: calls `postCommand("focusAgent", { repoPath, agentName })` with console.log
  - `onStop`: calls `postCommand("stopAgent", { repoPath, agentName })` with console.log
  - `onDelete`: calls `postCommand("deleteAgent", { repoPath, agentName })` with console.log
- Import postCommand from "./useVsCodeApi"

Keep all console.log calls with the same prefixes as the originals (e.g., "[Dashboard] rootGlobal", "[RepoSection] rootRepo", "[AgentTile] click -> focusAgent").
  </action>
  <verify>
    <automated>cd /Users/norules/Documents/code/vscode-agentic && npx tsc --noEmit -p src/ui/tsconfig.json 2>&1 | head -30</automated>
  </verify>
  <done>Three hook files exist, export correct types, compile without errors. All postCommand calls and state management extracted from components.</done>
</task>

<task type="auto">
  <name>Task 2: Make components pure presentational and wire agenticTab as smart container</name>
  <files>src/ui/components/AgentTile.tsx, src/ui/components/RepoSection.tsx, src/ui/components/Dashboard.tsx, src/ui/agenticTab.tsx</files>
  <action>
Refactor all three components to be purely presentational (no useState, no useEffect, no postCommand imports), then update agenticTab.tsx to be the smart container. All functions must use arrow function declaration: `const name = (args) => {}`.

**src/ui/components/AgentTile.tsx:**
- Remove: postCommand import, handleTileClick/handleStop/handleDelete functions
- Props interface `AgentTileProps`: `{ agent: AgentData; onFocus: () => void; onStop: () => void; onDelete: () => void }`
- Keep the `isRunning` derived value (it's a simple derivation from props, acceptable in presentational)
- Use props.onFocus as onClick on the tile div, props.onStop for stop button, props.onDelete for delete button
- Keep all existing JSX structure and class names exactly the same
- Keep StatusIcon, ActionButton, ElapsedTimer atom usage unchanged

**src/ui/components/RepoSection.tsx:**
- Remove: useState import, postCommand import, handleRoot/handleCreate/handleRemove functions, collapsed state
- Props interface `RepoSectionProps`: `{ repo: RepoData; scope: string; collapsed: boolean; onRoot: () => void; onCreate: () => void; onRemove: () => void; onToggleCollapse: () => void; getAgentCallbacks: (repoPath: string, agentName: string) => AgentCallbacks }`
- Import AgentCallbacks type from "../hooks/useAgentActions"
- Use props.collapsed instead of local state
- Use props.onToggleCollapse for the collapse button onClick
- Use props.onRoot, props.onCreate, props.onRemove for the action buttons
- For each AgentTile, call `getAgentCallbacks(agent.repoPath, agent.agentName)` and spread the callbacks as props: `<AgentTile agent={agent} {...getAgentCallbacks(agent.repoPath, agent.agentName)} />`
- Keep console.log for render: `console.log("[RepoSection] render", repo.name, repo.agents.length, "agents")`
- Keep all existing JSX structure, class names, conditional rendering exactly the same

**src/ui/components/Dashboard.tsx:**
- Remove: useState, useEffect, postCommand imports, data state, message listener
- Props interface `DashboardProps`: `{ data: DashboardData | null; onRootGlobal: () => void; onAddRepo: () => void; collapsedRepos: Record<string, boolean>; getRepoCallbacks: (repoPath: string) => RepoCallbacks; getAgentCallbacks: (repoPath: string, agentName: string) => AgentCallbacks }`
- Import RepoCallbacks from "../hooks/useRepoActions" and AgentCallbacks from "../hooks/useAgentActions"
- If data is null, render the loading div (same as before)
- Toolbar buttons use props.onRootGlobal and props.onAddRepo
- For each repo, get callbacks via `getRepoCallbacks(repo.path)` and pass to RepoSection along with `collapsed={collapsedRepos[repo.path] ?? false}` and `getAgentCallbacks={getAgentCallbacks}`
- Keep all existing JSX structure and class names exactly the same

**src/ui/agenticTab.tsx:**
- This becomes the smart container. Remove the current simple mount code.
- Create an `App` component that:
  1. Calls `useDashboardData()` to get `{ data, onRootGlobal, onAddRepo }`
  2. Calls `useRepoActions()` to get `{ collapsedRepos, getRepoCallbacks }`
  3. Calls `useAgentActions()` to get `{ getAgentCallbacks }`
  4. Returns `<Dashboard data={data} onRootGlobal={onRootGlobal} onAddRepo={onAddRepo} collapsedRepos={collapsedRepos} getRepoCallbacks={getRepoCallbacks} getAgentCallbacks={getAgentCallbacks} />`
- Keep the mount logic: getElementById("root"), createRoot, root.render(<App />)
- Keep console.log("[agenticTab] mounting React root")
  </action>
  <verify>
    <automated>cd /Users/norules/Documents/code/vscode-agentic && npx tsc --noEmit -p src/ui/tsconfig.json 2>&1 | head -30 && node -e "const fs=require('fs'); ['Dashboard','RepoSection','AgentTile'].forEach(f => { const c=fs.readFileSync('src/ui/components/'+f+'.tsx','utf8'); if(c.includes('useState') || c.includes('useEffect') || c.includes('postCommand')) { console.error('FAIL: '+f+' still has logic'); process.exit(1); } }); console.log('PASS: all components are pure presentational')"</automated>
  </verify>
  <done>All three components are purely presentational (no useState, no useEffect, no postCommand). agenticTab.tsx is the single smart container using custom hooks. TypeScript compiles without errors. The app renders identically -- same HTML structure, same class names, same behavior.</done>
</task>

</tasks>

<verification>
1. TypeScript compilation: `npx tsc --noEmit -p src/ui/tsconfig.json` passes with no errors
2. No logic in components: Dashboard.tsx, RepoSection.tsx, AgentTile.tsx contain zero useState/useEffect/postCommand
3. All logic in hooks: useDashboardData.ts, useRepoActions.ts, useAgentActions.ts contain all state and side effects
4. agenticTab.tsx is the single smart container calling all hooks
5. Build succeeds: `npm run build` completes without errors
</verification>

<success_criteria>
- Zero useState/useEffect/postCommand in any component file (Dashboard, RepoSection, AgentTile)
- Three new hook files in src/ui/hooks/ with all extracted logic
- agenticTab.tsx uses all three hooks and passes everything to Dashboard as props
- TypeScript compiles cleanly
- Extension builds successfully
</success_criteria>

<output>
After completion, create `.planning/quick/1-refactor-ui-atoms-components-pure-presen/1-SUMMARY.md`
</output>
