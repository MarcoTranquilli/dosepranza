const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
test('observer survives session rejection; metadata-only update clears cache banner',async()=>{
 const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,value:'',children:[],textContent:'',replaceChildren(){},append(){},addEventListener(){}});return nodes.get(id);};
 let callback,snapshot,options;const calls=[];const auth={currentUser:null};
 const ctx={console,Intl,Date,Promise,setTimeout,document:{getElementById:node,createElement:()=>({append(){}})},window:{DoseCustomerCore:{day:()=> '2026-10-30',manager:()=>true},DoseOrderAnalytics:{rangeFor:()=>({}),select:()=>({rows:[],excluded:0}),aggregate:()=>({count:0,cents:0,units:0,uniqueUsers:0,averageCents:null})},DoseSupplierAccess:{resolveSession:async()=>{calls.push('resolve');throw Error('offline');},signInWithGoogle:async()=>{},roleLabel:()=> 'Admin',roleForEmail:()=> 'admin'}},getApps:()=>[ {name:'[DEFAULT]'} ],getAuth:()=>auth,getFirestore:()=>({}),onAuthStateChanged:(a,cb)=>{calls.push('observer');callback=cb;return ()=>{};},collection:()=>{},query:()=>{},where:()=>{},orderBy:()=>{},limit:()=>{},onSnapshot:(q,o,cb)=>{options=o;snapshot=cb;return ()=>{};}};
 const code=fs.readFileSync('admin/admin.js','utf8').replace(/^import .*;\n/gm,'');
 await vm.runInNewContext(`(async()=>{${code}})()`,ctx);await Promise.resolve();
 assert.deepEqual(calls,['observer','resolve']);
 auth.currentUser={email:'marco.tranquilli@dos.design',emailVerified:true,providerData:[{providerId:'google.com'}]};callback(auth.currentUser);
 assert.equal(node('admin-app').hidden,false);assert.equal(options.includeMetadataChanges,true);
 snapshot({size:0,docs:[],metadata:{fromCache:true}});assert.equal(node('admin-cache-status').hidden,false);assert.match(node('data-status').textContent,/cache locale/);
 snapshot({size:0,docs:[],metadata:{fromCache:false}});assert.equal(node('admin-cache-status').hidden,true);assert.match(node('data-status').textContent,/sincronizzati/);
 auth.currentUser=null;callback(null);assert.equal(node('admin-app').hidden,true);assert.equal(node('btn-export-csv').disabled,true);
});
