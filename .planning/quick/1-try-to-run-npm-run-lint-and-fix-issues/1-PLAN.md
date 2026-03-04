---
phase: quick
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - src/commands/agent.commands.ts
  - src/commands/diff.commands.ts
  - src/commands/sidebar.commands.ts
  - src/extension.ts
  - src/services/diff.service.ts
  - src/services/repo-config.service.ts
  - src/services/workspace-switch.service.ts
  - src/utils/branch-validation.ts
  - test/unit/agent-tree-items.test.ts
  - test/unit/agent-tree-provider.test.ts
  - test/unit/agent.commands.test.ts
  - test/unit/agent.service.test.ts
  - test/unit/diff.commands.test.ts
  - test/unit/git-content.provider.test.ts
  - test/unit/repo-config.service.test.ts
  - test/unit/sidebar.commands.test.ts
  - test/unit/terminal.service.test.ts
  - test/unit/workspace-switch.service.test.ts
  - test/unit/worktree.commands.test.ts
  - test/unit/worktree.service.test.ts
autonomous: true
requirements: []
must_haves:
  truths:
    - "npm run lint exits with code 0 (no errors)"
    - "npm run test still passes after lint fixes"
  artifacts:
    - path: "src/utils/branch-validation.ts"
      provides: "Fixed regex without control character lint errors"
  key_links: []
---

<objective>
Run `npm run lint` (biome check .), fix all errors so lint passes clean, and clean up easy warnings.

Purpose: The codebase has 34 lint errors (18 formatting, 14 import organization, 2 regex control character) and 116 warnings. The errors cause `npm run lint` to exit non-zero.

Output: Clean lint run with 0 errors. Warnings reduced where auto-fixable.
</objective>

<execution_context>
@/Users/norules/.claude/get-shit-done/workflows/execute-plan.md
@/Users/norules/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
Biome 2.4.5 with config in biome.json. Lint command: `biome check .`
Fix command: `biome check --write .` (safe fixes), `biome check --write --unsafe .` (includes unsafe fixes).

Current error breakdown (34 errors):
- 18 format errors across 18 files (auto-fixable)
- 14 assist/source/organizeImports errors across 14 files (auto-fixable)
- 2 lint/suspicious/noControlCharactersInRegex errors in src/utils/branch-validation.ts:23 (manual fix)

Current warning breakdown (116 warnings, informational):
- 82 lint/style/noNonNullAssertion (37 FIXABLE, 45 manual)
- 26 lint/suspicious/noExplicitAny (configured as "warn" in biome.json)
- 6 lint/correctness/noUnusedImports (auto-fixable)
- 1 lint/style/useConst (auto-fixable)
- 1 lint/correctness/noUnusedPrivateClassMembers (unsafe auto-fixable)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Auto-fix all safe lint issues</name>
  <files>All 20 files listed in files_modified</files>
  <action>
    Run `npx biome check --write .` to auto-fix all safe issues:
    - 18 formatting errors (indentation, line width, etc.)
    - 14 import organization errors
    - 6 unused import warnings
    - 1 useConst warning (let -> const in agent.commands.ts:67)

    This resolves 32 of 34 errors and 7 of 116 warnings automatically.
  </action>
  <verify>
    <automated>npx biome check . --max-diagnostics=300 2>&1 | grep "^Found" | head -5</automated>
  </verify>
  <done>Format and organizeImports errors gone. Only noControlCharactersInRegex errors (2) remain.</done>
</task>

<task type="auto">
  <name>Task 2: Fix noControlCharactersInRegex errors in branch-validation.ts</name>
  <files>src/utils/branch-validation.ts</files>
  <action>
    Fix the regex on line 23 of src/utils/branch-validation.ts that triggers noControlCharactersInRegex.
    The current regex `/[\s~^:?*[\\\x00-\x1f\x7f]/.test(name)` uses literal control character ranges
    `\x00-\x1f` and `\x7f` which Biome flags.

    Suppress this specific lint rule for this line using a `// biome-ignore lint/suspicious/noControlCharactersInRegex: intentional - git ref validation requires checking for ASCII control characters` comment. This is the correct approach because git branch name validation genuinely needs to reject control characters -- the regex is correct by design, not accidental.

    Then run `npm run test` to confirm nothing breaks.
  </action>
  <verify>
    <automated>npx biome check . --max-diagnostics=300 2>&1 | grep "^Found" && npm run test 2>&1 | tail -5</automated>
  </verify>
  <done>npm run lint exits with 0 errors. npm run test still passes. Only warnings remain (noExplicitAny, noNonNullAssertion -- acceptable per biome.json config).</done>
</task>

</tasks>

<verification>
After both tasks:
1. `npm run lint` exits with code 0 (or exits non-zero only for warnings, not errors)
2. `npm run test` passes -- no regressions from formatting/import changes
3. Error count is 0 in biome output
</verification>

<success_criteria>
- `npm run lint` reports 0 errors
- `npm run test` passes
- No functional changes to code behavior -- only formatting, import ordering, and lint suppression
</success_criteria>

<output>
After completion, create `.planning/quick/1-try-to-run-npm-run-lint-and-fix-issues/1-SUMMARY.md`
</output>
