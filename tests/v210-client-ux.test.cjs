const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const UX = require('../shared/client-ux-guard.cjs');
const root = path.join(__dirname, '..');
function storage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {get length(){return map.size;}, key:i=>[...map.keys()][i], getItem:k=>map.get(k)??null,
    setItem:(k,v)=>map.set(k,String(v)), removeItem:k=>map.delete(k)};
}
const now = () => Date.parse('2026-11-12T12:00:00Z');

test('native share uses payload and does not also copy', async () => {
  let copied = false;
  const result = await UX.shareOrCopyReceipt({title:'Pranzo',text:'2x Pane',url:'https://example.test/dosepranza/'}, {
    nav:{share:async data=>{assert.equal(data.title,'Pranzo');assert.equal(data.text,'2x Pane');assert.equal(data.url,'https://example.test/dosepranza/');},clipboard:{writeText:async()=>{copied=true;}}}
  });
  assert.equal(result.method,'share');assert.equal(result.ok,true);assert.equal(copied,false);
});

test('share cancellation is silent and never copies', async () => {
  const result = await UX.shareOrCopyReceipt({text:'ordine'}, {nav:{share:async()=>{throw {name:'AbortError'};},clipboard:{writeText(){assert.fail('must not copy');}}}});
  assert.equal(result.method,'aborted');assert.equal(result.ok,false);
});

test('share unavailable or rejected falls back to clipboard and tolerates all API failures', async () => {
  for (const share of [undefined,async()=>{throw Error('blocked');}]) {
    let copied;
    const result=await UX.shareOrCopyReceipt({text:'ordine'},{nav:{share,clipboard:{writeText:async text=>{copied=text;}}}});
    assert.equal(result.method,'clipboard');assert.equal(copied,'ordine');
  }
  for(const nav of [null,{}, {clipboard:{writeText:async()=>{throw Error('denied');}}}, {get share(){throw Error('getter denied');}}]) {
    assert.equal((await UX.shareOrCopyReceipt({text:'ordine'},{nav})).method,'none');
  }
});

test('beforeunload only prevents leaving pending carts and can be unbound', () => {
  let handler,pending=false,removed;
  const win={addEventListener:(type,fn)=>{assert.equal(type,'beforeunload');handler=fn;},removeEventListener:(type,fn)=>{removed=fn;}};
  const unbind=UX.bindBeforeUnloadCartGuard(()=>pending,win);
  const event={preventDefault(){this.prevented=true;}};
  handler(event);assert.equal(event.prevented,undefined);
  pending=true;handler(event);assert.equal(event.prevented,true);assert.equal(event.returnValue,'');
  pending=false;const confirmed={preventDefault(){assert.fail('confirmed order must not block');}};handler(confirmed);
  unbind();assert.equal(removed,handler);
  assert.doesNotThrow(()=>UX.bindBeforeUnloadCartGuard(()=>true,null)());
});

test('daily storage roundtrips items, clears and purges only previous dates for its vendor', () => {
  const store=storage({'dose_user':'keep','dosepranza_prep_2026-11-11':'keep','dosepranza_cart_pagnottella_2026-11-11':'keep','dosepranza_cart_russo_2026-11-11':'old','dosepranza_cart_russo_2026-11-13':'future'});
  const cart=UX.createDailyCartStorage('russo',{storage:store,now});
  assert.equal(cart.save([{id:'1',price:4.5}]),true);
  assert.equal(cart.load()[0].price,4.5);
  assert.ok(store.getItem('dosepranza_cart_russo_2026-11-12'));
  assert.equal(store.getItem('dosepranza_cart_russo_2026-11-11'),null);
  for(const key of ['dose_user','dosepranza_prep_2026-11-11','dosepranza_cart_pagnottella_2026-11-11'])assert.equal(store.getItem(key),'keep');
  assert.equal(store.getItem('dosepranza_cart_russo_2026-11-13'),'future');
  cart.clear();assert.equal(cart.load().length,0);
});

test('daily storage follows Rome midnight/DST and isolates owner and corrupt data', () => {
  const store=storage();let time=Date.parse('2026-07-01T21:59:59Z'),owner='alice';
  const cart=UX.createDailyCartStorage('russo',{storage:store,now:()=>time,owner:()=>owner});
  cart.save([{id:'pane'}]);assert.ok(store.getItem('dosepranza_cart_russo_2026-07-01'));
  owner='bob';assert.equal(cart.load().length,0);owner='alice';assert.equal(cart.load().length,1);
  time+=1000;assert.equal(cart.load().length,0);assert.equal(store.getItem('dosepranza_cart_russo_2026-07-01'),null);
  store.setItem('dosepranza_cart_russo_2026-07-02','{bad json');assert.equal(cart.load().length,0);
  store.setItem('dosepranza_cart_russo_2026-07-02','{}');assert.equal(cart.load().length,0);
});

test('daily storage survives unavailable storage and quota failures', () => {
  const broken={get length(){throw Error('denied');},getItem(){throw Error('denied');},setItem(){throw Error('QuotaExceededError');},removeItem(){throw Error('denied');}};
  const cart=UX.createDailyCartStorage('russo',{storage:broken,now});
  assert.equal(cart.load().length,0);assert.equal(cart.save([]),false);assert.equal(cart.clear(),false);assert.equal(cart.purgeStale(),false);
  assert.equal(UX.createDailyCartStorage('russo',{storage:null,now}).save([]),false);
});

test('relative scripts resolve under Pages base and browser UMD exports the API', () => {
  for(const page of ['index.html','russo/index.html','pagnottella-gourmet/index.html']) {
    const html=fs.readFileSync(path.join(root,page),'utf8');
    const base=new URL(html.match(/<base[^>]+href="([^"]+)"/)?.[1]||'',`https://example.test/dosepranza/${page}`);
    for(const name of ['cutoff-time','client-ux-guard']) {
      const matches=[...html.matchAll(new RegExp(`<script[^>]+src="([^"]*shared/${name}\\.js[^\"]*)"`,'g'))];
      assert.equal(matches.length,1);assert.ok(!matches[0][1].startsWith('/'));
      assert.equal(new URL(matches[0][1],base).pathname,`/dosepranza/shared/${name}.js`);
      assert.ok(fs.existsSync(path.join(root,'shared',`${name}.js`)));
    }
  }
  const browser={};new Function('module','globalThis',fs.readFileSync(path.join(root,'shared/client-ux-guard.js'),'utf8'))(undefined,browser);
  assert.equal(typeof browser.DosePranzaClientUX.shareOrCopyReceipt,'function');
});

test('integrations keep WhatsApp transport separate and clear Russo draft after successful save', () => {
  const russo=fs.readFileSync(path.join(root,'app.v20260325.js'),'utf8');
  assert.match(russo,/await createRussoOrder\(payload\);\s*russoOrderSaved = true;\s*dailyRussoCart\?\.clear\(\);/);
  assert.match(russo,/state\.cart\.length > 0 && !russoOrderSaved/);
  const pg=fs.readFileSync(path.join(root,'pagnottella-gourmet/pagnottella.js'),'utf8');
  assert.match(pg,/bindBeforeUnloadCartGuard\(\(\) => Object.values\(state.cart\)/);
  assert.match(pg,/const popup = window.open\(target, '_blank'\)/);
});
