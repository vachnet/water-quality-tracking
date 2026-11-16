// Validates the Haiku extraction (data/scout/extracted.json) against data/scout/candidates.json and
// merges accepted items into data/curated-reports.json. Deterministic: location, URL, date and publisher come
// from the scout, never from the LLM; numbers must literally appear in the article snippet.
// Usage: node scripts/scout-ingest.mjs [--seed]   (--seed also upserts to Firestore; needs FIREBASE_SERVICE_ACCOUNT)
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const P = (p) => new URL(p, root);
const J = (p) => JSON.parse(readFileSync(P(p), 'utf8'));
const TYPES = new Set(['fish-kill', 'discoloration', 'odor', 'oil-foam', 'trash', 'discharge', 'algae', 'other']);
const MERGE_DAYS = 5;

const { candidates } = J('data/scout/candidates.json');
const extracted = J('data/scout/extracted.json');
const provinces = new Map(J('data/provinces.json').map((p) => [p.slug, p]));
const curated = J('data/curated-reports.json');
const state = J('data/scout/state.json');
const byId = new Map(candidates.map((c) => [c.id, c]));

const added = [], merged = [], rejected = [];
const hasUrl = (s) => /https?:\/\/|www\./i.test(s);

for (const x of extracted) {
  const c = byId.get(x?.id);
  const why = !c ? 'unknown id' : !x.relevant ? 'not relevant' : !TYPES.has(x.type) ? 'bad type'
    : typeof x.title !== 'string' || x.title.length < 5 || x.title.length > 120 ? 'bad title'
    : typeof x.description !== 'string' || x.description.length < 20 || x.description.length > 320 || hasUrl(x.description) ? 'bad description' : null;
  if (why) { rejected.push(`${x?.id}: ${why}`); if (c) state.seen[c.id] = { t: new Date().toISOString(), s: 'rejected' }; continue; }

  // keep only metrics whose numbers literally appear in the snippet
  const metrics = {};
  for (const [k, v] of Object.entries(x.metrics ?? {})) {
    if (typeof v === 'number' && /^[A-Za-z_]{1,30}$/.test(k) && c.snippet.includes(String(v))) metrics[k] = v;
  }
  const ref = { name: `${c.publisher} — ${c.title.slice(0, 90)}`, url: c.url, date: c.pubDate.slice(0, 10) };
  const t = Date.parse(c.pubDate);
  const near = [...curated, ...added].find((r) => r.source === 'news' && r.province === c.province && r.type === x.type &&
    Math.abs(Date.parse(r.occurredAt) - t) <= MERGE_DAYS * 86400000);
  if (near) {
    if (!near.references.some((r) => r.url === c.url)) near.references.push(ref);
    merged.push(`${c.id} -> ${near.id}`);
  } else {
    const p = provinces.get(c.province);
    const n = parseInt(createHash('sha1').update(c.id).digest('hex').slice(0, 4), 16);
    added.push({
      id: `news-${c.province}-${c.pubDate.slice(0, 10).replace(/-/g, '')}-${c.id.slice(0, 6)}`,
      source: 'news', type: x.type, title: x.title.trim(), description: x.description.trim(),
      lat: +(p.lat + ((n % 7) - 3) * 0.02).toFixed(4), lng: +(p.lng + (((n >> 3) % 7) - 3) * 0.02).toFixed(4),
      province: c.province, locationPrecision: 'province', occurredAt: c.pubDate,
      ...(Object.keys(metrics).length ? { metrics } : {}), references: [ref], status: 'published',
    });
  }
  state.seen[c.id] = { t: new Date().toISOString(), s: 'ingested' };
}

writeFileSync(P('data/curated-reports.json'), JSON.stringify([...curated, ...added], null, 1));
writeFileSync(P('data/scout/state.json'), JSON.stringify(state, null, 1));
console.log(`ingest: +${added.length} new, ${merged.length} merged as extra references, ${rejected.length} rejected`);
for (const r of rejected) console.log('  rejected', r);
if (process.argv.includes('--seed') && (added.length || merged.length)) {
  execFileSync('node', [new URL('./seed-curated.mjs', import.meta.url).pathname], { stdio: 'inherit', env: process.env });
}
