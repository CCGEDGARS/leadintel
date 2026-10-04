const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js');
test('ranked guesses learn only from distinct named official contacts at the active company',()=>{
 const people=[{name:'Alice Smith',publicEmail:'asmith@factory.test',publicEmailUrl:'https://factory.test/team'},{name:'Bob Jones',patternFindings:[{email:'bjones@factory.test',url:'https://factory.test/team'}]},{name:'Alice Smith',publicEmail:'asmith@factory.test',publicEmailUrl:'https://factory.test/team'},{name:'Fake Person',publicEmail:'fake.person@factory.test',publicEmailUrl:'https://directory.test'}];
 const guesses=D.rankedEmailGuesses({name:'Carol White'},'factory.test',people);
 assert.equal(guesses[0].email,'cwhite@factory.test');assert.equal(guesses[0].supportingContacts,2);assert.equal(guesses[0].status,'guessed');
 assert.equal(D.rankedEmailGuesses({name:'Carol White'},'other.test',people)[0].supportingContacts,0);
});
test('international names retain hyphens and offer a flattened alternative without inventing missing names',()=>{
 const guesses=D.rankedEmailGuesses({name:'Anne-Marie Østergaard'},'example.test');
 assert.equal(guesses[0].email,'anne-marie.ostergaard@example.test');assert.ok(guesses.some(row=>row.email==='annemarie.ostergaard@example.test'));
 for(const name of ['Anna','Unknown Person','Anna 123'])assert.deepEqual(D.rankedEmailGuesses({name},'example.test'),[]);
 for(const domain of ['gmail.com','outlook.com','localhost','bad domain.test'])assert.deepEqual(D.rankedEmailGuesses({name:'Anna Smith'},domain),[]);
});
test('company listings require the exact full name, exact domain and exact address token',()=>{
 const person={name:'Anna Smith'},rows=[{url:'https://example.test/team',markdown:'Other Person: anna.smith@example.test'},{url:'https://example.test/team',markdown:'Anna Smithson: anna.smith@example.test'},{url:'https://example.test/team',markdown:'Anna Smith COO. General email: xanna.smith@example.test'},{url:'https://example.test/team',markdown:'Anna Smith: anna.smith@example.test.evil'},{url:'https://example.test/team',markdown:'Anna Smith: info@example.test'}];
 assert.deepEqual(D.sourcedBuyerEmails(person,'example.test',rows),[]);
 const good=D.sourcedBuyerEmails(person,'example.test',[{url:'https://example.test/team',markdown:'Anna Smith: anna.smith@example.test'}]);assert.equal(good[0].email,'anna.smith@example.test');assert.equal(good[0].status,'public_unverified');
});
test('explicit non-pattern company email is retained while unrelated directory mailboxes are rejected',()=>{
 const rows=[{url:'https://example.test/team',markdown:'Anna Smith: procurement42@example.test'},{url:'https://example.test/team',markdown:'Anna Smith COO. Bob Jones: bjones@example.test'}];
 assert.deepEqual(D.sourcedBuyerEmails({name:'Anna Smith'},'example.test',rows).map(row=>row.email),['procurement42@example.test']);
});
test('Gmail ownership needs a public full-name and company attribution and never a generated pattern',()=>{
 const rows=[{url:'https://club.test',markdown:'Anna Smith · anna.smith@gmail.com'},{url:'https://club.test',markdown:'Anna Smith at Example: bluebird42@gmail.com'}];
 assert.deepEqual(D.sourcedBuyerEmails({name:'Anna Smith'},'example.test',rows,'Example').map(row=>row.email),['bluebird42@gmail.com']);
});
test('recent invalid checks and addresses already attributed to other people are removed from guesses',()=>{
 const person={name:'Anna Smith',hunterChecks:{'anna.smith@example.test':{status:'invalid',checked_at:new Date().toISOString()},'asmith@example.test':{status:'invalid',checked_at:'2020-01-01'}}};
 const guesses=D.rankedEmailGuesses(person,'example.test',[{name:'Alice Smith',publicEmail:'a.smith@example.test'}]);
 assert.ok(!guesses.some(row=>row.email==='anna.smith@example.test'||row.email==='a.smith@example.test'));assert.ok(guesses.some(row=>row.email==='asmith@example.test'));
});
