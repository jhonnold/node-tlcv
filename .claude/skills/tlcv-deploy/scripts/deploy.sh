#!/usr/bin/env bash
# Deploy origin/main of node-tlcv to ccrl (/var/www/node-tlcv, unit tlcv) without
# touching the live config/config.json.
#
#   deploy.sh [--dry] [--mode auto|ui|full] [--files FILE]
#     --dry         print the plan and the remote script; run nothing that changes prod
#     --mode        override the classification (default auto, from scripts/classify.py)
#     --files FILE  use this changed-file list instead of asking ccrl (needed for --dry offline)
#
# Exit: 0 deployed (or dry plan printed), 3 classify STOP, 1 any failure.
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
DRY=0; MODE=auto; FILES=
while [ $# -gt 0 ]; do case $1 in
  --dry) DRY=1 ;; --mode) MODE=$2; shift ;; --files) FILES=$2; shift ;;
  *) echo "unknown arg $1" >&2; exit 1 ;; esac; shift; done
R=/var/www/node-tlcv

# 1. read-only: what would change (ccrl's HEAD vs origin/main)
if [ -n "$FILES" ]; then changed=$(cat "$FILES")
else changed=$(ssh -o BatchMode=yes ccrl "cd $R && git fetch -q origin main && git diff --name-only HEAD origin/main"); fi
if [ -z "$changed" ]; then echo "nothing to deploy: ccrl is at origin/main"; exit 0; fi
set +e; plan=$(printf '%s\n' "$changed" | python3 -I "$HERE/classify.py"); rc=$?; set -e
echo "$plan"; [ $rc = 3 ] && exit 3; [ $rc = 0 ] || exit 1
auto_mode=$(sed -n 's/^mode=\([a-z]*\).*/\1/p' <<<"$plan"); deps=$(sed -n 's/.* deps=\([a-z]*\)/\1/p' <<<"$plan")
[ "$MODE" = auto ] && MODE=$auto_mode
[ "$MODE" = none ] && MODE=ui   # docs-only still pulls; a prebuild is cheap and harmless

# 2. the remote script (bash -s, so the login shell on ccrl doesn't matter)
remote=$(cat <<EOS
set -euo pipefail
cd $R
B=~/tlcv-config-backup-\$(date +%Y%m%d-%H%M%S).json
cp config/config.json "\$B"
dirty=0; git diff --quiet -- config/config.json || dirty=1
[ \$dirty = 1 ] && git stash push -q -- config/config.json
git pull -q --ff-only origin main
[ \$dirty = 1 ] && git stash pop -q
diff -q config/config.json "\$B" >/dev/null || { echo "CONFIG CHANGED after pull: restore from \$B"; exit 1; }
echo config-preserved
$( [ "$deps" = yes ] && echo 'npm ci --no-audit --no-fund 2>&1 | tail -1' )
$( if [ "$MODE" = full ]; then echo 'npm run build 2>&1 | tail -3'; echo 'sudo systemctl restart tlcv; sleep 4'
   else echo 'npm run prebuild 2>&1 | tail -3'; fi )
git log --oneline -1
systemctl is-active tlcv
curl -s -o /dev/null -w "local %{http_code}\n" http://localhost:8080/
EOS
)
echo "deploy mode: $MODE (deps: $deps)"
if [ $DRY = 1 ]; then echo "--- remote script (dry, not run) ---"; printf '%s\n' "$remote"; exit 0; fi
ssh -o BatchMode=yes ccrl 'bash -s' <<<"$remote"

# 3. verify from outside
code=$(curl -s -o /dev/null -w '%{http_code}' https://ccrl.live/); echo "public $code"
ssh -o BatchMode=yes ccrl 'journalctl -u tlcv --since "-2 min" --no-pager | grep -iE "error|warn" | tail -5' || true
[ "$code" = 200 ]
