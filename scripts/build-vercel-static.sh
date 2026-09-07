#!/usr/bin/env bash
set -euo pipefail

rm -rf .vercel-static
mkdir -p .vercel-static/v2 .vercel-static/customer

cp index.html .vercel-static/index.html
cp LeadIntel.html .vercel-static/LeadIntel.html
cp -R v2/. .vercel-static/v2/
cp -R customer/. .vercel-static/customer/

# Test and server-runtime files are useful in the repository but must never be part of the public static artifact.
rm -rf .vercel-static/customer/test
rm -rf .vercel-static/customer/api
rm -f .vercel-static/customer/requirements.txt
rm -f .vercel-static/customer/vercel.json

# Release provenance lets us prove that a URL serves the exact Git revision we intend.
# Verification must request release.json with Cache-Control/no-store semantics or a cache-busting query.
release_sha="${VERCEL_GIT_COMMIT_SHA:-${GITHUB_SHA:-$(git rev-parse HEAD 2>/dev/null || printf 'unknown')}}"
release_ref="${VERCEL_GIT_COMMIT_REF:-${GITHUB_REF_NAME:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || printf 'unknown')}}"
node - "$release_sha" "$release_ref" > .vercel-static/release.json <<'NODE'
const [commit, ref] = process.argv.slice(2);
const manifest = {
  service: 'leadintel-customer',
  commit,
  ref,
  built_at: new Date().toISOString(),
  provenance: 'vercel-git'
};
process.stdout.write(JSON.stringify(manifest, null, 2) + '\n');
NODE

# Deployment safety invariant: private implementation/source trees must not be published.
for forbidden in backend .github .agents apps-script docs make scripts; do
  if [ -e ".vercel-static/${forbidden}" ]; then
    echo "Refusing deployment: forbidden path present in artifact: ${forbidden}" >&2
    exit 1
  fi
done
