const {onSchedule} = require('firebase-functions/v2/scheduler');
const {defineSecret, defineString} = require('firebase-functions/params');
const {initializeApp, getApps} = require('firebase-admin/app');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const logger = require('firebase-functions/logger');
const {runBatch} = require('./russo-batch');

const RESEND_API_KEY = defineSecret('RESEND_API_KEY');
const ORDER_CONFIRM_FROM = defineString('ORDER_CONFIRM_FROM', {default:'onboarding@resend.dev'});

exports.russoDailyConfirmation = onSchedule({
  schedule: '30 10 * * 1-5',
  timeZone: 'Europe/Rome',
  region: 'europe-west1',
  serviceAccount: 'dosepranza-russo-email@app-ordini-pranzo-alimentari.iam.gserviceaccount.com',
  secrets: [RESEND_API_KEY],
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
      apiKey: RESEND_API_KEY.value(),
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
