import { test, expect, Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

type Scenario =
  | 'popup-success'
  | 'popup-failure'
  | 'popup-internal'
  | 'redirect-result'
  | 'redirect-internal-current-user'
  | 'redirect-internal-empty'
  | 'current-user';

async function installAuthHarness(page: Page, scenario: Scenario, email: string) {
  const accessSource = await readFile(resolve('pagnottella-gourmet/supplier-access.js'), 'utf8');
  await page.route('https://marcotranquilli.github.io/auth-harness**', route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><script src="/dosepranza/pagnottella-gourmet/supplier-access.js"></script>'
  }));
  await page.route('https://marcotranquilli.github.io/dosepranza/pagnottella-gourmet/supplier-access.js', route => route.fulfill({
    contentType: 'application/javascript',
    body: accessSource
  }));
  await page.route('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js', route => route.fulfill({
    contentType: 'application/javascript',
    headers: {'access-control-allow-origin': '*'},
    body: `const app={name:'[DEFAULT]'};export const getApps=()=>[app];export const initializeApp=()=>app;`
  }));
  await page.route('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js', route => route.fulfill({
    contentType: 'application/javascript',
    headers: {'access-control-allow-origin': '*'},
    body: `
const scenario=${JSON.stringify(scenario)};
let listeners=[];
const google={uid:'google-user',isAnonymous:false,email:${JSON.stringify(email)},displayName:'Utente DOS',providerData:[{providerId:'google.com',email:${JSON.stringify(email)}}],getIdToken:async()=>'',getIdTokenResult:async()=>({signInProvider:'google.com'})};
const anon={uid:'anonymous',isAnonymous:true,email:null,providerData:[]};
const auth={currentUser:['current-user','redirect-internal-current-user'].includes(scenario)?google:null,authStateReady:async()=>{}};
globalThis.__authCalls={anonymous:0,popup:0,redirect:0,redirectResult:0};
const emit=()=>listeners.forEach(fn=>fn(auth.currentUser));
export const browserLocalPersistence={};export const getAuth=()=>auth;export const setPersistence=async()=>{};
export const onAuthStateChanged=(a,fn)=>{listeners.push(fn);queueMicrotask(()=>fn(a.currentUser));return()=>{listeners=listeners.filter(item=>item!==fn)}};
export const signInAnonymously=async()=>{globalThis.__authCalls.anonymous++;auth.currentUser=anon;emit();return{user:anon}};
export class GoogleAuthProvider{addScope(){}setCustomParameters(){}static credentialFromError(){return null}}
export const signInWithPopup=async()=>{globalThis.__authCalls.popup++;if(['popup-failure','popup-internal'].includes(scenario)){const e=new Error('login failed');e.code=scenario==='popup-internal'?'auth/internal-error':'auth/popup-blocked';throw e}auth.currentUser=google;emit();return{user:google,_tokenResponse:{email:google.email,fullName:google.displayName}}};
export const linkWithPopup=signInWithPopup;export const signInWithCredential=signInWithPopup;
export const signInWithRedirect=async()=>{globalThis.__authCalls.redirect++};
export const getRedirectResult=async()=>{globalThis.__authCalls.redirectResult++;if(['redirect-internal-current-user','redirect-internal-empty'].includes(scenario)){const e=new Error('redirect failed');e.code='auth/internal-error';throw e}if(scenario==='redirect-result'){auth.currentUser=google;emit();return{user:google,_tokenResponse:{email:google.email,fullName:google.displayName}}}return null};
export const signOut=async()=>{auth.currentUser=null;emit()};
`
  }));
  await page.goto('https://marcotranquilli.github.io/auth-harness');
  await page.waitForFunction(() => !!window.DoseSupplierAccess);
}

test('redirect result viene adottato prima di creare un anonimo', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('dose_auth_redirect_pending', '1'));
  await installAuthHarness(page, 'redirect-result', 'marta.diamantini@dos.design');
  const result = await page.evaluate(async () => ({
    session: await window.DoseSupplierAccess.resolveSession(),
    calls: (globalThis as typeof globalThis & {__authCalls: Record<string, number>}).__authCalls
  }));
  expect(result.session).toMatchObject({email:'marta.diamantini@dos.design', role:'dos_user', supplierIds:['russo','pagnottella']});
  expect(result.calls).toMatchObject({redirectResult:1, anonymous:0});
});

test('currentUser Google viene adottato senza nuovo login', async ({ page }) => {
  await installAuthHarness(page, 'current-user', 'andreavalerio.chentrens@dos.design');
  const result = await page.evaluate(async () => ({
    session: await window.DoseSupplierAccess.resolveSession(),
    calls: (globalThis as typeof globalThis & {__authCalls: Record<string, number>}).__authCalls
  }));
  expect(result.session).toMatchObject({email:'andreavalerio.chentrens@dos.design', role:'dos_user'});
  expect(result.calls.anonymous).toBe(0);
});

test('popup pubblico salva la sessione Google senza linking anonimo', async ({ page }) => {
  await installAuthHarness(page, 'popup-success', 'marco.sabatini@dos.design');
  const result = await page.evaluate(async () => ({
    session: await window.DoseSupplierAccess.signInWithGoogle(),
    stored: JSON.parse(localStorage.getItem('dose_user') || 'null'),
    calls: (globalThis as typeof globalThis & {__authCalls: Record<string, number>}).__authCalls
  }));
  expect(result.session).toMatchObject({email:'marco.sabatini@dos.design', role:'dos_user'});
  expect(result.stored).toMatchObject({email:'marco.sabatini@dos.design', role:'dos_user'});
  expect(result.calls).toMatchObject({popup:1, redirect:0, anonymous:0});
});

test('popup pubblico fallito avvia redirect e conserva lo stato pending', async ({ page }) => {
  await installAuthHarness(page, 'popup-failure', 'veronica.battaglia@dos.design');
  const result = await page.evaluate(async () => ({
    session: await window.DoseSupplierAccess.signInWithGoogle(),
    pending: sessionStorage.getItem('dose_auth_redirect_pending'),
    calls: (globalThis as typeof globalThis & {__authCalls: Record<string, number>}).__authCalls
  }));
  expect(result.session).toBeNull();
  expect(result.pending).toBe('1');
  expect(result.calls).toMatchObject({popup:1, redirect:1, anonymous:0});
});

test('auth/internal-error su popup registra errore e avvia il redirect senza anonimo', async ({ page }) => {
  await installAuthHarness(page, 'popup-internal', 'gabriele@dos.design');
  const result = await page.evaluate(async () => ({
    session: await window.DoseSupplierAccess.signInWithGoogle(),
    diagnostics: await window.DoseSupplierAccess.getAuthDiagnostics(),
    pending: sessionStorage.getItem('dose_auth_redirect_pending'),
    calls: (globalThis as typeof globalThis & {__authCalls: Record<string, number>}).__authCalls
  }));
  expect(result.session).toBeNull();
  expect(result.pending).toBe('1');
  expect(result.diagnostics).toMatchObject({
    lastAuthErrorCode:'auth/internal-error',
    lastAuthErrorMessage:'Errore interno Firebase durante il riconoscimento Google.'
  });
  expect(Object.keys(result.diagnostics)).not.toEqual(expect.arrayContaining([
    'uid', 'token', 'idToken', 'refreshToken', 'localStorage'
  ]));
  expect(result.calls).toMatchObject({popup:1, redirect:1, anonymous:0});
});

test('auth/internal-error su redirect adotta currentUser Google persistito', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('dose_auth_redirect_pending', '1'));
  await installAuthHarness(page, 'redirect-internal-current-user', 'gabriele@dos.design');
  const result = await page.evaluate(async () => ({
    session: await window.DoseSupplierAccess.resolveSession(),
    calls: (globalThis as typeof globalThis & {__authCalls: Record<string, number>}).__authCalls
  }));
  expect(result.session).toMatchObject({
    email:'gabriele@dos.design',
    role:'dos_user',
    supplierIds:['russo','pagnottella']
  });
  expect(result.calls).toMatchObject({redirectResult:1, anonymous:0});
});

test('auth/internal-error su redirect senza currentUser non crea anonimo', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('dose_auth_redirect_pending', '1'));
  await installAuthHarness(page, 'redirect-internal-empty', 'gabriele@dos.design');
  const result = await page.evaluate(async () => {
    let code = '';
    try {
      await window.DoseSupplierAccess.resolveSession();
    } catch (error) {
      code = String((error as {code?: string})?.code || '');
    }
    return {
      code,
      diagnostics: await window.DoseSupplierAccess.getAuthDiagnostics(),
      calls: (globalThis as typeof globalThis & {__authCalls: Record<string, number>}).__authCalls
    };
  });
  expect(result.code).toBe('auth/internal-error');
  expect(result.diagnostics.lastAuthErrorCode).toBe('auth/internal-error');
  expect(result.calls.anonymous).toBe(0);
});
