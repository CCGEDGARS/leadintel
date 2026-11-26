#!/usr/bin/env bash
set -euo pipefail

# GitHub's regional EC2 mirror repeatedly exhausted browser-job deadlines while
# fetching fonts/Mesa, before any tests ran. Keep Ubuntu's signed packages and
# the runner's release/suites, but use the official HTTPS archive for downloads.
if [[ "${GITHUB_ACTIONS:-}" == "true" && -f /etc/apt/apt-mirrors.txt ]]; then
  printf '%s\n' 'https://archive.ubuntu.com/ubuntu/' | sudo tee /etc/apt/apt-mirrors.txt > /dev/null
fi
# Hosted runners often already have the system libraries. Verify them by
# launching the pinned browser before asking apt to install anything.
npx playwright-core install chromium
if ! node --input-type=module <<'JS'
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: chromium.executablePath(), headless: true });
await browser.close();
JS
then
  npx playwright-core install-deps chromium
  node --input-type=module -e "import {chromium} from 'playwright-core'; await (await chromium.launch({executablePath:chromium.executablePath()})).close()"
fi
