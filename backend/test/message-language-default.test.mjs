import test from 'node:test';
import assert from 'node:assert/strict';
import {approvedContext,fingerprint,normalizeWorkflowConfig,setupBlockers,renderDefaultWorkflowMessage} from '../src/approved-workflow-engine.js';

test('changing a saved flow language invalidates approval and cannot silently deliver an English automatic template',async()=>{
 const en=approvedContext({messageStudio:{languageSettings:{languages:['en','sv'],defaultLanguage:'en'}}}),sv=approvedContext({messageStudio:{languageSettings:{languages:['en','sv'],defaultLanguage:'sv'}}});
 assert.equal(en.outreachLanguage||'en','en');assert.equal(await fingerprint(en),await fingerprint(approvedContext({}))); assert.equal(sv.outreachLanguage,'sv');assert.notEqual(await fingerprint(en),await fingerprint(sv));
 const config=normalizeWorkflowConfig({});assert.ok(setupBlockers(sv,config).some(s=>s.includes('manual flow')));assert.ok(!setupBlockers(en,config).some(s=>s.includes('manual flow')));assert.throws(()=>renderDefaultWorkflowMessage(sv,{}),/automatic generation requires English/);
});
