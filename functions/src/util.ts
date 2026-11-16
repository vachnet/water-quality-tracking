import { createHmac } from 'node:crypto';
import type { Request } from 'firebase-functions/v2/https';
interface Res {
  set(k: string, v: string): unknown;
  status(n: number): { send(b: string): unknown };
}

/**
 * Cloud Run / GFE appends the real client address to X-Forwarded-For, so the LAST entry is the
 * one we can trust; earlier entries are client-supplied and spoofable.
 */
export function clientIp(req: Request): string {
  const xff = String(req.headers['x-forwarded-for'] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return xff.length ? xff[xff.length - 1] : req.ip || 'unknown';
}

/** HMAC-SHA256 with a secret key (Secret Manager), never plain SHA-256 — the IPv4 space is brute-forceable. */
export const hmacIp = (key: string, ip: string) => createHmac('sha256', key).update(ip).digest('hex');

export const daysFromNow = (d: number) => new Date(Date.now() + d * 86400000);

export function cleanText(s: unknown, max: number): string | undefined {
  if (typeof s !== 'string') return undefined;
  // strip control chars, collapse whitespace
  const t = s.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  return t || undefined;
}

export async function verifyTurnstile(secret: string, token: string | undefined, ip: string): Promise<boolean> {
  if (!token) return false;
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    const j = (await r.json()) as { success?: boolean };
    return j.success === true;
  } catch {
    return false; // fail closed
  }
}

/** Allow only listed origins. Returns true when the request was a preflight and is already answered. */
export function handleCors(req: Request, res: Res, allowedCsv: string): boolean {
  const origin = req.headers.origin;
  const allowed = allowedCsv.split(',').map((s) => s.trim()).filter(Boolean);
  if (origin && allowed.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Max-Age', '3600');
  }
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return true;
  }
  return false;
}
