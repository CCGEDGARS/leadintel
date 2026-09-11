import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { file, dependencies } from './fixtures/file-analysis/fixtures.mjs';
import { extractCopilotFile } from '../copilot-file-extractors.js';

for (const format of ['pdf', 'docx', 'xlsx', 'xls', 'csv', 'pptx']) {
  test(`committed fixture.${format} opens as a genuine supported file`, async () => {
    const bytes = await readFile(new URL(`./fixtures/file-analysis/fixture.${format}`, import.meta.url));
    const result = await extractCopilotFile(file(`fixture.${format}`, bytes), dependencies);
    assert.match(JSON.stringify(result.blocks), new RegExp(`${format.toUpperCase()}_MARKER`));
  });
}
test('default dependency loader extracts all six formats without remote imports', async () => {
  for (const format of ['pdf', 'docx', 'xlsx', 'xls', 'csv', 'pptx']) {
    const bytes = await readFile(new URL(`./fixtures/file-analysis/fixture.${format}`, import.meta.url));
    const result = await extractCopilotFile(file(`fixture.${format}`, bytes));
    assert.match(JSON.stringify(result.blocks), new RegExp(`${format.toUpperCase()}_MARKER`));
  }
});
