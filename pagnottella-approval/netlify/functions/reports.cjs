const { getStore } = require('@netlify/blobs');

exports.handler = async (event, context) => {
  const roles = (context.clientContext && context.clientContext.user && context.clientContext.user.app_metadata && context.clientContext.user.app_metadata.roles) || [];
  if (!roles.includes('reports') && !roles.includes('admin')) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  const store = getStore('uat-reports');
  await logAudit(store, context, 'reports_index');
  let index = [];
  try {
    index = await store.getJSON('index.json') || [];
  } catch {
    index = [];
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(index)
  };
};

async function logAudit(store, context, action) {
  try {
    const headers = context && context.clientContext && context.clientContext.headers;
    const ip = headers?.['x-nf-client-connection-ip'] || headers?.['x-forwarded-for'] || 'unknown';
    const ua = headers?.['user-agent'] || 'unknown';
    const user = context.clientContext && context.clientContext.user;
    const email = user && user.email ? user.email : 'unknown';
    const roles = (user && user.app_metadata && user.app_metadata.roles) || [];
    const date = new Date().toISOString().slice(0, 10);
    const key = `audit/${date}.json`;
    let logs = [];
    try { logs = await store.getJSON(key) || []; } catch { logs = []; }
    logs.push({
      ts: new Date().toISOString(),
      email,
      roles,
      ip,
      ua,
      action
    });
    await store.setJSON(key, logs);
  } catch {
    // best-effort audit
  }
}
