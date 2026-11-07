const test=require('node:test'),assert=require('node:assert/strict');
const {fillScript}=require('../channel-scripts.js'),E=require('../message-editor.js'),Rich=require('../rich-text.js');
const body="Hi [First name],\n\nLast [spring], [company]'s supplier failed at [plant]. Within [time], we [result].\n\nI'm [Your name] from [Company]. I noticed [verified fact about their project].\n\nLet's take 20 minutes on [meeting platform]: [Your booking URL]";
test('readable slots fill across all channels without inventing a customer reference or changing literals',()=>{
 for(const channel of ['email','linkedin','phone']){const original={channel,subject:'[First name]. [Company]',body};const before=JSON.stringify(original);const result=fillScript(original,{firstName:'Charlotte',sender:'Edgars Untals',company:'ERCON',verifiedDevelopment:'a verified plant expansion',meetingPlatform:'Zoom',calendly:'https://calendly.com/example'});
 assert.equal(result.draft.message,body.replace('[First name]','Charlotte').replace('[Your name]','Edgars Untals').replace('[Company]','ERCON').replace('[verified fact about their project]','a verified plant expansion').replace('[meeting platform]','Zoom').replace('[Your booking URL]','https://calendly.com/example'));
 assert.deepEqual(result.missing,['spring','company','plant','time','result']);assert.equal(JSON.stringify(original),before);assert.equal(result.draft.subject,channel==='email'?'Charlotte. ERCON':'');}
});
test('missing fields remain visible and block final use; unverified marker values are not substituted',()=>{const result=fillScript({channel:'email',body:'Hi [First name]. [City]. [result]',subject:'[Company]'},{firstName:'Alex',senderCity:'[Add verified city]'});assert.deepEqual(E.draftFactGaps(result.draft),['Company','City','result']);assert.equal(result.draft.message,'Hi Alex. [City]. [result]');});
test('bold readable fields retain their formatting and escape supplied markup',()=>{const result=fillScript({channel:'email',body:'Hi [First name] from [Company]',bodyHtml:'<p>Hi <strong>[First name]</strong> from [Company]</p>'},{firstName:'Alex & Jo',company:'<Example>'});assert.equal(Rich.toText(result.draft.messageHtml),result.draft.message);assert.match(result.draft.messageHtml,/<strong>Alex &amp; Jo<\/strong>/);assert.doesNotMatch(result.draft.messageHtml,/<Example>/);});
test('one buyer cannot inherit another buyer values and replacement values cannot introduce nested replacements',()=>{const script={channel:'email',body:'[First name] [Company]'};assert.equal(fillScript(script,{firstName:'Alex',company:'One'}).draft.message,'Alex One');assert.equal(fillScript(script,{firstName:'Beth',company:'Two'}).draft.message,'Beth Two');assert.equal(fillScript(script,{firstName:'[Company]',company:'Two'}).draft.message,'[First name] Two');});
test('phone conversation cues stay readable without becoming missing facts, while factual gaps remain',()=>{
 const body='Hi [First name]. [Answers]. [their words]. [manager]. [agreed day]. [certifications]. [result].';
 const phone=fillScript({channel:'phone',body},{firstName:'Alex'});
 assert.equal(phone.draft.message,body.replace('[First name]','Alex'));
 assert.deepEqual(phone.missing,['certifications','result']);
 assert.ok(fillScript({channel:'email',body},{}).missing.includes('Answers'),'email factual checks are unchanged');
});

test('owner NLP labels use reviewed facts, sender identity and links across every channel',()=>{
 const {readableValues}=require('../channel-scripts.js'),S=require('../message-studio.js');
 const studio={...S.seed(),mode:'curiosity',essentials:{sender:'Robin Lane',company:'Example Works',offer:'steel fabrication and installation',difference:'We have more than 30 years in the metalworking industry, specialising in the Scandinavian market.',proof:'We completed the Northport conveyor installation for Example Mining.',meetingValue:'production capacity data',calendly:'https://calendly.com/example/review'}};
 const context={firstName:'Alex',buyerName:'Alex Smith',buyerCompany:'Example Mining',sellerWebsite:'https://seller.example',senderLinkedInUrl:'https://www.linkedin.com/in/robin-lane',trigger:{summary:'Foundation work in Northport is under way. The new sorting plant is due to run in 2028.',excerpt:'Foundation work in Northport is under way. The new sorting plant is due to run in 2028.',url:'https://buyer.example/project',verification:'source_verified'},sellerEvidence:[{url:'https://seller.example/about',sourceRead:true,text:'Example Works is a Swedish steel fabrication and installation company. We have more than 30 years in the metalworking industry.'}]};
 const values=readableValues(studio,E.prepareFactContext(studio,context),{senderTitle:'Director'});
 const script={subject:'[First name]. [Company]',body:'Hi [First name],\n\n[Current project phase] in [project location] is under way. The new [facility / project] is due to run in [verified completion year].\n\nI’m [Your full name] from [Company], a [company location and description] with [verified years of experience] in [industry], specialising in [target market].\n\n[Real reference: “Recently we ….”]\n\n[relevant work packages]. [relevant company data]. [Your booking URL]\n[Your full name] | [Your LinkedIn profile URL]'};
 for(const channel of ['email','linkedin','phone']){
  const result=fillScript({...script,channel},values);assert.deepEqual(result.missing,[]);
  assert.match(result.draft.message,/Foundation work in Northport is under way/);
  assert.match(result.draft.message,/new sorting plant is due to run in 2028/);
  assert.match(result.draft.message,/Robin Lane from Example Works, a Swedish steel fabrication and installation company with more than 30 years in metalworking/);
  assert.match(result.draft.message,/We completed the Northport conveyor installation/);
  assert.match(result.draft.message,/https:\/\/www.linkedin.com\/in\/robin-lane/);
 }
});
test('unreviewed triggers, conflicting dates and other seller pages cannot fill factual slots',()=>{
 const {readableValues}=require('../channel-scripts.js'),S=require('../message-studio.js'),studio={...S.seed(),mode:'curiosity',essentials:{sender:'Robin',company:'Example',offer:'software development'}};
 const context={sellerWebsite:'https://seller.example',sellerEvidence:[{url:'https://other.example',sourceRead:true,text:'We have 99 years of metalworking experience and ISO 45001 certification.'}],trigger:{summary:'Foundation work in Northport is under way. The new sorting plant is due to run in 2028.',verification:'unconfirmed',url:'https://buyer.example/project'}};
 const v=readableValues(studio,E.prepareFactContext(studio,context));assert.equal(v.verifiedDevelopment,'');assert.equal(v.projectLocation,'');assert.equal(v.experienceDuration,'');assert.equal(v.certifications,'');
 const conflicting={...context,trigger:{...context.trigger,verification:'source_verified',excerpt:context.trigger.summary+' The new plant is due to run in 2029.'}};
 assert.equal(readableValues(studio,E.prepareFactContext(studio,conflicting)).openingYear,'');
});
test('published word-form experience is usable, but a capability page never invents a customer case',()=>{
 const {readableValues}=require('../channel-scripts.js'),S=require('../message-studio.js');const studio={...S.seed(),mode:'curiosity',essentials:{company:'Example Works',offer:'manufacturing and installation of metal structures'}};
 const v=readableValues(studio,{sellerWebsite:'https://seller.example',sellerEvidence:[{url:'https://seller.example/about',sourceRead:true,text:'Our team has more than thirty years of experience in the metalworking industry. We offer manufacturing and installation services.'}]});
 assert.equal(v.experienceDuration,'more than thirty years');assert.equal(v.industry,'metalworking');assert.equal(v.referenceStatement,'');assert.equal(v.comparableProjects,'');
 assert.deepEqual(fillScript({channel:'email',body:'[Real reference: “Recently we ….”] [company] [result]'},v).missing,['Real reference: “Recently we ….”','company','result']);
});
test('new readable aliases retain rich formatting and exact literal script wording',()=>{
 const result=fillScript({channel:'email',body:'I’m [Your full name]. [Real reference: “Recently we ….”]',bodyHtml:'<p>I’m <strong>[Your full name]</strong>. [Real reference: “Recently we ….”]</p>'},{sender:'Alex',referenceStatement:'We completed a supplied case.'});
 assert.equal(result.draft.message,'I’m Alex. We completed a supplied case.');assert.match(result.draft.messageHtml,/<strong>Alex<\/strong>/);assert.equal(Rich.toText(result.draft.messageHtml),result.draft.message);
});

test('all fifteen channel/style combinations combine approved Profile, extracted seller website and reviewed buyer trigger',()=>{
 const {readableValues}=require('../channel-scripts.js'),S=require('../message-studio.js');
 const studio={...S.seed(),mode:'professional',essentials:{company:'Example Systems',calendly:'https://calendly.com/example/demo'}};
 const context={firstName:'Sam',buyerCompany:'Buyer Labs',sellerWebsite:'https://seller.example',sellerAnswers:{priority_offers:'laboratory software integration',proof_points:'We completed the instrument integration for Sample Labs.'},sellerAnswerStatus:{priority_offers:'accepted',proof_points:'user'},sellerEvidence:[{url:'https://seller.example/about',sourceRead:true,text:'Our team has twenty years of experience in the software industry. We provide laboratory software integration.'}],trigger:{summary:'Buyer Labs has started construction of a new laboratory in Uppsala.',excerpt:'Buyer Labs has started construction of a new laboratory in Uppsala.',url:'https://buyer.example/news/laboratory',verification:'source_verified'}};
 const before=JSON.stringify(context),values=readableValues(studio,context,{senderName:'Robin Lane'});
 for(const channel of ['email','linkedin','phone'])for(const style of ['professional','curiosity','friendly','brutal','storyselling']){
  const script={channel,style,body:'Hi [First name]. [Your full name] from [Company]. [relevant service]. [verified years of experience] in [industry]. [verified project development]. [One short, verified reference.] [Your booking URL]'};
  const snapshot=JSON.stringify(script),result=fillScript(script,values);
  assert.deepEqual(result.missing,[]);assert.match(result.draft.message,/laboratory software integration/);assert.match(result.draft.message,/twenty years in software/);assert.match(result.draft.message,/new laboratory in Uppsala/);assert.match(result.draft.message,/completed the instrument integration for Sample Labs/);assert.doesNotMatch(result.draft.message,/steel|ERCON|Viscaria/);assert.equal(JSON.stringify(script),snapshot);
 }
 assert.equal(JSON.stringify(context),before);
});
test('explicit message facts override Profile defaults and unaccepted Profile references stay unknown',()=>{
 const {readableValues}=require('../channel-scripts.js'),S=require('../message-studio.js'),studio={...S.seed(),essentials:{offer:'user selected service',proof:'We completed the approved migration.'}};
 const context={sellerAnswers:{priority_offers:'older service',proof_points:'We completed a different case.'},sellerAnswerStatus:{priority_offers:'accepted',proof_points:'accepted'}};
 let values=readableValues(studio,context);assert.equal(values.serviceFocus,'user selected service');assert.equal(values.referenceStatement,'We completed the approved migration.');
 values=readableValues({...studio,essentials:{}},{...context,sellerAnswerStatus:{priority_offers:'suggested',proof_points:'suggested'}});assert.equal(values.referenceStatement,'');assert.ok(!values.serviceFocus);
});

test('readable credentials reject planned, expired and third-party certificates',()=>{
 const {readableValues}=require('../channel-scripts.js'),S=require('../message-studio.js');
 for(const text of ['We plan to become ISO 45001:2018 certified.','Our ISO 45001:2018 certification expired.','We work with ISO 45001:2018 certified partners.','We previously held ISO 45001:2018 certification.']){
  const v=readableValues({...S.seed(),essentials:{proof:text}});assert.equal(v.certifications,'',text);
 }
 assert.equal(readableValues({...S.seed(),essentials:{proof:'We are ISO 45001:2018 certified.'}}).certifications,'ISO 45001:2018');
});
test('negated or planned case claims do not satisfy the completed-reference slot',()=>{
 const {readableValues}=require('../channel-scripts.js'),S=require('../message-studio.js');
 for(const proof of ['We have not completed a reference project.','We will have completed the project next year.','Our partner completed the project.'])assert.equal(readableValues({...S.seed(),essentials:{proof}}).referenceStatement,'',proof);
});

test('buyer targeting answers cannot become seller experience or certifications',()=>{
 const {readableValues}=require('../channel-scripts.js'),S=require('../message-studio.js'),studio={...S.seed(),mode:'professional',essentials:{company:'Seller',offer:'software integration'}};
 const context={sellerAnswers:{ideal_customer:'A Swedish steel manufacturer with 99 years of experience. We are ISO 45001:2018 certified.'},sellerAnswerStatus:{ideal_customer:'accepted'}};
 const prepared=E.prepareFactContext(studio,context),values=readableValues(studio,prepared);
 assert.equal(values.experienceDuration,'');assert.equal(values.certifications,'');assert.doesNotMatch(values.sellerDescriptionPlain,/Swedish|steel/);
});
