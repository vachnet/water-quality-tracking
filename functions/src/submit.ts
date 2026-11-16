import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { PROVINCE_SLUGS, REPORT_TYPE_IDS, POLICY, REGION, RETENTION_DAYS, THAILAND } from './constants';
import { cleanText, clientIp, daysFromNow, handleCors, hmacIp, verifyTurnstile } from './util';

const IP_HASH_KEY = defineSecret('IP_HASH_KEY');
const TURNSTILE_SECRET = defineSecret('TURNSTILE_SECRET');
const ALLOWED_ORIGINS = defineString('ALLOWED_ORIGINS', { default: 'http://localhost:4321' }); // comma-separated

const db = () => getFirestore();

// Per-instance cache so a blocked IP does not cost a Firestore read on every request.
const blockCache = new Map<string, { blocked: boolean; at: number }>();
const BLOCK_CACHE_MS = 60_000;

async function isBlocked(ipHash: string): Promise<boolean> {
  const hit = blockCache.get(ipHash);
  if (hit && Date.now() - hit.at < BLOCK_CACHE_MS) return hit.blocked;
  const snap = await db().doc(`ip_restrictions/${ipHash}`).get();
  const exp = snap.exists ? (snap.get('expiresAt') as Timestamp | null) : null;
  const blocked = snap.exists && (!exp || exp.toMillis() > Date.now());
  blockCache.set(ipHash, { blocked, at: Date.now() });
  return blocked;
}

async function autoBlock(ipHash: string, reason: string) {
  await db().doc(`ip_restrictions/${ipHash}`).set({
    ipHash, reason, createdBy: 'system',
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromDate(new Date(Date.now() + POLICY.autoBlockHours * 3600000)),
  });
  await db().collection('block_audit').add({
    ipHash, action: 'block', reason, by: 'system',
    createdAt: FieldValue.serverTimestamp(), expiresAt: Timestamp.fromDate(daysFromNow(RETENTION_DAYS.blockAudit)),
  });
  blockCache.set(ipHash, { blocked: true, at: Date.now() });
}

const URL_RE = /(https?:\/\/|www\.|\.(com|net|org|xyz|top)\b)/gi;

export const submitReport = onRequest(
  {
    region: REGION,
    maxInstances: 5, // hard ceiling on cost during a flood
    memory: '256MiB',
    timeoutSeconds: 15,
    secrets: [IP_HASH_KEY, TURNSTILE_SECRET],
  },
  async (req, res) => {
    if (handleCors(req, res, ALLOWED_ORIGINS.value())) return;
    if (req.method !== 'POST') return void res.status(405).json({ error: 'method' });
    const b = (req.body ?? {}) as Record<string, unknown>;

    // Honeypot: pretend success, store nothing.
    if (typeof b.website === 'string' && b.website.trim() !== '') return void res.status(201).json({ ok: true });

    // ---- validation -------------------------------------------------------
    const type = String(b.type ?? '');
    const province = String(b.province ?? '');
    const lat = Number(b.lat);
    const lng = Number(b.lng);
    const occurred = new Date(String(b.occurredAt ?? ''));
    const now = Date.now();
    if (!REPORT_TYPE_IDS.has(type) || !PROVINCE_SLUGS.has(province)) return void res.status(400).json({ error: 'invalid' });
    if (!Number.isFinite(lat) || !Number.isFinite(lng) ||
        lat < THAILAND.minLat || lat > THAILAND.maxLat || lng < THAILAND.minLng || lng > THAILAND.maxLng) {
      return void res.status(400).json({ error: 'location' });
    }
    if (isNaN(+occurred) || +occurred > now + 5 * 60000 || +occurred < now - POLICY.maxBackdateDays * 86400000) {
      return void res.status(400).json({ error: 'time' });
    }
    const description = cleanText(b.description, POLICY.maxDescription);

    // ---- identity of the sender (never returned to clients) --------------
    const ip = clientIp(req);
    const ipHash = hmacIp(IP_HASH_KEY.value(), ip);

    if (await isBlocked(ipHash)) return void res.status(403).json({ error: 'blocked' });
    if (!(await verifyTurnstile(TURNSTILE_SECRET.value(), b.turnstileToken as string | undefined, ip))) {
      return void res.status(403).json({ error: 'captcha' });
    }

    // ---- rate limit: fixed 10-minute bucket per ip_hash ------------------
    const bucketId = `${ipHash}_${Math.floor(now / POLICY.windowMs)}`;
    const geoKey = `${lat.toFixed(3)}_${lng.toFixed(3)}_${type}`; // ~110 m cell
    const dupId = `${ipHash}_${geoKey}`;
    const reportRef = db().collection('reports').doc();

    const { count, duplicate } = await db().runTransaction(async (tx) => {
      const bucketRef = db().doc(`rate_buckets/${bucketId}`);
      const dupRef = db().doc(`dup_keys/${dupId}`);
      const [bucket, dup] = await Promise.all([tx.get(bucketRef), tx.get(dupRef)]);
      const n = (bucket.exists ? (bucket.get('count') as number) : 0) + 1;
      tx.set(bucketRef, { ipHash, count: n, expiresAt: Timestamp.fromMillis(now + 2 * POLICY.windowMs) });
      tx.set(dupRef, { expiresAt: Timestamp.fromMillis(now + 3600000) });
      return { count: n, duplicate: dup.exists };
    });

    if (count >= POLICY.autoBlockAt) {
      await autoBlock(ipHash, `auto: ${count} reports in 10 min`);
      return void res.status(403).json({ error: 'blocked' });
    }
    if (count > POLICY.throttleAbove) return void res.status(429).json({ error: 'rate' });

    // ---- risk score ------------------------------------------------------
    let risk = 0;
    const flags: string[] = [];
    if (count >= POLICY.riskFrom) { risk += 30; flags.push('burst'); }
    if (duplicate) { risk += 40; flags.push('duplicate-location'); }
    if (description && (description.match(URL_RE)?.length ?? 0) >= 1) { risk += 40; flags.push('link-in-text'); }
    if (description && /(.)\1{9,}/.test(description)) { risk += 30; flags.push('repeated-chars'); }
    if (Number.isInteger(lat) || Number.isInteger(lng)) { risk += 20; flags.push('suspicious-coordinates'); }
    const status = risk >= POLICY.flagRiskAt ? 'flagged' : 'unverified';

    // ---- write (public report + server-only metadata, in separate collections) ----
    const batch = db().batch();
    batch.set(reportRef, {
      type, lat: +lat.toFixed(5), lng: +lng.toFixed(5), province,
      occurredAt: Timestamp.fromDate(occurred),
      ...(description ? { description } : {}),
      status, createdAt: FieldValue.serverTimestamp(),
    });
    batch.set(db().doc(`ip_raw/${reportRef.id}`), {
      reportId: reportRef.id, ip, createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromDate(daysFromNow(RETENTION_DAYS.ipRaw)),
    });
    batch.set(db().doc(`submission_meta/${reportRef.id}`), {
      reportId: reportRef.id, ipHash,
      userAgent: String(req.headers['user-agent'] ?? '').slice(0, 200),
      riskScore: risk, abuseFlags: flags, createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromDate(daysFromNow(RETENTION_DAYS.ipHash)),
    });
    await batch.commit();

    res.status(201).json({ ok: true, id: reportRef.id });
  },
);
