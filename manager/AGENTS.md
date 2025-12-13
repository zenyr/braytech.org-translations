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
translate <key> <text>   # translate key, auto-preserve PUA/markdown/placeholders
                         # --dry-run: preview only
                         # --force: overwrite already-translated
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
- No markdown in translations (do not add `**`, `_`, etc. to JSON; display to user is OK)
- 사용자에게 존댓말 사용

## Translation Process Rules

- **Always use `manager translate`** for all translations (PUA char handling, placeholder validation)
- Never edit `ko/translation.json` directly
- **Glossary for proper nouns only** (Bungie, Discord, Destiny, etc.)
- **Check glossary before proposing translations** - use consistent terms for recurring words
- Review batches: max 10 items per review round for feedback efficiency
- **Show source text always** when presenting translations for review
- Present review in format: Key | Source | Proposal (no checkmarks until user approves)
