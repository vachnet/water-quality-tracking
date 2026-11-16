// Upserts data/curated-reports.json (official + news items, each with reference links) into Firestore.
// Idempotent: document ids are fixed, so re-running overwrites instead of duplicating.
// Usage: FIREBASE_SERVICE_ACCOUNT="$(cat key.json)" node scripts/seed-curated.mjs [--dry]
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';

const items = JSON.parse(readFileSync(new URL('../data/curated-reports.json', import.meta.url), 'utf8'));
if (process.argv.includes('--dry')) {
  console.log(`${items.length} items`, items.map((i) => i.id).join(', '));
  process.exit(0);
}
initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = getFirestore();
const batch = db.batch();
for (const { id, occurredAt, ...rest } of items) {
  batch.set(db.collection('reports').doc(id), {
    ...rest,
    occurredAt: Timestamp.fromDate(new Date(occurredAt)),
    createdAt: FieldValue.serverTimestamp(),
  });
}
await batch.commit();
console.log(`upserted ${items.length} curated reports`);
