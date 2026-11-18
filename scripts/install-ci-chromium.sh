#!/usr/bin/env bash
set -euo pipefail

# GitHub's regional EC2 mirror repeatedly exhausted browser-job deadlines while
# fetching fonts/Mesa, before any tests ran. Keep Ubuntu's signed packages and
# the runner's release/suites, but use the official HTTPS archive for downloads.
if [[ "${GITHUB_ACTIONS:-}" == "true" && -f /etc/apt/apt-mirrors.txt ]]; then
  printf '%s\n' 'https://archive.ubuntu.com/ubuntu/' | sudo tee /etc/apt/apt-mirrors.txt > /dev/null
fi
npx playwright-core install --with-deps chromium
