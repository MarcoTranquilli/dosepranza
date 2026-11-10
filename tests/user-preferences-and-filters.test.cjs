const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function setup(){const data=new Map(),context={Intl,Date,localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)}};vm.createContext(context);vm.runInContext(fs.readFileSync('shared/user-preferences.js','utf8'),context);return {P:context.DosePreferences,data,context};}
const order={items:[{id:'a',name:'Panino',quantity:1,price:5}],total:5,notes:'Senza sale'};
test('filters use explicit metadata and vegetarian catalog diets, never infer lactose claims',()=>{
 const {P}=setup();assert.equal(P.matches({dietType:'vegetariana'},'veg'),true);assert.equal(P.matches({diet:['vegano']},'veg'),true);
 assert.equal(P.matches({name:'Senza latte',diet:['vegano']},'lactose-free'),false);
 for(const tag of Object.keys(P.labels))assert.equal(P.matches({foodTags:[tag]},tag),true);
 assert.equal(P.matches({},'all'),true);assert.equal(P.matches({},'light'),false);
});
test('favorites serialize at most three slots, rename and delete without crossing UID or supplier',()=>{
 const {P}=setup();for(let i=0;i<3;i++)P.saveFavorite('u','russo',order,`Ordine ${i}`);
 assert.throws(()=>P.saveFavorite('u','russo',order,'Quarto'),/3 preferiti/);
 P.saveFavorite('u','russo',order,'Nuovo nome',1);assert.equal(P.favorites('u','russo')[1].label,'Nuovo nome');
 assert.equal(P.favorites('other','russo').length,0);assert.equal(P.favorites('u','pagnottella').length,0);
 P.removeFavorite('u','russo',1);assert.equal(P.favorites('u','russo').length,2);
 assert.throws(()=>P.saveFavorite(null,'russo',order,'Anonimo'),/Accedi/);
});
test('migration accepts all deployed legacy keys once and only for their owner',()=>{
 for(const [supplier,key,owner] of [['russo','russo_last_completed_order','userId'],['pagnottella','pg_last_completed_order','uid'],['pagnottella','pagnottella_last_completed_order','uid']]){
 const {P,data}=setup();data.set(key,JSON.stringify({...order,[owner]:'u'}));assert.equal(P.favorites('x',supplier).length,0);
 assert.equal(P.favorites('u',supplier)[0].label,'Il solito');P.removeFavorite('u',supplier,0);assert.equal(P.favorites('u',supplier).length,0);assert.ok(data.has(key));
 }
});
test('notes are UID scoped, blank edits retain suggestion, storage denial never crashes checkout',()=>{
 const {P,context}=setup();P.saveNote('a','russo','Senza sale');P.saveNote('a','russo','');assert.equal(P.note('a','russo'),'Senza sale');assert.equal(P.note('b','russo'),'');assert.equal(P.note('a','pagnottella'),'');
 context.localStorage.setItem=()=>{throw Error('quota');};assert.equal(P.saveNote('a','russo','Nuova'),false);assert.equal(P.receipt('a','russo','1',order),false);assert.throws(()=>P.saveFavorite('a','russo',order,'Test'),/non disponibile/);
});
test('receipts require explicit completion, isolate users and expire on Rome date, including DST',()=>{
 const {P}=setup();P.receipt('u','pagnottella','pg1',order,false);assert.equal(P.today('u').length,0);P.confirmReceipt('x','pg1');assert.equal(P.today('u').length,0);P.confirmReceipt('u','pg1');assert.equal(P.today('u').length,1);assert.equal(P.today('x').length,0);assert.equal(P.today('u',new Date('2020-01-01')).length,0);
 assert.equal(P.romeDay(new Date('2026-10-24T22:30:00Z')),'2026-10-25');assert.equal(P.romeDay(new Date('2026-10-25T23:30:00Z')),'2026-10-26');
});
test('malformed preferences are rejected and do not prevent rendering',()=>{
 const {P,data}=setup();data.set('dose_ux_v1:u:russo:favorites','bad json');assert.equal(P.favorites('u','russo').length,0);
 assert.throws(()=>P.saveFavorite('u','russo',{items:[{name:'x',quantity:0}]},'X'),/valida/);
});
test('corrupt receipt collections do not interrupt checkout or the hub',()=>{
 const {P,data}=setup();data.set('dose_ux_v1:u:receipts','[null,{},false]');data.set('dose_ux_v1:u:pending','[null,{}]');
 assert.equal(P.today('u').length,0);assert.doesNotThrow(()=>P.confirmReceipt('u','x'));assert.equal(P.receipt('u','russo','one',order),true);assert.equal(P.today('u').length,1);
});
