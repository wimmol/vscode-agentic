---
status: diagnosed
trigger: "Sidebar loses agents when focusAgent switches workspace folders via updateWorkspaceFolders"
created: 2026-03-07T00:00:00.000Z
updated: 2026-03-07T00:00:00.000Z
---

## Current Focus

hypothesis: All three services (AgentService, RepoConfigService, WorktreeService) use context.workspaceState which is scoped to the current workspace folder -- when focusAgent calls updateWorkspaceFolders to switch to the agent's worktree directory, VS Code re-activates the extension with a DIFFERENT workspaceState, causing all data to vanish.
test: Code trace through extension.ts and all service constructors
expecting: Confirmed that workspaceState is the sole storage mechanism for all persistent data
next_action: Return diagnosis

## Symptoms

expected: Clicking an agent tile should focus the agent terminal and switch to the worktree folder. The sidebar should continue showing ALL agents and repos regardless of which workspace folder is active.
actual: Clicking an agent tile switches workspace folders (updateWorkspaceFolders), the extension re-activates with a new workspaceState scoped to the worktree folder, and the sidebar goes blank -- all repos and agents disappear.
errors: No error messages -- the sidebar simply renders empty because the services read from a fresh, empty workspaceState.
reproduction: 1) Add a repo, 2) Create an agent, 3) Click the agent tile to focus it, 4) Observe sidebar goes blank.
started: Always broken -- inherent to the architecture since workspaceState was chosen as the storage mechanism.

## Eliminated

(none -- root cause found on first hypothesis)

## Evidence

- timestamp: 2026-03-07T00:00:00.000Z
  checked: src/extension.ts lines 14-18
  found: All three services are initialized with context.workspaceState -- AgentService(context.workspaceState, ...), RepoConfigService(context.workspaceState, ...), WorktreeService(..., context.workspaceState)
  implication: Every piece of persistent data in the extension is workspace-scoped

- timestamp: 2026-03-07T00:00:00.000Z
  checked: src/services/agent.service.ts lines 46-51
  found: getRegistry() reads from this.state.get(AGENT_REGISTRY_KEY, []) and saveRegistry() writes to this.state.update(AGENT_REGISTRY_KEY, entries) -- where this.state is the workspaceState Memento
  implication: Agent registry is stored per-workspace-folder, not globally

- timestamp: 2026-03-07T00:00:00.000Z
  checked: src/services/repo-config.service.ts lines 24-25
  found: getAll() reads from this.state.get(REPO_CONFIGS_KEY, []) -- same workspaceState pattern
  implication: Repo configurations are also stored per-workspace-folder

- timestamp: 2026-03-07T00:00:00.000Z
  checked: src/services/worktree.service.ts lines 199-204
  found: getAllManifestEntries() reads from this.state.get(WORKTREE_MANIFEST_KEY, []) -- same workspaceState pattern
  implication: Worktree manifest is also stored per-workspace-folder

- timestamp: 2026-03-07T00:00:00.000Z
  checked: src/commands/agent.commands.ts lines 128-144
  found: focusAgent command calls vscode.workspace.updateWorkspaceFolders(0, length, { uri: worktreePath }) -- this REPLACES all workspace folders with the agent's worktree directory
  implication: This is the trigger that changes the workspace identity, causing VS Code to re-activate the extension with a different workspaceState

- timestamp: 2026-03-07T00:00:00.000Z
  checked: package.json line 12
  found: activationEvents is [] -- the extension relies on implicit activation from the contributed view. When workspace folders change, VS Code may deactivate and re-activate the extension.
  implication: Re-activation creates fresh service instances that read from the NEW workspace's (empty) workspaceState

## Resolution

root_cause: |
  THREE INTERACTING PROBLEMS cause the sidebar to go blank:

  1. DATA STORAGE IS WORKSPACE-SCOPED (primary cause)
     All three services (AgentService, RepoConfigService, WorktreeService) receive context.workspaceState
     as their Memento store (src/extension.ts lines 14-18). workspaceState is scoped to the currently
     open workspace folder. When the workspace folder changes, the data is simply not there.

     Storage keys affected:
     - "vscode-agentic.agentRegistry" (agent entries)
     - "vscode-agentic.repoConfigs" (repo configurations)
     - "vscode-agentic.worktreeManifest" (worktree entries)

  2. focusAgent REPLACES ALL WORKSPACE FOLDERS (trigger)
     src/commands/agent.commands.ts lines 137-141:
     vscode.workspace.updateWorkspaceFolders(0, length, { uri: worktreeUri })
     This replaces the ENTIRE workspace folder list with a single worktree folder.
     This changes the workspace identity from the user's original folder to the agent's worktree.

  3. EXTENSION RE-ACTIVATION WITH FRESH STATE (mechanism)
     When workspace folders change via updateWorkspaceFolders, VS Code may deactivate and
     re-activate the extension. The activate() function (src/extension.ts) creates brand new
     service instances using the NEW context.workspaceState, which is scoped to the worktree
     folder -- a folder that has never had any data stored in it.

  The result: the SidebarViewProvider calls repoConfigService.getAll() which returns [] from the
  new empty workspaceState, and agentService.getForRepo() also returns []. The sidebar renders
  with zero repos and zero agents.

fix: (not applied -- diagnosis only)
verification: (not applied -- diagnosis only)
files_changed: []
