import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewWebsiteLinkedIn,websiteLinkedInReviewCurrent,websiteLinkedInQueries} from '../src/website-linkedin-review.js';
const candidate={company:'Finance Group',domain:'finance.example'},person=()=>({id:'original',name:'Ārija Bērziņa',publicName:'Ārija Bērziņa',title:'CFO',organization:'Finance Group',identityOrigin:'official',publicNameUrl:'https://finance.example/team'}),row={url:'https://lv.linkedin.com/in/arija-berzina',title:'Arija Berzina - CFO at Finance Group',description:'Current employer: Finance Group'};
test('an empty accented query falls back and the found exact profile is checked again with retained acquisition dates',async()=>{
 const p=person(),calls=[],date=new Date(Date.now()-86400000).toISOString(),search=async q=>{calls.push(q);return q.includes('Ārija')?[]:[row];};
 const result=await reviewWebsiteLinkedIn(candidate,p,{search,receipt:()=>({checkedAt:date})});assert.equal(result.matchStatus,'double_checked');assert.equal(result.queries.length,3);assert.equal(result.profileUrl,row.url);assert.ok(result.queries.every(q=>q.checkedAt===date));assert.equal(websiteLinkedInReviewCurrent(candidate,{...p,linkedinReview:result}),true);assert.ok(calls.some(q=>q.includes('"arija-berzina"')));assert.equal(p.id,'original');
});
test('empty searches stay not found and failed checks never become complete',async()=>{
 const p=person(),review=await reviewWebsiteLinkedIn(candidate,p,{search:async()=>[]});assert.equal(review.matchStatus,'not_found');assert.equal(review.status,'complete');assert.equal(review.profileUrl,'');
 const failed=await reviewWebsiteLinkedIn(candidate,p,{search:async q=>{if(q.includes('"Arija'))throw Error('Provider unavailable');return [];}});assert.equal(failed.status,'incomplete');assert.equal(websiteLinkedInReviewCurrent(candidate,{...p,linkedinReview:failed}),false);
});
test('distinct profiles and current employers remain held; stale or changed-person reviews cannot transfer',async()=>{
 const p=person();let n=0;const review=await reviewWebsiteLinkedIn(candidate,p,{search:async()=>[{...row,url:++n===1?row.url:row.url+'-other'}]});assert.equal(review.matchStatus,'conflict');assert.equal(review.profileUrl,'');
 const good=await reviewWebsiteLinkedIn(candidate,p,{search:async()=>[row]});assert.equal(websiteLinkedInReviewCurrent(candidate,{...p,linkedinReview:good}),true);assert.equal(websiteLinkedInReviewCurrent({...candidate,company:'Replacement'}, {...p,linkedinReview:good}),false);assert.equal(websiteLinkedInReviewCurrent(candidate,{...p,name:'Different Person',publicName:'Different Person',linkedinReview:good}),false);
 const old=structuredClone(good);old.queries[0].checkedAt=new Date(Date.now()-31*86400000).toISOString();assert.equal(websiteLinkedInReviewCurrent(candidate,{...p,linkedinReview:old}),false);
 const changed=await reviewWebsiteLinkedIn(candidate,p,{search:async()=>[{...row,description:'Current employer: Other Group. Previously Finance Group.'}]});assert.notEqual(changed.matchStatus,'double_checked');
});
test('every full identity gets two distinct bounded queries without changing shared Buyer plans',()=>{
 for(const name of ['Anna Svensson','Emīls Latkovskis','Roman Kornienko']){const queries=websiteLinkedInQueries(candidate,{...person(),name,publicName:name});assert.equal(new Set(queries).size,2);assert.ok(queries.every(q=>q.startsWith('site:linkedin.com/in/')));}
});

test('a published professional credential suffix does not change a sourced full identity',async()=>{
 const p={...person(),name:'Gatis Treimanis',publicName:'Gatis Treimanis',title:'CEO'},source={url:'https://lv.linkedin.com/in/gatis-treimanis-pmp-b3776132',title:'Gatis Treimanis, PMP - FinTech Management | Operations',description:'Experience: Finance Group'};
 const review=await reviewWebsiteLinkedIn(candidate,p,{search:async()=>[source]});assert.equal(review.matchStatus,'double_checked');assert.equal(review.profileUrl,source.url);assert.equal(review.queries[0].rows[0].title,source.title,'retain the actual indexed source title');
 const other=await reviewWebsiteLinkedIn(candidate,p,{search:async()=>[{...source,title:'Gatis Other, PMP - Finance Group'}]});assert.equal(other.matchStatus,'not_found');
});

test('an officially sourced current employer can coexist with a secondary board role without hiding explicit employer conflicts',async()=>{
 const p={...person(),name:'Sindija Liepina',publicName:'Sindija Liepina',title:'Head of Communications'},source={url:'https://lv.linkedin.com/in/sindija-liepina',title:'Sindija Liepina - Head of Communications @Finance Group / Director & Board Member at Charity Foundation',description:'Experience: Finance Group'};
 const review=await reviewWebsiteLinkedIn(candidate,p,{search:async()=>[source]});assert.equal(review.matchStatus,'double_checked');assert.equal(review.queries[0].rows[0].title,source.title);
 const conflict=await reviewWebsiteLinkedIn(candidate,{...p,publicLinkedinUrl:source.url},{search:async()=>[{...source,description:'Current employer: Other Group. Previously Finance Group.'}]});assert.equal(conflict.matchStatus,'conflict');
});

test('a cross-script source stays a visible candidate rather than a confirmed or invented profile',async()=>{
 const p={...person(),name:'Roman Kornienko',publicName:'Roman Kornienko',title:'CIO'},source={url:'https://lv.linkedin.com/in/roman-cyrillic-source',title:'Роман Корниенко - CIO at Finance Group',description:'Current employer: Finance Group'};
 const review=await reviewWebsiteLinkedIn(candidate,p,{search:async()=>[source]});assert.equal(review.matchStatus,'candidate');assert.equal(review.profileUrl,'');assert.equal(review.candidateProfiles[0].url,source.url);assert.equal(review.queries.length,2);assert.equal(websiteLinkedInReviewCurrent(candidate,{...p,linkedinReview:review}),true,'completed coverage differs from identity confirmation');
});

test('prior manual or provider confirmation does not bypass the new public double-check',async()=>{
 const p={...person(),identitySource:'apollo',linkedin_url:row.url,linkedinConfirmedUrl:row.url,linkedinConfirmationMethod:'manual',publicLinkedinUrl:row.url,contactData:{phone:{number:'+37120000001'}}};
 const review=await reviewWebsiteLinkedIn(candidate,p,{search:async()=>[row]});assert.equal(review.matchStatus,'double_checked');assert.equal(p.contactData.phone.number,'+37120000001');assert.equal(p.linkedinConfirmedUrl,row.url);
});
