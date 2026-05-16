---
name: deploy
description: Ship a new version of the Agentic VS Code extension — bump version, update CHANGELOG.md, build the VSIX, commit + push, and publish to the VS Code Marketplace via vsce. Use when the user asks to "deploy", "publish", "release", "ship a new version", or to bump the version. Assumes the user is already logged into vsce (`npx vsce login wimmol`).
---

# Deploy the Agentic extension

Run end-to-end: version bump → changelog → build → commit → push → marketplace publish.

## Inputs

Ask the user (with `AskUserQuestion`) for both **before** doing anything if not supplied:

1. **Bump kind** — `patch` (default), `minor`, or `major`. Maps onto the third / second / first number in `package.json` `version`.
2. **Changelog blurb** — 1–3 sentences describing what's shipping in this release. Used to seed the new `## [vX.Y.Z]` section. If they gave a clear commit-style description in the conversation, repeat it back and ask for confirmation.

If the user already named both in the request ("deploy 0.9.0, this changes…"), skip the prompts.

## Steps

### 1. Read current version

```bash
grep '"version"' package.json
```

Compute the new version from the bump kind. Do not hand-edit if you can avoid it — use `sed`:

```bash
sed -i 's/"version": "X.Y.Z"/"version": "X.Y.W"/' package.json
```

Verify with another `grep '"version"'`.

### 2. Update CHANGELOG.md

Prepend a new section dated today (use the date in the system context, not `$(date)`, so the entry matches the commit date metadata):

```bash
cat > /tmp/changelog_prepend.md <<'EOF'
# Changelog

## [vX.Y.Z] - YYYY-MM-DD

### <Fixed | Added | Changed>

- <bullet derived from user's blurb — concrete, names file paths / functions where useful>

EOF
tail -n +2 CHANGELOG.md > /tmp/changelog_rest.md
cat /tmp/changelog_prepend.md /tmp/changelog_rest.md > CHANGELOG.md.new
mv CHANGELOG.md.new CHANGELOG.md
head -10 CHANGELOG.md
```

Match the tone of existing entries in `CHANGELOG.md`: short header bullets backed by specific file / symbol references, no marketing language.

### 3. Build the VSIX

`npm` lives under `~/.nvm/versions/node/v24.15.0/bin` on this machine and is **not** on `PATH` by default. Always export it first:

```bash
export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH"
npm run package
```

`npm run package` runs `vscode:prepublish` (typecheck + production esbuild) and `vsce package`, producing `vscode-agentic-X.Y.Z.vsix` at the repo root.

If typecheck fails, **stop** — fix it before continuing. Don't ship a build that doesn't compile.

### 4. Remove the previous VSIX

Only the newest VSIX should remain at the repo root:

```bash
ls *.vsix
rm vscode-agentic-<previous>.vsix
```

`*.vsix` is in `.gitignore`, so this is filesystem-only — no `git rm` needed.

### 5. Commit

```bash
git add CHANGELOG.md package.json <any source files you also changed>
git commit -m "$(cat <<'EOF'
vX.Y.Z: <one-line subject matching the changelog header>

<paragraph describing the change, free-form, matches commit style of
previous releases like `32ac1b9` and `746f208`>
EOF
)"
```

Use a HEREDOC so newlines survive. Do **not** add Claude co-author trailers.

### 6. Push

```bash
git push origin master
```

If push is rejected (non-fast-forward), stop and ask the user — never `--force` here.

### 7. Publish to the marketplace

The user is already logged in as `wimmol` (`npx vsce ls-publishers` will print `wimmol`). Publish the freshly-built VSIX explicitly so `vsce` doesn't rebuild:

```bash
export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH"
npx vsce publish --packagePath vscode-agentic-X.Y.Z.vsix
```

Expected success output ends with `DONE  Published wimmol.vscode-agentic vX.Y.Z.`

If you see `ERROR  Patch Authentication Failed` or a 401, the PAT has expired — tell the user to re-run `npx vsce login wimmol` and try again. Don't loop on retries.

### 8. Report back

End with a short summary:
- New version published
- Git SHA pushed
- Marketplace URL: `https://marketplace.visualstudio.com/items?itemName=wimmol.vscode-agentic`

## Notes

- The marketplace takes a few minutes to reindex; the URL works but the version number on the page can lag.
- The repo root keeps exactly one VSIX (the latest). It's gitignored — it's just a local convenience artifact.
- If the user asks to deploy but there are uncommitted changes outside `package.json` / `CHANGELOG.md`, surface that first via `git status --short` and ask whether they should be part of the release commit.
- This skill assumes the working branch is `master` and the remote is `origin`. If the user is on a feature branch, ask before pushing.
