const nodemailer = require('nodemailer');

function createSmtpTransport({user = process.env.SMTP_USER || 'marco.tranquilli@dos.design',
  pass = process.env.SMTP_PASS} = {}, createTransport = nodemailer.createTransport) {
  const password = typeof pass === 'string' ? pass.replace(/\s/g, '') : '';
  if (!/^[a-zA-Z0-9]{16}$/.test(password) || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(user)) {
    throw Object.assign(new Error('batch_missing_configuration'), {code:'batch_missing_configuration'});
  }
  return createTransport({host:'smtp.gmail.com', port:465, secure:true,
    auth:{user, pass:password}, tls:{minVersion:'TLSv1.2', rejectUnauthorized:true},
    connectionTimeout:10000, greetingTimeout:10000, socketTimeout:20000,
    logger:false, debug:false, disableFileAccess:true, disableUrlAccess:true});
}

module.exports = {createSmtpTransport};
