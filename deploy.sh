#!/bin/bash
# Deploy the Bosch Milestone Analysis dashboard into the ALP monorepo prototype
# branch (auto-deploys to prototype-bosch-milestone-analysis.dev.maersk-digital.net
# via Helm / ci-prototype). Replaces the old worktree-based sync_to_alp.sh — uses a
# sparse clone in ~/Library/Caches (outside ~/Documents, no FDA/worktree fragility),
# the same pattern as booking-funnel/deploy.sh.
#
# hpuri84/bosch-milestone-analysis (this repo) is SOURCE OF TRUTH: it holds the Python
# pipeline + raw data; the ALP branch carries the flattened app (dashboard/src -> src,
# dashboard/public/*.json -> public). Idempotent: no-op if nothing changed.
#
# Usage: ./deploy.sh ["summary"]   |   ./deploy.sh --dry-run   (preview, no commit/push)
set -euo pipefail

DRY=0; [ "${1:-}" = "--dry-run" ] && { DRY=1; shift; }
SUMMARY="${1:-Sync dashboard from hpuri84 source of truth}"

SRC="$HOME/Documents/Harsh OS/Work/Bosch/milestone-analysis"
DEPLOY="$HOME/Library/Caches/bosch-milestone-analysis-deploy"   # outside ~/Documents — git needs no FDA grant
URL="https://github.com/Maersk-Global/alp-development-platform.git"
BRANCH="prototype/business-prototypes/bosch-milestone-analysis"
PROJ="projects/business-prototypes/bosch-milestone-analysis"

# 1. sparse clone (first run) / refresh to clean origin state
if [ ! -d "$DEPLOY/.git" ]; then
  git clone --depth 1 --filter=blob:none --sparse --branch "$BRANCH" "$URL" "$DEPLOY"
  git -C "$DEPLOY" sparse-checkout set "$PROJ"
fi
git -C "$DEPLOY" fetch -q origin "$BRANCH"
git -C "$DEPLOY" reset -q --hard "origin/$BRANCH"
git -C "$DEPLOY" clean -fdq -- "$PROJ"   # drop untracked leftovers so the clone == origin before sync

# 2. mirror app source + JSON data (same mapping the old sync_to_alp.sh used; no --delete)
rsync -a --exclude='.DS_Store' --exclude='assets/' "$SRC/dashboard/src/"    "$DEPLOY/$PROJ/src/"
rsync -a --include='*.json' --exclude='*'           "$SRC/dashboard/public/" "$DEPLOY/$PROJ/public/"

# 3. detect real changes (only src/ + public/ count)
CHANGED=$(git -C "$DEPLOY" status --short "$PROJ/src" "$PROJ/public" | wc -l | tr -d ' ')
if [ "$CHANGED" = "0" ]; then echo "deploy: dashboard unchanged vs alp — nothing to push"; exit 0; fi

echo "deploy: $CHANGED changed file(s):"
git -C "$DEPLOY" status --short "$PROJ/src" "$PROJ/public" | sed 's/^/   /'
if [ "$DRY" = "1" ]; then echo "deploy: --dry-run, NOT committing/pushing"; exit 0; fi

# 4. commit + push (triggers the dev deploy)
git -C "$DEPLOY" add "$PROJ/src" "$PROJ/public"
git -C "$DEPLOY" commit -q -m "prototype(bosch-milestone-analysis): sync from hpuri84 source $(date +%F)

$SUMMARY

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git -C "$DEPLOY" push -q origin HEAD
echo "deploy: pushed $(git -C "$DEPLOY" rev-parse --short HEAD) ($CHANGED files) → dev deploy triggered"
