const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createSmtpTransport}=require('../smtp-transport');
test('Google SMTP uses TLS and disables credential logging',()=>{
 const config=createSmtpTransport({user:'marco.tranquilli@dos.design',pass:'abcd efgh ijkl mnop'},x=>x);
 assert.equal(config.host,'smtp.gmail.com');assert.equal(config.port,465);assert.equal(config.secure,true);
 assert.equal(config.auth.pass,'abcdefghijklmnop');assert.equal(config.logger,false);assert.equal(config.debug,false);
 assert.equal(config.tls.rejectUnauthorized,true);assert.equal(config.disableFileAccess,true);
});
test('missing password and placeholder fail without leaking configuration',()=>{
 for(const pass of ['',undefined,'INSERISCI_APP_PASSWORD_SENZA_SPAZI']) assert.throws(()=>createSmtpTransport({pass}),/batch_missing_configuration/);
});
