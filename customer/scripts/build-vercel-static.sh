#!/usr/bin/env bash
set -euo pipefail

# Compatibility entry point for Vercel projects whose Root Directory is set to /customer.
# The canonical build remains the repository-root script so both root modes produce
# the same verified deployment artifact.
repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"
bash scripts/build-vercel-static.sh

# With Root Directory=/customer, Vercel resolves outputDirectory=.vercel-static
# relative to /customer. Mirror the canonical artifact there after the build.
rm -rf "$repo_root/customer/.vercel-static"
mkdir -p "$repo_root/customer/.vercel-static"
cp -R "$repo_root/.vercel-static/." "$repo_root/customer/.vercel-static/"

# Do not publish this deployment compatibility script inside the customer bundle.
rm -rf "$repo_root/customer/.vercel-static/customer/scripts"
