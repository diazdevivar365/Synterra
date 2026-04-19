# SETUP — Forgentic local development

This is the hard contract for getting a clean Forgentic environment up. If `pnpm install` fails, the cause is almost always on this page.

---

## TL;DR

```bash
# 1. Install fnm (Arch):
sudo pacman -S fnm

# 2. Enable fnm auto-switch in your shell (zsh shown; bash: ~/.bashrc):
echo 'eval "$(fnm env --use-on-cd --shell zsh)"' >> ~/.zshrc
exec zsh

# 3. Clone + enter:
git clone git@github.com:diazdevivar365/Forgentic.git
cd Forgentic

# 4. fnm auto-reads .nvmrc and installs + activates Node 22:
fnm use          # or just `cd` in — auto-switch fires

# 5. Activate pinned pnpm (shipped with Node 22 via corepack):
corepack enable
corepack prepare pnpm@10.33.0 --activate

# 6. Install workspace:
pnpm install

# 7. Bring up local infra (Postgres + Redis + Mailpit):
docker compose -f infra/docker-compose.yml up -d

# 8. Run everything in parallel:
pnpm dev
```

---

## Why these specific tools?

### `fnm` (Fast Node Manager) — required

Arch ships **nodejs 25** (current, non-LTS). Forgentic's `package.json` pins `engines.node: ">=22.0.0 <23.0.0"` and `.npmrc` has `engine-strict=true` — so `pnpm install` with system Node will fail hard.

Why `fnm` over `nvm`:

- Arch-native package (`sudo pacman -S fnm`) — no curl-installer.
- 5 MB Rust binary vs `nvm`'s multi-thousand-line bash script.
- Auto-switch on `cd` via `.nvmrc` (set `--use-on-cd` in shell hook).
- Startup overhead ~15 ms vs `nvm`'s ~300 ms.

Inside the repo you see Node 22; outside the repo, your system Node (or whatever other project pins).

```bash
cd /path/to/Forgentic && node -v     # v22.x.y
cd ~                    && node -v   # your system default
```

### `corepack` — pnpm version pinning

`package.json#packageManager` = `pnpm@10.33.0`. Corepack (ships with Node 22) reads that and transparently uses the exact pnpm version, even if your global pnpm is different or missing.

- Don't `npm i -g pnpm` — that fights corepack.
- If `pnpm` isn't on PATH after `corepack enable`, log out + back in (PATH refresh).

### `.npmrc#engine-strict=true`

Without this, pnpm only **warns** about engine mismatches. With it, `pnpm install` exits non-zero. This is the defense that prevents future devs (or Claude sessions) from silently building on wrong Node.

### `.nvmrc` + `.node-version`

Both hold `22`. `fnm`/`nvm` read `.nvmrc`; `asdf`/`Volta` read `.node-version`. We ship both so any version manager Just Works.

---

## Common failure modes

### `pnpm install` fails with `Unsupported engine`

```
ERR_PNPM_UNSUPPORTED_ENGINE  Unsupported engine
Your Node version is incompatible with "...".
Expected version: >=22.0.0 <23.0.0
Got: v25.9.0
```

→ System Node is active. Run `fnm use` (or `cd` back into the repo with auto-switch configured). Verify `node -v` shows `v22.x.y` before retrying.

### `pnpm: command not found`

→ `corepack` isn't enabling the shim. Run `corepack enable` with sudo if needed, or log out/in for PATH to pick up `~/.local/share/corepack/bin`.

### `pnpm install` hangs on a peer dep

→ We run `strict-peer-dependencies=true`. Don't pass `--shamefully-hoist` or `--force`; fix the missing peer. The error message lists which package needs which peer.

### `fnm` doesn't auto-switch on `cd`

→ Shell hook missing `--use-on-cd`. Re-run:

```bash
echo 'eval "$(fnm env --use-on-cd --shell zsh)"' >> ~/.zshrc && exec zsh
```

### Node 22 downloaded but not activated

→ Run `fnm use` once inside the repo — reads `.nvmrc`. Or set default: `fnm default 22`.

---

## Editor setup

- **VS Code**: install `dbaeumer.vscode-eslint`, `esbenp.prettier-vscode`, `bradlc.vscode-tailwindcss`. The repo ships `.vscode/extensions.json` recommending these.
- **TypeScript version**: use "Workspace Version" (TS 5.9 from `node_modules`), not the VS Code bundled one.
- **Format on save**: enable it; Prettier config lives at `.prettierrc.mjs`.

---

## Verification checklist

Run these. All must pass before opening a PR:

```bash
node -v                 # v22.x.y
pnpm -v                 # 10.33.0
pnpm install            # no peer warnings, no engine errors
pnpm lint               # green
pnpm typecheck          # green
pnpm test               # green
pnpm build              # green
```

---

## References

- Plan: [`../PLAN.md`](../PLAN.md)
- Architecture: [`./ARCHITECTURE.md`](./ARCHITECTURE.md)
- Contributing (conventional commits, PR flow): [`../CONTRIBUTING.md`](../CONTRIBUTING.md)
- Active workstream: [`../tasks/todo.md`](../tasks/todo.md)
