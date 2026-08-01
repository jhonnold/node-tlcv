# Deploying to Production

This service runs in production at https://ccrl.live/. This doc records the
deployment procedure as actually performed on the production host.

## Production Environment

- **Host**: `ccrl` (configured in `~/.ssh/config`)
- **Deploy path**: `/var/www/node-tlcv`
- **Reverse proxy**: nginx-proxy-manager fronts the Node server
- **Process manager**: systemd unit `tlcv.service`
  - `systemctl status tlcv`, `journalctl -u tlcv`
- **Public URL**: https://ccrl.live/
- **Config**: env-driven via `.env` (loaded through `dotenv/config`). Backend port
  is `PORT`, defaulting to 8080 (`src/main.ts`).

> **CRITICAL**: During `git pull`, you MUST NOT overwrite `config/config.json` in
> the production environment. The running service actively manages that file
> (`src/config/config-store.ts` manages kibitzer IDs, broadcast connections,
> connection history, etc.) and clobbering it risks closing, changing, or losing
> live broadcasts. Stash or otherwise preserve the prod config across the pull.

## UI-only changes

Frontend artifacts are served directly by Express, so no service restart is needed
— just rebuild the bundles in place.

Steps:

1. `ssh ccrl`
2. `cd /var/www/node-tlcv`
3. `git stash push -- config/config.json` (preserve the live config)
4. `git pull`
5. `git stash pop` (restore the live config)
6. `npm run prebuild` (webpack production build of public assets)

One-liner:

```bash
ssh ccrl 'cd /var/www/node-tlcv && git stash push -- config/config.json && git pull && git stash pop && npm run prebuild'
```

## Backend (or full) changes

Backend changes require recompiling TypeScript and restarting the systemd service.

Steps:

1. `ssh ccrl`
2. `cd /var/www/node-tlcv`
3. `git stash push -- config/config.json` (preserve the live config)
4. `git pull`
5. `git stash pop` (restore the live config)
6. `npm run build` (runs `prebuild` for the frontend, then compiles the backend)
7. `sudo systemctl restart tlcv`

One-liner:

```bash
ssh ccrl 'cd /var/www/node-tlcv && git stash push -- config/config.json && git pull && git stash pop && npm run build && sudo systemctl restart tlcv'
```

## Verification

After a backend deploy, confirm the service restarted and is serving traffic:

```bash
ssh ccrl 'systemctl is-active tlcv && curl -s -o /dev/null -w "%{http_code}\n" https://ccrl.live/'
```

Log warnings like `Received an odd ordering of messages!` and
`Failed to parse ... ! Loading from FEN...` right after a restart are normal — the
service reconnects mid-broadcast and skips stale/out-of-order messages until it
catches up. They are not errors.
