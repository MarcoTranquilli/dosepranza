import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import admin from 'firebase-admin';
import {
  EXPECTED_LEGACY_COUNT,
  classifyLegacyOrder
} from './lib/russo_backfill_policy.mjs';

const args = process.argv.slice(2);
const valueFor = flag => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : '';
};
const applyMode = args.includes('--apply');
const rollbackMode = args.includes('--rollback');
const projectId = valueFor('--project') || process.env.FIREBASE_PROJECT_ID || 'app-ordini-pranzo-alimentari';
const manifestPath = valueFor('--manifest');
const confirmation = valueFor('--confirm');
const outputDirectory = path.resolve(valueFor('--output-dir') || 'backfill-manifests');

if (applyMode && rollbackMode) throw new Error('Scegli --apply oppure --rollback.');
if ((applyMode || rollbackMode) && !manifestPath) throw new Error('--manifest è obbligatorio.');
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  throw new Error('GOOGLE_APPLICATION_CREDENTIALS deve puntare a un service account JSON valido.');
}

admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId });
const db = admin.firestore();
const shortId = id => id.length <= 12 ? id : `${id.slice(0, 6)}…${id.slice(-4)}`;
const updateMillis = snapshot => snapshot.updateTime?.toMillis?.() || null;
const chunk = (values, size = 400) => values.reduce((groups, value, index) => {
  if (index % size === 0) groups.push([]);
  groups.at(-1).push(value);
  return groups;
}, []);

async function loadOrders() {
  return db.collection('orders').get();
}

function buildAudit(snapshot) {
  const distribution = {};
  const certain = [];
  const ambiguous = [];
  for (const document of snapshot.docs) {
    const data = document.data();
    const supplierId = typeof data.supplierId === 'string' && data.supplierId.trim()
      ? data.supplierId.trim()
      : '__missing__';
    distribution[supplierId] = (distribution[supplierId] || 0) + 1;
    const classification = classifyLegacyOrder(data);
    const entry = {
      id: document.id,
      shortId: shortId(document.id),
      updateTimeMillis: updateMillis(document),
      classification: classification.reason
    };
    if (classification.status === 'certain-russo') certain.push(entry);
    if (classification.status === 'ambiguous') ambiguous.push(entry);
  }
  return { total: snapshot.size, distribution, certain, ambiguous };
}

function writeDryRun(audit) {
  fs.mkdirSync(outputDirectory, { recursive: true, mode: 0o700 });
  const batchId = `russo-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const target = path.join(outputDirectory, `${batchId}.dry-run.json`);
  const summaryTarget = path.join(outputDirectory, `${batchId}.short-ids.txt`);
  fs.writeFileSync(target, JSON.stringify({
    version: 1,
    mode: 'dry-run',
    projectId,
    createdAt: new Date().toISOString(),
    expectedCount: EXPECTED_LEGACY_COUNT,
    candidates: audit.certain
  }, null, 2), { mode: 0o600 });
  fs.writeFileSync(summaryTarget, audit.certain.map(entry => entry.shortId).join('\n') + '\n', { mode: 0o600 });
  console.log(JSON.stringify({
    mode: 'dry-run',
    total: audit.total,
    distribution: audit.distribution,
    certainRusso: audit.certain.length,
    ambiguous: audit.ambiguous.length,
    manifest: target,
    abbreviatedIds: summaryTarget
  }, null, 2));
}

async function applyManifest() {
  const manifest = JSON.parse(fs.readFileSync(path.resolve(manifestPath), 'utf8'));
  const expectedConfirmation = `BACKFILL_RUSSO_${manifest.candidates.length}`;
  if (confirmation !== expectedConfirmation) throw new Error(`Conferma richiesta: --confirm ${expectedConfirmation}`);
  if (manifest.projectId !== projectId || manifest.mode !== 'dry-run') throw new Error('Manifest non coerente.');
  if (manifest.candidates.length !== EXPECTED_LEGACY_COUNT) throw new Error('Conteggio manifest diverso dall’audit approvato.');

  const refs = manifest.candidates.map(entry => db.collection('orders').doc(entry.id));
  const current = await db.getAll(...refs);
  for (let index = 0; index < current.length; index += 1) {
    const snapshot = current[index];
    const expected = manifest.candidates[index];
    if (!snapshot.exists || snapshot.data().supplierId || updateMillis(snapshot) !== expected.updateTimeMillis) {
      throw new Error(`Precondizione fallita per ${expected.shortId}. Nessuna modifica eseguita.`);
    }
    if (classifyLegacyOrder(snapshot.data()).status !== 'certain-russo') {
      throw new Error(`Documento non più attribuibile con certezza: ${expected.shortId}.`);
    }
  }

  for (const group of chunk(current)) {
    const batch = db.batch();
    for (const snapshot of group) {
      batch.update(snapshot.ref, { supplierId: 'russo' }, { lastUpdateTime: snapshot.updateTime });
    }
    await batch.commit();
  }
  const applied = await db.getAll(...refs);
  const appliedPath = path.resolve(manifestPath).replace(/\.dry-run\.json$/, '.applied.json');
  fs.writeFileSync(appliedPath, JSON.stringify({
    ...manifest,
    mode: 'applied',
    appliedAt: new Date().toISOString(),
    candidates: applied.map((snapshot, index) => ({
      ...manifest.candidates[index],
      appliedUpdateTimeMillis: updateMillis(snapshot)
    }))
  }, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ mode: 'applied', updated: applied.length, rollbackManifest: appliedPath }, null, 2));
}

async function rollbackManifest() {
  const manifest = JSON.parse(fs.readFileSync(path.resolve(manifestPath), 'utf8'));
  const expectedConfirmation = `ROLLBACK_RUSSO_${manifest.candidates.length}`;
  if (confirmation !== expectedConfirmation) throw new Error(`Conferma richiesta: --confirm ${expectedConfirmation}`);
  if (manifest.projectId !== projectId || manifest.mode !== 'applied') throw new Error('Manifest applicato non coerente.');
  const refs = manifest.candidates.map(entry => db.collection('orders').doc(entry.id));
  const current = await db.getAll(...refs);
  for (let index = 0; index < current.length; index += 1) {
    const snapshot = current[index];
    const expected = manifest.candidates[index];
    if (!snapshot.exists || snapshot.data().supplierId !== 'russo' || updateMillis(snapshot) !== expected.appliedUpdateTimeMillis) {
      throw new Error(`Rollback non sicuro per ${expected.shortId}. Nessuna modifica eseguita.`);
    }
  }
  for (const group of chunk(current)) {
    const batch = db.batch();
    for (const snapshot of group) {
      batch.update(snapshot.ref, { supplierId: admin.firestore.FieldValue.delete() }, { lastUpdateTime: snapshot.updateTime });
    }
    await batch.commit();
  }
  console.log(JSON.stringify({ mode: 'rollback', restored: current.length }, null, 2));
}

try {
  if (applyMode) await applyManifest();
  else if (rollbackMode) await rollbackManifest();
  else writeDryRun(buildAudit(await loadOrders()));
} finally {
  await admin.app().delete();
}

