const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const modulePath=path.join(__dirname,'..','background-task-centre.js');
const TaskCentre=fs.existsSync(modulePath)?require(modulePath):{};

function memoryStorage(){
  const values=new Map();
  return {
    getItem:key=>values.has(key)?values.get(key):null,
    setItem:(key,value)=>values.set(key,String(value)),
    removeItem:key=>values.delete(key)
  };
}

test('background task centre exposes a persistent task registry',()=>{
  assert.equal(typeof TaskCentre.createTaskCentre,'function');
});

test('task progress, results and completion survive a reload',()=>{
  const storage=memoryStorage();
  const centre=TaskCentre.createTaskCentre({storage,now:()=>1_000});
  centre.start({id:'market:1',type:'market-research',title:'Market research',stage:'Searching public sources',total:10});
  centre.update('market:1',{completed:4,resultCount:7,stage:'Checking evidence'});
  const reloaded=TaskCentre.createTaskCentre({storage,now:()=>2_000,recoverInterrupted:false});
  assert.deepEqual({...reloaded.get('market:1'),metadata:{}},{id:'market:1',type:'market-research',title:'Market research',stage:'Checking evidence',status:'running',completed:4,total:10,progress:40,resultCount:7,etaSeconds:null,error:'',startedAt:1000,updatedAt:1000,finishedAt:null,metadata:{},canCancel:false,canRetry:false,canResume:false});
  reloaded.complete('market:1',{resultCount:12});
  assert.deepEqual({status:reloaded.get('market:1').status,completed:reloaded.get('market:1').completed,progress:reloaded.get('market:1').progress,resultCount:reloaded.get('market:1').resultCount},{status:'complete',completed:10,progress:100,resultCount:12});
});

test('running tasks are marked interrupted after a real page reload',()=>{
  const storage=memoryStorage();
  TaskCentre.createTaskCentre({storage,now:()=>1_000}).start({id:'discovery:1',type:'company-discovery',title:'Company discovery',total:8,completed:3});
  const reloaded=TaskCentre.createTaskCentre({storage,now:()=>2_000});
  assert.deepEqual({status:reloaded.get('discovery:1').status,completed:reloaded.get('discovery:1').completed,total:reloaded.get('discovery:1').total},{status:'interrupted',completed:3,total:8});
  assert.match(reloaded.get('discovery:1').stage,/interrupted/i);
});

test('ETA is evidence-based and only appears after measurable progress',()=>{
  let now=1_000;
  const centre=TaskCentre.createTaskCentre({storage:memoryStorage(),now:()=>now,recoverInterrupted:false});
  centre.start({id:'research:1',type:'company-research',title:'Company research',total:10});
  assert.equal(centre.get('research:1').etaSeconds,null);
  now=11_000;
  centre.update('research:1',{completed:2});
  assert.equal(centre.get('research:1').etaSeconds,40);
});

test('registered cancel and retry actions update task state safely',async()=>{
  const centre=TaskCentre.createTaskCentre({storage:memoryStorage(),now:()=>1_000,recoverInterrupted:false});
  let canceled=false,retried=false;
  centre.start({id:'apollo:1',type:'apollo-enrichment',title:'Apollo enrichment',total:3});
  centre.registerActions('apollo:1',{cancel:()=>{canceled=true;},retry:()=>{retried=true;}});
  await centre.cancel('apollo:1');
  assert.equal(canceled,true);
  assert.equal(centre.get('apollo:1').status,'canceled');
  await centre.retry('apollo:1');
  assert.equal(retried,true);
  assert.equal(centre.get('apollo:1').status,'running');
});

test('clearing a workspace removes active and finished task history across reloads',()=>{
  const storage=memoryStorage();
  const centre=TaskCentre.createTaskCentre({storage,now:()=>1_000,recoverInterrupted:false});
  centre.start({id:'research:active',type:'market-research',title:'Active research',total:4,completed:1});
  centre.start({id:'research:finished',type:'market-research',title:'Finished research',total:1});
  centre.complete('research:finished');

  centre.clearAll();

  assert.deepEqual(centre.list(),[]);
  const reloaded=TaskCentre.createTaskCentre({storage,now:()=>2_000,recoverInterrupted:false});
  assert.deepEqual(reloaded.list(),[]);
});

test('invalid counters and unsafe error payloads are normalized',()=>{
  const centre=TaskCentre.createTaskCentre({storage:memoryStorage(),now:()=>1_000,recoverInterrupted:false});
  centre.start({id:'safe:1',type:'market-research',title:'Safe task',total:2,completed:99,resultCount:-5});
  centre.fail('safe:1',new Error('  token=secret\nRequest failed  '));
  const task=centre.get('safe:1');
  assert.equal(task.completed,2);
  assert.equal(task.resultCount,0);
  assert.equal(task.error,'Request failed');
});

test('customer workspace loads the task centre before long-running workflows',()=>{
  const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  assert.match(html,/background-task-centre\.css/);
  const taskScript=html.indexOf('background-task-centre.js');
  assert.ok(taskScript>0);
  assert.ok(taskScript<html.indexOf('app.js'));
  assert.ok(taskScript<html.indexOf('discovery-ui.js'));
  assert.ok(taskScript<html.indexOf('company-research-ui.js'));
});

test('long-running workflows publish progress to the shared task centre',()=>{
  const company=fs.readFileSync(path.join(__dirname,'..','company-research-ui.js'),'utf8');
  const market=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
  const discovery=fs.readFileSync(path.join(__dirname,'..','discovery-ui.js'),'utf8');
  const apollo=fs.readFileSync(path.join(__dirname,'..','apollo-bulk-enrichment.js'),'utf8');
  assert.match(company,/LeadIntelTaskCentre/);
  assert.match(market,/market-research/);
  assert.match(discovery,/company-discovery/);
  assert.match(discovery,/decision-maker-search/);
  assert.match(discovery,/apollo-enrichment/);
  assert.match(apollo,/LeadIntelTaskCentre/);
});
