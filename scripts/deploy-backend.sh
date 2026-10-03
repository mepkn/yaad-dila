#!/usr/bin/env bash
# Deploys convex/ to the production deployment (formal-setter-463).
# Needs CONVEX_DEPLOY_KEY in .env.prod.local (git-ignored).
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env.prod.local ]; then
  echo "Missing .env.prod.local with CONVEX_DEPLOY_KEY=prod:..." >&2
  exit 1
fi
CONVEX_DEPLOY_KEY="$(grep '^CONVEX_DEPLOY_KEY=' .env.prod.local | cut -d= -f2-)"
export CONVEX_DEPLOY_KEY
# .env.local points `convex` at the local dev backend; don't let it win.
unset CONVEX_DEPLOYMENT

echo "› Typecheck and tests"
npx tsc -p convex --noEmit
npx vitest run

echo "› Deploying to production"
npx convex deploy -y
