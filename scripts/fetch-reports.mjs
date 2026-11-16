// Writes src/data/reports.json for the static build.
// With FIREBASE_SERVICE_ACCOUNT (JSON string) set it reads Firestore; otherwise it writes demo data.
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = new URL('../src/data/reports.json', import.meta.url);
const WINDOW_DAYS = 30;
const MAX_REPORTS = 3000;
mkdirSync(new URL('../src/data/', import.meta.url), { recursive: true });

async function fromFirestore() {
  const { initializeApp, cert } = await import('firebase-admin/app');
  const { getFirestore, Timestamp } = await import('firebase-admin/firestore');
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  const since = Timestamp.fromMillis(Date.now() - WINDOW_DAYS * 86400000);
  const db = getFirestore();
  // Community reports: recent window only. Curated sources (government, news): kept regardless of age.
  const [community, curated] = await Promise.all([
    db.collection('reports').where('status', 'in', ['unverified', 'flagged']).where('occurredAt', '>=', since)
      .orderBy('occurredAt', 'desc').limit(MAX_REPORTS).get(),
    db.collection('reports').where('source', 'in', ['government', 'news']).limit(1000).get(),
  ]);
  // Public fields only. Never copy IP or submission metadata here.
  return [...community.docs, ...curated.docs]
    .filter((d) => d.get('status') !== 'hidden')
    .map((d) => {
      const r = d.data();
      return {
        id: d.id,
        source: r.source ?? 'community',
        type: r.type,
        lat: r.lat,
        lng: r.lng,
        province: r.province,
        occurredAt: r.occurredAt.toDate().toISOString(),
        status: r.status,
        ...(r.title ? { title: r.title } : {}),
        ...(r.description ? { description: r.description } : {}),
        ...(r.locationPrecision ? { locationPrecision: r.locationPrecision } : {}),
        ...(r.metrics ? { metrics: r.metrics } : {}),
        ...(r.references ? { references: r.references } : {}),
      };
    })
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

function demo() {
  const types = ['fish-kill', 'discoloration', 'odor', 'oil-foam', 'trash', 'discharge', 'algae', 'other'];
  const spots = [
    ['bangkok', 13.72, 100.5], ['bangkok', 13.79, 100.47], ['chiang-mai', 18.79, 98.99],
    ['khon-kaen', 16.44, 102.83], ['songkhla', 7.2, 100.58], ['chonburi', 13.36, 100.98],
    ['ayutthaya', 14.35, 100.57], ['nakhon-sawan', 15.7, 100.14], ['rayong', 12.68, 101.28],
    ['samut-sakhon', 13.54, 100.27], ['ubon-ratchathani', 15.23, 104.86], ['phuket', 7.88, 98.39],
  ];
  const notes = ['น้ำมีกลิ่นเหม็นรุนแรงตั้งแต่เช้า', 'พบปลาลอยตายหลายตัวริมตลิ่ง', 'น้ำเป็นสีเขียวเข้มผิดปกติ', undefined, undefined];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: 48 }, (_, i) => {
    const [province, lat, lng] = spots[i % spots.length];
    const note = notes[Math.floor(rnd() * notes.length)];
    return {
      id: `demo-${i + 1}`,
      type: types[Math.floor(rnd() * types.length)],
      lat: +(lat + (rnd() - 0.5) * 0.12).toFixed(4),
      lng: +(lng + (rnd() - 0.5) * 0.12).toFixed(4),
      province,
      occurredAt: new Date(Date.now() - rnd() * 20 * 86400000).toISOString(),
      ...(note ? { description: note } : {}),
      source: 'community',
      status: rnd() > 0.9 ? 'flagged' : 'unverified',
    };
  }).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

async function measurementsFromFirestore() {
  const { getFirestore } = await import('firebase-admin/firestore');
  const snap = await getFirestore().collection('measurements').get();
  return snap.docs.map((d) => {
    const { sampledTo, ...r } = d.data();
    return { id: d.id, ...r, sampledTo: sampledTo.toDate().toISOString().slice(0, 10) };
  });
}

const reports = process.env.FIREBASE_SERVICE_ACCOUNT ? await fromFirestore() : demo();
// Toxic-substance measurements (official lab results reported in news): Firestore, or the committed seed file in demo mode.
const measurements = process.env.FIREBASE_SERVICE_ACCOUNT
  ? await measurementsFromFirestore()
  : JSON.parse((await import('node:fs')).readFileSync(new URL('../data/toxic-measurements.json', import.meta.url), 'utf8'));
writeFileSync(new URL('../src/data/measurements.json', import.meta.url), JSON.stringify({ generatedAt: new Date().toISOString(), measurements }));
console.log(`measurements.json: ${measurements.length} rows`);
writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), demo: !process.env.FIREBASE_SERVICE_ACCOUNT, reports }));
console.log(`reports.json: ${reports.length} reports (${process.env.FIREBASE_SERVICE_ACCOUNT ? 'firestore' : 'demo'})`);
