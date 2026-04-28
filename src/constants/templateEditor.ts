// Webview → Extension
export const TE_CMD_READY = 'te.ready';
export const TE_CMD_CREATE = 'te.create';
export const TE_CMD_UPDATE = 'te.update';
export const TE_CMD_SET_DEFAULT = 'te.setDefault';
export const TE_CMD_REMOVE = 'te.remove';

// Extension → Webview
export const TE_MSG_STATE = 'te.state';

/** View type for the template editor webview panel. */
export const TE_VIEW_TYPE = 'vscode-agentic.templateEditor';
/** Command id bound to opening the panel. */
export const TE_COMMAND_OPEN = 'vscode-agentic.manageTemplates';

/** Sentinel id for the unsaved "new template" draft row. */
export const TE_DRAFT_ID = '__draft__';
