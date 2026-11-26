const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
test('saved and new scan text share a translation, preserve originals and switch across target languages',async t=>{
 const w=new JSDOM('<select id="research-results-language"></select>',{runScripts:'outside-only',url:'https://workspace.example'}).window;
 t.after(()=>w.close());
 for(const file of ['language-pack-catalogue','content-language','research-reading-language'])w.eval(fs.readFileSync(require.resolve('../'+file+'.js'),'utf8'));
 w.LeadIntelServerBridge={workspace:{id:'w1'},session:{authenticated:true}};
 const calls=[];
 w.fetch=async(url,request)=>{
   const {system,prompt}=JSON.parse(request.body);calls.push(system);
   const input=JSON.parse(prompt),translation=system.includes('German')?'Wir fertigen Stahl.':'We manufacture steel.';
   return {ok:true,json:async()=>({text:JSON.stringify(Object.fromEntries(Object.keys(input).map(key=>[key,translation])))})};
 };
 const settings=w.LeadIntelResearchReading;
 assert.equal(settings.configure(['Denmark','Germany'],'lv'),'en');
 assert.deepEqual(Array.from(settings.choices(['Denmark','Germany','Japan'])),['en','da','de','ja']);
 w.document.body.insertAdjacentHTML('beforeend','<research-reading>Vi fremstiller stål.</research-reading>'.repeat(2));
 await new Promise(r=>setImmediate(r));
 const node=w.document.querySelector('research-reading');
 assert.equal(calls.length,1);assert.match(node.textContent,/We manufacture steel/);
 node.querySelector('button').click();assert.match(node.textContent,/Vi fremstiller stål/);
 settings.configure(['Denmark','Germany'],'de');await new Promise(r=>setImmediate(r));
 assert.equal(calls.length,2);assert.match(node.textContent,/Wir fertigen Stahl/);
 assert.equal(require('../profile-engine.js').normalizeSavedState({researchResultsLanguage:'de'}).researchResultsLanguage,'de');
});
