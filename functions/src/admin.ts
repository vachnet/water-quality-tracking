import { onRequest, type Request } from 'firebase-functions/v2/https';
import { defineString } from 'firebase-functions/params';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { REGION, RETENTION_DAYS } from './constants';
import { daysFromNow, handleCors } from './util';

const ALLOWED_ORIGINS = defineString('ALLOWED_ORIGINS', { default: 'http://localhost:4321' });
const db = () => getFirestore();
const HOUR = 3600000;

/** Admin = Firebase Auth user with custom claim { admin: true } (set via scripts/set-admin.mjs). */
async function requireAdmin(req: Request): Promise<string | null> {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? '');
  if (!m) return null;
  try {
    const t = await getAuth().verifyIdToken(m[1]);
    return t.admin === true ? (t.email ?? t.uid) : null;
  } catch {
    return null;
  }
}

async function countSince(ipHash: string, ms: number) {
  const q = db().collection('submission_meta').where('ipHash', '==', ipHash)
    .where('createdAt', '>=', Timestamp.fromMillis(Date.now() - ms));
  return (await q.count().get()).data().count;
}

export const adminApi = onRequest(
  {
    region: REGION, maxInstances: 2, memory: '256MiB', timeoutSeconds: 30,
  },
  async (req, res) => {
    if (handleCors(req, res, ALLOWED_ORIGINS.value())) return;
    const admin = await requireAdmin(req);
    if (!admin) return void res.status(401).json({ error: 'unauthorized' });
    const route = req.path.replace(/\/+$/, '');
    const body = (req.body ?? {}) as Record<string, unknown>;

    try {
      // GET /overview — reports today + suspicious IPs in the last 24h
      if (req.method === 'GET' && route.endsWith('/overview')) {
        const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
        const today = (await db().collection('reports').where('createdAt', '>=', Timestamp.fromDate(midnight)).count().get()).data().count;
        const rows = await db().collection('submission_meta')
          .where('createdAt', '>=', Timestamp.fromMillis(Date.now() - 24 * HOUR))
          .orderBy('createdAt', 'desc').limit(1000).get();
        const groups = new Map<string, { n: number; n1h: number; risk: number; flags: Set<string>; sample: string }>();
        for (const d of rows.docs) {
          const r = d.data();
          const g = groups.get(r.ipHash) ?? { n: 0, n1h: 0, risk: 0, flags: new Set<string>(), sample: d.id };
          g.n++;
          if ((r.createdAt as Timestamp).toMillis() > Date.now() - HOUR) g.n1h++;
          g.risk = Math.max(g.risk, r.riskScore ?? 0);
          (r.abuseFlags ?? []).forEach((f: string) => g.flags.add(f));
          groups.set(r.ipHash, g);
        }
        const suspicious = [...groups.entries()]
          .filter(([, g]) => g.risk >= 30 || g.n >= 4)
          .sort((a, b) => b[1].risk - a[1].risk || b[1].n - a[1].n).slice(0, 50);
        const out = await Promise.all(suspicious.map(async ([ipHash, g]) => {
          const raw = await db().doc(`ip_raw/${g.sample}`).get(); // null once past 30-day retention
          const restr = await db().doc(`ip_restrictions/${ipHash}`).get();
          const exp = restr.exists ? (restr.get('expiresAt') as Timestamp | null) : null;
          return {
            ipHash, ip: raw.exists ? raw.get('ip') : null, reports24h: g.n, reports1h: g.n1h,
            risk: g.risk >= 70 ? 'high' : g.risk >= 30 ? 'medium' : 'low', riskScore: g.risk, flags: [...g.flags],
            blocked: restr.exists && (!exp || exp.toMillis() > Date.now()),
          };
        }));
        return void res.json({ reportsToday: today, suspiciousCount: out.length, suspicious: out });
      }

      // GET /ip?hash= — counts for 1h / 24h / 7d and the reports from that IP
      if (req.method === 'GET' && route.endsWith('/ip')) {
        const ipHash = String(req.query.hash ?? '');
        if (!ipHash) return void res.status(400).json({ error: 'hash' });
        const [h1, h24, d7, metas] = await Promise.all([
          countSince(ipHash, HOUR), countSince(ipHash, 24 * HOUR), countSince(ipHash, 7 * 24 * HOUR),
          db().collection('submission_meta').where('ipHash', '==', ipHash).orderBy('createdAt', 'desc').limit(50).get(),
        ]);
        return void res.json({
          counts: { '1h': h1, '24h': h24, '7d': d7 },
          reports: metas.docs.map((d) => ({ reportId: d.get('reportId'), riskScore: d.get('riskScore'), flags: d.get('abuseFlags') })),
        });
      }

      // POST /block {ipHash, hours, reason}   POST /unblock {ipHash}
      if (req.method === 'POST' && (route.endsWith('/block') || route.endsWith('/unblock'))) {
        const ipHash = String(body.ipHash ?? '');
        if (!ipHash) return void res.status(400).json({ error: 'hash' });
        const block = route.endsWith('/block');
        if (block) {
          const hours = Math.min(Math.max(Number(body.hours) || 24, 1), 24 * 30); // never permanent
          await db().doc(`ip_restrictions/${ipHash}`).set({
            ipHash, reason: String(body.reason ?? 'manual').slice(0, 200), createdBy: admin,
            createdAt: FieldValue.serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + hours * HOUR),
          });
        } else {
          await db().doc(`ip_restrictions/${ipHash}`).delete();
        }
        await db().collection('block_audit').add({
          ipHash, action: block ? 'block' : 'unblock', reason: String(body.reason ?? ''), by: admin,
          createdAt: FieldValue.serverTimestamp(), expiresAt: Timestamp.fromDate(daysFromNow(RETENTION_DAYS.blockAudit)),
        });
        return void res.json({ ok: true });
      }

      // POST /hide {reportIds?: string[], ipHash?: string, status: 'hidden'|'unverified'}
      if (req.method === 'POST' && route.endsWith('/hide')) {
        const status = body.status === 'unverified' ? 'unverified' : 'hidden';
        let ids = Array.isArray(body.reportIds) ? (body.reportIds as string[]).map(String) : [];
        if (body.ipHash) {
          const q = await db().collection('submission_meta').where('ipHash', '==', String(body.ipHash)).limit(400).get();
          ids = ids.concat(q.docs.map((d) => d.get('reportId')));
        }
        ids = [...new Set(ids)].slice(0, 450);
        const batch = db().batch();
        ids.forEach((id) => batch.update(db().doc(`reports/${id}`), { status }));
        await batch.commit();
        return void res.json({ ok: true, updated: ids.length });
      }

      res.status(404).json({ error: 'not-found' });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'server' });
    }
  },
);
