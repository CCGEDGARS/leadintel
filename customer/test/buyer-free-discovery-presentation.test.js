const {test}=require('node:test'),assert=require('node:assert/strict');
const UI=require('../company-dossier-ui.js');
const free={executionStatus:'needs_review',diagnostics:[{phase:'identities',code:'free_discovery_finished'}]};

test('after free discovery the dossier says company research and its facts come with web expansion',()=>{
 const html=UI.render({domain:'example.com',company:'Example',people:[],buyerResearchProgress:free},{});
 assert.match(html,/Two-provider company research runs when you expand web research/);
 assert.doesNotMatch(html,/before selecting buyers|Resume source research/);
});

test('without free discovery the dossier keeps its existing wording',()=>{
 const html=UI.render({domain:'example.com',company:'Example',people:[]},{});
 assert.match(html,/before selecting buyers/);
});
