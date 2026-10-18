import {initializeApp, getApps, cert} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import '../../pagnottella-gourmet/order-analytics.js';

const projectId = 'app-ordini-pranzo-alimentari';
const origins = new Set(['https://app-dosepranza.netlify.app', 'https://marcotranquilli.github.io']);
export function createHandler({runtime, clock = () => new Date()} = {}) {
  return async request => {
    const origin = request.headers.get('origin');
    const headers = {'Cache-Control':'no-store', Vary:'Origin',
      ...(origins.has(origin) ? {'Access-Control-Allow-Origin':origin} : {}),
      'Access-Control-Allow-Headers':'Authorization', 'Access-Control-Allow-Methods':'GET, OPTIONS'};
    const reply = (status, data) => Response.json(data, {status, headers});
    if (origin && !origins.has(origin)) return reply(403, {error:'origin_not_allowed'});
    if (request.method === 'OPTIONS') return new Response(null, {status:204, headers});
    if (request.method !== 'GET') return reply(405, {error:'method_not_allowed'});
    const bearer = request.headers.get('authorization') || '';
    if (!bearer.startsWith('Bearer ')) return reply(401, {error:'authentication_required'});
    try {
      const {auth, db} = runtime();
      let user;
      try { user = await auth.verifyIdToken(bearer.slice(7), true); }
      catch { return reply(401, {error:'invalid_session'}); }
      const email = String(user.email || '').trim().toLowerCase();
      if (user.firebase?.sign_in_provider !== 'google.com' || !email.endsWith('@dos.design')) return reply(403, {error:'account_not_authorized'});
      const now = clock(), analytics = globalThis.DoseOrderAnalytics;
      const baseline = analytics.russoThreshold([], {now});
      const range = analytics.rangeFor('today', now);
      const snapshot = await db.collection('orders').where('supplierId', '==', 'russo')
        .where('createdAt', '>=', range.startDate).where('createdAt', '<', new Date(baseline.cutoff))
        .orderBy('createdAt', 'desc').limit(1001).get();
      if (snapshot.size > 1000) return reply(503, {error:'summary_limit'});
      const summary = analytics.russoThreshold(snapshot.docs.map(doc => ({...doc.data(), id:doc.id})), {now});
      return reply(200, {...summary, asOf:now.toISOString()});
    } catch {
      return reply(503, {error:'summary_unavailable'});
    }
  };
}

function runtime() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('server_not_configured');
  const credential = JSON.parse(raw);
  if (credential.project_id !== projectId) throw new Error('wrong_project');
  const app = getApps().find(app => app.name === 'russo-threshold')
    || initializeApp({credential:cert(credential), projectId}, 'russo-threshold');
  return {auth:getAuth(app), db:getFirestore(app)};
}
export default createHandler({runtime});
