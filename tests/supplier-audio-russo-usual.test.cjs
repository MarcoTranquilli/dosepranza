const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function load(path){const data=new Map();const context={console,Intl,Date,Set,localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)}};vm.createContext(context);vm.runInContext(fs.readFileSync(path,'utf8'),context);return context;}
test('audio suppresses cache, initial server snapshot, metadata and historical dates',()=>{
 const A=load('shared/supplier-audio.js').DoseSupplierAudio,t=A.tracker(),day=A.day();
 const a={id:'a',day},b={id:'b',day};
 assert.equal(t.observe([a],day,true),false);
 assert.equal(t.observe([a],day,false),false);
 assert.equal(t.observe([a,b],day,false),true);
 assert.equal(t.observe([a,b],day,false),false);
 assert.equal(t.observe([a,b,{id:'c',day}], '2020-01-01',false),false);
 assert.equal(t.observe([a,b,{id:'c',day}],day,false),false);
 t.reset();assert.equal(t.observe([a,b],day,false),false);
 assert.equal(t.observe([a,b,{id:'d',day}],day,false,true),false);
});
test('Russo usual is isolated by UID and denied storage is harmless',()=>{
 const c=load('shared/russo-usual.js'),u=c.DoseRussoUsual;
 u.save('one',{items:[{id:'a',name:'Panino'}],allergies:'Nota'});
 assert.equal(u.read('two'),null);assert.equal(u.read(null),null);
 assert.equal(u.read('one').notes,'Nota');
 c.localStorage.setItem=()=>{throw Error('quota');};assert.doesNotThrow(()=>u.save('one',{items:[]}));
});
test('Russo reconciliation uses current prices and skips missing or unsafe variants',()=>{
 const u=load('shared/russo-usual.js').DoseRussoUsual;
 const result=u.plan([{id:'a',name:'Pane',price:1,quantity:2},{id:'gone',name:'Rimosso'},{id:'b',details:'Vecchia variante'}],[{id:'a',price:5},{id:'b',price:3}]);
 assert.equal(result.accepted.length,1);assert.equal(result.accepted[0].product.price,5);assert.equal(result.accepted[0].qty,2);assert.equal(result.skipped.length,2);
});
test('both supplier pages include audio controls and standalone metadata',()=>{
 for(const supplier of ['russo','pagnottella-gourmet']){
 const html=fs.readFileSync(`${supplier}/ordini.html`,'utf8');
 assert.match(html,/id="supplier-audio-toggle"/);assert.match(html,/id="supplier-audio-test"/);assert.match(html,/apple-mobile-web-app-capable/);assert.match(html,/shared\/supplier-audio.js\?v=/);
 }
});
test('audio toggle unlocks on gesture, synthesizes two tones and persists mute',async()=>{
 const c=load('shared/supplier-audio.js'),handlers={},frequencies=[];
 const button=id=>({textContent:'',setAttribute(){},addEventListener:(event,fn)=>{handlers[id]=fn;}});
 const elements={ 'supplier-audio-toggle':button('toggle'),'supplier-audio-test':button('test') };
 c.document={getElementById:id=>elements[id],addEventListener(){}};
 c.AudioContext=class {
  state='suspended';currentTime=0;destination={};
  async resume(){this.state='running';}
  createOscillator(){const node={frequency:{value:0},connect(){},start(){frequencies.push(node.frequency.value);},stop(){},disconnect(){}};return node;}
  createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}
 };
 c.DoseSupplierAudio.mount('russo');
 await handlers.toggle();assert.deepEqual(frequencies,[587.33,880]);assert.equal(c.localStorage.getItem('dose_supplier_audio_russo'),'true');
 await handlers.toggle();assert.equal(c.localStorage.getItem('dose_supplier_audio_russo'),'false');assert.equal(frequencies.length,2);
});
