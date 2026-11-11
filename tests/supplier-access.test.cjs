const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const emails=['isidorovagnozzi@gmail.com','isidoro.vagnozzi@gmail.com','commerciale@lapagnottellagourmet.it'];
const user=email=>({email,uid:'supplier',emailVerified:true,providerData:[{providerId:'google.com'}]});
for(const file of ['supplier-access.js','pagnottella-gourmet/supplier-access.js'])test(`${file}: both exact Isidoro variants are normalized suppliers, never admins`,()=>{
 const context={window:{}};vm.runInNewContext(fs.readFileSync(file,'utf8'),context);const A=context.window.DoseSupplierAccess;
 for(const email of emails)for(const spelling of [email,` ${email.toUpperCase()} `]){assert.equal(A.roleForEmail(spelling),'supplier');assert.deepEqual(Array.from(A.supplierIdsForIdentity(spelling)),['pagnottella']);}
 for(const email of ['isidoro.vagnozzi@gmail.com.evil','isidoro.vagnozzi+other@gmail.com','isi.doro.vagnozzi@gmail.com'])assert.deepEqual(Array.from(A.supplierIdsForIdentity(email)),[]);
});
const context={};vm.runInNewContext(fs.readFileSync('shared/pagnottella-orders-core.js','utf8'),context);const C=context.DosePagnottellaOrders;
test('dashboard authorization uses normalized verified Google whitelist, not arbitrary Gmail aliases',()=>{
 for(const email of emails){assert.equal(C.allowed(user(` ${email.toUpperCase()} `)),true);assert.equal(C.allowed({...user(email),emailVerified:false}),false);assert.equal(C.allowed({...user(email),isAnonymous:true}),false);assert.equal(C.allowed({...user(email),providerData:[]}),false);}
 assert.equal(C.allowed(user('isi.doro.vagnozzi@gmail.com')),false);
});
const guide={};vm.runInNewContext(fs.readFileSync('shared/supplier-login-guide.js','utf8'),guide);const G=guide.DoseSupplierLogin;
test('embedded browser warning and mobile failures guide user without unsafe forced redirects',()=>{
 for(const agent of ['WhatsApp','Telegram','Line','MicroMessenger','musical_ly','FBAN','FBAV','Instagram','Slack','Teams','Android; wv)'])assert.equal(G.embedded(agent),true);
 assert.equal(G.embedded('Mozilla/5.0 Safari/605.1.15'),false);assert.match(G.guidance('WhatsApp'),/WhatsApp.*Chrome.*Safari/);
 assert.match(G.errorMessage({code:'auth/popup-blocked'}),/popup.*Safari/);assert.match(G.errorMessage({code:'auth/popup-closed-by-user'}),/annullato/);
});
async function controller(code='auth/popup-blocked'){
 let observer,reads=0,signouts=0,redirects=0;const store=new Map();const storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};const nodes=new Map();const el=id=>{if(!nodes.has(id))nodes.set(id,{style:{},replaceChildren(){}});return nodes.get(id);};
 const auth={currentUser:null};const sandbox={window:{DosePagnottellaOrders:C,DoseOrderAnalytics:{},DoseSupplierLogin:{...G,createFlow:options=>G.createFlow({...options,storage,agent:''})},DoseSupplierAccess:{ensureFirebase:async()=>({auth,app:{}})}},document:{getElementById:el},navigator:{userAgent:''},Intl,Date,console,getRedirectResult:async()=>null,signInWithRedirect:async()=>{redirects++;},getFirestore:()=>({}),onAuthStateChanged:(a,cb)=>observer=cb,signInWithPopup:async()=>{throw Object.assign(new Error('test'),{code});},GoogleAuthProvider:class{setCustomParameters(value){assert.equal(value.prompt,'select_account');}},signOut:async()=>{signouts++;auth.currentUser=null;observer(null);},collection:()=>({}),query:()=>({}),where:()=>({}),onSnapshot:()=>{reads++;return ()=>{};}};
 const source=fs.readFileSync('pagnottella-gourmet/ordini.js','utf8').replace(/^import .*;\n/gm,'');await vm.runInNewContext(`(async()=>{${source}})()`,sandbox);
 return {el,auth,observe:value=>{auth.currentUser=value;observer(value);},reads:()=>reads,signouts:()=>signouts,redirects:()=>redirects};
}
test('wrong account displays actual email, starts no query, and can sign out then authorize the correct one',async()=>{
 const t=await controller();t.observe(user('Wrong@Example.com'));assert.equal(t.reads(),0);assert.match(t.el('access-status').textContent,/wrong@example.com/);assert.equal(t.el('btn-blocked-logout').hidden,false);
 await t.el('btn-blocked-logout').onclick();assert.equal(t.signouts(),1);assert.equal(t.el('btn-login').disabled,false);
 t.observe(user(' ISIDORO.VAGNOZZI@GMAIL.COM '));assert.equal(t.reads(),1);assert.equal(t.el('main-view').style.display,'block');
});
for(const code of ['auth/popup-blocked','auth/popup-closed-by-user','auth/network-request-failed','auth/web-storage-unsupported'])test(`login always resets UI after ${code}`,async()=>{
 const t=await controller(code);await t.el('btn-login').onclick();assert.equal(t.el('btn-login').disabled,false);if(code==='auth/popup-blocked'){assert.equal(t.redirects(),1);assert.match(t.el('access-status').textContent,/stessa scheda/);}else{assert.equal(t.redirects(),0);assert.equal(t.el('access-status').textContent,G.errorMessage({code}));}assert.equal(t.reads(),0);
});
for(const file of ['supplier-access.js','pagnottella-gourmet/supplier-access.js'])test(`${file}: in-app login is blocked before Firebase initialization`,async()=>{
 const context={window:{navigator:{userAgent:'Telegram'},location:{protocol:'https:'}}};vm.runInNewContext(fs.readFileSync(file,'utf8'),context);
 assert.equal(context.window.DoseSupplierAccess.isInAppBrowser('MicroMessenger'),true);
 await assert.rejects(context.window.DoseSupplierAccess.signInWithGoogle(),error=>error.code==='auth/disallowed-useragent');
});
function flowFixture({code='auth/popup-blocked',agent='',result=null,storageBlocked=false}={}){
 const values=new Map(),messages=[];let redirects=0,popups=0,recoveries=0,issues=0;
 const storage={getItem:k=>values.get(k),setItem:(k,v)=>{if(storageBlocked)throw Error('blocked');values.set(k,v);},removeItem:k=>values.delete(k)};
 const sdk={GoogleAuthProvider:class{setCustomParameters(){}},getRedirectResult:async()=>{recoveries++;return result;},signInWithPopup:async()=>{popups++;throw {code};},signInWithRedirect:async()=>{redirects++;}};
 const make=()=>G.createFlow({auth:{currentUser:null},sdk,storage,agent,path:'/supplier/',status:m=>messages.push(m),onIssue:()=>issues++});
 return {make,values,messages,redirects:()=>redirects,popups:()=>popups,recoveries:()=>recoveries,issues:()=>issues};
}
for(const code of ['auth/popup-blocked','auth/cancelled-popup-request'])test(`one redirect fallback for ${code}, no loop on missing session`,async()=>{
 const f=flowFixture({code}),first=f.make();await first.recover();await first.login();assert.equal(f.redirects(),1);
 const returned=f.make();const recovered=await returned.recover();assert.equal(recovered.issue,true);await returned.login();assert.equal(f.redirects(),1);assert.match(f.messages.at(-1),/Nessun altro redirect/);
 returned.reset();await returned.login();assert.equal(f.redirects(),2);
});
test('redirect result is consumed once and returns the signed-in user',async()=>{
 const expected=user('isidoro.vagnozzi@gmail.com'),f=flowFixture({result:{user:expected}}),flow=f.make();assert.equal((await flow.recover()).user,expected);await flow.recover();assert.equal(f.recoveries(),1);
});
test('embedded browser never opens OAuth popup or redirect',async()=>{
 const f=flowFixture({agent:'WhatsApp'});await f.make().login();assert.equal(f.popups(),0);assert.equal(f.redirects(),0);assert.match(f.messages[0],/Chrome.*Safari/);
});
test('unavailable sessionStorage fails visibly without unsafe redirect',async()=>{
 const f=flowFixture({storageBlocked:true});await f.make().login();assert.equal(f.redirects(),0);assert.match(f.messages.at(-1),/storage/);
});
test('stalled redirect recovery times out visibly instead of keeping login pending forever',async()=>{
 const context={setTimeout:callback=>{queueMicrotask(callback);return 1;},clearTimeout(){}};vm.runInNewContext(fs.readFileSync('shared/supplier-login-guide.js','utf8'),context);
 const messages=[];const flow=context.DoseSupplierLogin.createFlow({auth:{currentUser:null},sdk:{getRedirectResult:()=>new Promise(()=>{})},status:m=>messages.push(m)});
 assert.equal((await flow.recover()).issue,true);assert.match(messages[0],/sessione valida/);
});
test('failed redirect is reported and does not recursively retry',async()=>{
 const f=flowFixture();const flow=f.make();await flow.login();await flow.login();assert.equal(f.redirects(),1);assert.ok(f.issues()>0);
});
