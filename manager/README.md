# Manager

Private tooling for `ko/` translation management.

## Branch Strategy

```
source (justrealmilk/...)  ← upstream, fetch-only
origin (zenyr/...)         ← fork

Branches:
  master  → clean, sync-able with source, no manager/
  forked  → has manager/ + root package.json, daily work
```

## Workflow

1. Work on `forked` branch
2. Run `bun run manager sync` to merge into `master` (auto-excludes `manager/`, `package.json`)
3. Create PR branch from `master` → submit to `source`

## Commands

```bash
bun run manager stats             # translation stats
bun run manager find-untranslated # list 🦘 markers
bun run manager sync              # forked → master (excluding private files)
bun run manager --help            # show help
```

## Design Decisions

- Private files exist only in `forked` branch: `manager/`, `package.json`, `AGENTS.md`
- `master` stays pristine for clean PRs to upstream
- Intentional desync between branches
