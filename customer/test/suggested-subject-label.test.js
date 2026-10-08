const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('all core styles use the agreed Suggested subjects chooser label',()=>{
 const source=fs.readFileSync(require.resolve('../outreach-ui.js'),'utf8');
 assert.match(source,/<span id="message-subject-choice-title">Suggested subjects<\/span>/);
 assert.match(source,/q\('message-subject-choice-title'\)\.textContent=[^;]*'Suggested subjects';/);
 assert.doesNotMatch(source,/Approved (Professional|NLP|Friendly|Brutal Honesty) subjects/);
 assert.match(source,/Choose a suggested subject/);
});
