const test=require('node:test');
const assert=require('node:assert/strict');
const view=require('../evidence-view.js');

test('renders narrow product evidence with its source, scope, supported field and warning',()=>{
  const html=view.renderEvidence({
    evidenceCoverage:{level:'limited',label:'Limited coverage',message:'Only one narrow product claim was collected. It supports a priority offer but does not support the complete company profile.'},
    evidenceSources:[{
      id:'E1',type:'Official website',title:'Instrumentu skapis SUPPLY',url:'https://www.ajprodukti.lv/instrumentu-skapis',scope:'product',scopeLabel:'Limited product evidence',confidence:'High source confidence · narrow scope',excerpt:'Izturīgs metāla skapis efektīvai instrumentu un detaļu uzglabāšanai.',supports:['Priority offer']
    }]
  });
  assert.match(html,/Limited coverage/);
  assert.match(html,/does not support the complete company profile/);
  assert.match(html,/Limited product evidence/);
  assert.match(html,/Priority offer/);
  assert.match(html,/href="https:\/\/www\.ajprodukti\.lv\/instrumentu-skapis"/);
});

test('escapes untrusted source content and rejects unsafe source URLs',()=>{
  const html=view.renderEvidence({
    evidenceCoverage:{level:'partial',label:'Partial coverage',message:'Review source.'},
    evidenceSources:[{id:'E1',type:'Official page',title:'<script>alert(1)</script>',url:'javascript:alert(1)',scope:'supporting',scopeLabel:'Supporting page evidence',confidence:'Supporting evidence',excerpt:'<img src=x onerror=alert(1)>',supports:['Supporting context']}]
  });
  assert.doesNotMatch(html,/<script>|<img|javascript:/i);
  assert.match(html,/&lt;script&gt;/);
});
