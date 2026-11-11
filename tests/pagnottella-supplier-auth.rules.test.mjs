import {test,after} from 'node:test';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,updateDoc,deleteDoc,collection,query,where,getDocs,Timestamp} from 'firebase/firestore';
const env=await initializeTestEnvironment({projectId:'demo-dose-pg-auth',firestore:{host:'127.0.0.1',port:8194,rules:readFileSync('FIRESTORE_RULES_ENTERPRISE.txt','utf8')}});
after(()=>env.cleanup());
await env.withSecurityRulesDisabled(async c=>{for(const supplierId of ['russo','pagnottella'])await setDoc(doc(c.firestore(),'orders',supplierId),{uid:'other',supplierId,total:5,createdAt:Timestamp.fromDate(new Date('2020-01-01'))});});
const db=(email,claims={})=>env.authenticatedContext('supplier',{email,email_verified:true,firebase:{sign_in_provider:'google.com'},...claims}).firestore();
for(const email of ['isidorovagnozzi@gmail.com','isidoro.vagnozzi@gmail.com','commerciale@lapagnottellagourmet.it',' ISIDORO.VAGNOZZI@GMAIL.COM '])test(`verified supplier ${email}: own supplier query succeeds, Russo and writes denied`,async()=>{
 const d=db(email);await assertSucceeds(getDoc(doc(d,'orders','pagnottella')));await assertSucceeds(getDocs(query(collection(d,'orders'),where('supplierId','==','pagnottella'))));
 await assertFails(getDoc(doc(d,'orders','russo')));await assertFails(updateDoc(doc(d,'orders','pagnottella'),{total:0}));await assertFails(deleteDoc(doc(d,'orders','pagnottella')));
});
test('unverified, password-only and unlisted Gmail variants remain blocked',async()=>{
 for(const d of [db('isidoro.vagnozzi@gmail.com',{email_verified:false}),db('isidoro.vagnozzi@gmail.com',{firebase:{sign_in_provider:'password'}}),db('isi.doro.vagnozzi@gmail.com'),db('isidoro.vagnozzi@gmail.com.evil'),env.unauthenticatedContext().firestore()])await assertFails(getDoc(doc(d,'orders','pagnottella')));
});
