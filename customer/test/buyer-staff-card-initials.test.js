const {test}=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js');
// Read on 23 Nov 2026: seven buyer research jobs of the test workspace saved 22 people and not one e-mail address, while the
// companies' own contact pages listed an address under every name. Danish companies of this size write the address as the
// person's initials (25 of 26 on one page, 9 of 9 on another), and an address was accepted only when its text resembled the
// name. The pages below have the shape the platform's own reader makes of those two pages; every name and address is invented.
const company='Eksempel Beton',domain='eksempel-beton.dk',url='https://eksempel-beton.dk/kontakt/';
const card=(name,title,local,phone='12 34 56 78')=>`### ${name}\n${title}\n${local?`[${local}@${domain}\n](mailto:${local}@${domain})`:''}Direkte tlf.: ${phone}`;
const longCard=(name,title,local)=>`### ${name}\n${title}\n${name.split(' ')[0]} tiltrådte i 2019 og har mange års erfaring fra branchen med ansvar for regnskab, administration og indkøb samt implementering af nye systemer med fokus på digitalisering og optimering af hele virksomheden.\nTelefon\n[+45 1234 5678](tel:+4512345678)\nEmail\n[${local}@${domain}](mailto:${local}@${domain})`;
const page=(markdown,extra={})=>({url,markdown:'# Kontakt\n## Produktion\n##\n'+markdown,sourceRead:true,metadata:{sourceURL:url,source:'direct-fallback'},extractedAt:new Date().toISOString(),...extra});
const buyer=(name,title)=>({id:name,name,publicName:name,title,organization:company,companyContactSource:'official_staff',publicNameUrl:url});
const attach=(person,row)=>D.matchPublicBuyerDetails([person],[row],domain,company)[0];
const accepted=person=>D.acceptedOfficialBuyerEmail({company,domain},JSON.parse(JSON.stringify(person)));
const staff=page([card('Karla Holm','Teknisk Chef','kh'),card('Jonas Berg','Ingeniør','jb','23 45 67 89'),card('Mette Lund','Økonomichef','ml','34 56 78 90')].join('\n'));

test('an address made of the person\'s initials on the company\'s own staff card becomes that person\'s published e-mail',()=>{
 for(const [name,title,local] of [['Karla Holm','Teknisk Chef','kh'],['Jonas Berg','Ingeniør','jb'],['Mette Lund','Økonomichef','ml']]){
  const person=attach(buyer(name,title),staff);
  assert.equal(person.publicEmail,local+'@'+domain,name);
  assert.equal(person.publicEmailUrl,url);assert.equal(person.publicEmailEvidence.sourceKind,'official');assert.equal(person.publicEmailEvidence.sourceRead,true);
  assert.equal(accepted(person),local+'@'+domain,name+': accepted from the saved evidence alone, after a save and reload');
 }
});

test('several contact lines may stand between the title and the address, however long together',()=>{
 const lines='Direkte telefon: +45 12 34 56 78 / Mobil: +45 23 45 67 89\nTlf. nr.: +45 34 56 78 90 / Telefon: +45 45 67 89 01\nMobil nr.: +45 56 78 90 12 | Direkte: +45 67 89 01 23\nE-mail';
 const row=page(`### Tine Dahl\nRegnskabschef\n${lines}\n[td@${domain}](mailto:td@${domain})\n### Peter Skov\nProjektleder\n[ps@${domain}](mailto:ps@${domain})`);
 assert.ok(lines.length>160);
 const person=attach(buyer('Tine Dahl','Regnskabschef'),row);
 assert.equal(person.publicEmail,'td@'+domain);assert.equal(accepted(person),'td@'+domain);
 assert.deepEqual(D.sourcedBuyerEmails(buyer('Tine Dahl','Regnskabschef'),domain,[row],company).map(found=>found.email),['td@'+domain],'read straight from the live page, more than 160 characters after the name');
});

test('initials of all name words, or of the first and the last, are recognised; other letters are not',()=>{
 const found=(name,title,local)=>D.sourcedBuyerEmails(buyer(name,title),domain,[page(card(name,title,local))],company).map(row=>row.email);
 assert.deepEqual(found('Karla Bech Holm','Teknisk Chef','kbh'),['kbh@'+domain]);
 assert.deepEqual(found('Karla Bech Holm','Teknisk Chef','kh'),['kh@'+domain]);
 assert.deepEqual(found('Søren Åberg','Teknisk Chef','sa'),['sa@'+domain],'ø and å count as o and a');
 assert.deepEqual(found('Karla Holm','Teknisk Chef','kb'),[]);
 assert.deepEqual(found('Karla Holm','Teknisk Chef','hk'),[]);
 assert.deepEqual(found('Karla Holm','Teknisk Chef','k'),[]);
 assert.deepEqual(found('Karla Holm','Teknisk Chef','kho'),[]);
});

test('a neighbour\'s address is never taken, even when the initials are the same',()=>{
 const row=page([card('Karla Holm','Teknisk Chef',''),card('Kim Hansen','Ingeniør','kh','23 45 67 89')].join('\n'));
 const karla=attach(buyer('Karla Holm','Teknisk Chef'),row);
 assert.equal(karla.publicEmail||'','');assert.equal(accepted(karla),'');
 assert.deepEqual(D.sourcedBuyerEmails(buyer('Karla Holm','Teknisk Chef'),domain,[row],company),[]);
 assert.equal(attach(buyer('Kim Hansen','Ingeniør'),row).publicEmail,'kh@'+domain);
});

test('a card with an address that is not the person\'s initials, or with two addresses, gives no e-mail',()=>{
 const other=attach(buyer('Karla Holm','Teknisk Chef'),page(card('Karla Holm','Teknisk Chef','xy')));
 assert.equal(other.publicEmail||'','');
 const two=page(`### Karla Holm\nTeknisk Chef\n[kh@${domain}](mailto:kh@${domain})\n[jb@${domain}](mailto:jb@${domain})\nDirekte tlf.: 12 34 56 78`);
 assert.equal(attach(buyer('Karla Holm','Teknisk Chef'),two).publicEmail||'','');
 assert.deepEqual(D.sourcedBuyerEmails(buyer('Karla Holm','Teknisk Chef'),domain,[two],company),[]);
});

test('a department mailbox that happens to equal the initials is not a personal address',()=>{
 for(const [name,title,local] of [['Ida Thomsen','IT-chef','it'],['Per Rask','Kommunikationschef','pr'],['Quinn Aagaard','Kvalitetschef','qa']]){
  const row=page(card(name,title,local));
  assert.equal(attach(buyer(name,title),row).publicEmail||'','',local);
  assert.deepEqual(D.sourcedBuyerEmails(buyer(name,title),domain,[row],company),[],local);
 }
});

test('the card must be on the company\'s own site, read by the platform, and carry the person\'s own title',()=>{
 const text=card('Karla Holm','Teknisk Chef','kh');
 assert.equal(attach(buyer('Karla Holm','Teknisk Chef'),page(text,{sourceRead:false})).publicEmail||'','','a search excerpt is not a read page');
 const elsewhere={...page(company+'\n'+text),url:'https://katalog-eksempel.dk/eksempel-beton',metadata:{sourceURL:'https://katalog-eksempel.dk/eksempel-beton'}};
 assert.equal(attach({...buyer('Karla Holm','Teknisk Chef'),publicNameUrl:elsewhere.url},elsewhere).publicEmail||'','','a listing on another site');
 assert.equal(attach(buyer('Karla Holm','Indkøbschef'),page(text)).publicEmail||'','','another title than the card\'s');
 assert.deepEqual(D.sourcedBuyerEmails(buyer('Karla Holm','Indkøbschef'),domain,[page(text)],company),[]);
});

test('an address written as the name keeps working as before',()=>{
 const row=page(card('Karla Holm','Teknisk Chef','karla.holm'));
 const person=attach(buyer('Karla Holm','Teknisk Chef'),row);
 assert.equal(person.publicEmail,'karla.holm@'+domain);assert.equal(accepted(person),'karla.holm@'+domain);
});

test('a whole research pass over such a page ends with the address accepted and without the deeper searches',async()=>{
 const candidate={company,domain,buyerRoles:'Teknisk Chef',people:[buyer('Karla Holm','Teknisk Chef')]},queries=[];
 const report=await D.runMandatoryBuyerResearch(candidate,{rows:[staff],search:async query=>{queries.push(query);return [];},readPage:async()=>staff});
 const [karla]=candidate.people;
 assert.equal(karla.publicEmail,'kh@'+domain);assert.equal(D.acceptedOfficialBuyerEmail(candidate,karla),'kh@'+domain);
 assert.equal(karla.contactResearch.checks.deep.status,'not_needed');assert.match(karla.contactResearch.checks.deep.reason,/Published company email already found/);
 for(const query of D.buyerDeepContactQueries(candidate,karla))assert.ok(!queries.includes(query));
 assert.equal(report.status,'complete');
});

// Found by a second reader on the first version of this change (23 Nov 2026): initials are two letters, so wherever the card's
// end is not certain a neighbour's or a department's address could be taken. Every page below gave a wrong address then.
const link=local=>`[${local}@${domain}](mailto:${local}@${domain})`;
const nothing=(name,title,markdown,why,extra)=>{
 const row={...page(markdown),...extra},person=attach(buyer(name,title),row);
 assert.equal(person.publicEmail||'','',why+': attached');assert.equal(accepted(person),'',why+': accepted');
 assert.deepEqual(D.sourcedBuyerEmails(buyer(name,title),domain,[row],company),[],why+': listed as a finding');
};

test('initials count only on a card whose end is certain: the next person in any form ends it',()=>{
 const karla='### Karla Holm\nTeknisk Chef\nDirekte tlf.: 12 34 56 78\n';
 nothing('Karla Holm','Teknisk Chef',karla+'Kim Hansen\nIngeniør\n'+link('kh'),'next card as plain lines');
 nothing('Karla Holm','Teknisk Chef',karla+'**Kim Hansen, Ingeniør**\n'+link('kh'),'next card bold with its title');
 nothing('Karla Holm','Teknisk Chef',karla+'**Kim Hansen – Ingeniør**\n'+link('kh'),'next card bold with a dash');
 nothing('Karla Holm','Teknisk Chef',karla+'__Kim Hansen__\nIngeniør\n'+link('kh'),'next card underlined');
 nothing('Karla Holm','Teknisk Chef',karla+'- Kim Hansen, Ingeniør, '+link('kh'),'next card a list item');
 nothing('Karla Holm','Teknisk Chef',karla+'![Foto](https://eksempel-beton.dk/kim.jpg)\nKim Hansen\n'+link('kh'),'a portrait between the cards');
 nothing('Karla Holm','Teknisk Chef',karla+'![Kim Hansen](https://eksempel-beton.dk/kim.jpg)\n'+link('kh'),'only a portrait between the cards');
 nothing('Karla Holm','Teknisk Chef',karla+'---\nDirekte tlf.: 23 45 67 89\n'+link('kh'),'only a rule between the cards');
 nothing('Karla Holm','Teknisk Chef',karla+'**Kirsten la Hede**\nIngeniør\nTlf. 23 45 67 89\n'+link('kh'),'a name with a particle');
 nothing('Karla Bech Holm','Teknisk Chef','### Karla Bech Holm\nTeknisk Chef\nDirekte tlf.: 12 34 56 78\nKim Holm\nIngeniør\n'+link('kh'),'three name words, a neighbour with the first and last initial');
});

test('initials need a card that starts with a heading or a bold name, and no second address hidden behind a link label',()=>{
 nothing('Karla Holm','Teknisk Chef',`Karla Holm\nTeknisk Chef\nTlf. 12 34 56 78\n${link('kh')}`,'plain lines are not a card');
 nothing('Karla Holm','Teknisk Chef',`Kontakt\nKarla Holm\nTeknisk Chef\nTlf. 12 34 56 78\n[E-mail](mailto:kho@${domain})\nKim Hansen\nIngeniør\nTlf. 23 45 67 89\n${link('kh')}`,'own address behind a label, neighbour\'s in the open');
 nothing('Karla Holm','Teknisk Chef',`### Karla Holm\nTeknisk Chef\n[Send mail](mailto:karla@${domain})\n${link('kh')}`,'two addresses, one behind a label');
 nothing('Karla Holm','Teknisk Chef',`### Karla Holm\nTeknisk Chef\n[E-mail](mailto:kho@${domain})\nKim Hansen\nIngeniør\n${link('kh')}`,'her own address behind a label inside her card, the neighbour\'s in the open after it');
 nothing('Karla Holm','Teknisk Chef',`### Karla Holm\nTeknisk Chef\n[E-mail](mailto:karla@${domain})\n${link('kh')}`,'two addresses, the first behind an e-mail label');
 const bold=attach(buyer('Karla Holm','Teknisk Chef'),page(`**Karla Holm**\nTeknisk Chef\n${link('kh')}\n**Kim Hansen**\nIngeniør\n${link('kih')}`));
 assert.equal(bold.publicEmail,'kh@'+domain,'a bold name starts a card');
});

test('a mailbox with a label of its own is a department\'s, wherever it stands',()=>{
 nothing('Erik Larsen','Afdelingsleder',`### Mette Lund\nØkonomichef\n${link('ml')}\n### Erik Larsen\nAfdelingsleder\nDirekte tlf.: 12 34 56 78\n\nEl-afdeling: ${link('el')}\nCVR 12345678`,'after the last card');
 nothing('Anders Petersen','Bogholder',`### Anders Petersen\nBogholder\nKreditorer: ${link('ap')}`,'on the card, labelled');
 nothing('Kaj Sørensen','Servicechef',`### Kaj Sørensen\nServicechef\nKundeservice\n${link('ks')}`,'label on the line above');
 for(const [name,title,local] of [['Jens Ole Bak','Personalechef','job'],['Dorte Pia Olsen','Jurist','dpo'],['Vera Vinter Skov','Projektleder','vvs'],['Carl Erik Olsen','Direktør','ceo'],['Per Otto Steen Thomsen','Lagerchef','post']])
  nothing(name,title,`### ${name}\n${title}\n${link(local)}`,local+'@ is a function mailbox');
 const own=attach(buyer('Tine Dahl','Regnskabschef'),page(`### Tine Dahl\nRegnskabschef\nTelefon\n[+45 1234 5678](tel:+4512345678)\nE-mail: ${link('td')}`));
 assert.equal(own.publicEmail,'td@'+domain,'an e-mail label is not a department');
});

test('a model\'s summary of a page is never a staff card for initials',()=>{
 nothing('Karla Holm','Teknisk Chef',`### Karla Holm\nTeknisk Chef\n${link('kh')}`,'model summary',{evidenceKind:'model_summary'});
});

test('the title may differ in letter case between the card and the saved person, and the address is still accepted after a reload',()=>{
 const person=attach(buyer('Karla Holm','Teknisk Chef'),page(`### Karla Holm\nTeknisk chef\n${link('kh')}`));
 assert.equal(person.publicEmail,'kh@'+domain);assert.equal(accepted(person),'kh@'+domain);
});

test('the saved proof of an initials address is the card\'s name, title and address, and nothing of a neighbour',()=>{
 const row=page([card('Tine Dahl','Regnskabschef','td'),card('Peter Skov','Projektleder','ps')].join('\n'));
 const person=attach(buyer('Tine Dahl','Regnskabschef'),row);
 assert.equal(person.publicEmailEvidence.quote,'Tine Dahl Regnskabschef td@'+domain);
});

test('the address has to stand within eight lines of the title, and capitalised contact labels do not end the card',()=>{
 const filler=n=>Array.from({length:n},(_,i)=>`Tlf. 12 34 56 7${i}`).join('\n');
 nothing('Karla Holm','Teknisk Chef',`### Karla Holm\nTeknisk Chef\n${filler(8)}\n${link('kh')}`,'ninth line after the title');
 assert.equal(attach(buyer('Karla Holm','Teknisk Chef'),page(`### Karla Holm\nTeknisk Chef\n${filler(7)}\n${link('kh')}`)).publicEmail,'kh@'+domain,'eighth line');
 const labels=attach(buyer('Karla Holm','Teknisk Chef'),page(`### Karla Holm\nTeknisk Chef\nDirekte Telefon\n12 34 56 78\nMobil Telefon\n23 45 67 89\nE-mail\n${link('kh')}\n### Kim Hansen\nIngeniør`));
 assert.equal(labels.publicEmail,'kh@'+domain);
});

// Second round of the same reader: a list of the shapes a neighbour's card may take never ends, so the rule now lists what a
// card may hold instead. Each page below gave Karla the address of the person after her.
test('whatever the next card looks like, it ends this one: only contact lines belong to a card',()=>{
 const karla='### Karla Holm\nTeknisk chef\nTlf. 12 34 56 78\n',kim='\nIngeniør\nTlf. 23 45 67 89\n'+link('kh');
 for(const [next,why] of [['Kim Hansen (barsel)'+kim,'a note in brackets after the name'],['Kim'+kim,'a first name only'],['Kim Ole Bech Juul Hansen'+kim,'a name of five words'],['kim hansen'+kim,'a name in lower case'],
  ['Ingeniør, Kim Hansen\nTlf. 23 45 67 89\n'+link('kh'),'the title before the name'],['Projektleder: Kim Hansen\nTlf. 23 45 67 89\n'+link('kh'),'the title and a colon before the name'],
  ['Kim Hansen / Ingeniør\nTlf. 23 45 67 89\n'+link('kh'),'a slash'],['Kim Hansen · Ingeniør\nTlf. 23 45 67 89\n'+link('kh'),'a middle dot'],['Kim Hansen: Ingeniør\nTlf. 23 45 67 89\n'+link('kh'),'a colon'],
  ['Kim Hansen (barsel)\nIngeniør\nE-mail:\n'+link('kh'),'an e-mail label above the address'],['Kim Hansen er vores nye ingeniør i produktionen fra marts.\n'+link('kh'),'a sentence that names somebody else'],
  ['Afdeling Nord\n'+link('kh'),'a line that is neither contact nor text'],['Åbningstider: 7-16\n'+link('kh'),'a labelled line of another kind']])
  nothing('Karla Holm','Teknisk Chef',karla+next,why);
 nothing('Karla Holm','Teknisk Chef',(karla+'Kim Hansen (barsel)'+kim).replace(/\n/g,'\r\n'),'Windows line endings');
});

test('an address on the name line or the title line is the card\'s own and counts against any other',()=>{
 const kim='Tlf. 12 34 56 78\nKim Hansen (barsel)\nIngeniør\nTlf. 23 45 67 89\n'+link('kh');
 nothing('Karla Holm','Teknisk Chef',`### [Karla Holm](mailto:kho@${domain})\nTeknisk chef\n${kim}`,'the name is a mail link');
 nothing('Karla Holm','Teknisk Chef',`### Karla Holm\n[Teknisk chef](mailto:kho@${domain})\n${kim}`,'the title is a mail link');
 nothing('Karla Holm','Teknisk Chef',`### Karla Holm\nTeknisk chef og indkøber\n${link('kh')}`,'the title line holds more than the title');
 nothing('Karla Holm','Teknisk Chef',`### Karla Holm\n[Teknisk chef](mailto:kho@${domain})\nTlf. 12 34 56 78\n${link('kh')}`,'an address behind the title and a second one below, nothing but contact lines between');
});

test('a card may hold phone and e-mail lines in the usual Danish forms',()=>{
 const ok=(markdown,why)=>assert.equal(attach(buyer('Karla Holm','Teknisk Chef'),page(markdown)).publicEmail,'kh@'+domain,why);
 ok(`### Karla Holm\nTeknisk Chef\nDirekte tlf.: 12 34 56 78\nMobil: +45 23 45 67 89\nE-mail: ${link('kh')}`,'labels with numbers, the address after an e-mail label');
 ok(`### Karla Holm\nTeknisk Chef\n- Tlf. 12 34 56 78\n- ${link('kh')}`,'list items');
 ok(`**Karla Holm**\nTeknisk Chef\n[+45 1234 5678](tel:+4512345678)\n${link('kh')}\n**Kim Hansen**\nIngeniør\n${link('kih')}`,'a phone link, a bold name');
 ok(`### Karla Holm\nTeknisk Chef\n${link('kh')}\nDirekte tlf.: 12 34 56 78\n### Kim Hansen\nIngeniør\n${link('kih')}`,'the address first, the phone after it');
 ok(`### Karla Holm\nTeknisk Chef\nTlf. nr.: 12 34 56 78\nDirekte: 12 34 56 78 / Mobil: 23 45 67 89\n${link('kh')}`,'a number label, two numbers on a line');
 ok(`### Karla Holm\nTeknisk Chef\nT: +45 12 34 56 78\nM: +45 23 45 67 89\nE: ${link('kh')}`,'one-letter labels');
});

// Third round: a sentence was allowed between the title and the address, and a sentence can say anything.
test('a sentence between the title and the address ends the card, whatever it says',()=>{
 const karla='### Karla Holm\nTeknisk chef\nTlf. 12 34 56 78\n';
 for(const [next,why] of [
  ['K. Hansen, tlf. 23 45 67 89\n'+link('kh'),'a name with a phone number'],['Kim, ingeniør: 23 45 67 89\n'+link('kh'),'a first name, a title and a number'],['Ingeniør, direkte 23 45 67 89\n'+link('kh'),'a title and a number'],
  ['Kim er vores nye ingeniør og træffes bedst om formiddagen\nMail: '+link('kh'),'a sentence about a colleague'],['Kirsten la Hede overtager alle henvendelser om tekniske spørgsmål\n'+link('kh'),'a sentence naming a colleague'],
  ['i min fravær kontakt venligst min kollega på nedenstående mail\n'+link('kh'),'a sentence sending the reader to a colleague'],['Karla Holmgaard overtager alle henvendelser om tekniske spørgsmål\n'+link('kh'),'a longer name that starts like hers'],
  ['Karla Holm har været i virksomheden siden 2011 og leder den tekniske afdeling.\n'+link('kh'),'even a sentence about herself']])
  nothing('Karla Holm','Teknisk Chef',karla+next,why);
 nothing('Karen Svendsen','Kundechef',`### Karen Svendsen\nKundechef\nTlf. 12 34 56 78\nHenvendelser om ordrer og levering sendes til vores kundeservice\n${link('ks')}`,'a sentence naming a department');
 nothing('Tine Dahl','Regnskabschef',[longCard('Tine Dahl','Regnskabschef','td'),longCard('Peter Skov','Projektleder','ps')].join('\n'),'a biography paragraph before the contact lines: a known miss');
});
