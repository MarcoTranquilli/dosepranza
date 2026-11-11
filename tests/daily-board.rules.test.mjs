import {test,after,beforeEach} from 'node:test';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,updateDoc,deleteDoc,collection,getDocs,Timestamp,serverTimestamp} from 'firebase/firestore';
const env=await initializeTestEnvironment({projectId:'demo-dose-board',firestore:{host:'127.0.0.1',port:8194,rules:readFileSync('FIRESTORE_RULES_ENTERPRISE.txt','utf8')}});
after(()=>env.cleanup());
const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const db=(uid,email=`${uid}@dos.design`,extra={})=>env.authenticatedContext(uid,{email,email_verified:true,name:`User ${uid}`,firebase:{sign_in_provider:'google.com'},...extra}).firestore();
const participant=(uid='a',patch={})=>({uid,name:`User ${uid}`,email:`${uid}@dos.design`,supplierId:'russo',orderId:`order-${uid}`,timestamp:Timestamp.now(),...patch});
const ref=d=>doc(d,'daily_summaries',day);
const payload=participants=>({participants,lastUpdated:serverTimestamp()});
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{for(const uid of ['a','b'])await setDoc(doc(c.firestore(),'orders',`order-${uid}`),{uid,supplierId:'russo',createdAt:Timestamp.now(),orderStatus:'submitted',total:9,allergies:'PRIVATE'});});});
test('verified DOS can create and append only their own presence without touching existing entries',async()=>{
 const a=participant();await assertSucceeds(setDoc(ref(db('a')),payload([a])));const b=participant('b');await assertSucceeds(setDoc(ref(db('b')),payload([a,b])));
 await assertSucceeds(getDoc(ref(db('a'))));await assertFails(getDocs(collection(db('a'),'daily_summaries')));
 await assertFails(updateDoc(ref(db('a')),{participants:[a],lastUpdated:serverTimestamp()}));await assertFails(deleteDoc(ref(db('a'))));
});
test('spoofed UID, email, display name, supplier and missing order are denied',async()=>{
 for(const patch of [{uid:'b'},{email:'b@dos.design'},{name:'User b'},{supplierId:'pagnottella'},{orderId:'missing'},{orderId:'order-b'}])await assertFails(setDoc(ref(db('a')),payload([participant('a',patch)])));
});
test('extra economic fields, multiple additions and mutation of another identity are denied',async()=>{
 const a=participant();await assertFails(setDoc(ref(db('a')),payload([{...a,total:9}])));await assertFails(setDoc(ref(db('a')),{...payload([a]),notes:'secret'}));
 await assertFails(setDoc(ref(db('a')),payload([a,participant('b')])));await assertSucceeds(setDoc(ref(db('a')),payload([a])));
 await assertFails(setDoc(ref(db('b')),payload([{...a,name:'Altered'},participant('b')])));
});
test('outsiders, anonymous, unverified and non Google identities cannot read or publish',async()=>{
 await assertSucceeds(setDoc(ref(db('a')),payload([participant()])));
 for(const d of [env.unauthenticatedContext().firestore(),db('x','x@gmail.com'),db('a','a@dos.design',{email_verified:false}),db('a','a@dos.design',{firebase:{sign_in_provider:'password'}})]){
 await assertFails(getDoc(ref(d)));await assertFails(setDoc(ref(d),payload([participant()])));
 }
});
test('ordinary colleagues cannot read other users orders, including today Russo',async()=>{
 await assertSucceeds(getDoc(doc(db('a'),'orders','order-a')));
 await assertFails(getDoc(doc(db('b'),'orders','order-a')));
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'orders','pg'),{uid:'a',supplierId:'pagnottella',createdAt:Timestamp.now()}));
 await assertFails(getDoc(doc(db('b'),'orders','pg')));
});
test('historical dates, nonserver lastUpdated and old participant timestamps are denied',async()=>{
 await assertFails(setDoc(doc(db('a'),'daily_summaries','2020-01-01'),payload([participant()])));
 await assertFails(setDoc(ref(db('a')),{participants:[participant()],lastUpdated:Timestamp.fromMillis(0)}));
 await assertFails(setDoc(ref(db('a')),payload([participant('a',{timestamp:Timestamp.fromMillis(0)})])));
});
