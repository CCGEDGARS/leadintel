const test=require('node:test'),assert=require('node:assert/strict');
const Preview=require('../trigger-preview.js');
test('Swedish LKAB investment is summarized as one grounded English sentence',()=>{
 const row={summary:'Nytt sovringsverk framtidssäkrar produktionen i Gällivare LKAB satsar sex miljarder på ett nytt sovringsverk vid Malmbergsgruvan – en investering för att säkra stabil produktion.'};
 assert.equal(Preview.summary(row,'LKAB'),'LKAB announced an investment in a new sorting plant at Malmberget.');
});
test('English trigger text keeps the first full sentence',()=>{
 assert.equal(Preview.summary({summary:'LKAB announced a new sorting plant in Malmberget. Additional background here.'},'LKAB'),'LKAB announced a new sorting plant in Malmberget.');
});
test('Unknown Swedish event avoids inventing numbers and technical detail',()=>{
 const text=Preview.summary({summary:'Företaget satsar på en ny utveckling.'},'CompanyCo');
 assert.match(text,/review the source/i);
 assert.doesNotMatch(text,/2028|SEK|EXC3/i);
});
