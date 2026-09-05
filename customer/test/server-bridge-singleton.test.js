const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
test('loading the server bridge twice registers only one initialization',()=>{
  let initializers=0;const document={readyState:'loading',addEventListener(type){if(type==='DOMContentLoaded')initializers++;}};const window={};
  const source=fs.readFileSync(path.join(__dirname,'../server-bridge.js'),'utf8');
  const context=vm.createContext({window,document,localStorage:{getItem:()=>null},sessionStorage:{getItem:()=>null},location:{},fetch:()=>{},setTimeout,clearTimeout,URL,CustomEvent:class{}});
  vm.runInContext(source,context);vm.runInContext(source,context);
  assert.equal(initializers,1);
});
