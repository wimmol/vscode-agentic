# Technology Stack

**Analysis Date:** 2026-03-04

## Languages

**Primary:**
- TypeScript ~5.8.0 - All source code in `src/` and `test/`

**Secondary:**
- JavaScript (CommonJS) - Build script `esbuild.js`

## Runtime

**Environment:**
- Node.js v22.14.0 (detected in environment)
- VS Code Extension Host - primary runtime context; extension runs inside VS Code process

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present (lockfileVersion 3)

## Frameworks

**Core:**
- VS Code Extension API (`@types/vscode` ^1.96.0) - Extension host, TreeView, terminals, commands, Memento state, TextDocumentContentProvider

**Testing:**
- Vitest ^3.2.4 - Unit test runner (configured in `vitest.config.ts`)
- `@vscode/test-cli` ^0.0.12 - Integration test runner (invoked via `npm run test:integration`)
- `@vscode/test-electron` ^2.5.2 - Electron-based integration test harness

**Build/Dev:**
- esbuild ^0.27.3 - Bundles extension to `dist/extension.js` (CJS format, Node platform)
- `npm-run-all2` ^8.0.4 - Parallel watch scripts
- `@vscode/vsce` ^3.7.1 - Extension packaging and publishing

## Key Dependencies

**Critical:**
- `vscode` (virtual/external) - VS Code API; marked `external` in esbuild, resolved from the extension host at runtime
- `@types/vscode` ^1.96.0 - TypeScript types for the VS Code API; engine requirement `vscode: ^1.96.0`

**Infrastructure:**
- `@types/node` ^22.19.13 - Node.js built-in types (used for `node:child_process`, `node:path`, `node:util`)

**No runtime npm dependencies** - The extension has zero production `dependencies`; all packages are `devDependencies`. The bundle is fully self-contained except for the `vscode` external.

## Configuration

**TypeScript:**
- `tsconfig.json` - `module: Node16`, `target: ES2022`, `strict: true`, `rootDir: src`, `outDir: dist`, `noEmit: true` (tsc used only for type-checking; esbuild does actual emit)

**Linting/Formatting:**
- `biome.json` - Biome 2.4.5; tab indentation, 100-char line width, recommended linting rules, `noExplicitAny: warn`, import organization enabled, VCS git integration on

**Build:**
- `esbuild.js` - Entry point `src/extension.ts`, output `dist/extension.js`, CJS format, Node platform, `vscode` external, source maps in dev, minification in production

**VS Code Extension Manifest:**
- `package.json` `contributes` section defines:
  - Commands, menus, TreeView container (`vscode-agentic`), activity bar icon
  - Configuration properties: `maxAgentsPerRepo` (default 5), `maxWorktreesPerRepo` (default 5), `maxConcurrentAgents` (default 10)
- `main`: `./dist/extension.js`

## Build Scripts

```bash
npm run compile          # Type-check + esbuild bundle (dev)
npm run package          # Type-check + esbuild bundle (production, minified)
npm run watch            # Parallel: esbuild --watch + tsc --watch
npm run check-types      # tsc --noEmit only
npm run test             # vitest run (unit tests)
npm run test:watch       # vitest (watch mode)
npm run test:integration # vscode-test (Electron integration tests)
npm run lint             # biome check .
npm run lint:fix         # biome check --write .
npm run format           # biome format --write .
```

## Platform Requirements

**Development:**
- Node.js 22+
- VS Code ^1.96.0 (for extension host)
- `git` in PATH (required at runtime for worktree operations)
- `claude` CLI in PATH (required at runtime for agent terminals; Claude Code CLI)
- `gh` CLI in PATH (optional at runtime for PR creation via `vscode-agentic.createPR`)

**Production:**
- VS Code ^1.96.0 extension host
- All three CLIs above must be available in the user's PATH

---

*Stack analysis: 2026-03-04*
