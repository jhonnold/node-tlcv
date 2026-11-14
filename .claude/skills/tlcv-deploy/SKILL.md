---
name: tlcv-deploy
description: Deploy node-tlcv to production (https://ccrl.live/, host `ccrl`, /var/www/node-tlcv, systemd unit `tlcv`) without overwriting the live config/config.json, and verify it. scripts/deploy.sh classifies the change from the files changed between ccrl's HEAD and origin/main: a UI-only rebuild (no restart), or a full build plus `systemctl restart tlcv`, with `npm ci` when package files change. It also covers running node-tlcv locally against a live broadcast port, and checking a dependabot PR (since `npm test` is a no-op). Use it for "deploy node-tlcv", "deploy it to ccrl", "push it live", "Squash merge PR#236. Sync local and deploy.", "Squash merged… then deploy" (node-tlcv), "is ccrl.live up after the deploy", "launch the server against a few graham ports", "is this dependabot PR safe to merge". The merge, sync and branch cleanup belong to github-pr. It is not for homelab services (use service-deploy) or for uci-to-tlcs.
---

# tlcv-deploy: shipping node-tlcv to ccrl

Production is documented in `docs/deploy.md`; read it first. That doc and this skill must agree, and the doc wins on facts.
The usual flow is: Jay squash-merges, then **github-pr** syncs local main and cleans up, then this skill deploys `origin/main` to ccrl.

## Deploy

```sh
S=.claude/skills/tlcv-deploy/scripts
$S/deploy.sh --dry           # one read-only ssh: git fetch + diff on ccrl, then print the classification and remote script
$S/deploy.sh                 # do it
$S/deploy.sh --mode full     # override when you know better (for example a shared/ change the classifier missed)
```

What `deploy.sh` does (it runs in `bash -s` on ccrl, so the login shell doesn't matter):

1. **Classify** with `git diff --name-only HEAD origin/main` on ccrl, piped through `scripts/classify.py`:
   - `web/`, `public/` or `vite.config.ts` gives **ui**: `npm run prebuild` (vite build into `build/public`). Express reads `build/public` per request, so there is no restart.
   - `src/`, `shared/`, `tsconfig*` or anything unknown gives **full**: `npm run build` (prebuild plus tsc), then `sudo systemctl restart tlcv`.
   - `package.json` or `package-lock.json` gives **full** plus `npm ci --no-audit --no-fund`.
   - `docs/`, `*.md` or `.github/` gives none; the script still pulls and runs a cheap prebuild.
   - **`config/config.json` itself changed in the repo** stops with exit 3: the stash pop would fight the live file, so ask Jay.
2. **Protect the live config.** Copy it to `~/tlcv-config-backup-<ts>.json`. Stash `config/config.json` only if it is dirty, then `git pull --ff-only origin main`, then pop. `diff -q` against the backup must be identical; otherwise abort and print the backup path.
3. **Build, restart if needed, and check on the box:** `git log -1`, `systemctl is-active tlcv`, `curl localhost:8080/`.
4. **Check from outside:** `https://ccrl.live/` must return 200. Also scan the last 2 minutes of `journalctl -u tlcv` for errors and warnings.

Report the deployed commit, the mode, `config-preserved`, the HTTP codes and any journal errors.

**Optional visual check.** For UI changes, open the live page with Playwright (preinstalled; `require('playwright')`) at widths 1440, 834 and 390, as was done for the Svelte redesign. To prove the new bundle is live, compare `curl -s https://ccrl.live/ | grep -o 'index-[A-Za-z0-9_-]*\.js'` with `ls build/public/assets` on ccrl.

## Run it locally against a live broadcast

Use this for "launch the server on your machine against a few graham ports; I'll connect and verify by hand".

```sh
npm run build
S=<scratchpad>; mkdir -p $S/cfg $S/pgns
echo '{"connections":["GrahamCCRL.dyndns.org:16073"]}' > $S/cfg/config.json
run-logged tlcv-debug-16073 --log $S/server.log -- env PORT=8099 CONFIG_DIR=$S/cfg PGNS_DIR=$S/pgns LOG_LEVEL=debug node build/src/main.js
systemctl --user list-units 'run-tlcv-debug*' --no-legend      # find the unit name
systemctl --user stop run-tlcv-debug-16073-<ts>                 # stop it this way, never pkill
```

- `CONFIG_DIR` and `PGNS_DIR` (`src/config/env.ts`) keep the repo's `config/config.json` and `pgns/` untouched.
- Each broadcast port can be watched by only one local instance, because the UDP bind is the broadcast port (`docs/gotchas.md`). Use one port per instance.
- Give Jay the port (8099 here) and the stop command.

## Dependabot PR check

`npm test` is `echo OK`. There are no tests. For each PR:

1. Check it out in a worktree.
2. Run `npm ci && npm run build && npm run check && npm run lint`.
3. Start it as in the local run above, and confirm the server starts, connects to a broadcast and receives updates.

Jay's correction: "make sure, along with what you already said, `npm run build && npm run start` work (i.e. the server starts connects and receives notifications)".

Then merge the safe ones with **github-pr**. Their merge loop polls `mergeable` and skips anything that isn't MERGEABLE. Deploy once, after the batch.

## Gotchas

- **Never overwrite prod `config/config.json`.** The running service writes it (kibitzer ids, connections, history); clobbering it can drop live broadcasts (`docs/deploy.md`, CRITICAL).
- **Don't `git stash push -- config/config.json` blindly.** With no local change it stashes nothing, and the following `stash pop` then pops an unrelated older stash. `deploy.sh` stashes only when the file is dirty.
- **A UI-only change needs no restart.** Restarting drops every viewer's socket for nothing. Only a backend change, or a change to package files, restarts `tlcv`.
- **Package changes need `npm ci` before the build.** Otherwise the build runs against the old `node_modules`. Vite 8 needs Node `^20.19.0 || >=22.12.0`; check `ssh ccrl node -v` if the build fails.
- **Some post-restart log noise is normal.** "Received an odd ordering of messages!" and "Failed to parse … Loading from FEN" are the service catching up mid-broadcast (`docs/deploy.md`).
- **Never commit `config/config.json` from a local checkout.** The main checkout has a dirty one on purpose; work in a worktree.
- **Don't edit the PR body with `gh pr edit`.** It fails (Projects classic); github-pr has the `gh api -X PATCH` workaround.

## Links

- `docs/deploy.md` (procedure, verification), `docs/gotchas.md` (UDP bind, Node version, config format).
- `AGENTS.md` (commands, verification = build, check, lint).
- `scripts/deploy.sh`, `scripts/classify.py`, `tests/run.sh` (fixtures are the real file lists of PRs #220, #224, #236, #237 and #238).
