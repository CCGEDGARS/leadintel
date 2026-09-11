import { extractCopilotFile } from '../copilot-file-extractors.js';
import { SUPPORTED_FILE_FORMATS } from '../copilot-file-contract.js';

const output = document.querySelector('#results');
const button = document.querySelector('#run');
const violations = [];
document.addEventListener('securitypolicyviolation', event => violations.push(`${event.violatedDirective}: ${event.blockedURI}`));
button.addEventListener('click', async () => {
  button.disabled = true;
  const rows = [];
  try {
    for (const [format, locator] of [['pdf', 'page:2'], ['docx', 'section:Commercial priorities'], ['xlsx', 'sheet:Pipeline!B3'], ['xls', 'sheet:Legacy!A2'], ['csv', 'row:3'], ['pptx', 'slide:2']]) {
      output.textContent = [...rows, `Reading ${format}…`].join('\n');
      const response = await fetch(`./fixtures/file-analysis/fixture.${format}`);
      if (!response.ok) throw new Error(`Fixture ${format}: HTTP ${response.status}`);
      const file = new File([await response.arrayBuffer()], `fixture.${format}`, { type: SUPPORTED_FILE_FORMATS[format].mimeTypes[0] });
      const extraction = await extractCopilotFile(file);
      if (!extraction.blocks.some(block => block.locator === locator && JSON.stringify(block).includes(`${format.toUpperCase()}_MARKER`))) throw new Error(`${format}: missing marker or stable locator`);
      rows.push(`PASS ${format}: ${locator}`);
    }
    const remote = performance.getEntriesByType('resource').filter(entry => new URL(entry.name).origin !== location.origin);
    if (remote.length || violations.length) throw new Error(`Unexpected remote resource or CSP violation: ${violations.join('; ')}`);
    output.textContent = `${rows.join('\n')}\nPASS 6/6; actual default loader; same-origin assets only; no CSP violations.`;
  } catch (error) { output.textContent = `${rows.join('\n')}\nFAIL: ${error.message}`; }
  finally { button.disabled = false; }
});
