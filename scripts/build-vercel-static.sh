#!/usr/bin/env bash
set -euo pipefail

rm -rf .vercel-static
mkdir -p .vercel-static/v2 .vercel-static/customer

cp index.html .vercel-static/index.html
cp LeadIntel.html .vercel-static/LeadIntel.html
cp -R v2/. .vercel-static/v2/
cp -R customer/. .vercel-static/customer/

# Test files are useful in the repository but must never be part of the public deployment artifact.
rm -rf .vercel-static/customer/test

# Deployment safety invariant: private implementation/source trees must not be published.
for forbidden in backend .github .agents apps-script docs make scripts; do
  if [ -e ".vercel-static/${forbidden}" ]; then
    echo "Refusing deployment: forbidden path present in artifact: ${forbidden}" >&2
    exit 1
  fi
done
