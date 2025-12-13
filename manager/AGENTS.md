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

1. Never commit to master: `manager/`, `package.json`, `AGENTS.md`
2. Use `sync` to merge forked → master (auto-excludes private)
3. PRs to upstream: branch from `master`, no private files
4. Delegate commits to git subagent unless specified otherwise

## Commands (prefix: bun run manager)

```bash
stats                    # ko/ stats
find-untranslated        # list untranslated (🦘)
sync                     # forked → master
glossary                 # list|search <q>|add <term> <trans> [ctx]|remove <term> [ctx]
browse                   # [path]|get <path>|search <q>
```

## Translation Workflow

1. Work on `forked`, edit `ko/translation.json`, commit
2. `sync` → clean merge to `master`
3. From `master`, create PR branch → `source`

## Commit Convention

**Translation (can PR to upstream):**
```
ko: Add Action.Browse, Action.Edit
ko: Update Error messages
```

**Manager (private, stays in forked):**
```
✴︎ manager: add sync command
```

Rules:
- Separate translation/manager commits
- `✴︎` prefix → private only

## Conventions

- Untranslated strings marked with 🦘 prefix
