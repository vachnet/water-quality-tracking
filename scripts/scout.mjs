// Zero-LLM scouting pass. Finds NEW, relevant, recent water-pollution news from trusted Thai outlets
// and checks the official PCD datasets for updates. Writes data/scout/candidates.json for the Haiku step.
// Usage: node scripts/scout.mjs            (prints a one-line summary; exit 0)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const P = (p) => new URL(p, root);
const MAX_CANDIDATES = 10; // hard cap on LLM work per run
const MAX_AGE_DAYS = 14;
const SNIPPET_CHARS = 1100;

const QUERIES = ['ปลาตาย น้ำเสีย', 'น้ำเน่าเสีย แม่น้ำ คลอง', 'ปล่อยน้ำเสีย โรงงาน คลอง', 'คราบน้ำมัน แม่น้ำ ทะเล', 'น้ำเปลี่ยนสี คลอง แม่น้ำ', 'กรมควบคุมมลพิษ ตรวจคุณภาพน้ำ ปลาตาย', 'สารหนู แม่น้ำ เกินมาตรฐาน', 'โลหะหนัก น้ำ ตะกอนดิน ผลตรวจ', 'สารปนเปื้อน แม่น้ำ อะลูมิเนียม ตะกั่ว ปรอท'];
const KEYWORDS = /ปลาตาย|น้ำเสีย|น้ำเน่า|คราบน้ำมัน|น้ำมันรั่ว|น้ำเปลี่ยนสี|น้ำดำ|ปล่อยน้ำเสีย|สาหร่าย|ออกซิเจน|คุณภาพน้ำ|สารหนู|โลหะหนัก|ตะกั่ว|ปรอท|แคดเมียม|อะลูมิเนียม|สารปนเปื้อน|ตะกอนดิน/;
// Numeric toxic-substance readings are NOT auto-ingested; candidates that contain them are flagged for human review.
const TOXIC_NUMBERS = /(สารหนู|ตะกั่ว|ปรอท|แคดเมียม|อะลูมิเนียม|แมงกานีส|โครเมียม|นิกเกิล)[^.]{0,80}?\d+\.?\d*\s*(มก\.\/ล|มก\.\/กก|มิลลิกรัม)/;
// Trusted outlets only (national media, public broadcasters, government). Subdomains match.
const ALLOW = ['thaipbs.or.th', 'thaipost.net', 'mgronline.com', 'matichon.co.th', 'khaosod.co.th', 'bangkokbiznews.com', 'nationthailand.com',
  'bangkokpost.com', 'pptvhd36.com', 'hfocus.org', 'amarintv.com', 'thairath.co.th', 'dailynews.co.th', 'sanook.com', 'tnnthailand.com', 'thematter.co',
  'prachachat.net', 'komchadluek.net', 'posttoday.com', 'thansettakij.com', 'workpointtoday.com', 'springnews.co.th', 'thestandard.co', 'voicetv.co.th',
  'mcot.net', 'ch7.com', 'ch3plus.com', 'bbc.com', 'onep.go.th', 'pcd.go.th', 'anamai.moph.go.th', 'fisheries.go.th', 'dmcr.go.th', 'hii.or.th', 'thaiwater.net'];
const GOV_DATASETS = ['_11_07_wqiscore', '_11_08_waterqualityratio', 'water-quality'];

const provinces = JSON.parse(readFileSync(P('data/provinces.json'), 'utf8'));
const statePath = P('data/scout/state.json');
let state = { seen: {}, gov: {} };
try { state = JSON.parse(readFileSync(statePath, 'utf8')); } catch {}
const now = Date.now();
const h = (s) => createHash('sha1').update(s).digest('hex').slice(0, 12);
const unescape = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const get = async (url, ms = 12000) => {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WaterScout/1.0)', 'Accept-Language': 'th,en;q=0.8' }, signal: AbortSignal.timeout(ms), redirect: 'follow' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
};

function canonical(u) {
  try {
    const x = new URL(u);
    for (const k of [...x.searchParams.keys()]) if (/^(utm_|fbclid|gclid|ref$)/.test(k)) x.searchParams.delete(k);
    x.hash = '';
    return x.href;
  } catch { return null; }
}
const trusted = (u) => { try { const d = new URL(u).hostname.replace(/^www\./, ''); return ALLOW.some((a) => d === a || d.endsWith('.' + a)); } catch { return false; } };

// ---- province detection (deterministic; the LLM never picks the location) ----
function detectProvince(text) {
  const score = new Map();
  const bump = (slug, n) => score.set(slug, (score.get(slug) ?? 0) + n);
  const alias = { 'กรุงเทพฯ': 'bangkok', 'กทม': 'bangkok', 'อยุธยา': 'ayutthaya', 'โคราช': 'nakhon-ratchasima' };
  for (const [a, slug] of Object.entries(alias)) bump(slug, (text.split(a).length - 1) * 2);
  for (const p of provinces) {
    const explicit = text.split(new RegExp(`(?:จ\\.|จังหวัด)\\s*${p.name}`)).length - 1;
    bump(p.slug, explicit * 3);
    if (p.name.length >= 4) bump(p.slug, text.split(p.name).length - 1);
    const stem = p.name.replace(/บุรี$/, '');
    if (stem !== p.name && stem.length >= 4) bump(p.slug, text.split(stem).length - 1);
  }
  const top = [...score.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  return top.length && (top.length === 1 || top[0][1] > top[1][1]) ? top[0][0] : null;
}

function pageText(html) {
  return unescape(html.replace(/<(script|style|noscript|svg|nav|header|footer)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}
function snippet(title, text) {
  // title + opening + windows around measurement/cause words, capped hard (this is all the LLM sees)
  const parts = [title, text.slice(0, 450)];
  for (const m of text.matchAll(/ออกซิเจน|DO\b|มก\.\/ลิตร|สาเหตุ|ตรวจ|ปล่อยน้ำเสีย/g)) {
    parts.push(text.slice(Math.max(0, m.index - 60), m.index + 160));
    if (parts.join(' ').length > SNIPPET_CHARS) break;
  }
  return parts.join(' … ').slice(0, SNIPPET_CHARS);
}

// ---- news ----
async function scoutNews() {
  const found = new Map();
  await Promise.all(QUERIES.map(async (q) => {
    try {
      const xml = await get(`https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=rss&setmkt=th-TH&qft=sortbydate%3d%221%22`);
      for (const it of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
        const tag = (k) => unescape((it[1].match(new RegExp(`<${k}>([\\s\\S]*?)</${k}>`)) || [])[1] ?? '');
        const link = tag('link');
        const target = canonical(decodeURIComponent((link.match(/[?&]url=([^&]+)/) || [])[1] ?? ''));
        if (!target || !trusted(target)) continue;
        const date = new Date(tag('pubDate'));
        if (isNaN(+date) || now - +date > MAX_AGE_DAYS * 86400000) continue;
        found.set(h(target), { id: h(target), url: target, title: tag('title').replace(/<[^>]+>/g, ''), pubDate: date.toISOString() });
      }
    } catch (e) { console.error(`feed failed (${q}): ${e.message}`); }
  }));
  const fresh = [...found.values()].filter((c) => !state.seen[c.id]).sort((a, b) => b.pubDate.localeCompare(a.pubDate));
  const out = [];
  let skipped = 0;
  for (const c of fresh) {
    if (out.length >= MAX_CANDIDATES) break;
    try {
      const html = await get(c.url);
      const text = pageText(html);
      const body = `${c.title} ${text}`;
      if (!KEYWORDS.test(c.title) || !KEYWORDS.test(body)) { state.seen[c.id] = { t: new Date().toISOString(), s: 'irrelevant' }; skipped++; continue; }
      const province = detectProvince(`${c.title} ${c.title} ${text.slice(0, 3000)}`);
      if (!province) { state.seen[c.id] = { t: new Date().toISOString(), s: 'no-province' }; skipped++; continue; }
      out.push({ ...c, toxicNumbers: TOXIC_NUMBERS.test(text), publisher: new URL(c.url).hostname.replace(/^www\./, ''), province, snippet: snippet(c.title, text) });
      state.seen[c.id] = { t: new Date().toISOString(), s: 'candidate' };
    } catch (e) { state.seen[c.id] = { t: new Date().toISOString(), s: 'fetch_failed' }; skipped++; }
  }
  return { out, found: found.size, fresh: fresh.length, skipped };
}

// ---- official datasets: notify on change only ----
async function scoutGov() {
  const changed = [];
  for (const id of GOV_DATASETS) {
    try {
      const j = JSON.parse(await get(`https://data.go.th/api/3/action/package_show?id=${id}`));
      const r = j.result;
      const sig = `${r.metadata_modified}|${(r.resources ?? []).map((x) => x.id).sort().join(',')}`;
      if (state.gov[id] && state.gov[id] !== sig) changed.push({ id, title: r.title, url: `https://data.go.th/en/dataset/${id}`, lastUpdated: r.last_updated_date });
      state.gov[id] = sig; // first run just records the baseline
    } catch (e) { console.error(`gov check failed (${id}): ${e.message}`); }
  }
  return changed;
}

const [news, gov] = await Promise.all([scoutNews(), scoutGov()]);
for (const [k, v] of Object.entries(state.seen)) if (now - Date.parse(v.t) > 60 * 86400000) delete state.seen[k]; // prune
mkdirSync(P('data/scout/'), { recursive: true });
writeFileSync(statePath, JSON.stringify(state, null, 1));
writeFileSync(P('data/scout/candidates.json'), JSON.stringify({ generatedAt: new Date().toISOString(), candidates: news.out, govChanged: gov }, null, 1));
console.log(`scout: ${news.out.length} candidate(s) for LLM (${news.found} trusted items, ${news.fresh} unseen, ${news.skipped} filtered out); gov datasets changed: ${gov.length}`);
