import FormData from 'form-data';
import fetch from 'node-fetch';

const ALLOWED_TYPES = new Set(['bug', 'feature', 'support']);
const ALLOWED_COMPONENTS = new Set(['accesso', 'russo', 'pagnottella', 'ordine', 'altro']);
const DEFAULT_ORIGINS = ['https://app-dosepranza.netlify.app', 'https://marcotranquilli.github.io'];
const MAX_BODY_BYTES = 5_500_000;
const MAX_SCREENSHOT_BYTES = 3_000_000;

function allowedOrigins() {
  return String(process.env.FEEDBACK_ALLOWED_ORIGINS || DEFAULT_ORIGINS.join(','))
    .split(',').map((value) => value.trim()).filter(Boolean);
}

function corsOrigin(event) {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  return allowedOrigins().includes(origin) ? origin : '';
}

function reply(statusCode, payload, origin = '') {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return { statusCode, headers, body: JSON.stringify(payload) };
}

function cleanText(value, maxLength) {
  return String(value == null ? '' : value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, maxLength);
}

function redact(value) {
  return cleanText(value, 4000)
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, '[REDACTED_JWT]')
    .replace(/((?:authorization|bearer|token|password|passwd|secret|api[_-]?key|credential)\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]');
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return 'Payload non valido';
  if (!ALLOWED_TYPES.has(payload.requestType)) return 'Tipo richiesta non valido';
  if (!ALLOWED_COMPONENTS.has(payload.component)) return 'Componente non valido';
  if (!cleanText(payload.summary, 140)) return 'Titolo obbligatorio';
  if (!cleanText(payload.description, 4000)) return 'Descrizione obbligatoria';
  const email = cleanText(payload.userEmail, 254);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Email non valida';
  if (payload.logs != null && !Array.isArray(payload.logs)) return 'Log non validi';
  return '';
}

function requiredConfig() {
  const config = {
    domain: cleanText(process.env.JIRA_DOMAIN, 255).replace(/^https?:\/\//, '').replace(/\/+$/, ''),
    email: cleanText(process.env.JIRA_API_EMAIL, 254),
    token: String(process.env.JIRA_API_TOKEN || '').trim(),
    serviceDeskId: cleanText(process.env.JSM_SERVICE_DESK_ID, 50),
    requestTypes: {
      bug: cleanText(process.env.JSM_REQUEST_TYPE_BUG, 50),
      feature: cleanText(process.env.JSM_REQUEST_TYPE_FEATURE, 50),
      support: cleanText(process.env.JSM_REQUEST_TYPE_SUPPORT, 50),
    },
  };
  if (!config.domain || !/^[a-z0-9.-]+$/i.test(config.domain) || !config.email || !config.token || !config.serviceDeskId) return null;
  if (Object.values(config.requestTypes).some((value) => !value)) return null;
  return config;
}

function safeDiagnostics(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const allowed = ['capturedAt', 'url', 'screenResolution', 'viewport', 'userAgent', 'language', 'online', 'serviceWorkerStatus', 'swResetQueryPresent'];
  return Object.fromEntries(allowed.filter((key) => value[key] !== undefined).map((key) => [key, redact(value[key])]));
}

function safeLogs(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(-30).map((entry) => ({
    timestamp: cleanText(entry?.timestamp, 50),
    level: ['log', 'warn', 'error'].includes(entry?.level) ? entry.level : 'log',
    message: redact(entry?.message),
  }));
}

function enrichedDescription(payload, diagnostics) {
  const lines = [
    cleanText(payload.description, 4000),
    '',
    '--- Contesto DOSepranza ---',
    `Area: ${cleanText(payload.component, 30)}`,
    `Email di contatto: ${cleanText(payload.userEmail, 254) || 'non fornita'}`,
  ];
  if (diagnostics) {
    lines.push('', 'Diagnostica:');
    Object.entries(diagnostics).forEach(([key, value]) => lines.push(`- ${key}: ${value}`));
  }
  return lines.join('\n').slice(0, 8000);
}

async function jiraJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`Jira HTTP ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }
  return body;
}

async function uploadAttachment(config, issueKey, buffer, filename, contentType) {
  const form = new FormData();
  form.append('file', buffer, { filename, contentType, knownLength: buffer.length });
  const response = await fetch(`https://${config.domain}/rest/api/3/issue/${encodeURIComponent(issueKey)}/attachments`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.email}:${config.token}`).toString('base64')}`,
      Accept: 'application/json',
      'X-Atlassian-Token': 'no-check',
      ...form.getHeaders(),
    },
    body: form,
  });
  if (!response.ok) throw new Error(`Jira attachment HTTP ${response.status}`);
}

export async function handler(event) {
  const origin = corsOrigin(event);
  const requestOrigin = event.headers?.origin || event.headers?.Origin || '';
  if (requestOrigin && !origin) return reply(403, { success: false, error: 'Origine non autorizzata' });
  if (event.httpMethod === 'OPTIONS') return { ...reply(204, {}, origin), body: '' };
  if (event.httpMethod !== 'POST') return reply(405, { success: false, error: 'Metodo non consentito' }, origin);
  if (Buffer.byteLength(event.body || '', 'utf8') > MAX_BODY_BYTES) return reply(413, { success: false, error: 'Segnalazione troppo grande' }, origin);

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (_) {
    return reply(400, { success: false, error: 'JSON non valido' }, origin);
  }
  const validationError = validatePayload(payload);
  if (validationError) return reply(400, { success: false, error: validationError }, origin);

  const config = requiredConfig();
  if (!config) return reply(503, { success: false, error: 'Servizio assistenza non configurato' }, origin);

  const diagnostics = safeDiagnostics(payload.diagnostics);
  const logs = safeLogs(payload.logs);
  const auth = Buffer.from(`${config.email}:${config.token}`).toString('base64');
  try {
    const ticket = await jiraJson(`https://${config.domain}/rest/servicedeskapi/request`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceDeskId: config.serviceDeskId,
        requestTypeId: config.requestTypes[payload.requestType],
        requestFieldValues: {
          summary: `[App] ${cleanText(payload.summary, 140)}`,
          description: enrichedDescription(payload, diagnostics),
        },
      }),
    });
    const issueKey = cleanText(ticket.issueKey, 50);
    if (!issueKey) throw new Error('Jira non ha restituito la chiave ticket');

    const attachmentWarnings = [];
    const screenshotMatch = String(payload.screenshot || '').match(/^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/);
    if (screenshotMatch) {
      const image = Buffer.from(screenshotMatch[2], 'base64');
      if (image.length <= MAX_SCREENSHOT_BYTES) {
        try {
          await uploadAttachment(config, issueKey, image, `dosepranza-${Date.now()}.${screenshotMatch[1] === 'jpeg' ? 'jpg' : 'png'}`, `image/${screenshotMatch[1]}`);
        } catch (_) {
          attachmentWarnings.push('screenshot');
        }
      } else attachmentWarnings.push('screenshot-too-large');
    }
    if (logs.length) {
      try {
        await uploadAttachment(config, issueKey, Buffer.from(JSON.stringify(logs, null, 2), 'utf8'), `dosepranza-logs-${Date.now()}.json`, 'application/json');
      } catch (_) {
        attachmentWarnings.push('logs');
      }
    }
    return reply(201, { success: true, issueKey, attachmentWarnings }, origin);
  } catch (error) {
    console.error('Jira ticket creation failed', { message: error.message, statusCode: error.statusCode || 500 });
    return reply(502, { success: false, error: 'Jira non ha accettato la segnalazione. Riprova più tardi.' }, origin);
  }
}

export const __testables = { validatePayload, safeDiagnostics, safeLogs, enrichedDescription };
