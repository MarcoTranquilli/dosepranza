import fs from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';

const projectId = 'demo-dosepranza-supplier-rules';
const rules = fs.readFileSync('firestore.pagnottella-production.proposed.rules', 'utf8');
const googleClaims = email => ({ email, firebase:{ sign_in_provider:'google.com' } });
const env = await initializeTestEnvironment({ projectId, firestore:{ rules } });

const admin = env.authenticatedContext('uid-admin', googleClaims('marco.tranquilli@dos.design')).firestore();
const dos_user = env.authenticatedContext('uid-dos_user', googleClaims('utente@dos.design')).firestore();
const pagnottella = env.authenticatedContext('uid-pg', googleClaims('commerciale@lapagnottellagourmet.it')).firestore();
const isidoro = env.authenticatedContext('uid-isidoro', googleClaims('isidorovagnozzi@gmail.com')).firestore();
const russo = env.authenticatedContext('uid-russo', googleClaims('russolorenzo11@gmail.com')).firestore();
const external = env.authenticatedContext('uid-ext', googleClaims('utente@gmail.com')).firestore();

const order = (supplierId, uid, email) => ({
  supplierId,
  uid,
  email,
  user:'Utente Test',
  items:[{ name:'Prodotto', price:5 }],
  total:5,
  paymentStatus:'pending',
  reconciled:false,
  orderStatus:'submitted',
  createdAt:Timestamp.now()
});

try {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'orders', 'pg-order'), order('pagnottella', 'uid-dos_user', 'utente@dos.design'));
    await setDoc(doc(db, 'orders', 'russo-order'), order('russo', 'uid-other', 'altro@dos.design'));
    const legacyOrder = order('russo', 'uid-other', 'altro@dos.design');
    delete legacyOrder.supplierId;
    await setDoc(doc(db, 'orders', 'legacy-order'), legacyOrder);
  });

  const pgQuery = db => query(collection(db, 'orders'), where('supplierId', '==', 'pagnottella'), orderBy('createdAt', 'desc'));
  const russoQuery = db => query(collection(db, 'orders'), where('supplierId', '==', 'russo'), orderBy('createdAt', 'desc'));
  const globalQuery = db => query(collection(db, 'orders'), orderBy('createdAt', 'desc'));

  const pgResult = await assertSucceeds(getDocs(pgQuery(pagnottella)));
  if (pgResult.size !== 1 || pgResult.docs[0].id !== 'pg-order') throw new Error('Pagnottella query not segregated');
  await assertFails(getDocs(globalQuery(pagnottella)));
  await assertFails(getDoc(doc(pagnottella, 'orders', 'russo-order')));
  const isidoroResult = await assertSucceeds(getDocs(pgQuery(isidoro)));
  if (isidoroResult.size !== 1 || isidoroResult.docs[0].id !== 'pg-order') throw new Error('Isidoro query not segregated');
  await assertFails(getDocs(globalQuery(isidoro)));
  await assertFails(getDoc(doc(isidoro, 'orders', 'russo-order')));

  const russoResult = await assertSucceeds(getDocs(russoQuery(russo)));
  if (russoResult.size !== 1 || russoResult.docs[0].id !== 'russo-order') throw new Error('Russo query not segregated');
  await assertFails(getDocs(globalQuery(russo)));
  await assertFails(getDoc(doc(russo, 'orders', 'pg-order')));
  await assertFails(getDoc(doc(russo, 'orders', 'legacy-order')));

  const adminResult = await assertSucceeds(getDocs(globalQuery(admin)));
  if (adminResult.size !== 3) throw new Error('Admin global query incomplete');
  await assertSucceeds(updateDoc(doc(admin, 'orders', 'pg-order'), {
    paymentStatus:'paid',
    reconciled:true,
    reconciledAt:Timestamp.now(),
    reconciledBy:'marco.tranquilli@dos.design'
  }));
  await assertFails(updateDoc(doc(admin, 'orders', 'pg-order'), { total:1 }));
  await assertFails(updateDoc(doc(pagnottella, 'orders', 'pg-order'), { paymentStatus:'paid' }));
  await assertFails(updateDoc(doc(russo, 'orders', 'russo-order'), { orderStatus:'completed' }));

  await assertSucceeds(getDoc(doc(dos_user, 'orders', 'pg-order')));
  await assertFails(getDocs(globalQuery(dos_user)));
  await assertSucceeds(addDoc(collection(dos_user, 'orders'), order('russo', 'uid-dos_user', 'utente@dos.design')));
  await assertSucceeds(addDoc(collection(dos_user, 'orders'), order('pagnottella', 'uid-dos_user', 'utente@dos.design')));
  await assertFails(addDoc(collection(dos_user, 'orders'), order('russo', 'uid-other', 'utente@dos.design')));
  const missingSupplier = order('russo', 'uid-dos_user', 'utente@dos.design');
  delete missingSupplier.supplierId;
  await assertFails(addDoc(collection(dos_user, 'orders'), missingSupplier));

  await assertFails(getDoc(doc(external, 'orders', 'pg-order')));
  await assertFails(addDoc(collection(external, 'orders'), order('russo', 'uid-ext', 'utente@gmail.com')));

  console.log('supplier-rules-tests: passed');
} finally {
  await env.cleanup();
}
