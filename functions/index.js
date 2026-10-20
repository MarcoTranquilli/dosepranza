const {onSchedule} = require('firebase-functions/v2/scheduler');
const {defineSecret, defineString, defineBoolean} = require('firebase-functions/params');
const {initializeApp, getApps} = require('firebase-admin/app');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const logger = require('firebase-functions/logger');
const {runBatch} = require('./russo-batch');
const suppliers = require('./config/suppliers');
const {runReminders} = require('./draft-reminders');
const REMINDERS_ENABLED = defineBoolean('REMINDERS_ENABLED', {default:false});

const {createSmtpTransport} = require('./smtp-transport');
const SMTP_PASS = defineSecret('SMTP_PASS');
const SMTP_USER = defineString('SMTP_USER', {default:'marco.tranquilli@dos.design'});
const ORDER_CONFIRM_FROM = defineString('ORDER_CONFIRM_FROM', {default:'Alimentari Russo <marco.tranquilli@dos.design>'});

exports.russoDailyConfirmation = onSchedule({
  schedule: `${Number(suppliers.russo.cutoffTimeRome.split(':')[1])} ${Number(suppliers.russo.cutoffTimeRome.split(':')[0])} * * 1-5`,
  timeZone: 'Europe/Rome',
  region: 'europe-west1',
  serviceAccount: 'dosepranza-russo-email@app-ordini-pranzo-alimentari.iam.gserviceaccount.com',
  secrets: [SMTP_PASS],
  timeoutSeconds: 120,
  maxInstances: 1,
  concurrency: 1,
  retryCount: 5,
  minBackoffSeconds: 60,
  maxBackoffSeconds: 300,
  maxRetrySeconds: 3600
}, async event => {
  try {
    if (!getApps().length) initializeApp(); // ADC from the attached runtime identity.
    const result = await runBatch({
      db: getFirestore(),
      transporter: createSmtpTransport({user:SMTP_USER.value(), pass:SMTP_PASS.value()}),
      from: ORDER_CONFIRM_FROM.value(),
      scheduledAt: new Date(event.scheduleTime),
      serverTimestamp: () => FieldValue.serverTimestamp()
    });
    logger.info('Russo daily batch', result);
  } catch (error) {
    // Never log provider responses, order contents, identities or credentials.
    const code = /^batch_[a-z0-9_]+$/.test(error.code || '') ? error.code : 'batch_unavailable';
    logger.error('Russo daily batch failed', {code});
    throw new Error(code);
  }
});

for (const supplier of Object.values(suppliers)) {
  const [hour, minute] = supplier.cutoffTimeRome.split(':').map(Number);
  const reminder = hour * 60 + minute - supplier.reminderMinutesBeforeCutoff;
  exports[supplier.id + 'DraftReminder'] = onSchedule({
    schedule: `${reminder % 60} ${Math.floor(reminder / 60)} * * 1-5`,
    timeZone:'Europe/Rome', region:'europe-west1', secrets:[SMTP_PASS],
    serviceAccount:'dosepranza-russo-email@app-ordini-pranzo-alimentari.iam.gserviceaccount.com',
    timeoutSeconds:120, maxInstances:1, concurrency:1
  }, async event => {
    if (!REMINDERS_ENABLED.value()) return;
    if (!getApps().length) initializeApp();
    try {
      const result = await runReminders({db:getFirestore(), supplierId:supplier.id,
        scheduledAt:new Date(event.scheduleTime),
        transporter:createSmtpTransport({user:SMTP_USER.value(),pass:SMTP_PASS.value()})});
      logger.info('Draft reminders', result);
    } catch { throw new Error('reminder_failed'); }
  });
}
exports.pagnottellaDailyConfirmation = onSchedule({
  schedule: `${Number(suppliers.pagnottella.cutoffTimeRome.split(':')[1])} ${Number(suppliers.pagnottella.cutoffTimeRome.split(':')[0])} * * 1-5`,
  timeZone:'Europe/Rome', region:'europe-west1', secrets:[SMTP_PASS],
  serviceAccount:'dosepranza-russo-email@app-ordini-pranzo-alimentari.iam.gserviceaccount.com',
  timeoutSeconds:120, maxInstances:1, concurrency:1
}, async event => {
  if (!getApps().length) initializeApp();
  try {
    await runBatch({db:getFirestore(),supplierId:'pagnottella',scheduledAt:new Date(event.scheduleTime),
      transporter:createSmtpTransport({user:SMTP_USER.value(),pass:SMTP_PASS.value()}),
      serverTimestamp:()=>FieldValue.serverTimestamp()});
  } catch { throw new Error('batch_pagnottella_failed'); }
});
