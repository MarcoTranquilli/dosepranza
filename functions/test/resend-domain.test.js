const {test} = require('node:test');
const assert = require('node:assert/strict');
const details = {id:'d1',name:'send.dos.design',region:'eu-west-1',status:'pending',records:[{type:'TXT',name:'resend._domainkey',value:'dns-value',status:'pending'}]};
const load = () => import('../../scripts/resend-domain.js');
function mock(replies,calls) { return async(url,init)=>{calls.push({url,...init});const reply=replies.shift();assert.ok(reply);return {ok:true,json:async()=>reply};}; }
test('domain creation requests EU region and returns exact DNS values', async()=>{
 const {manageDomain}=await load(),calls=[];
 const result=await manageDomain('create',details.name,'test-key',{fetchImpl:mock([{data:[]},{id:'d1'},details],calls)});
 assert.deepEqual(JSON.parse(calls[1].body),{name:details.name,region:'eu-west-1'});
 assert.deepEqual(result.records,details.records);
});
test('existing domain recovered across pages without duplicate creation',async()=>{
 const {manageDomain}=await load(),calls=[];
 await manageDomain('create',details.name,'test-key',{fetchImpl:mock([{data:[{id:'other',name:'other.example'}],has_more:true},{data:[details]},details],calls)});
 assert.ok(calls[1].url.includes('after=other'));
 assert.ok(calls.every(c=>c.method==='GET'));
});
test('check triggers verification then reads status',async()=>{
 const {manageDomain}=await load(),calls=[];
 const result=await manageDomain('check',details.name,'test-key',{fetchImpl:mock([{data:[details]},{id:'d1'},{...details,status:'verified'}],calls)});
 assert.equal(calls[1].method,'POST');assert.ok(calls[1].url.endsWith('/verify'));assert.equal(result.status,'verified');
});
test('errors never expose provider body or credentials',async()=>{
 const {manageDomain}=await load();
 await assert.rejects(manageDomain('check',details.name,'private-key',{fetchImpl:async()=>({ok:false,status:403,json:()=>assert.fail('must not read error body')})}), e=>e.message.includes('403')&&!e.message.includes('private-key'));
 await assert.rejects(manageDomain('create',details.name,''),/RESEND_API_KEY/);
 await assert.rejects(manageDomain('check',details.name,'test-key',{fetchImpl:async()=>({ok:true,json:async()=>({data:[]})})}),/assente/);
});
