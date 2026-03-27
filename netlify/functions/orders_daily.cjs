const admin = require('firebase-admin');

const STAFF_EMAILS = [
  'marco.tranquilli@dos.design',
  'lorenzo.russo@alimentarirusso',
  'beatrice.binini@dos.design',
  'monica.porta@dos.design',
];

const STAFF_NAMES = {
  ristoratore: ['lorenzo russo'],
};

function json(statusCode, payload, origin) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return { statusCode, headers, body: JSON.stringify(payload) };
}

function resolveAllowedOrigin(event) {
  const requestOrigin = event.headers?.origin || event.headers?.Origin || '';
  const allowed = (process.env.ORDER_CONFIRM_ALLOWED_ORIGINS || [
    'https://app-dosepranza.netlify.app',
    'https://marcotranquilli.github.io',
  ].join(','))
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  if (!requestOrigin) return allowed[0] || '*';
  return allowed.includes(requestOrigin) ? requestOrigin : allowed[0] || '*';
}

function getAdminApp() {
  if (admin.apps.length) return admin.app();
  const inlineCreds = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (inlineCreds) {
    return admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(inlineCreds)),
    });
  }
  return admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeName(value) {
  return String(value || '').trim().toLowerCase();
}

function getDateFromValue(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') return new Date(value);
  return null;
}

function romeDateKey(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function romeMinutes(date) {
  const parts = new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value || '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value || '0');
  return hour * 60 + minute;
}

function hasStaffAccess(decoded) {
  const role = String(decoded?.role || '').trim().toLowerCase();
  if (['admin', 'ristoratore', 'facility'].includes(role)) return true;

  const provider = String(decoded?.firebase?.sign_in_provider || '').trim().toLowerCase();
  const email = normalizeEmail(decoded?.email);
  const name = normalizeName(decoded?.name);
  const emailVerified = decoded?.email_verified === true;

  if (provider === 'google.com' && STAFF_EMAILS.includes(email)) return true;
  if (provider === 'google.com' && emailVerified && STAFF_NAMES.ristoratore.includes(name)) return true;
  return false;
}

function isValidOrder(order) {
  if (!order) return false;
  const createdAt = getDateFromValue(order.createdAt);
  if (!createdAt) return false;
  if (!Array.isArray(order.items) || order.items.length === 0) return false;
  if (Number(order.total || 0) <= 0) return false;
  const status = String(order.orderStatus || '').trim().toLowerCase();
  if (['void', 'canceled', 'annullato', 'bozza', 'draft'].includes(status)) return false;

  const isFridgeOrder = String(order.orderType || order.source || '').trim().toLowerCase() === 'frige';
  const allowAfterHours = order.allowAfterHours === true || order.afterHoursAllowed === true;
  if (!isFridgeOrder && !allowAfterHours) {
    const cutoff = 11 * 60 + 30;
    if (romeMinutes(createdAt) > cutoff) return false;
  }
  return true;
}

function serializeValue(value) {
  if (value == null) return value;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serializeValue);
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, serializeValue(inner)]));
  }
  return value;
}

exports.handler = async (event) => {
  const origin = resolveAllowedOrigin(event);
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true }, origin);
  if (event.httpMethod !== 'GET') return json(405, { error: 'method_not_allowed' }, origin);

  try {
    const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) return json(401, { error: 'missing_token' }, origin);

    getAdminApp();
    const decoded = await admin.auth().verifyIdToken(token);
    if (!hasStaffAccess(decoded)) {
      return json(403, { error: 'forbidden', message: 'staff_access_required' }, origin);
    }

    const db = admin.firestore();
    const snap = await db.collection('orders').orderBy('createdAt', 'desc').limit(250).get();
    const todayKey = romeDateKey(new Date());
    const orders = snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((order) => {
        const createdAt = getDateFromValue(order.createdAt);
        return createdAt && romeDateKey(createdAt) === todayKey;
      })
      .filter(isValidOrder)
      .map((order) => serializeValue(order));

    return json(200, { ok: true, orders, count: orders.length }, origin);
  } catch (err) {
    return json(500, {
      error: 'orders_daily_failed',
      message: err.message,
    }, origin);
  }
};
