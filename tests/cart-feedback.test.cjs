const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('shared/cart-feedback.js','utf8');
function load(env={}){vm.runInNewContext(source,env);return env.DoseCartFeedback;}
test('haptic feedback tolerates unsupported and throwing APIs',()=>{
 assert.equal(load().pulse(),false);
 assert.equal(load({navigator:{vibrate(){throw Error('Denied');}}}).pulse(),false);
 const env={};Object.defineProperty(env,'navigator',{get(){throw Error('Denied');}});
 assert.equal(load(env).pulse(),false);
 assert.equal(load({matchMedia(){throw Error('Denied');}}).pulse(),false);
});
test('haptic feedback is short, bound to navigator, and throttled',()=>{
 let time=1000;const pulses=[];const navigator={vibrate(ms){assert.equal(this,navigator);pulses.push(ms);return true;}};
 const api=load({navigator,Date:{now:()=>time}});
 assert.equal(api.pulse(),true);assert.equal(api.pulse(),false);time+=100;assert.equal(api.pulse(),true);
 assert.deepEqual(pulses,[12,12]);
});
test('reduced-motion preference suppresses optional haptic feedback',()=>{
 let calls=0;assert.equal(load({matchMedia:()=>({matches:true}),navigator:{vibrate(){calls++;}}}).pulse(),false);assert.equal(calls,0);
});
test('browser refusal to vibrate is non-blocking',()=>assert.equal(load({navigator:{vibrate:()=>false}}).pulse(),false));
test('both carts provide atomic polite live totals and load the feedback utility',()=>{
 for(const [file,ids] of [['russo/index.html',['cart-count','cart-total-display']],['pagnottella-gourmet/index.html',['cartCount','mobileCount','finalTotal','mobileTotal']]]){
  const html=fs.readFileSync(file,'utf8');assert.match(html,/shared\/cart-feedback\.js\?v=/);
  for(const id of ids){const tag=html.match(new RegExp(`<[^>]*id="${id}"[^>]*>`))[0];assert.match(tag,/aria-live="polite"/);assert.match(tag,/aria-atomic="true"/);}
 }
});
test('real renderers escape product names in contextual quantity labels',()=>{
 const pg=fs.readFileSync('pagnottella-gourmet/pagnottella.js','utf8'),russo=fs.readFileSync('app.v20260325.js','utf8');
 for(const code of [pg,russo])for(const action of ['Riduci','Aumenta'])assert.ok(code.includes(`aria-label="${action} quantità di \${esc(i.name)}"`));
});
