import { test, expect, Page } from '@playwright/test';

const forbiddenCopy = /preview|approval|review sponsor|anteprima locale|demo locale|non usa firebase/i;

async function mockFirebase(page: Page, email = 'veronica.battaglia@dos.design') {
  await page.route('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js', route => route.fulfill({
    contentType:'application/javascript',
    headers:{'access-control-allow-origin':'*'},
    body:`const app={name:'[DEFAULT]'};export const getApps=()=>[app];export const initializeApp=()=>app;`
  }));
  await page.route('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js', route => route.fulfill({
    contentType:'application/javascript',
    headers:{'access-control-allow-origin':'*'},
    body:`
let listeners=[];const auth={currentUser:null,authStateReady:async()=>{}};
const emit=()=>listeners.forEach(fn=>fn(auth.currentUser));
const anon={uid:'anon-uid',isAnonymous:true,email:null,providerData:[]};
const google={uid:'firebase-${email.replace(/[^a-z0-9]/gi, '-')}',isAnonymous:false,email:${JSON.stringify(email)},displayName:'Utente Test',providerData:[{providerId:'google.com',email:${JSON.stringify(email)}}],getIdToken:async()=>'',getIdTokenResult:async()=>({signInProvider:'google.com'})};
export const browserLocalPersistence={};export const getAuth=()=>auth;export const setPersistence=async()=>{};
export const onAuthStateChanged=(a,fn)=>{listeners.push(fn);queueMicrotask(()=>fn(a.currentUser));return()=>{listeners=listeners.filter(item=>item!==fn)}};
export const signInAnonymously=async()=>{auth.currentUser=anon;emit();return{user:anon}};
export class GoogleAuthProvider{addScope(){}setCustomParameters(){}static credentialFromError(){return null}}
export const linkWithPopup=async()=>{auth.currentUser=google;emit();return{user:google,_tokenResponse:{email:google.email,fullName:google.displayName},additionalUserInfo:{profile:{email:google.email,name:google.displayName}}}};
export const signInWithPopup=linkWithPopup;export const signInWithCredential=linkWithPopup;
export const getRedirectResult=async()=>null;export const signInWithRedirect=async()=>{};
export const signOut=async()=>{auth.currentUser=null;emit()};
`
  }));
  await page.route('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js', route => route.fulfill({
    contentType:'application/javascript',
    headers:{'access-control-allow-origin':'*'},
    body:`
const sample=[
 {id:'pg-1',data:()=>({supplierId:'pagnottella',uid:'u1',user:'Cliente P',email:'p@dos.design',items:[{name:'Saporito'}],total:8,paymentMethod:'Satispay',paymentStatus:'pending',reconciled:false,createdAt:{toDate:()=>new Date()}})},
 {id:'ru-1',data:()=>({supplierId:'russo',uid:'u2',user:'Cliente R',email:'r@dos.design',items:[{name:'Supplì'}],total:3,paymentStatus:'pending',reconciled:false,createdAt:{toDate:()=>new Date()}})}
];
export const getFirestore=()=>({});export const collection=(db,name)=>({name});export const where=(field,op,value)=>({type:'where',field,op,value});export const orderBy=(field,direction)=>({type:'orderBy',field,direction});export const query=(ref,...constraints)=>{globalThis.__firestoreQueries=(globalThis.__firestoreQueries||[]).concat([{collection:ref.name,constraints}]);return{ref,constraints}};
export const onSnapshot=(q,next)=>{const filter=q.constraints?.find(c=>c.type==='where'&&c.field==='supplierId');next({docs:filter?sample.filter(doc=>doc.data().supplierId===filter.value):sample});return()=>{}};
export const getDoc=async()=>({exists:()=>false,data:()=>({})});export const setDoc=async()=>{};export const doc=(db,col,id)=>({col,id});export const serverTimestamp=()=>({serverTimestamp:true});
export const addDoc=async(ref,order)=>{globalThis.__lastOrder=order;return{id:'pg-created'}};export const updateDoc=async(ref,data)=>{globalThis.__lastUpdate={ref,data}};
`
  }));
}

async function googleLogin(page: Page) {
  await page.getByRole('button', {name:'Accedi con Google'}).click();
  await expect(page.locator('#supplierStage')).not.toHaveClass(/hidden/);
}

test('UI production pulita, responsive e catalogo compliant', async ({page}, testInfo) => {
  await page.goto('.');
  await expect(page).toHaveTitle('DOSepranza · La Pagnottella Gourmet');
  await expect(page.locator('#authGateLocal')).toHaveCount(0);
  await expect(page.locator('#authGateEnvironment')).toHaveText('Accesso riservato tramite account Google autorizzato.');
  expect(await page.locator('body').innerText()).not.toMatch(forbiddenCopy);
  await page.evaluate(() => {
    localStorage.setItem('dose_e2e', '1');
    localStorage.setItem('dose_user', JSON.stringify({uid:'dos_user',name:'Utente DOS',email:'dos_user@dos.design',provider:'google.com'}));
  });
  await page.reload();
  await page.locator('.pagnottellaCard').click();
  await expect(page.locator('#grid .card')).toHaveCount(101);
  await page.locator('#search').fill('Birre artigianali');
  await expect(page.locator('#grid .card')).toHaveCount(0);
  await page.locator('#search').fill('Saporito');
  await expect(page.locator('#grid .card')).toHaveCount(1);
  if (testInfo.project.name === 'mobile') {
    await expect(page.locator('#mobileBar')).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test('matrice ruoli e accessi è calcolata dall’email', async ({page}) => {
  await page.goto('.');
  const result = await page.evaluate(async () => {
    const access = window.DoseSupplierAccess;
    const session = (email:string) => {
      localStorage.setItem('dose_e2e', '1');
      localStorage.setItem('dose_user', JSON.stringify({uid:'u',name:'Test',email,provider:'google.com'}));
      return access.getStoredUser();
    };
    const emails = [
      'marco.tranquilli@dos.design','veronica.battaglia@dos.design','marta.diamantini@dos.design',
      'andreavalerio.chentrens@dos.design','marco.sabatini@dos.design','luca.pacella@dos.design','nome.cognome@dos.design',
      'commerciale@lapagnottellagourmet.it',
      'lorenzo.russo@alimentarirusso','russolorenzo11@gmail.com','test@gmail.com',
      'utente@mydos.design','utente@dos.design.fake'
    ];
    return Promise.all(emails.map(async email => {
      const user = session(email);
      return [email,user.role,await access.canAccessSupplier('russo',user),await access.canAccessSupplier('pagnottella',user)];
    }));
  });
  expect(result).toEqual([
    ['marco.tranquilli@dos.design','admin',true,true],
    ['veronica.battaglia@dos.design','dos_user',true,true],
    ['marta.diamantini@dos.design','dos_user',true,true],
    ['andreavalerio.chentrens@dos.design','dos_user',true,true],
    ['marco.sabatini@dos.design','dos_user',true,true],
    ['luca.pacella@dos.design','dos_user',true,true],
    ['nome.cognome@dos.design','dos_user',true,true],
    ['commerciale@lapagnottellagourmet.it','supplier',false,true],
    ['lorenzo.russo@alimentarirusso','supplier',true,false],
    ['russolorenzo11@gmail.com','supplier',true,false],
    ['test@gmail.com','user',false,false],
    ['utente@mydos.design','user',false,false],
    ['utente@dos.design.fake','user',false,false]
  ]);
  expect(await page.evaluate(() => {
    const access = window.DoseSupplierAccess;
    return ['admin', 'dos_user', 'supplier', 'user'].map(role => access.roleLabel(role));
  })).toEqual(['Amministratore', 'Utente DOS', 'Ristoratore / Fornitore', 'Non autorizzato']);
});

test('utente DOS Google salva ordine Pagnottella con UID Firebase', async ({page}, testInfo) => {
  await mockFirebase(page);
  await page.goto('.');
  await googleLogin(page);
  await expect(page.locator('#adminWorkspace')).toHaveClass(/hidden/);
  await page.locator('.pagnottellaCard').click();
  await page.locator('#search').fill('Saporito');
  await page.locator('#grid .card').first().locator('.add').click();
  await page.locator('#options .opt').nth(1).click();
  await page.locator('#extraSearch').fill('Funghi');
  await page.locator('#drawerExtras .drawerExtra').filter({hasText:'Funghi'}).click();
  await page.getByRole('button', {name:'Aggiungi al carrello'}).click();
  await page.locator('#notes').fill('Allergia di test');
  if (testInfo.project.name === 'mobile') {
    await page.locator('#sendOrderBtn').evaluate(element => element.scrollIntoView({block:'center'}));
    await page.locator('#sendOrderBtn').dispatchEvent('click');
  } else {
    await page.locator('#sendOrderBtn').click();
  }
  const popupPromise = page.waitForEvent('popup');
  await page.locator('#paymentConfirmAccept').click();
  const popup = await popupPromise;
  await popup.close();
  await expect(page.locator('#confirm')).toContainText('Ordine pg-created salvato');
  const saved = await page.evaluate(() => ({
    user:JSON.parse(localStorage.getItem('dose_user') || 'null'),
    order:(globalThis as typeof globalThis & {__lastOrder?:Record<string,unknown>}).__lastOrder
  }));
  expect(saved.user).toMatchObject({email:'veronica.battaglia@dos.design',role:'dos_user',provider:'google.com'});
  expect(saved.order).toMatchObject({
    uid:'firebase-veronica-battaglia-dos-design',
    email:'veronica.battaglia@dos.design',
    supplierId:'pagnottella',
    supplierName:'La Pagnottella Gourmet',
    allergies:'Allergia di test'
  });
});

test('supplier Pagnottella esegue solo query Pagnottella e non vede funzioni globali', async ({page}) => {
  await mockFirebase(page, 'commerciale@lapagnottellagourmet.it');
  await page.goto('.');
  await googleLogin(page);
  await page.locator('.pagnottellaCard').click();
  await expect(page.locator('#adminWorkspace')).not.toHaveClass(/hidden/);
  await expect(page.locator('[data-admin-view="analytics"]')).toHaveClass(/hidden/);
  await expect(page.locator('[data-admin-view="export"]')).toHaveClass(/hidden/);
  await expect(page.locator('#adminOrdersList')).toContainText('Cliente P');
  await expect(page.locator('#adminOrdersList')).not.toContainText('Cliente R');
  const queries = await page.evaluate(() => (globalThis as typeof globalThis & {__firestoreQueries?:Array<Record<string,unknown>>}).__firestoreQueries || []);
  expect(JSON.stringify(queries)).toContain('pagnottella');
});

test('Marco vede query globale e può riconciliare dopo update Firestore', async ({page}) => {
  await mockFirebase(page, 'marco.tranquilli@dos.design');
  await page.goto('.');
  await googleLogin(page);
  await page.locator('.pagnottellaCard').click();
  await expect(page.locator('#adminOrdersList')).toContainText('Cliente P');
  await expect(page.locator('#adminOrdersList')).toContainText('Cliente R');
  await expect(page.locator('[data-admin-view="analytics"]')).not.toHaveClass(/hidden/);
  await page.locator('.adminOrderCard').first().getByRole('button', {name:'Segna riconciliato'}).click();
  const update = await page.evaluate(() => (globalThis as typeof globalThis & {__lastUpdate?:Record<string,unknown>}).__lastUpdate);
  expect(update).toBeTruthy();
  expect(JSON.stringify(update)).toContain('reconciledBy');
});
