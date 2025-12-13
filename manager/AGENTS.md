# Agent Instructions

Translation management for `ko/` in braytech.org-translations.

## Repository Structure

```
Remotes:
  origin  → zenyr/... (fork)
  source  → justrealmilk/... (upstream, fetch-only)

Branches:
  master  → clean, PR-ready, no private files
  forked  → daily work, includes manager/, package.json, AGENTS.md
```

## Key Rules

1. **Never commit private files to master**: `manager/`, `package.json`, `AGENTS.md`
2. **Use `bun run manager sync`** to merge forked → master (auto-excludes private files)
3. **PRs to upstream**: always branch from `master`, never include private files

## Commands (run from root)

```bash
bun run manager stats             # ko/ translation stats
bun run manager find-untranslated # list untranslated (🦘 marker)
bun run manager sync              # forked → master merge
bun run manager --help            # show help
```

## Translation Workflow

1. Work on `forked` branch
2. Edit `ko/translation.json`
3. Commit changes
4. `bun run manager sync` → creates clean merge in `master`
5. From `master`, create PR branch → submit to `source`

## Commit Convention

**Translation commits:**
```
ko: Add Action.Browse, Action.Edit
ko: Update Error messages
ko: Fix typo in Settings
```

**Manager commits (private, never in PRs):**
```
✴︎ manager: add sync command
✴︎ manager: refactor CLI structure
```

Rules:
- **Always separate** translation commits from manager commits
- Translation commits → can go to upstream via PR
- `✴︎` prefix → private, stays in `forked` branch only

## Conventions

- Untranslated strings marked with 🦘 prefix
