#!/usr/bin/env bash
# Sync the hpuri84 dashboard into the ALP monorepo prototype and deploy it.
#
# hpuri84 (this repo) is the SOURCE OF TRUTH. It holds the Python pipeline +
# raw data; the ALP monorepo only carries the built dashboard app (flattened:
# no dashboard/ subdir). This script mirrors the app into the ALP worktree and
# replicates /prototype-deploy (commit + push the prototype branch, which
# triggers the Helm deploy to prototype-bosch-milestone-analysis.dev.maersk-digital.net).
#
# Usage: ./sync_to_alp.sh "one-line summary of what changed"
set -euo pipefail

SRC="/Users/harsh.puri/Documents/work-maersk/Prototype Playground/Bosch Milestone Analysis"
WT_ROOT="/Users/harsh.puri/Documents/work-maersk/alp-development-platform/.claude/worktrees/elegant-cray-79e841"
APP_REL="projects/business-prototypes/bosch-milestone-analysis"
APP="$WT_ROOT/$APP_REL"
BRANCH="prototype/business-prototypes/bosch-milestone-analysis"

SUMMARY="${1:-Sync dashboard from hpuri84 source of truth}"

if [ ! -d "$APP" ]; then
  echo "ERROR: ALP worktree not found at $APP" >&2
  echo "Run 'git -C <alp-root> worktree list' to find the bosch prototype worktree and update WT_ROOT." >&2
  exit 1
fi

echo "==> Mirroring app files into ALP monorepo (flattened: dashboard/src -> src, dashboard/public -> public)"
# Component / app source (structurally identical, just relocated). No --delete: never clobber monorepo-only files.
# Exclude assets/ (unused Vite scaffold cruft) and .DS_Store so they don't create spurious diffs.
rsync -a --exclude='.DS_Store' --exclude='assets/' "$SRC/dashboard/src/" "$APP/src/"
# Static data (the pipeline output). Only JSON — leave monorepo's own static assets alone.
rsync -a --include='*.json' --exclude='*' "$SRC/dashboard/public/" "$APP/public/"

cd "$WT_ROOT"
git checkout "$BRANCH" >/dev/null 2>&1 || true

# Detect real app changes BEFORE touching changes.md (changes.md is bookkeeping,
# not a reason to deploy on its own).
if [ -z "$(git status --porcelain "$APP_REL/src" "$APP_REL/public")" ]; then
  echo "Nothing to deploy — ALP monorepo already matches hpuri84."
  exit 0
fi

echo "==> Updating changes.md"
DATE="$(date +%Y-%m-%d)"
CHANGES="$APP/changes.md"
SUMMARY="$SUMMARY" DATE="$DATE" python3 - "$CHANGES" <<'PY'
import os, sys
path = sys.argv[1]
date = os.environ["DATE"]; summary = os.environ["SUMMARY"]
entry = (f"\n### Prototype Iteration — Bosch Milestone Analysis Dashboard\n"
         f"- **User:** harshpuri84\n- **Type:** prototype-iterate\n- **Summary:** {summary}\n")
text = open(path, encoding="utf-8").read() if os.path.exists(path) else "# Changelog\n"
header = f"## {date}"
if header in text:
    i = text.index(header) + len(header)
    text = text[:i] + "\n" + entry + text[i:]
else:
    text = text.rstrip() + f"\n\n{header}\n{entry}"
open(path, "w", encoding="utf-8").write(text)
PY

echo "==> Verifying ALP build"
( cd "$APP" && npm install --silent >/dev/null 2>&1 && npm run build >/dev/null 2>&1 ) \
  && echo "   build OK" || { echo "ERROR: ALP build failed — not deploying." >&2; exit 1; }

echo "==> Committing + pushing prototype branch (triggers Helm dev deploy)"
git add "$APP_REL"
git commit -m "prototype(bosch-milestone-analysis): ${SUMMARY}"
git push -u origin "$BRANCH"
echo "==> Done. ALP dev: https://prototype-bosch-milestone-analysis.dev.maersk-digital.net"
