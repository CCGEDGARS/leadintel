const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../outreach-ui.js'),'utf8'),M=require('../message-studio.js');
function setup({approved=false,conflict=false,ready=true,selectedWorkspace='w1',link='https://calendly.com/legal/consultation'}={}){
 let item={channel:'linkedin',approved,drafts:{linkedinMessage:'Choose a time: [Add your Calendly link]'}},writes=0,updates=0;
 const root={LeadIntelMessageStudio:M,LeadIntelOutreach:{invalidateOutreachApproval:i=>({...i,approved:false})},crmBridge:()=>({ready,conflict,workspace:{id:'w1'},session:{authenticated:true}}),readJson:()=>({scriptBuyer:{workspaceId:selectedWorkspace}}),DISCOVERY_META_KEY:'meta',currentItem:()=>item,readDraftEdits:()=>item,studioState:()=>({essentials:{calendly:link}}),upsertItem:i=>{item=i;updates++;},q:()=>null,toast(){},navigator:{clipboard:{writeText:async()=>{writes++;}}}};
 vm.runInNewContext(source.slice(source.indexOf('function messageWorkspaceUsable()'),source.indexOf('function messageWorkspaceUsable()')+source.slice(source.indexOf('function messageWorkspaceUsable()')).indexOf('\nasync function copyField')),root);
 vm.runInNewContext(source.slice(source.indexOf('async function copyField'),source.indexOf('\nfunction ',source.indexOf('async function copyField')+10)),root);
 vm.runInNewContext(source.slice(source.indexOf('function renderDossier()'),source.indexOf('const workspace=q("dossier-workspace")',source.indexOf('function renderDossier()')))+'}',root);
 return {root,get item(){return item;},get writes(){return writes;},get updates(){return updates;}};
}
test('restored unapproved draft uses the active booking link and can be copied',async()=>{const h=setup();h.root.renderDossier();assert.match(h.item.drafts.linkedinMessage,/calendly.com\/legal\/consultation/);assert.equal(h.updates,1);await h.root.copyField('linkedin');assert.equal(h.writes,1);});
test('approved drafts are never changed by restoration',()=>{const h=setup({approved:true});h.root.renderDossier();assert.equal(h.updates,0);});
for(const config of [{conflict:true},{ready:false},{selectedWorkspace:'other-workspace'},{link:''},{link:'https://invalid.example/meeting'}])test('unsafe booking restoration cannot mutate or copy: '+JSON.stringify(config),async()=>{const h=setup(config);h.root.renderDossier();assert.equal(h.updates,0);await h.root.copyField('linkedin');assert.equal(h.writes,0);});
