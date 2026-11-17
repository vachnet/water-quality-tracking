// Atom feed of confirmed exceedances, one entry per river + round + sample type.
import { abs } from './url';
import { lpath, type Lang } from './i18n';
import { tx } from './toxicI18n';
import { measurements, measurementsGeneratedAt, levelOf, ratioOf, riverName, roundName, sampledLabel, SUBSTANCES, fmtValue, unitLabel, type Measurement } from './toxic';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const iso = (d: string) => new Date(d).toISOString();

export function toxicFeed(lang: Lang, site: URL | undefined): string {
  const d = tx(lang);
  const groups = new Map<string, Measurement[]>();
  for (const m of measurements) {
    if (levelOf(m) !== 'confirmed') continue;
    const k = `${m.river}|${m.round}|${m.matrix}|${m.sampledFrom}`;
    groups.set(k, [...(groups.get(k) ?? []), m]);
  }
  const page = abs(lpath(lang, '/toxic/'), site);
  const self = abs(lang === 'en' ? '/en/toxic.xml' : '/toxic.xml', site);
  const entries = [...groups.values()]
    .map((list) => {
      const m = list[0];
      const updated = m.reference.date ?? m.sampledTo ?? m.sampledFrom;
      const subs = [...new Set(list.map((x) => (lang === 'en' ? SUBSTANCES[x.substance].en : SUBSTANCES[x.substance].th)))].join(', ');
      const title = d.feedEntry(riverName(m.river, lang), `${roundName(m.round, lang)} (${d.matrix[m.matrix]})`, list.length, subs);
      const lines = list.map((x) => {
        const r = ratioOf(x);
        return `${x.station}: ${lang === 'en' ? SUBSTANCES[x.substance].en : SUBSTANCES[x.substance].th} ${fmtValue(x.value)} ${unitLabel(x.unit, lang)}${x.standard != null ? ` / ${d.standard} ${fmtValue(x.standard)}` : ''}${r ? ` (${r.toFixed(1)}×)` : ''}`;
      });
      const summary = `${d.sampled} ${sampledLabel(m, lang)}. ${d.source} ${m.reference.name}. ${lines.join('; ')}. ${d.approximate}.`;
      const id = `tag:clearwater-watch,${m.sampledFrom}:toxic/${encodeURIComponent(`${m.river}-${m.round}-${m.matrix}`)}/${lang}`;
      return { updated, xml: `  <entry>
    <id>${esc(id)}</id>
    <title>${esc(title)}</title>
    <updated>${iso(updated)}</updated>
    <link rel="alternate" type="text/html" href="${esc(m.reference.url)}"/>
    <link rel="related" type="text/html" href="${esc(page)}"/>
    <author><name>${esc(m.agency)}</name></author>
    <summary>${esc(summary)}</summary>
  </entry>` };
    })
    .sort((a, b) => b.updated.localeCompare(a.updated))
    .slice(0, 30);
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${lang}">
  <id>${esc(self)}</id>
  <title>${esc(d.feedTitle)}</title>
  <subtitle>${esc(d.feedSubtitle)}</subtitle>
  <updated>${iso(measurementsGeneratedAt)}</updated>
  <link rel="self" type="application/atom+xml" href="${esc(self)}"/>
  <link rel="alternate" type="text/html" href="${esc(page)}"/>
${entries.map((e) => e.xml).join('\n')}
</feed>
`;
}
