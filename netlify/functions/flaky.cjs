const { getStore } = require('@netlify/blobs');

exports.handler = async (event, context) => {
  const roles = (context.clientContext && context.clientContext.user && context.clientContext.user.app_metadata && context.clientContext.user.app_metadata.roles) || [];
  if (!roles.includes('admin')) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  const store = getStore('uat-reports');
  let data = [];
  try {
    data = await store.getJSON('reports/flaky/latest.json') || [];
  } catch {
    data = [];
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  };
};
