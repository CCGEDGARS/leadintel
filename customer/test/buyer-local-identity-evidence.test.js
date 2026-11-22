const {test}=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js');
// 21.11 live defect (Buyers for a 25-person Danish workshop: 0 people). The public search had returned the
// owner-director, but every result was rejected: the profile headline named the employer by the company's own
// abbreviation (its registered domain label) after the Danish preposition "i", with the legal form "ApS" and a
// second company joined by "og"; Danish leadership titles were not recognised as leadership; and the gates
// after tracing compared the full company name only.
// The negative cases are the ones an adversarial review produced against the first version of this change.
// All companies and people below are invented.
const companies=[
 {company:'Nordby Smede & Maskinfabrik ApS',domain:'nsmf.dk',market:'Denmark',brand:'NSMF ApS',other:'Holm Steel A/S',roles:'Production manager; Purchasing manager; Project Manager'},
 {company:'Vestkyst Transport og Logistik A/S',domain:'vestkyst.dk',market:'Denmark',brand:'Vestkyst A/S',other:'Kystlager ApS',roles:'Fleet manager; Warehouse manager'}
];
const nsmf=companies[0];
const profileFor=c=>({companyDomain:c.domain,decisionMakers:c.roles});
const linkedIn=slug=>'https://dk.linkedin.com/in/'+slug;
let serial=0;
const row=(title,description,url)=>{const name=title.split(' - ')[0];return {url:url||linkedIn(name.toLowerCase().replace(/[^a-z]+/g,'-')+'-'+(++serial)),title,description:description||name+'.'};};
const traced=(c,rows,profile=profileFor(c))=>D.tracePublicBuyers(rows,c.company,profile);
// "Kept" is the whole path a durable job takes: traced, shortlisted or retained.
const kept=(c,rows)=>{const people=traced(c,rows).people,profile={decisionMakers:c.roles};return D.retainBuyerIdentities(D.mergeBuyerPool([],people,profile),profile,c).map(p=>[p.name,p.title,p.organization]);};

for(const c of companies)test(`${c.company}: an owner-director named by the domain label after Danish "i" is kept`,()=>{
 const rows=[row(`Jens Holm - Ejer og direktør i ${c.brand} og ${c.other}.`,`Capital owner and CEO of ${c.brand} & ${c.other}. ... We have more than 45 years of experience as proud contractor and supplier to the telecom business in ...`)];
 const trace=traced(c,rows);
 assert.equal(trace.people.length,1,JSON.stringify(trace.diagnostics));
 const person=trace.people[0];
 assert.equal(person.name,'Jens Holm');
 assert.equal(person.title,'Ejer og direktør','the role is the text before the employer, not the whole headline');
 assert.equal(person.organization,c.brand,'the evidenced employer as written in the source');
 assert.equal(person.matchedBuyerRole,'Executive leadership');
 assert.ok(!D.qualifyBuyer(person,profileFor(c),c).gaps.includes('Employer mismatch'));
 assert.deepEqual(D.rankedBuyerShortlist(trace.people,{decisionMakers:c.roles},c).people.map(p=>p.name),['Jens Holm']);
 assert.deepEqual(kept(c,rows),[['Jens Holm','Ejer og direktør',c.brand]]);
});

for(const c of companies)test(`${c.company}: the same headline is not attached when no company domain anchors the abbreviation`,()=>{
 const rows=[row(`Jens Holm - Ejer og direktør i ${c.brand} og ${c.other}.`)];
 assert.deepEqual(traced(c,rows,{decisionMakers:c.roles}).people,[]);
});

test('the full company name and the label with its legal form work after i, hos, at and as a separate part',()=>{
 const rows=[
  row('Mette Lund - Indkøbschef hos NSMF ApS'),
  row('Ida Skov - Administrerende direktør - NSMF ApS'),
  row('Karl Vang - Production Manager at NSMF ApS'),
  row('Sara Lind - Projektleder i Holm Steel A/S og Nordby Smede & Maskinfabrik ApS'),
  row('Bo Krag - Produktionschef i Holm & Søn ApS og NSMF ApS'),
  row('Tor Vik - Direktør i NSMF ApS og bestyrelsesmedlem i Holm Byg ApS')
 ];
 assert.deepEqual(kept(nsmf,rows).sort(),[
  ['Bo Krag','Produktionschef','NSMF ApS'],
  ['Ida Skov','Administrerende direktør','NSMF ApS'],
  ['Karl Vang','Production Manager','NSMF ApS'],
  ['Mette Lund','Indkøbschef','NSMF ApS'],
  ['Sara Lind','Projektleder','Nordby Smede & Maskinfabrik ApS'],
  ['Tor Vik','Direktør','NSMF ApS']
 ]);
 assert.match(traced(nsmf,rows).people.find(p=>p.name==='Mette Lund').matchedBuyerRole,/^(?:Procurement Director|Purchasing manager)$/,'a Danish title must match an English purchasing role it translates');
 const vestkyst=companies[1];
 assert.deepEqual(kept(vestkyst,[row('Rie Dam - Direktør i Vestkyst Transport og Logistik A/S og Kystlager ApS')]),[['Rie Dam','Direktør','Vestkyst Transport og Logistik A/S']],'a company whose own name contains "og" is not cut in two');
});

test('a bare domain label is not enough without the full company name in the result, in any language',()=>{
 for(const [c,title] of [
  [{company:'Atlas Maskin AB',domain:'atlas.se',market:'Sweden',roles:'Procurement Director; Project Manager'},'Erik Holm - CEO at Atlas | LinkedIn'],
  [{company:'Atlas Maskin AB',domain:'atlas.se',market:'Sweden',roles:'Procurement Director; Project Manager'},'Karl Berg - Project Manager for Atlas'],
  [{company:'Atlas Maskin AB',domain:'atlas.se',market:'Sweden',roles:'Procurement Director; Project Manager'},'Lena Ek - Inköpschef - Atlas'],
  [{company:'Holm Forge Ltd',domain:'forge.co.uk',market:'United Kingdom',roles:'Procurement Director'},'Sam Reed - Procurement Director at Forge'],
  [nsmf,'Karl Vang - Production Manager at NSMF'],
  [nsmf,'Karl Vang - Produktionschef i NSMF'],
  // The exact name without its legal form is, as before, not enough on its own either.
  [{company:'Holm Steel AB',domain:'holmsteel.se',market:'Sweden',roles:'Procurement Director'},'Lena Ek - Inköpschef - Holm Steel'],
  // A truncated target name after "i" stays as unanchored as it was as a bare suffix (24.10).
  [{company:'Automation',domain:'balticautomation.com',market:'Latvia',roles:'CEO'},'Anna Bērziņa - CEO i Automation'],
  // With the label as the only evidence the role beside it must be a plain title.
  [nsmf,'Karl Vang - CEO at Holm Steel A/S - NSMF ApS']
 ])assert.deepEqual(kept(c,[row(title)]),[],title);
 // With the full company name in the result the label still identifies the employer, as since 24.10.
 assert.deepEqual(kept(nsmf,[row('Karl Vang - Production Manager at NSMF','Karl Vang. Production Manager at Nordby Smede & Maskinfabrik ApS.')]).map(p=>p[0]),['Karl Vang']);
});

test('a town after "i" is not an employer, even when the town is the domain label',()=>{
 const aarhus={company:'Aarhus Kommune',domain:'aarhus.dk',market:'Denmark',roles:'Project Manager; Procurement Director'},kiruna={company:'Kiruna kommun',domain:'kiruna.se',market:'Sweden',roles:'Project Manager'};
 for(const [c,title] of [[aarhus,'Mette Lund - Projektleder i Aarhus'],[aarhus,'Per Dam - Direktør i Aarhus'],[aarhus,'Lis Friis - Indkøbschef hos Holm Steel A/S, bosat i Aarhus'],[kiruna,'Nils Berg - Projektledare i Kiruna'],[nsmf,'Per Dam - Direktør i Fredericia']])assert.deepEqual(kept(c,[row(title)]),[],title);
});

test('a job held elsewhere, a board seat or a supplier relation does not attach the person to the target',()=>{
 const lkab={company:'LKAB',domain:'lkab.com',market:'Sweden',roles:'Procurement Director; Project Manager'};
 for(const [c,title] of [
  [lkab,'Nils Berg - CEO at Holm Steel AB, styrelseledamot i LKAB'],
  [lkab,'Nils Berg - Verkställande direktör på Holm Steel AB och styrelseledamot i LKAB'],
  [lkab,'Erik Lind - Inköpschef på Holm Steel AB, ansvarig för leveranser i LKAB'],
  [lkab,'Erik Lind - Projektledare på Holm Steel AB med uppdrag i LKAB'],
  [nsmf,'Jens Moe - Ejer og direktør i Holm Byg ApS og bestyrelsesmedlem i NSMF ApS'],
  [nsmf,'Jens Moe - Bestyrelsesmedlem i NSMF ApS'],
  [nsmf,'Ane Juul - Projektleder hos Holm Steel A/S, leverandør i NSMF ApS'],
  [nsmf,'Ane Juul - Projektleder, leverandør til NSMF ApS'],
  // Another legal entity that only shares the label.
  [nsmf,'Mads Krog - Direktør i NSMF Holding Invest ApS'],
  [nsmf,'Mads Krog - Direktør i NSMF Group ApS'],
  [nsmf,'Mads Krog - Direktør i NSMF A/S'],
  [nsmf,'Mads Krog - Direktør i NSMF K/S'],
  // One company whose name contains "og": not two employers.
  [nsmf,'Finn Juhl - Direktør i Jysk Stål og NSMF ApS'],
  [{company:'Aarhus Kommune',domain:'aarhus.dk',market:'Denmark',roles:'Project Manager'},'Finn Juhl - Projektleder i Aarhus Kommune og Omegn A/S']
 ])assert.deepEqual(kept(c,[row(title)]),[],title);
 // The label appears only as a customer reference in the description.
 assert.deepEqual(kept(nsmf,[row('Lise Bro - Direktør i Bro Teknik ApS','Lise Bro. Leverandør til NSMF ApS og Nordby Smede & Maskinfabrik ApS.')]),[]);
});

test('a role that is over stays out, in Danish as in English and Swedish',()=>{
 for(const title of ['Ole Friis - Tidligere direktør i NSMF ApS','Ole Friis - Tidligere indkøbschef hos NSMF ApS','Ole Friis - Fhv. indkøbschef hos NSMF ApS','Ole Friis - Forhenværende indkøbschef hos NSMF ApS','Ole Friis - Ex-indkøbschef hos NSMF ApS','Ole Friis - Tidl. indkøbschef i NSMF ApS','Ole Friis - Pensioneret indkøbschef i NSMF ApS','Ole Friis - Tidl. adm. direktør i NSMF ApS','Ole Friis - Tidl. adm. direktør - NSMF ApS','Ole Friis - Tidligere indkøbschef hos Nordby Smede & Maskinfabrik ApS','Ole Friis - Former purchasing manager at Nordby Smede & Maskinfabrik ApS','Ole Friis - Tidigare inköpschef hos Nordby Smede & Maskinfabrik ApS','Ole Friis - F.d. inköpschef i Nordby Smede & Maskinfabrik ApS','Ole Friis - Före detta inköpschef i Nordby Smede & Maskinfabrik ApS','Ole Friis - Pensionerad inköpschef i Nordby Smede & Maskinfabrik ApS']){
  const trace=traced(nsmf,[row(title)]);
  assert.deepEqual(trace.people,[],title);
  assert.equal(trace.diagnostics[0].companyVerification,'rejected',title+' must not even be read as employed at the target');
 }
 // Current headline, but the description dates the role as over.
 assert.deepEqual(kept(nsmf,[row('Ole Friis - Direktør i NSMF ApS','Tidligere direktør i Nordby Smede & Maskinfabrik ApS (1998–2021). Nu pensioneret.')]),[]);
 assert.deepEqual(kept(nsmf,[row('Ole Friis - Direktør i NSMF ApS','Tidligere direktør i NSMF ApS (1998–2021). Nu pensioneret.')]),[]);
 // Left the company: the dated experience line is not current employment (the real case of 21.11).
 assert.deepEqual(kept(nsmf,[row('Lone Bak - Salgs- og Projektdirektør, Europa','Nordby Smede & Maskinfabrik ApS. mar. 2024 – dec. 2024 10 måneder ... Produktionschef / Production Manager.')]),[]);
 // The later gates refuse a former title whatever produced the person.
 const former={id:'f1',name:'Ole Friis',publicName:'Ole Friis',title:'Tidligere indkøbschef',organization:nsmf.company,publicNameUrl:linkedIn('ole-friis-1'),publicLinkedinUrl:linkedIn('ole-friis-1')};
 assert.equal(D.sourcedBuyerIdentity(former,nsmf),false);
 assert.equal(D.sourcedBuyerIdentity({...former,title:'Indkøbschef'},nsmf),true);
 assert.deepEqual(D.rankedBuyerShortlist([former],{decisionMakers:nsmf.roles},nsmf).people,[]);
 assert.ok(D.qualifyBuyer(former,{decisionMakers:nsmf.roles},nsmf).gaps.includes('Former role'));
});

test('job adverts and headings on other sites do not become people through the headline rule',()=>{
 for(const [title,url] of [['Ledig stilling - Indkøbschef i NSMF ApS','https://www.jobindex.dk/job/123'],['Vi søger - Projektleder i NSMF ApS','https://www.jobindex.dk/job/124'],['Ny direktør - Adm. direktør i NSMF ApS','https://www.metal-news.example/artikel/1'],['Ledig stilling - Indkøbschef hos NSMF ApS','https://www.jobindex.dk/job/125'],['Ny direktør - Adm. direktør - NSMF ApS','https://www.metal-news.example/artikel/2'],['Mette Lund - Indkøbschef hos NSMF ApS','https://www.directory.example/people/mette-lund'],['Jens Holm - Ejer og direktør i NSMF ApS og Holm Steel A/S.','https://www.directory.example/people/jens-holm']])assert.deepEqual(kept(nsmf,[row(title,'',url)]),[],title);
});

test('a non-buying role at the target is parsed but not selected',()=>{
 const trace=traced(nsmf,[row('Nina Holt - Kontorassistent i NSMF ApS')]);
 assert.deepEqual(trace.people,[]);
 assert.equal(trace.diagnostics[0].companyVerification,'complete',JSON.stringify(trace.diagnostics[0]));
 assert.equal(trace.diagnostics[0].parsedTitle,'Kontorassistent');
});

test('Danish leadership titles are leadership; functional directors, assistants, staff, former and incoming roles are not',()=>{
 for(const title of ['Direktør','Adm. direktør','Adm.direktør','Adm. dir.','Administrerende direktør','Ejer','Indehaver','Medejer','Ejer og direktør','Direktør og medejer','Direktør, ejer','Indehaver, direktør','Direktør (ejer)','Adm. direktør, partner'])assert.equal(D.isExecutiveBuyer({title}),true,title);
 for(const title of ['Salgsdirektør','Salgs- og Projektdirektør, Europa','Teknisk direktør','Direktør, Europa','Direktionsassistent','Assistent for direktør','Sekretær for adm. direktør','PA for adm. direktør','Stabschef for adm. direktør','Rådgiver for adm. direktør','Tidligere direktør','Tidl. adm. direktør','Ex-adm. direktør','Forhenværende adm. direktør','Kommende adm. direktør','Afgående adm. direktør','Kunde / Ejer','Kontorassistent','Ejendomsmægler','Produktejer'])assert.equal(D.isExecutiveBuyer({title}),false,title);
 // Existing recognition is unchanged.
 for(const title of ['CEO','Managing Director','Verkställande direktör','Owner'])assert.equal(D.isExecutiveBuyer({title}),true,title);
});

test('Danish companies get Danish title variants; Swedish ones keep theirs',()=>{
 const danish=role=>D.localBuyerRoleAliases(role,'Denmark');
 assert.ok(danish('Production manager').includes('Produktionschef'));
 assert.ok(danish('Procurement Director').includes('Indkøbschef'));
 assert.ok(danish('Purchasing manager').includes('Indkøber'));
 assert.ok(danish('Plant Manager').includes('Fabrikschef'));
 assert.deepEqual(danish('Project Manager'),['Project Manager','Projektleder']);
 assert.ok(danish('Project Director').includes('Projektchef'));
 const leadership=danish('Executive leadership');
 for(const title of ['Administrerende direktør','Direktør','Ejer','Indehaver'])assert.ok(leadership.includes(title),title);
 assert.ok(!leadership.includes('Verkställande direktör'));
 assert.ok(!danish('Production manager').includes('Inköpschef'));
 // The market is recognised the way the engine recognises markets elsewhere.
 for(const market of ['Danmark','DK','Dānija','Danish market'])assert.ok(D.localBuyerRoleAliases('Production manager',market).includes('Produktionschef'),market);
 assert.ok(D.localBuyerRoleAliases('Executive leadership','Sweden').includes('Verkställande direktör'));
 assert.ok(D.localBuyerRoleAliases('Procurement Manager','Sweden').includes('Inköpschef'));
 assert.ok(!D.localBuyerRoleAliases('Procurement Manager','Sweden').includes('Indkøbschef'));
 assert.deepEqual(D.localBuyerRoleAliases('Production manager','Latvia'),['Production manager']);
});

test('the search plan for a Danish company asks in Danish and carries no Swedish wording',()=>{
 for(const c of companies){
  const plan=D.buyerResearchPlan({company:c.company,domain:c.domain,market:c.market},{decisionMakers:'Production manager; Purchasing manager'});
  const first=plan.queries.slice(0,6).join('\n');
  assert.ok(!/Verkställande|ledning\b|inköp/i.test(plan.queries.join('\n')),plan.queries.join('\n'));
  assert.match(plan.queries[0],new RegExp('^site:'+c.domain.replace('.','\\.')+' '));
  assert.match(plan.queries[0],/"Administrerende direktør"/);
  assert.match(plan.queries[0],/ledelse/);
  assert.match(first,/"Produktionschef"/);
  assert.match(first,/"Indkøbschef"/);
 }
 const swedish=D.buyerResearchPlan({company:'Independent Factory',domain:'factory.example',market:'Sweden'},{decisionMakers:'Procurement Director'});
 assert.equal(swedish.queries[0],'site:factory.example (CEO OR "Chief Executive Officer" OR COO OR "Managing Director" OR "Verkställande direktör") (leadership OR management OR team OR ledning)');
});

test('Danish titles belong to their buying function, and the opportunity query for a Danish company is worded in Danish',()=>{
 assert.deepEqual(['Indkøbschef','Indkøber','Fabrikschef','Værkfører','Vedligeholdelseschef','Direktør'].map(D.buyerFunction),['Procurement / sourcing','Procurement / sourcing','Operations','Operations','Operations','Executive']);
 const plan=market=>D.buyerResearchPlan({company:'Nordby Smede & Maskinfabrik ApS',domain:'nsmf.dk',market,buyerFit:{purchase:'a new investment'}},{decisionMakers:'Fleet manager'}).queries.filter(query=>/"investment" \(/.test(query));
 assert.deepEqual(plan('Denmark'),['"Nordby Smede & Maskinfabrik ApS" "investment" (project OR procurement OR engineering OR operations OR indkøb OR projektchef OR projektleder)']);
 assert.deepEqual(plan('Sweden'),['"Nordby Smede & Maskinfabrik ApS" "investment" (project OR procurement OR engineering OR operations OR inköp OR projektchef OR projektledare)']);
});

// The gates after tracing compared the full company name only, so a buyer accepted on the domain label
// (this case, and the truncated-name case fixed on 24.10) was traced and then dropped before the page.
test('the truncated-name buyer of 24.10 survives the same steps; a different employer still does not',()=>{
 const c={company:'Automation',domain:'balticautomation.com',market:'Latvia'},profile={decisionMakers:'CEO; Managing Director'};
 const rows=[{url:'https://www.linkedin.com/in/anna-berzina',title:'Anna Bērziņa - CEO at Baltic Automation | LinkedIn',description:'Anna Bērziņa. CEO at Baltic Automation SIA. Riga, Latvia.'}];
 const people=D.tracePublicBuyers(rows,c.company,{...profile,companyDomain:c.domain}).people;
 assert.deepEqual(D.retainBuyerIdentities(D.mergeBuyerPool([],people,profile),profile,c).map(p=>p.name),['Anna Bērziņa']);
 const stranger={id:'x1',name:'Peter Hantman',publicName:'Peter Hantman',title:'CEO',organization:'Tungsten Automation',publicNameUrl:'https://www.linkedin.com/in/peter-hantman',publicLinkedinUrl:'https://www.linkedin.com/in/peter-hantman'};
 assert.deepEqual(D.rankedBuyerShortlist([stranger],profile,c).people,[]);
 assert.deepEqual(D.retainBuyerIdentities([stranger],profile,c),[]);
});

// The same employer rule in the remaining identity gates: a legal form or the domain label in the source's
// wording of the employer must not turn a sourced buyer into a mismatch; another legal entity still does.
const example={company:'Example',domain:'example.com',crmId:'company',buyerSearchMode:'user_selected_target',buyerRoles:['Procurement Director']};
const anna={id:'anna',name:'Anna Smith',publicName:'Anna Smith',title:'Head of Procurement',organization:'Example',publicNameUrl:'https://linkedin.com/in/anna-smith',publicLinkedinUrl:'https://linkedin.com/in/anna-smith'};
// ("Example Group" has always counted as the company itself: the exact-name rule ignores "Group".)
const otherEntities=['Example Holding ApS','Example Group ApS','Other'];
test('LinkedIn verification treats the employer written with a legal form like the plain company name',()=>{
 const plain=D.linkedInVerification(anna,example).status;
 assert.equal(plain,'automatic');
 assert.equal(D.linkedInVerification({...anna,organization:'Example ApS'},example).status,plain);
 for(const organization of otherEntities)assert.equal(D.linkedInVerification({...anna,organization},example).status,'review_required',organization);
});
test('a verified provider phone stays confirmed for that employer wording and not for another legal entity',()=>{
 const contact={id:'saved-phone',source:'apollo',external_person_id:anna.id,name:anna.name,title:anna.title,company_id:'company',workspace_id:'w',phone_number:'+37122113344',phone_status:'Verified'};
 const phone=organization=>D.confirmedBuyerPhone({...example,people:[{...anna,organization}]},{...anna,organization},contact,{workspaceId:'w'});
 assert.equal(phone('Example'),'+37122113344');
 assert.equal(phone('Example ApS'),'+37122113344');
 for(const organization of otherEntities)assert.equal(phone(organization),'',organization);
});
test('a sourced person outside the shortlist is retained under either wording of the employer, never under another entity',()=>{
 const clerk={...anna,id:'kim',name:'Kim Berg',publicName:'Kim Berg',title:'Office Clerk',publicNameUrl:'https://linkedin.com/in/kim-berg',publicLinkedinUrl:'https://linkedin.com/in/kim-berg'},profile={decisionMakers:'Procurement Director'};
 const retained=organization=>D.retainBuyerIdentities([{...clerk,organization}],profile,example).map(p=>p.name);
 assert.deepEqual(retained('Example'),['Kim Berg']);
 assert.deepEqual(retained('Example ApS'),['Kim Berg']);
 for(const organization of otherEntities)assert.deepEqual(retained(organization),[],organization);
 // A legal form that differs from the target's own names another entity.
 const aps={...example,company:'Example ApS'};
 assert.deepEqual(D.retainBuyerIdentities([{...clerk,organization:'Example A/S'}],profile,aps),[]);
 assert.deepEqual(D.retainBuyerIdentities([{...clerk,organization:'Example'}],profile,aps).map(p=>p.name),['Kim Berg']);
});

// Second adversarial round: the headline rule must hold on its own, whatever else the result says.
test('the headline rule is not switched off or widened by the full company name elsewhere in the result',()=>{
 const full='Nordby Smede & Maskinfabrik ApS';
 for(const [title,description,url] of [
  ['Ane Juul - Projektleder hos NSMF ApS','Kunde: '+full+'.','https://www.directory.example/people/ane-juul'],
  ['Ane Juul - Projektleder hos NSMF ApS','Ane Juul. Projektleder hos Holm Steel A/S. Vi leverer stål til '+full+'.'],
  ['Ane Juul - Konsulent og projektleder hos NSMF ApS','Ane Juul. '+full+' er min kunde.'],
  ['Ane Juul - Interim Purchasing Manager at NSMF ApS','Ane Juul. Client: '+full],
  ['Ane Juul - Indkøbschef i Holm Steel A/S og NSMF ApS','Ane Juul. Indkøbschef i Holm Steel A/S. Leverandør til NSMF ApS.'],
  ['Ane Juul - Projektleder i Holm Steel A/S og NSMF ApS','Ane Juul. Rådgiver for NSMF ApS.']
 ])assert.deepEqual(kept(nsmf,[row(title,description,url)]),[],title+' / '+description);
});
test('hired-in, seconded, incoming and second-employer wording in the role is not a plain role at the target',()=>{
 for(const role of ['Interim projektleder','Konsulent projektleder','Indlejet projektleder','Ekstern indkøber','Freelance projektleder','Selvstændig projektleder','Projektleder via Holm Bemanding','Projektleder udlånt fra Holm Consult','Projektleder udstationeret','Projektleder Holm Consult A/S','Kommende produktionschef','Afgående produktionschef'])assert.deepEqual(kept(nsmf,[row('Jens Holm - '+role+' i NSMF ApS')]),[],role);
 assert.deepEqual(kept(nsmf,[row('Jens Holm - Projektleder with NSMF ApS')]),[]);
});
test('former, dated or departed wording near the company in the description cancels the headline',()=>{
 for(const [title,description] of [
  ['Jens Holm - Produktionschef - NSMF ApS','Tidl. produktionschef, NSMF ApS.'],
  ['Jens Holm - Direktør i NSMF ApS','Erfaring: Tidl. adm. direktør i NSMF ApS'],
  ['Jens Holm - Produktionschef i NSMF ApS','Tidligere produktionschef i NSMF.'],
  ['Jens Holm - Produktionschef i NSMF ApS','Jens Holm. Produktionschef i NSMF ApS fra 2012 til 2020.'],
  ['Jens Holm - Produktionschef i NSMF ApS','Jens Holm har forladt NSMF ApS i 2022.'],
  ['Jens Holm - Direktør i NSMF ApS','Direktør i NSMF ApS 2010 - 2019.'],
  ['Jens Holm - Produktionschef i NSMF ApS','NSMF ApS. mar. 2019 – dec. 2023 4 år 10 måneder.'],
  ['Jens Holm - Indkøbschef i NSMF ApS og Holm Steel A/S - tidligere','Jens Holm.']
 ])assert.deepEqual(kept(nsmf,[row(title,description)]),[],title+' / '+description);
 // A current dated line is not a contradiction.
 assert.deepEqual(kept(nsmf,[row('Jens Holm - Produktionschef i NSMF ApS','NSMF ApS. sep. 2023 – nu 3 år 2 måneder.')]).map(p=>p[0]),['Jens Holm']);
});
test('a target without a legal form in its name gets no label evidence; with one, only its own form',()=>{
 const bare={company:'Nordby Smede',domain:'nsmf.dk',market:'Denmark',roles:'Production manager'};
 for(const label of ['NSMF GmbH','NSMF A/S','NSMF ApS','NSMF'])assert.deepEqual(kept(bare,[row('Jens Holm - Produktionschef i '+label)]),[],label);
 // Swedish target: the label with its own form is the same rule as for a Danish one.
 const atlas={company:'Atlas Maskin AB',domain:'atlas.se',market:'Sweden',roles:'Procurement Director'};
 assert.deepEqual(kept(atlas,[row('Lena Ek - Inköpschef på Atlas AB')]),[['Lena Ek','Inköpschef','Atlas AB']]);
 assert.deepEqual(kept(atlas,[row('Lena Ek - Inköpschef på Atlas Oy')]),[]);
});
test('"Ex" in a title is explosion protection, not a former role; only "Ex-" before a title is',()=>{
 const steel={company:'Holm Steel AB',domain:'holmsteel.se',market:'Sweden',roles:'Project Manager; Engineering Manager'},profile={decisionMakers:steel.roles};
 const person=title=>({id:'e1',name:'Erik Lind',publicName:'Erik Lind',title,organization:steel.company,publicNameUrl:'https://www.linkedin.com/in/erik-lind',publicLinkedinUrl:'https://www.linkedin.com/in/erik-lind'});
 for(const title of ['Project Manager Ex','Ex Engineering Manager','Head of Ex Inspection']){
  assert.equal(D.sourcedBuyerIdentity(person(title),steel),true,title);
  assert.ok(!D.qualifyBuyer(person(title),profile,steel).gaps.includes('Former role'),title);
 }
 assert.deepEqual(D.rankedBuyerShortlist([person('Project Manager Ex')],profile,steel).people.map(p=>p.name),['Erik Lind']);
 assert.deepEqual(kept(steel,[row('Erik Lind - Ex Engineering Manager at Holm Steel AB','Erik Lind. Ex Engineering Manager at Holm Steel AB.')]).map(p=>p[0]),['Erik Lind']);
});

// The Danish business register lists the executive management as "Direktør". The existing register path
// (Swedish, Norwegian, Latvian … registers) must read that role from a register source and from nothing else.
test('a register source naming the "Direktør" yields a leader with official role evidence',()=>{
 const url='https://apicvr.dk/api/v1/11111111',page=markdown=>({url,markdown,sourceType:'registry',sourceRead:true,metadata:{sourceURL:url,statusCode:200,source:'registry'}});
 const contacts=D.discoverCompanyContacts([page('# Nordby Smede & Maskinfabrik ApS\n\nBusiness register: CVR, registration 11111111\n\nDirektør | Rita Holm Dahl (since 2016-05-04)\nSalgsdirektør | Bo Krag\n')],nsmf,[]);
 assert.deepEqual(contacts.map(p=>[p.name,p.title,p.companyContactSource,p.roleReview.status,p.corporateRoleEvidence.url]),[['Rita Holm Dahl','Direktør','registry','supported',url]]);
 const profile={decisionMakers:nsmf.roles},retained=D.retainBuyerIdentities(D.mergeBuyerPool([],contacts,profile),profile,nsmf);
 assert.deepEqual(retained.map(p=>[p.name,p.matchedBuyerRole||D.rankedBuyerShortlist(retained,profile,nsmf).people[0]?.matchedBuyerRole]),[['Rita Holm Dahl','Executive leadership']]);
 // Another company's register page, an unread page and an ordinary web page give nobody.
 assert.deepEqual(D.discoverCompanyContacts([page('# Holm Steel A/S\n\nDirektør | Rita Holm Dahl\n')],nsmf,[]),[]);
 assert.deepEqual(D.discoverCompanyContacts([{...page('# Nordby Smede & Maskinfabrik ApS\n\nDirektør | Rita Holm Dahl\n'),sourceRead:false}],nsmf,[]),[]);
 assert.deepEqual(D.discoverCompanyContacts([{url:'https://www.blog.example/nsmf',markdown:'# Nordby Smede & Maskinfabrik ApS\n\nDirektør | Rita Holm Dahl\n',sourceRead:true}],nsmf,[]),[]);
});
test('on a scraped register page the plain "Direktør" is not taken, and a Danish "former management" section is skipped',()=>{
 const proff={url:'https://www.proff.dk/firma/nordby-smede/123',sourceRead:true,markdown:'# Nordby Smede & Maskinfabrik ApS\n\n## Ledelse\n\nAdministrerende direktør | Rita Holm Dahl\nDirektør | Bo Krag\n\n## Tidligere ledelse\n\nAdministrerende direktør | Karl Berg Olsen (2009-2015)\n\n## Moderselskab: Dahl Holding ApS\n\nDirektør | Erik Vang Holm\n'};
 assert.deepEqual(D.discoverCompanyContacts([proff],nsmf,[]).map(p=>[p.name,p.title]),[['Rita Holm Dahl','Administrerende direktør']]);
});


// 21 Nov live (L35): the AI search provider returned a LinkedIn post (a /posts/ address) under a title it wrote
// itself, "<name> — LinkedIn post about production leadership at <company>". The "role at company" reading
// took "LinkedIn post about production leadership" as the person's role, and the page showed that entry as a
// researched buyer matched to Production manager. The words describe the publication, not its author's job.
const postAddress='https://dk.linkedin.com/posts/mette-krog-1a2b3c_produktion-ledelse-activity-7300000000000000000-AbCd';
test('the title a search provider wrote for a LinkedIn post never becomes a role',()=>{
 const rows=[row(`Mette Krog — LinkedIn post about production leadership at ${nsmf.company}`,'A post about how a workshop plans its production week.',postAddress)];
 const trace=traced(nsmf,rows);
 assert.deepEqual(trace.people.map(person=>[person.name,person.title]),[]);
 assert.equal(trace.diagnostics.at(-1).rejectionReason,'Parsed role describes a publication, not a job');
 assert.deepEqual(kept(nsmf,rows),[]);
});
test('a profile with a plain role is still kept when a post of the same company stands beside it',()=>{
 const rows=[row(`Mette Krog — LinkedIn post about production leadership at ${nsmf.company}`,'A post about how a workshop plans its production week.',postAddress),row(`Lars Bak - Production manager at ${nsmf.company}`,`Lars Bak. Production manager at ${nsmf.company}.`)];
 assert.deepEqual(kept(nsmf,rows).map(person=>person.slice(0,2)),[['Lars Bak','Production manager']]);
});

// The cause behind L35 (two adversarial reviews, 22 Nov): the words read as a role were not a role. The AI search
// provider writes its own titles and sentences about a page ("<name> — LinkedIn post about production leadership
// at <company>", "Post identifies <someone else> as production manager at <company>", "Public LinkedIn profile
// describes her as team lead ... at <company>"), and "role at company" took whatever stood before "at <company>".
// In seven saved live runs this produced three of 39 people. Rejecting the provider's rows as such was wrong
// twice over: a page read after such a result keeps the result's tag (real staff were dropped), and the
// provider's sentence is also what says "formerly" (former employees passed). So the test is on the words: a
// phrase that describes a publication, or a sentence about someone, is never a role; where the title holds a
// role, that one is used.
const model=(title,description,url)=>({...row(title,description,url),evidenceKind:'model_summary',buyerSource:'grounded',searchProvider:'grounded'});
const brandt={company:'Brandt Conveyor Group A/S',domain:'brandtconveyor.dk',market:'Denmark',roles:'Head of Procurement; Purchasing manager; Supply chain manager'};
const providerTitle=`Mette Krog — LinkedIn post about production leadership at ${nsmf.company}`;
for(const [origin,make] of [['search provider',model],['search engine',row]])for(const address of ['https://www.facebook.com/nordbysmede/posts/123','https://www.nsmf.dk/nyheder/produktion','https://lnkd.in/dXyZ1a'])test(`a publication described in a result title is not a role: ${new URL(address).hostname}, ${origin} row`,()=>{
 const trace=traced(nsmf,[make(providerTitle,'A post about how a workshop plans its production week.',address)]);
 assert.deepEqual(trace.people.map(person=>[person.name,person.title]),[]);
 assert.equal(trace.diagnostics.at(-1).rejectionReason,'Parsed role describes a publication, not a job');
});
test('a sentence that names someone else does not give that role to the person in the title',()=>{
 const rows=[model('Mette Krog — post about the workshop',`Post identifies Lars Bak as production manager at ${nsmf.company}.`,'https://www.facebook.com/nordbysmede/posts/9')];
 assert.deepEqual(traced(nsmf,rows).people.map(person=>[person.name,person.title]),[]);
});
test('on a profile the role comes from the title when the sentence about the profile is not a role',()=>{
 const rows=[model(`Lise Holm — Operational purchasing team lead, ${brandt.company}`,`Public LinkedIn profile describes her as team lead for operational purchasing at ${brandt.company}. Relevant purchasing lead.`,linkedIn('lise-holm-4d5e6f'))];
 assert.deepEqual(traced(brandt,rows).people.map(person=>[person.name,person.title]),[['Lise Holm','Operational purchasing team lead']]);
});
test('a plain statement in a snippet is still read as the role',()=>{
 const rows=[row('Lise Holm | LinkedIn',`Lise Holm is Purchasing manager at ${brandt.company}. Experience: ${brandt.company}.`,linkedIn('lise-holm-4d5e6f'))];
 assert.deepEqual(traced(brandt,rows).people.map(person=>[person.name,person.title]),[['Lise Holm','Purchasing manager']]);
});
test('job titles that contain the same words are kept',()=>{
 for(const title of ['Post Production Manager','Production manager, Profile Extrusion']){
  const rows=[row(`Lars Bak - ${title} at ${nsmf.company}`,`Lars Bak. ${title} at ${nsmf.company}.`)];
  assert.deepEqual(traced(nsmf,rows).people.map(person=>[person.name,person.title]),[['Lars Bak',title]],title);
 }
});
test("the same title on a profile's activity feed is not a role either",()=>{
 const feed='https://dk.linkedin.com/in/mette-krog-1a2b3c/recent-activity/all/';
 for(const result of [model(providerTitle,'',feed),row(providerTitle,'A post about how a workshop plans its production week.',feed)])assert.deepEqual(traced(nsmf,[result]).people.map(person=>[person.name,person.title]),[]);
});
// Guards from the second review: what a rule about the provider's rows must never do again.
test('an official staff page read after a search provider result still yields its staff',()=>{
 const found={url:'https://www.nsmf.dk/kontakt',title:'Kontakt | NSMF',description:'The contact page lists the team.',evidenceKind:'model_summary',buyerSource:'grounded'};
 const read={...found,markdown:'## Team\n\nLars Bak\nProduction manager\n\nMette Krog\nPurchasing manager\n',sourceRead:true};
 assert.deepEqual(traced(nsmf,[found,read]).people.map(person=>[person.name,person.title,person.companyContactSource]).sort(),[['Lars Bak','Production manager','official_staff'],['Mette Krog','Purchasing manager','official_staff']]);
});
for(const [label,title,description] of [
 ['formerly',`Anna Berg - Purchasing manager - NSMF ApS | LinkedIn`,`Anna Berg formerly worked at ${nsmf.company}; she now leads purchasing at Holm Steel A/S.`],
 ['tidligere','Anna Berg - Indkøbschef i NSMF ApS | LinkedIn','Anna Berg, tidligere indkøbschef i NSMF ApS, nu hos Holm Steel A/S.'],
 ['a customer of','Anna Berg - Indkøbschef i NSMF ApS | LinkedIn','Anna Berg is purchasing manager at Holm Steel A/S, a customer of NSMF ApS.']
])test(`a search provider's sentence that says "${label}" still rejects the profile headline`,()=>{
 assert.deepEqual(traced(nsmf,[model(title,description,linkedIn('anna-berg-7a8b9c'))]).people.map(person=>[person.name,person.title]),[]);
});
// Third review: a sentence that is not taken as the role must still be heard when it says "former" (with the
// full company name in the title nothing else checks it), and the same defect in other words.
for(const [label,title,description,url] of [
 ['describes ... formerly, on a profile',`Anna Berg - Purchasing manager - ${nsmf.company} | LinkedIn`,`Profile describes Anna Berg as formerly purchasing manager at ${nsmf.company}.`,linkedIn('anna-berg-x1')],
 ['identifies ... previous, on a profile',`Anna Berg - Purchasing manager - ${nsmf.company} | LinkedIn`,`Post identifies Anna Berg as previous purchasing manager at ${nsmf.company}.`,linkedIn('anna-berg-x2')],
 ['mentions ... former, on a news site',`Anna Berg - Purchasing manager - ${nsmf.company}`,`The article mentions Anna Berg as the former purchasing manager at ${nsmf.company}.`,'https://www.example-news.dk/a/1'],
 ['opslag om tidligere, on a profile',`Anna Berg - Indkøbschef - ${nsmf.company} | LinkedIn`,`Opslag om tidligere indkøbschef hos ${nsmf.company}.`,linkedIn('anna-berg-x3')]
])test(`a former employee named so in a sentence about a publication is not kept: ${label}`,()=>{
 assert.deepEqual(traced(nsmf,[model(title,description,url)]).people.map(person=>[person.name,person.title]),[]);
});
for(const words of ['Facebook post on production leadership','Update about production leadership','Comment on production leadership','Press release about production leadership','quoted in an article on production leadership','Mentioned as production manager in a post','Search result lists her as production manager'])test(`not a job title: "${words}"`,()=>{
 const trace=traced(nsmf,[row(`Mette Krog — ${words} at ${nsmf.company}`,'A text about how a workshop plans its production week.','https://www.facebook.com/nordbysmede/posts/77')]);
 assert.deepEqual(trace.people.map(person=>[person.name,person.title]),[]);
});
// Fourth review: taking the title's role instead of the sentence is only right when the employer is evidenced
// without that sentence; otherwise the row is read exactly as before this change.
test('a sentence about someone else or about an article is not employer evidence for the person in the title',()=>{
 for(const [title,statement,url] of [
  ['Mette Krog - Purchasing manager',`Lars Bak is sales assistant at ${nsmf.company}.`,'https://www.example-news.dk/a/2'],
  ['Mette Krog - Purchasing manager at Holm Steel A/S',`Lars Bak is sales assistant at ${nsmf.company}.`,'https://www.example-news.dk/a/7'],
  ['Mette Krog - Purchasing manager | LinkedIn',`Lars Bak er sælger hos ${nsmf.company}.`,linkedIn('mette-krog-1x2y3z')],
  ['Mette Krog - Purchasing manager',`Article about the new paint line at ${nsmf.company}.`,'https://www.example-news.dk/a/5'],
  ['Mette Krog - Purchasing manager',`Post identifies Lars Bak as sales assistant at ${nsmf.company}.`,'https://www.example-news.dk/a/6']
 ])assert.deepEqual(kept(nsmf,[row(title,statement,url)]),[],title+' / '+statement);
});
test('a statement with the person as its subject is still the role, also with a middle name',()=>{
 for(const statement of [`Mette Krog is Purchasing manager at ${nsmf.company}.`,`Mette Louise Krog is currently Purchasing manager at ${nsmf.company}.`]){
  assert.deepEqual(traced(nsmf,[row('Mette Krog | LinkedIn',statement+` Experience: ${nsmf.company}.`,linkedIn('mette-krog-5q6r7s'))]).people.map(person=>[person.name,person.title]),[['Mette Krog','Purchasing manager']],statement);
 }
});
test('a role with a clause after it is read as before',()=>{
 for(const title of ['Purchasing manager and author of the monthly sourcing column','Purchasing manager, featured in a trade paper']){
  const rows=[row(`Mette Krog - ${title} at ${nsmf.company}`,`Mette Krog. ${title} at ${nsmf.company}.`)];
  assert.deepEqual(traced(nsmf,rows).people.map(person=>[person.name,person.title]),[['Mette Krog',title]],title);
 }
});
test('job titles that only resemble those phrases are kept',()=>{
 for(const title of ['LinkedIn Marketing and Production manager','Production manager, Customer Stories','Head of Production, Updates and Releases']){
  const rows=[row(`Lars Bak - ${title} at ${nsmf.company}`,`Lars Bak. ${title} at ${nsmf.company}.`)];
  assert.deepEqual(traced(nsmf,rows).people.map(person=>[person.name,person.title]),[['Lars Bak',title]],title);
 }
});
test('a contact-directory summary "<name>, based in <place>, is currently a <role> at <company>" still gives the role',()=>{
 // Found by comparing the live engine with this change row by row over seven saved runs: the "is" in such a
 // summary belongs to the person named just before it, not to another subject.
 const rows=[row('Mette Krog Email & Phone Number - RocketReach',`# Mette Krog Email & Phone Number ### Mette Krog Summary - Mette Krog, based in Aarhus, is currently a Purchasing manager at ${nsmf.company}.`,'https://rocketreach.co/mette-krog-email_1234567')];
 assert.deepEqual(traced(nsmf,rows).people.map(person=>[person.name,person.title]),[['Mette Krog','Purchasing manager']]);
});
// Fifth review: the title's role is kept instead of the sentence only when the title itself names the employer and
// the sentence says nothing about leaving or about another relation; everything else is read exactly as before.
for(const [label,title,description,url] of [
 ['a post about her last day',`Mette Krog - Purchasing manager - ${nsmf.company}`,`LinkedIn post about her last day at ${nsmf.company}.`,'https://dk.linkedin.com/posts/mette-krog_last-day-activity-1'],
 ['a post about leaving',`Mette Krog - Purchasing manager - ${nsmf.company}`,`Post about leaving her job at ${nsmf.company}.`,'https://dk.linkedin.com/posts/mette-krog_farewell-activity-2'],
 ['a Danish farewell post',`Mette Krog - Purchasing manager - ${nsmf.company}`,`Opslag om hendes afsked hos ${nsmf.company}.`,'https://dk.linkedin.com/posts/mette-krog_pension-activity-3'],
 ['a case study about a customer on the company site','Mette Krog - Purchasing manager | Holm Steel A/S',`Case study about Holm Steel deliveries at ${nsmf.company}.`,'https://nsmf.dk/cases/holm-steel']
])test(`the title's role is not kept when the sentence is ${label}`,()=>{
 assert.deepEqual(traced(nsmf,[row(title,description,url)]).people.map(person=>[person.name,person.title]),[]);
});
test('website-contacts mode does not keep the title role over the sentence',()=>{
 const rows=[model(`Lise Holm — Operational purchasing team lead, ${brandt.company}`,`Public LinkedIn profile describes her as team lead for operational purchasing at ${brandt.company}.`,linkedIn('lise-holm-4d5e6f'))];
 assert.deepEqual(D.tracePublicBuyers(rows,brandt.company,{...profileFor(brandt),includeIndexedCompanyContacts:true}).people.map(person=>person.title).filter(title=>title==='Public LinkedIn profile describes her as team lead for operational purchasing'),[]);
});
test('job titles that begin like those phrases are kept in the all-contacts reading',()=>{
 for(const title of ['Listings on Marketplaces Lead','Company Profile Manager','Public Profile Lead','Results Associate Director','Interviews with Customers Lead','Updates on Supply Chain Lead','Podcast by Sales Lead','Post Production Manager','Named Account Manager','Blog Editor']){
  const trace=D.tracePublicBuyers([{url:'https://www.nsmf.dk/team',title:`Lars Bak - ${title} - ${nsmf.company}`,description:`Lars Bak. ${title}.`,sourceRead:true,markdown:`Lars Bak\n${title}`}],nsmf.company,{...profileFor(nsmf),collectAllCompanyContacts:true});
  assert.notEqual(trace.diagnostics.find(entry=>entry.parsedTitle===title)?.rejectionReason,'Parsed role describes a publication, not a job',title);
 }
});
