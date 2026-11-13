import fs from 'node:fs';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,serverTimestamp} from 'firebase/firestore';
const env=await initializeTestEnvironment({projectId:'demo-dose-stock-v211',firestore:{rules:fs.readFileSync('FIRESTORE_RULES_ENTERPRISE.txt','utf8')}});
const db=email=>env.authenticatedContext(email,{email,email_verified:true,role:'user',firebase:{sign_in_provider:'google.com'}}).firestore();
const state={supplierId:'pagnottella',soldOutItems:['Pane test'],soldOutIngredients:[],updatedAt:serverTimestamp()};
try{
 for(const email of ['commerciale@lapagnottellagourmet.it','isidorovagnozzi@gmail.com','isidoro.vagnozzi@gmail.com','marco.tranquilli@dos.design'])await assertSucceeds(setDoc(doc(db(email),'menu_products','dose_stock_pagnottella'),state));
 await assertSucceeds(setDoc(doc(db('russolorenzo11@gmail.com'),'menu_products','dose_stock_russo'),{...state,supplierId:'russo'}));
 for(const email of ['utente@dos.design','luca.pacella@dos.design','marta.diamantini@dos.design']){
  await assertSucceeds(getDoc(doc(db(email),'menu_products','dose_stock_pagnottella')));
  await assertFails(setDoc(doc(db(email),'menu_products','dose_stock_pagnottella'),state));
 }
 await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'menu_products','dose_stock_pagnottella')));
 // Existing staff rule is collection-wide: document this boundary rather than claiming vendor isolation.
 await assertSucceeds(setDoc(doc(db('russolorenzo11@gmail.com'),'menu_products','dose_stock_pagnottella'),state));
 console.log('PASS: stock rules read/write matrix; existing cross-supplier staff permission confirmed');
}finally{await env.cleanup();}
