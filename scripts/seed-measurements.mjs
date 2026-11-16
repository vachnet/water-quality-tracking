// Upserts data/toxic-measurements.json into Firestore collection `measurements` (public read via build only).
// Usage: FIREBASE_SERVICE_ACCOUNT="$(cat key.json)" node scripts/seed-measurements.mjs
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const rows = JSON.parse(readFileSync(new URL('../data/toxic-measurements.json', import.meta.url), 'utf8'));
initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = getFirestore();
for (let i = 0; i < rows.length; i += 400) {
  const batch = db.batch();
  for (const { id, sampledTo, ...rest } of rows.slice(i, i + 400)) {
    batch.set(db.collection('measurements').doc(id), { ...rest, sampledTo: Timestamp.fromDate(new Date(sampledTo)) });
  }
  await batch.commit();
}
console.log(`upserted ${rows.length} measurements`);
