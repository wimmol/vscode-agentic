# VS Code Extension Rules

## Extension Logic

- **Disposable pattern is mandatory.** Push every subscription, listener, watcher, and provider into `context.subscriptions`. Leaked disposables accumulate and cause memory issues.
- Never use `*` as an activation event in production. Use the most specific activation event: `onCommand`, `onLanguage`, `workspaceContains`, `onView`, etc.
- Register commands with `vscode.commands.registerCommand()` — always push the returned Disposable to `context.subscriptions`.
- Follow the VS Code event naming convention: `on[Will|Did]VerbNoun` — e.g., `onDidChangeConfiguration`, `onWillSaveTextDocument`.
- Use `vscode.workspace.getConfiguration('yourExtension')` for settings — never hardcode values users might want to change.
- Expose all configurable behavior through `contributes.configuration` in `package.json`.
- Use `vscode.window.withProgress()` for long-running operations — never block the UI without feedback.
- Prefer `vscode.workspace.fs` over Node.js `fs` for file operations — it works with remote and virtual file systems.
- Use `vscode.Uri` for all path handling — never construct file paths with string concatenation.
- Always check `vscode.window.activeTextEditor` for `undefined` before accessing it.
- Use `vscode.languages.registerCodeActionsProvider()` with explicit `CodeActionKind` values.
- For tree views, implement `TreeDataProvider` with proper `getTreeItem()` and `getChildren()` — always fire `onDidChangeTreeData` when data updates.

## Extension UI

- Use React with React hooks.
- Create a separate component for each UI element.
- All UI lives in `src/ui/` with this structure:
  - `atoms/` — small presentational components
  - `components/` — reusable components with logic
  - `view.ts` — where all UI is combined
  - `agenticTab.ts` — business logic and render entry point
- Do not overengineer. Write code as simple as possible.

## Architecture

- Make things as simple as possible.
- Do not create large classes.
- Try not to split code of one feature across many separate files and functions.
- Keep the codebase consistent.
- Add `console.log` calls to see function call chains.
