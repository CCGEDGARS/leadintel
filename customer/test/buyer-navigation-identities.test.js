const test=require('node:test');
const assert=require('node:assert/strict');
const D=require('../discovery-engine.js');

const navigation=['Investor Relations Contacts','Corporate Governance','Capital Markets Day','About Us'];
test('navigation headings cannot become full buyer identities',()=>{
  for(const heading of navigation)assert.equal(D.hasFullBuyerName(heading),false,heading);
  for(const name of ['Milda Zybartienė','Rafał Smyjewski','Alex Jørgensen','Carina Marie Brataas'])assert.equal(D.hasFullBuyerName(name),true,name);
});

for(const [company,domain] of [['Northstar Systems','northstar.example'],['Independent Clinic','clinic.example']]){
  test(`${company} contact discovery excludes navigation and the company office`,()=>{
    const candidate={company,domain,market:'Denmark'};
    const row={url:`https://${domain}/contact-us`,sourceRead:true,markdown:`# Team\nMilda Zybartienė\nSourcing Director\nRafał Smyjewski\nGlobal Commodity Manager - Mechanics - EU&US\n${company}\nHead Office\nInvestor Relations Contacts\nFor Suppliers Supplier Code of Conduct\nCorporate Governance\nSustainability\nCapital Markets Day\nAnalysts`};
    const office={...row,markdown:`# Contact\n## ${company}\nHead Office`};
    const stale={id:'old-office',name:company,title:'Head Office',organization:company,identityStatus:'confirmed',nameVerification:'confirmed',publicNameUrl:row.url};
    const contacts=D.discoverCompanyContacts([row,office],candidate,[stale]);
    assert.deepEqual(contacts.map(p=>p.name).sort(),['Milda Zybartienė','Rafał Smyjewski']);
    assert.equal(D.retainBuyerIdentities([stale,...contacts],{decisionMakers:'Sourcing Director; Commodity Manager'},candidate).some(p=>p.name===company),false,'old office entries cannot consume the retained identity quota');
    const restored=D.normalizeDiscoveryState({selectedProspects:[{...candidate,buyerSearchMode:'user_selected_target',people:contacts,buyerDiscovery:{companyContacts:contacts}}]}).selectedProspects[0];
    assert.deepEqual(restored.people.map(p=>p.name).sort(),['Milda Zybartienė','Rafał Smyjewski']);
  });
}
