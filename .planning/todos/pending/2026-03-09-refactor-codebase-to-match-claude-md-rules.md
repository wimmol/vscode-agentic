---
created: 2026-03-09T16:37:49.797Z
title: Refactor codebase to match CLAUDE.md rules
area: general
files: []
---

## Problem

The codebase doesn't follow the conventions defined in CLAUDE.md. Four areas need attention:

1. **Imports** — need rewriting to match project conventions
2. **UI** — needs rewriting to React/hooks structure with proper folder layout (`src/ui/` with `atoms/`, `components/`, `view.ts`, `agenticTab.ts`)
3. **Unnecessary commands** — remove command registrations that should be direct UI action → service calls instead of going through the command palette
4. **Overall simplification** — reduce complexity, avoid large classes, keep feature code co-located, add console.logs for call chain visibility

## Solution

Systematic refactor pass:
- Audit current imports and align with VS Code best practices (vscode.Uri, vscode.workspace.fs, etc.)
- Restructure UI into React components under `src/ui/` with atoms/components separation
- Identify and remove commands that only serve as middlemen between UI and services
- Simplify classes, reduce file splitting, ensure disposable pattern compliance
