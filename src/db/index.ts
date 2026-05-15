import * as vscode from 'vscode';
import { StateStorage } from './StateStorage';
import {
  STORE_REPOSITORIES,
  STORE_AGENTS,
  STORE_WORKTREES,
  STORE_SCHEMA_VERSION,
} from '../constants/db';

export { StateStorage } from './StateStorage';

const WORKSPACE_SCOPED_KEYS = [
  STORE_REPOSITORIES,
  STORE_AGENTS,
  STORE_WORKTREES,
  STORE_SCHEMA_VERSION,
] as const;

/**
 * One-shot migration from globalState (legacy) to workspaceState. The first
 * workspace to activate under the new code claims any pre-existing global
 * data; subsequent workspaces start empty. Templates are not migrated —
 * they remain in globalState so they stay shared across workspaces.
 */
const migrateGlobalToWorkspace = async (context: vscode.ExtensionContext): Promise<void> => {
  await Promise.all(
    WORKSPACE_SCOPED_KEYS.map(async (key) => {
      const legacy = context.globalState.get(key);
      if (legacy === undefined) return;
      if (context.workspaceState.get(key) === undefined) {
        await context.workspaceState.update(key, legacy);
      }
      await context.globalState.update(key, undefined);
    }),
  );
};

/**
 * Creates a StateStorage. Repos / agents / worktrees / schema version /
 * explorer expand state are scoped to the current workspace; templates
 * stay global so they can be reused across workspaces.
 */
export const createStateStorage = async (context: vscode.ExtensionContext): Promise<StateStorage> => {
  await migrateGlobalToWorkspace(context);
  const storage = new StateStorage(context.workspaceState, context.globalState);
  await storage.runMigrations();
  return storage;
};
