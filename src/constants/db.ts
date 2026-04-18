export const STORE_REPOSITORIES = 'agentic.repositories';
export const STORE_AGENTS = 'agentic.agents';
export const STORE_WORKTREES = 'agentic.worktrees';
export const STORE_EXPLORER_STATE = 'agentic.explorerState';
export const STORE_ZONE_EXPANDED = 'agentic.zoneExpanded';
export const STORE_TEMPLATES = 'agentic.templates';
export const STORE_SCHEMA_VERSION = 'agentic.schemaVersion';

/** Bump whenever a stored shape changes. Migrations run in StateStorage.migrate. */
export const CURRENT_SCHEMA_VERSION = 2;
