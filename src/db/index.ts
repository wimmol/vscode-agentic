import * as vscode from 'vscode';
import { StateStorage } from './StateStorage';
import {
  STORE_REPOSITORIES,
  STORE_AGENTS,
  STORE_WORKTREES,
  STORE_EXPLORER_STATE,
  STORE_ZONE_EXPANDED,
  STORE_TEMPLATES,
  STORE_SCHEMA_VERSION,
} from '../constants/db';

export { StateStorage } from './StateStorage';

const CROSS_WORKSPACE_KEYS = [
  STORE_REPOSITORIES,
  STORE_AGENTS,
  STORE_WORKTREES,
  STORE_TEMPLATES,
  STORE_ZONE_EXPANDED,
  STORE_SCHEMA_VERSION,
] as const;

/**
 * One-shot migration from workspaceState (legacy) to globalState.
 * Runs during createStateStorage before the StateStorage instance takes over.
 * Leaves STORE_EXPLORER_STATE in workspaceState because expanded-folder state
 * is per-workspace UI state, not cross-workspace data.
 */
const migrateWorkspaceToGlobal = async (context: vscode.ExtensionContext): Promise<void> => {
  for (const key of CROSS_WORKSPACE_KEYS) {
    const legacy = context.workspaceState.get(key);
    if (legacy === undefined) continue;
    const current = context.globalState.get(key);
    if (current !== undefined) continue;
    await context.globalState.update(key, legacy);
    await context.workspaceState.update(key, undefined);
  }
};

/**
 * Creates a StateStorage. Cross-workspace data lives in globalState so that
 * agents and repo configs persist across different VS Code workspaces.
 * Per-workspace UI state (explorer expand) stays in workspaceState.
 */
export const createStateStorage = async (context: vscode.ExtensionContext): Promise<StateStorage> => {
  await migrateWorkspaceToGlobal(context);
  const storage = new StateStorage(context.globalState, context.workspaceState);
  await storage.runMigrations();
  return storage;
};
