const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
test('universal binding is idempotent and resets after blocked popup', async()=>{
 const output={};
 let listener, bindings=0;
 const button={dataset:{loginContext:'test',loginStatus:'status'},removeAttribute(){},addEventListener(type,cb){listener=cb;bindings++;}};
 const context={window:{},document:{readyState:'complete',querySelectorAll:()=>[button],getElementById:()=>output}};
 vm.runInNewContext(fs.readFileSync('shared/google-login-ui.js','utf8'),context);
 const ui=context.window.DoseGoogleLoginUI;
 ui.register('test',async()=>{throw {code:'auth/popup-blocked'};});
 ui.bind();
 assert.equal(bindings,1);
 await listener({currentTarget:button,preventDefault(){},stopImmediatePropagation(){}});
 assert.equal(button.disabled,false);
 assert.match(output.textContent,/Popup Google bloccato/);
});
test('unavailable page controller produces visible feedback',async()=>{
 const output={};let listener;
 const button={dataset:{loginStatus:'status'},removeAttribute(){},addEventListener(t,cb){listener=cb;}};
 const context={window:{},document:{readyState:'complete',querySelectorAll:()=>[button],getElementById:()=>output}};
 vm.runInNewContext(fs.readFileSync('shared/google-login-ui.js','utf8'),context);
 await listener({currentTarget:button,preventDefault(){},stopImmediatePropagation(){}});
 assert.match(output.textContent,/non riuscito/);
 assert.equal(button.disabled,false);
});
test('shared login script paths resolve within GitHub Pages subpath',()=>{
 for(const file of ['index.html','russo/index.html','pagnottella-gourmet/index.html']){
  const html=fs.readFileSync(file,'utf8');
  const page=new URL(file,'https://example.org/dosepranza/');
  const base=html.match(/<base href="([^"]+)"/);
  const url=new URL(html.match(/src="([^"]*shared\/google-login-ui.js[^"]*)"/)[1],base?new URL(base[1],page):page);
  assert.equal(url.pathname,'/dosepranza/shared/google-login-ui.js');
  assert.ok(fs.existsSync('.'+url.pathname.replace('/dosepranza','')));
 }
});
