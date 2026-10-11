const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const base=path.join(__dirname,'..');
function setup(order=['background-task-centre.js','attention-centre-model.js','attention-centre.js'],storage={}){
  const w=new JSDOM('<button id="workspace-attention"><em data-attention-summary></em><b data-attention-count hidden></b></button><div data-utility-tasks></div>',{url:'https://example.test',runScripts:'outside-only'}).window;
  w.setInterval=()=>0;w.LeadIntelServerBridge={status:'synced',session:{authenticated:true},workspace:{id:'one'}};
  w.LeadIntelWorkspacePersistence={hasUnsavedChanges:()=>false,isExplicitlySaved:()=>true,hasMeaningfulWorkspaceData:()=>false};
  for(const [key,value] of Object.entries(storage))w.localStorage.setItem(key,JSON.stringify(value));
  order.forEach(file=>w.eval(fs.readFileSync(path.join(base,file),'utf8')));w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  return w;
}
test('one workspace panel contains sync and persistent task activity in either script order',()=>{
  for(const order of [['background-task-centre.js','attention-centre-model.js','attention-centre.js'],['attention-centre-model.js','attention-centre.js','background-task-centre.js']]){
    const w=setup(order),d=w.document;try{
      assert.equal(d.querySelectorAll('.task-centre-trigger').length,0);
      assert.ok(d.querySelector('#workspace-attention-drawer [data-workspace-sync]'));
      assert.ok(d.querySelector('#workspace-attention-drawer .task-centre-list'));
      assert.equal(d.querySelector('[data-attention-summary]').textContent,'All saved · Ready');
      assert.equal(d.querySelector('[data-attention-count]').hidden,true);
      d.getElementById('workspace-attention').click();assert.equal(d.getElementById('workspace-attention-drawer').hidden,false);
      w.LeadIntelTaskCentre.start({id:'search',title:'Company research',stage:'Researching 3 companies',total:3});
      w.LeadIntelAttention.refresh();
      assert.match(d.querySelector('[data-attention-summary]').textContent,/Researching 3 companies/);
      assert.equal(d.querySelector('[data-attention-count]').textContent,'1');assert.equal(d.querySelector('[data-attention-count]').hidden,false);
      w.LeadIntelTaskCentre.complete('search');w.LeadIntelAttention.refresh();
      assert.equal(d.querySelector('[data-attention-summary]').textContent,'All saved · Ready');
      assert.equal(d.querySelector('[data-attention-count]').hidden,true);assert.ok(d.querySelector('.task-complete'));
      d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape'}));assert.equal(d.getElementById('workspace-attention-drawer').hidden,true);
    }finally{w.close();}
  }
});
test('sync failures take priority over active work and never claim all saved',()=>{
  const w=setup(),d=w.document;try{
    w.LeadIntelTaskCentre.start({id:'work',title:'Research',stage:'Checking sources'});
    w.LeadIntelServerBridge.status='error';w.dispatchEvent(new w.Event('leadintel:sync-status-changed'));w.LeadIntelAttention.refresh();
    assert.match(d.querySelector('[data-attention-summary]').textContent,/Sync issue/);
    assert.match(d.querySelector('[data-workspace-sync]').textContent,/preserved/i);
    assert.ok(w.LeadIntelAttention.list().some(i=>i.id==='workspace-sync'));
    w.LeadIntelServerBridge.status='saving';w.LeadIntelAttention.refresh();assert.match(d.querySelector('[data-attention-summary]').textContent,/Saving/);
    w.LeadIntelServerBridge.status='local';w.LeadIntelServerBridge.session.authenticated=false;w.LeadIntelAttention.refresh();
    assert.doesNotMatch(d.querySelector('[data-attention-summary]').textContent,/All saved/);
  }finally{w.close();}
});
test('task alert stays in combined panel; registered retry/cancel work; reload preserves history',async()=>{
  const w=setup(),d=w.document;let retries=0,cancels=0;try{
    const c=w.LeadIntelTaskCentre;c.start({id:'one',title:'Company research',total:3});c.registerActions('one',{retry:()=>{retries++;},cancel:()=>{cancels++;}});c.fail('one','Temporary failure');w.LeadIntelAttention.refresh();
    d.getElementById('workspace-attention').click();
    Array.from(d.querySelectorAll('.attention-action')).find(b=>b.textContent==='Review task').click();
    assert.equal(d.getElementById('workspace-attention-drawer').hidden,false);
    d.querySelector('[data-task-action="retry"]').click();await new Promise(resolve=>setImmediate(resolve));assert.equal(retries,1);assert.equal(c.get('one').status,'running');
    d.querySelector('[data-task-action="cancel"]').click();await new Promise(resolve=>setImmediate(resolve));assert.equal(cancels,1);
    c.start({id:'unfinished',title:'Interrupted work',total:4,completed:2});
    const w2=setup(undefined,{[c.storageKey]:JSON.parse(w.localStorage.getItem(c.storageKey))});try{
      assert.equal(w2.LeadIntelTaskCentre.get('unfinished').status,'interrupted');assert.equal(w2.LeadIntelTaskCentre.get('unfinished').completed,2);
      assert.equal(w2.document.querySelectorAll('[data-task-action="retry"]').length,0);
      assert.ok(w2.document.querySelector('.task-canceled'));
      w2.document.querySelector('.task-centre-clear').click();assert.equal(w2.LeadIntelTaskCentre.list().length,0);
    }finally{w2.close();}
  }finally{w.close();}
});
