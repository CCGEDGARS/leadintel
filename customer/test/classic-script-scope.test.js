const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const customerDir = path.join(__dirname, '..');

test('classic customer scripts share a browser realm without lexical redeclarations', () => {
  const html = fs.readFileSync(path.join(customerDir, 'index.html'), 'utf8');
  const processMap = fs.readFileSync(path.join(customerDir, 'process-map.js'), 'utf8');
  const discoveryUi = fs.readFileSync(path.join(customerDir, 'discovery-ui.js'), 'utf8');

  assert.match(html, /<script defer src="process-map\.js[^"]*"><\/script>/);
  assert.match(html, /<script defer src="discovery-ui\.js[^"]*"><\/script>/);

  assert.doesNotThrow(
    () => new vm.Script(processMap + '\n' + discoveryUi),
    /already been declared/
  );
});
