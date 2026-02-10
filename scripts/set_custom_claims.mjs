import admin from 'firebase-admin';
import fs from 'fs';

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (credPath && fs.existsSync(credPath)) {
  const serviceAccount = JSON.parse(fs.readFileSync(credPath, 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} else {
  // Fallback to Application Default Credentials (Cloud Shell / gcloud auth)
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
}

const ROLE_MAP = {
  'marco.tranquilli@dos.design': 'admin',
  'lorenzo.russo@alimentarirusso': 'ristoratore',
  'beatrice.binini@dos.design': 'facility',
  'monica.porta@dos.design': 'facility'
};

const emails = Object.keys(ROLE_MAP);

for (const email of emails) {
  try {
    const user = await admin.auth().getUserByEmail(email);
    const role = ROLE_MAP[email];
    await admin.auth().setCustomUserClaims(user.uid, { role });
    console.log(`✅ ${email} -> ${role}`);
  } catch (err) {
    console.error(`❌ ${email}: ${err.message}`);
  }
}

console.log('Done. Users must sign out/in to refresh tokens.');
