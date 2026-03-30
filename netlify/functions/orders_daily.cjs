const FIREBASE_PROJECT_ID = 'app-ordini-pranzo-alimentari';

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
    .map((value) => value.trim())
    .filter(Boolean);
  if (!requestOrigin) return allowed[0] || '*';
  return allowed.includes(requestOrigin) ? requestOrigin : allowed[0] || '*';
}

function getDateFromValue(value) {
  if (!value) return null;
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
  const hour = Number(parts.find((part) => part.type === 'hour')?.value || '0');
  const minute = Number(parts.find((part) => part.type === 'minute')?.value || '0');
  return hour * 60 + minute;
}

function isValidOrder(order) {
  if (!order) return false;
  const createdAt = getDateFromValue(order.createdAt);
  if (!createdAt || Number.isNaN(createdAt.getTime())) return false;
  if (!Array.isArray(order.items) || order.items.length === 0) return false;
  if (Number(order.total || 0) <= 0) return false;
  const status = String(order.orderStatus || '').trim().toLowerCase();
  if (['void', 'canceled', 'annullato', 'bozza', 'draft'].includes(status)) return false;
  return true;
}

function parseFirestoreValue(node) {
  if (node == null || typeof node !== 'object') return node;
  if ('nullValue' in node) return null;
  if ('stringValue' in node) return node.stringValue;
  if ('booleanValue' in node) return node.booleanValue;
  if ('integerValue' in node) return Number(node.integerValue);
  if ('doubleValue' in node) return Number(node.doubleValue);
  if ('timestampValue' in node) return node.timestampValue;
  if ('mapValue' in node) {
    const fields = node.mapValue?.fields || {};
    return Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [key, parseFirestoreValue(value)]),
    );
  }
  if ('arrayValue' in node) {
    return (node.arrayValue?.values || []).map(parseFirestoreValue);
  }
  if ('geoPointValue' in node) return node.geoPointValue;
  if ('referenceValue' in node) return node.referenceValue;
  return node;
}

function parseFirestoreDocument(document) {
  const id = String(document?.name || '').split('/').pop() || '';
  const fields = document?.fields || {};
  return {
    id,
    ...Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, parseFirestoreValue(value)])),
  };
}

async function fetchOrdersWithUserToken(token) {
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'orders' }],
          orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
          limit: 250,
        },
      }),
    },
  );

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = payload?.error?.message || payload?.message || `firestore_query_${res.status}`;
    const err = new Error(message);
    err.statusCode = res.status;
    throw err;
  }

  return (Array.isArray(payload) ? payload : [])
    .filter((entry) => entry?.document)
    .map((entry) => parseFirestoreDocument(entry.document));
}

exports.handler = async (event) => {
  const origin = resolveAllowedOrigin(event);
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true }, origin);
  if (event.httpMethod !== 'GET') return json(405, { error: 'method_not_allowed' }, origin);

  try {
    const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) return json(401, { error: 'missing_token' }, origin);

    const todayKey = romeDateKey(new Date());
    const orders = (await fetchOrdersWithUserToken(token))
      .filter((order) => {
        const createdAt = getDateFromValue(order.createdAt);
        return createdAt && romeDateKey(createdAt) === todayKey;
      })
      .filter(isValidOrder);

    return json(200, { ok: true, orders, count: orders.length }, origin);
  } catch (err) {
    const statusCode = err.statusCode === 401 || err.statusCode === 403 ? err.statusCode : 500;
    return json(statusCode, {
      error: 'orders_daily_failed',
      message: err.message,
    }, origin);
  }
};
