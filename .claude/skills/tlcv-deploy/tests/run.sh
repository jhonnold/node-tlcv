#!/usr/bin/env bash
# Fixtures pr*.txt are the real `git show --name-only` file lists of merged
# node-tlcv PRs (#238/#237 were deployed UI-only, #236 needed the backend
# restart). config-changed.txt is constructed.
set -u
cd "$(dirname "$0")"
C="python3 -I ../scripts/classify.py"; DEP=../scripts/deploy.sh; F=fixtures; pass=0; fail=0
t() { # name, want-rc, want-first-line, cmd (string)
  out=$(bash -c "$4" 2>&1); rc=$?; first=$(head -1 <<<"$out")
  if [ "$rc" = "$2" ] && [ "$first" = "$3" ]; then pass=$((pass+1)); echo "ok   $1"
  else fail=$((fail+1)); echo "FAIL $1: rc=$rc first='$first' (want rc=$2 '$3')"; fi
}
has() { # name, needle, cmd: output must contain needle
  if bash -c "$3" 2>&1 | grep -qF -- "$2"; then pass=$((pass+1)); echo "ok   $1"
  else fail=$((fail+1)); echo "FAIL $1: missing '$2'"; fi
}
lacks() {
  if bash -c "$3" 2>&1 | grep -qF -- "$2"; then fail=$((fail+1)); echo "FAIL $1: has '$2'"
  else pass=$((pass+1)); echo "ok   $1"; fi
}
t pr238-ui        0 'mode=ui deps=no'    "$C < $F/pr238-theme.txt"
t pr237-ui        0 'mode=ui deps=no'    "$C < $F/pr237-standings.txt"
t pr236-full      0 'mode=full deps=no'  "$C < $F/pr236-winfo.txt"
t pr220-deps      0 'mode=full deps=yes' "$C < $F/pr220-deps.txt"
t pr224-docs      0 'mode=none deps=no'  "$C < $F/pr224-docs.txt"
t config-stop     3 'STOP: config/config.json changed in the repo; prod'"'"'s live copy must not be overwritten' "$C < $F/config-changed.txt"
has dry-ui-prebuild   'npm run prebuild'            "$DEP --dry --files $F/pr238-theme.txt"
lacks dry-ui-norestart 'systemctl restart'          "$DEP --dry --files $F/pr238-theme.txt"
has dry-full-restart  'sudo systemctl restart tlcv' "$DEP --dry --files $F/pr236-winfo.txt"
has dry-deps-npmci    'npm ci --no-audit'           "$DEP --dry --files $F/pr220-deps.txt"
has dry-config-guard  'CONFIG CHANGED after pull'  "$DEP --dry --files $F/pr237-standings.txt"
has dry-stash-guarded '[ $dirty = 1 ] && git stash pop' "$DEP --dry --files $F/pr237-standings.txt"
t dry-config-stop 3 'STOP: config/config.json changed in the repo; prod'"'"'s live copy must not be overwritten' "$DEP --dry --files $F/config-changed.txt"
has dry-override-full 'deploy mode: full'           "$DEP --dry --mode full --files $F/pr238-theme.txt"
echo "passed $pass, failed $fail"; [ $fail = 0 ]
