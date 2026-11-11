const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
function tools(extra={}){const ctx={Intl,Date,URL,setTimeout,clearTimeout,...extra};vm.runInNewContext(fs.readFileSync('shared/checkout-utils.js','utf8'),ctx);return {ctx,U:ctx.DoseCheckout};}
test('countdown follows Rome winter and summer cutoff with second precision',()=>{
 const {U}=tools();
 for(const iso of ['2026-11-11T09:10:00Z','2026-07-01T08:10:00Z']){const r=U.countdown(new Date(iso),'10:30');assert.equal(r.visible,true);assert.equal(r.text,'20:00');}
 assert.equal(U.countdown(new Date('2026-11-11T09:09:59Z'),'10:30').visible,false);
 const end=U.countdown(new Date('2026-11-11T09:30:00Z'),'10:30');assert.equal(end.closed,true);assert.equal(end.text,'00:00');
 assert.equal(U.countdown(new Date('2026-11-11T09:29:59Z'),'10:30').text,'00:01');
 assert.equal(U.countdown(new Date('2026-11-11T09:40:00Z'),'11:00').visible,true);
});
test('server clock offset compensates RTT and then uses monotonic elapsed time',()=>{
 let mono=100;const {U}=tools({performance:{now:()=>mono}});const clock=U.clock(),server=Date.parse('2026-11-11T09:00:00Z');
 assert.equal(clock.accept('Wed, 11 Nov 2026 09:00:00 GMT',server-60000,server-59800),true);
 assert.equal(clock.offset,59900);assert.equal(clock.now(),server+100);mono+=1000;assert.equal(clock.now(),server+1100);
 assert.equal(clock.accept('invalid',1,2),false);assert.equal(clock.accept('Wed, 11 Nov 2026 09:00:00 GMT',0,11000),false);
});
test('clock network failures are fail-safe',async()=>{const {U}=tools({location:{href:'https://example.test/'},fetch:async()=>{throw Error('offline');}});assert.equal(await U.clock().sync(),false);});
test('chat summary includes quantities, options, amount and declared payment without allergies',()=>{
 const {U}=tools();const record={supplier:'pagnottella',items:[{name:'Ciabatta',quantity:2,details:'Crudo e rucola'}],total:12.5,paymentMethod:'Satispay',allergies:'private'};
 assert.equal(U.summary(record),'Oggi ho ordinato da Pagnottella Gourmet: 2x Ciabatta (Crudo e rucola) · Totale €12,50 via Satispay.');
 assert.match(U.summary({...record,paymentMethod:''}),/metodo non indicato/);
});
test('clipboard rejection and success restore the button after 2.5 seconds',async()=>{
 for(const fail of [false,true]){let callback,delay;const {U}=tools({navigator:{clipboard:{writeText:async()=>{if(fail)throw Error();}}},setTimeout:(f,ms)=>{callback=f;delay=ms;}});
 const b={textContent:'Copia',disabled:false};assert.equal(await U.copy(b,{supplier:'russo',items:[],total:0}),!fail);assert.equal(delay,2500);assert.equal(b.disabled,true);callback();assert.equal(b.disabled,false);assert.equal(b.textContent,'Copia');}
});
test('profile memory changes only on confirmed receipts and remains isolated by identity',()=>{
 const values=new Map(),ctx={Intl,Date,localStorage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)}};
 vm.runInNewContext(fs.readFileSync('shared/user-preferences.js','utf8'),ctx);const P=ctx.DosePreferences;
 P.saveProfile(null,'russo',{notes:'Ospite'});assert.equal(P.profile('a','russo').notes,'');
 const data={items:[{id:'p',name:'Panino',quantity:1}],total:4,notes:'Piano 2',allergies:'Senza noci'};
 P.receipt('a','russo','1',data,false);assert.equal(P.profile('a','russo').notes,'');
 P.confirmReceipt('a','1');assert.equal(P.profile('a','russo').notes,'Piano 2');assert.equal(P.profile('b','russo').notes,'');
 P.receipt('a','russo','2',{...data,notes:'',allergies:''},true);assert.equal(P.profile('a','russo').notes,'');
});
test('network indicator retries only terminated listeners for authorized sessions',()=>{
 const events={},element={textContent:''};let retries=0,allowed=true;
 const ctx={Intl,Date,navigator:{onLine:true},document:{querySelectorAll:()=>[]},addEventListener:(n,f)=>events[n]=f};
 vm.runInNewContext(fs.readFileSync('shared/supplier-audio.js','utf8'),ctx);
 const net=ctx.DoseSupplierAudio.connection({retry:()=>retries++,allowed:()=>allowed,element});
 events.offline();net.snapshot(false);assert.match(element.textContent,/assente/);events.online();assert.equal(retries,0);
 net.error();allowed=false;events.online();assert.equal(retries,0);allowed=true;events.online();assert.equal(retries,1);events.online();assert.equal(retries,1);
 net.snapshot(false);assert.equal(element.textContent,'Sincronizzato dal server');
});
test('new mobile metadata preserves correct Pages icon path',()=>{
 for(const file of ['index.html','russo/index.html','pagnottella-gourmet/index.html']){const h=fs.readFileSync(file,'utf8');assert.match(h,/viewport-fit=cover/);assert.match(h,/name="apple-mobile-web-app-capable" content="yes"/);assert.match(h,/rel="apple-touch-icon" href="\/dosepranza\/favicondosepranza.png"/);}
});
