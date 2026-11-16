import { onRequest } from 'firebase-functions/v2/https';
import { defineString } from 'firebase-functions/params';
import { getMessaging } from 'firebase-admin/messaging';
import { PROVINCE_SLUGS, REGION } from './constants';
import { handleCors } from './util';

const ALLOWED_ORIGINS = defineString('ALLOWED_ORIGINS', { default: 'http://localhost:4321' });

export const topicFor = (slug: string) => `prov-${slug}`; // slug 'all' => nationwide

const TOKEN_RE = /^[A-Za-z0-9_:\-]{80,400}$/;

/**
 * POST { token, provinces: string[], action?: 'subscribe' | 'unsubscribe' }
 * Subscribes a browser's FCM token to per-province alert topics. Stores nothing about the person:
 * only FCM topic membership (managed by Google).
 */
export const subscribeAlerts = onRequest(
  { region: REGION, maxInstances: 3, memory: '256MiB', timeoutSeconds: 15 },
  async (req, res) => {
    if (handleCors(req, res, ALLOWED_ORIGINS.value())) return;
    if (req.method !== 'POST') return void res.status(405).json({ error: 'method' });
    const b = (req.body ?? {}) as Record<string, unknown>;
    const token = String(b.token ?? '');
    const list = Array.isArray(b.provinces) ? (b.provinces as unknown[]).map(String) : [];
    const provinces = [...new Set(list)].slice(0, 12);
    if (!TOKEN_RE.test(token) || provinces.length === 0 || !provinces.every((p) => p === 'all' || PROVINCE_SLUGS.has(p))) {
      return void res.status(400).json({ error: 'invalid' });
    }
    const unsubscribe = b.action === 'unsubscribe';
    try {
      for (const p of provinces) {
        const m = getMessaging();
        if (unsubscribe) await m.unsubscribeFromTopic(token, topicFor(p));
        else await m.subscribeToTopic(token, topicFor(p));
      }
      res.json({ ok: true });
    } catch (e) {
      console.error('subscribe failed', (e as Error).message);
      res.status(400).json({ error: 'token' });
    }
  },
);
