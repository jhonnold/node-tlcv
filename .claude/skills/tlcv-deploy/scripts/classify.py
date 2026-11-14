"""Decide how to deploy node-tlcv from the list of files changed between the
deployed commit and the new one (stdin, one path per line, as printed by
`git diff --name-only OLD NEW`).

Prints:  mode=<none|ui|full> deps=<yes|no>   then one "why:" line per rule hit.
Exit 3 (STOP) if config/config.json itself changed in the repo: the stash pop
on prod would conflict with the live file, so Jay decides.
"""
import sys

UI = ("web/", "public/", "vite.config.ts")
NONE = ("docs/", ".github/", ".husky/", "LICENSE", "Dockerfile", "eslint.config.js", ".prettierrc")
DEPS = ("package.json", "package-lock.json")


def classify(paths):
    mode, deps, why = "none", False, []
    rank = {"none": 0, "ui": 1, "full": 2}

    def bump(m, reason):
        nonlocal mode
        if rank[m] > rank[mode]:
            mode = m
        why.append(f"{m}: {reason}")

    for p in paths:
        if p == "config/config.json":
            return None, False, ["STOP: config/config.json changed in the repo; prod's live copy must not be overwritten"]
        if p in DEPS:
            deps = True
            bump("full", f"{p} (npm ci, then full build)")
        elif p.startswith(UI):
            bump("ui", p)
        elif p.startswith(NONE) or p.endswith(".md"):
            why.append(f"none: {p}")
        else:  # src/, shared/, tsconfig*, anything unknown: conservative
            bump("full", p)
    return mode, deps, why


def main():
    paths = [l.strip() for l in sys.stdin if l.strip()]
    mode, deps, why = classify(paths)
    if mode is None:
        print(why[0])
        sys.exit(3)
    print(f"mode={mode} deps={'yes' if deps else 'no'}")
    for w in why:
        print(f"why: {w}")


if __name__ == "__main__":
    main()
