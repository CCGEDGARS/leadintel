const test=require('node:test'),assert=require('node:assert/strict');
const S=require('../message-studio'),E=require('../message-editor');

const styles=['professional','curiosity','friendly','brutal'];
const essentials={sender:'Robin Lane',company:'Fixture Industrial',offer:'industrial automation; custom machinery',difference:'Our engineers support production teams.',value:'support commissioning',approach:'Fixed-price project delivery',proof:'https://seller.example/projects',meetingValue:'project requirements',calendly:'https://calendly.com/seller/intro',language:'en'};
const context={channel:'email',firstName:'Alex',buyerName:'Alex Buyer',buyerCompany:'Buyer Labs',sellerWebsite:'https://seller.example/'};

function generate(mode,seller){
 const studio=S.normalize({mode,essentials:{...essentials,...seller}});
 let facts=E.prepareFactContext(studio,context);
 if(E.needsPreparation(studio,facts))facts=E.preparedContext(studio,facts,E.preparedResponse(E.fieldSources(studio,facts),studio,facts));
 const draft=E.tailor(studio,facts);
 E.validateCoreDraft(studio,facts,draft);
 return {studio,facts,draft};
}

test('all core styles assemble grammatical seller descriptions from their own offers',()=>{
 const sellers=[
  {company:'Fixture Industrial',offer:'industrial automation; custom machinery',description:'an industrial automation and custom machinery company'},
  {company:'Delta Controls',offer:'industrial automation, custom machinery',description:'an industrial automation and custom machinery company'},
  {company:'Clear Water Labs',offer:'environmental monitoring; water analysis; compliance testing',description:'an environmental monitoring, water analysis and compliance testing company'},
  {company:'Legal North',offer:'commercial contract review, legal operations',description:'a commercial contract review and legal operations company'},
  {company:'River Audit',offer:'audit, tax and financial advisory',description:'an audit, tax and financial advisory company'},
  {company:'Delta Research',offer:'user research',description:'a user research company'},
  {company:'Atlas Advisory',offer:'European regulatory consulting',description:'a European regulatory consulting company'}
 ];
 for(const mode of styles)for(const seller of sellers){
  const {studio,facts,draft}=generate(mode,seller);
  assert.equal(E.factualValues(studio,facts).sellerDescription,seller.description,mode+' / '+seller.company);
  assert.ok(draft.message.includes(seller.company+(mode==='brutal'?' is ':', ')+seller.description+'.'),mode+' / '+seller.company);
  assert.doesNotMatch(draft.message,/Latvian|Swedish|Scandinavian|steel|ERCON|LKAB/);
 }
});

test('the article follows a supported origin without inventing geography',()=>{
 for(const mode of styles){
  const {studio,facts,draft}=generate(mode,{company:'Clear Water Labs',offer:'environmental monitoring; water analysis',difference:'We are a German company.'});
  assert.equal(E.factualValues(studio,facts).sellerDescription,'a German environmental monitoring and water analysis company');
  assert.match(draft.message,/a German environmental monitoring and water analysis company\./);
 }
});

test('a missing offer retains the declared description marker in every core style',()=>{
 for(const mode of styles){
  const {studio,facts,draft}=generate(mode,{offer:''});
  assert.equal(E.factualValues(studio,facts).sellerDescription,'[Add verified company description]');
  assert.match(draft.message,/\[Add verified company description\]/);
 }
});
