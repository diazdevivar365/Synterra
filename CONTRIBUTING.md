# Contributing to Forgentic

Forgentic (codename: **Synterra**) is a proprietary monorepo. This document covers the day-to-day contract: how to set the repo up, how to author commits so they pass pre-commit + CI, and how to diagnose common hook failures.

---

## Prerequisites

| Tool     | Version                   | Why                                           |
| -------- | ------------------------- | --------------------------------------------- |
| Node     | `22.x` (LTS)              | Pinned in `package.json` `engines` + `.nvmrc` |
| pnpm     | `10.x` (exact: `10.33.0`) | Pinned in `packageManager`                    |
| Git      | `>=2.42`                  | Sparse-checkout + improved partial clone      |
| Corepack | `enabled`                 | Activates the pinned pnpm automatically       |

```bash
# Recommended install via fnm:
fnm install 22 && fnm use 22
corepack enable
corepack prepare pnpm@10.33.0 --activate
```

Then from the repo root:

```bash
pnpm install            # installs deps AND runs `lefthook install` via the prepare hook
```

---

## Conventional commits — mandatory

All commits must follow the [Conventional Commits](https://www.conventionalcommits.org/) spec. Both the local `commit-msg` hook (lefthook → commitlint) and the CI `commitlint` job enforce this.

### Format

```
<type>(<scope>): <subject>

<body — optional, 72-col wrap preferred>

<footer — optional: BREAKING CHANGE, Refs, Co-Authored-By, etc.>
```

### Types

`feat`, `fix`, `perf`, `refactor`, `revert`, `docs`, `test`, `build`, `ci`, `chore`, `style`, `release`.

### Scopes

Must come from this enum (defined in `commitlint.config.cjs`):

- **apps**: `web`, `api`, `workers`
- **packages**: `db`, `auth`, `billing`, `aquila-client`, `ui`, `emails`, `telemetry`, `shared`
- **cross-cutting**: `infra`, `ci`, `docs`, `deps`, `tooling`, `tests`, `release`

### Good examples

```
feat(web): add workspace switcher with Cmd+K palette
fix(auth): reject empty workspace slugs in magic-link callback
perf(db): index workspace_members on (workspace_id, user_id)
chore(deps): bump drizzle-orm 0.36.0 -> 0.36.4
refactor(aquila-client): extract retry policy into its own module
docs(architecture): document control-plane / data-plane split
ci: cancel in-flight runs on superseded pushes
```

### Bad examples (will be rejected)

```
# ❌ missing scope
feat: add switcher

# ❌ unknown scope
feat(dashboard): add chart        # use `web` or split the UI into `ui` package first

# ❌ wrong casing / punctuation
Feat(Web): Added Thing.           # must be lower-case, no trailing period
```

### Breaking changes

Use the `!` shorthand OR a `BREAKING CHANGE:` footer (preferred for searchability):

```
feat(api)!: drop /v1/legacy-research endpoint

BREAKING CHANGE: customers on legacy-research must migrate to /v1/research.
```

---

## Pre-commit hook behaviour

Installed by `lefthook install` (via `pnpm install`'s `prepare` script). Runs on every `git commit`:

| Command              | Scope                                                         | Blocks commit?                                                   |
| -------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------- |
| `prettier --write`   | Staged files matching `*.{ts,tsx,…,md,mdx,yml,yaml,css,html}` | Yes — auto-fixes + re-stages                                     |
| `eslint --fix`       | Staged files matching `*.{ts,tsx,js,…}`                       | Yes — auto-fixes + re-stages; hard-fails on unfixable + warnings |
| `typecheck-affected` | Workspaces changed vs `HEAD` (via `turbo ...[HEAD]`)          | Yes                                                              |
| `test-affected`      | Same filter as above                                          | Yes                                                              |

Plus the `commit-msg` hook runs commitlint (see above).

### Fast paths

- Empty repo / tooling-only changes → affected filter matches zero workspaces → turbo exits instantly.
- Doc-only change (`*.md`) → prettier runs, eslint/typecheck/test don't match, commit is fast.
- On merge/rebase, typecheck + test are skipped (lefthook's `skip: [merge, rebase]`) to avoid re-running on every conflict resolution.

### Emergency skip (discouraged)

```bash
LEFTHOOK=0 git commit -m "…"   # skips all hooks — must be justified in PR
```

Never use `git commit --no-verify`. CI will reject the commit on push anyway.

---

## Pre-push hook

Runs `turbo typecheck` + `turbo test` on the whole graph. Catches regressions in packages that the pre-commit affected-filter missed (e.g. you changed a package A that a test in package B silently depends on).

---

## Troubleshooting

### `lefthook: command not found`

The `lefthook install` step failed silently. Fix:

```bash
pnpm install --force
pnpm exec lefthook install
```

### `commitlint: subject may not be empty` on merge commits

Merge commits from `git merge` have a default message that may not match the enum. Use:

```bash
git merge --no-ff <branch>   # keeps the merge commit
# then amend:
git commit --amend -m "chore(release): merge feature/xyz into main"
```

Or configure git to use a commit-message template. Automated merge commits from GitHub's "Squash + merge" UI are already conventional when the PR title is.

### Pre-commit keeps re-formatting my file in an infinite loop

This usually means `.prettierrc.mjs` and `eslint-config-prettier` disagree. File an issue — we shouldn't see this because `eslint-config-prettier` disables every rule that fights Prettier. Check `pnpm exec eslint-config-prettier <file>` to see conflicting rules.

### `pnpm turbo run typecheck --filter='...[HEAD]'` runs on everything

Turbo's `[HEAD]` filter requires git history to be present. If you're in a shallow clone (`--depth=1`), expand it: `git fetch --unshallow`.

### CI `commitlint` job fails but my local `commit-msg` hook passed

You likely edited the commit message via `git commit --amend --no-edit` without re-running the hook. Re-push with a rebased range:

```bash
git rebase -i HEAD~N   # fix the offending commit message
git push --force-with-lease
```

(Only do `--force-with-lease` on your own feature branch, never `main`.)

---

## Before opening a PR

1. `pnpm lint` — green
2. `pnpm typecheck` — green
3. `pnpm test` — green
4. If UI change: `pnpm test:e2e` locally against a running `pnpm dev`
5. `tasks/todo.md` updated if closing a workstream item
6. PR description follows `.github/PULL_REQUEST_TEMPLATE.md`
7. Branch is rebased on latest `main` (not merged)

---

## Code of conduct

Be direct, be specific, argue the design not the author. Lefthook / CI / reviewers are there to catch mistakes — a rejected PR is not a personal failing, it's the system working as intended.
