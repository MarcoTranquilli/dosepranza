const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
for(const file of ['supplier-access.js','pagnottella-gourmet/supplier-access.js']){
 test(`${file}: coordinators read both suppliers without admin role`,()=>{
  const context={window:{}};vm.runInNewContext(fs.readFileSync(file,'utf8'),context);
  const a=context.window.DoseSupplierAccess;
  assert.equal(a.roleForEmail('marco.tranquilli@dos.design'),'admin');
  for(const email of ['luca.pacella@dos.design','marta.diamantini@dos.design']){
   assert.equal(a.roleForEmail(email),'coordinator');
   assert.deepEqual(Array.from(a.supplierIdsForIdentity(email)),['russo','pagnottella']);
  }
  assert.equal(a.roleForEmail('collega@dos.design'),'dos_user');
  assert.equal(a.roleForEmail('luca.pacella@dos.design.fake'),'user');
  assert.equal(a.roleForEmail('marco.tranquilli@gmail.com'),'user');
  assert.deepEqual(Array.from(a.supplierIdsForIdentity('isidorovagnozzi@gmail.com')),['pagnottella']);
  assert.deepEqual(Array.from(a.supplierIdsForIdentity('russolorenzo11@gmail.com')),['russo']);
 });
}
