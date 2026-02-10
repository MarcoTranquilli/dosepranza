const { getStore } = require('@netlify/blobs');

exports.handler = async (event, context) => {
  const user = context.clientContext && context.clientContext.user;
  const roles = (user && user.app_metadata && user.app_metadata.roles) || [];
  if (!roles.includes('admin')) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  const store = getStore('uat-reports');
  const date = (event.queryStringParameters && event.queryStringParameters.date) || new Date().toISOString().slice(0, 10);
  const key = `audit/${date}.json`;

  let logs = [];
  try {
    logs = await store.getJSON(key) || [];
  } catch {
    logs = [];
  }

  if ((event.queryStringParameters && event.queryStringParameters.format) === 'csv') {
    const header = 'timestamp,email,action,roles,ip,user_agent\n';
    const rows = logs.map(l => `${l.ts},${l.email},${l.action},"${(l.roles || []).join('|')}",${l.ip || ''},"${(l.ua || '').replace(/\"/g, '\"\"')}"`).join('\n');
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/csv' },
      body: header + rows
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, logs })
  };
};
