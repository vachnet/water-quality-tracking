import raw from '../data/reports.json';
import type { Report, Source } from './types';
import { typeById, SOURCES } from './types';
import { provinceBySlug, provinceName } from './provinces';
import { t, type Lang } from './i18n';
import { beYear, fmtDate, fmtDateTime } from './format';

export const generatedAt: string = raw.generatedAt;
export const isDemo: boolean = raw.demo;
export const reports: Report[] = (raw.reports as Report[])
  .map((r) => ({ ...r, source: r.source ?? 'community' }))
  .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

export const reportsByProvince = (slug: string) => reports.filter((r) => r.province === slug);

const DAY = 86400000;

export function countBySource(list: Report[]): Record<Source | 'all', number> {
  const c = { all: list.length, government: 0, news: 0, community: 0 };
  for (const r of list) c[r.source]++;
  return c;
}

/**
 * Honest headline numbers. Time windows only apply to community reports (which arrive continuously);
 * news and official readings are counted as totals with their latest date, so a 2024 annual index is
 * never presented as "today".
 */
export function stats(now = Date.now()) {
  const community = reports.filter((r) => r.source === 'community');
  const news = reports.filter((r) => r.source === 'news');
  const gov = reports.filter((r) => r.source === 'government');
  const within = (list: Report[], days: number) => list.filter((r) => now - Date.parse(r.occurredAt) < days * DAY).length;
  const govYears = gov.map((r) => Number(r.metrics?.year)).filter((y) => Number.isFinite(y) && y > 0);
  return {
    community24h: within(community, 1),
    community7d: within(community, 7),
    community30d: within(community, 30),
    news: news.length,
    newsLatest: news[0]?.occurredAt,
    gov: gov.length,
    govLatestYear: govYears.length ? Math.max(...govYears) : undefined,
    provinces: new Set(reports.map((r) => r.province)).size,
    bySource: countBySource(reports),
  };
}

/** List for panels: newest first, capped per source so official/news items are never crowded out. */
export function listSelection(list: Report[], caps: Partial<Record<Source, number>> = {}) {
  const cap = { community: 80, news: 40, government: 40, ...caps };
  const seen = { community: 0, news: 0, government: 0 };
  return list.filter((r) => seen[r.source]++ < cap[r.source]);
}

export interface RefView { name: string; url: string; date?: string }

/** Everything the UI shows for one item, already localised. Used by server cards and the client map. */
export interface ReportView {
  id: string;
  source: Source;
  lat: number;
  lng: number;
  province: string;
  provinceName: string;
  at: string;
  when: string; // formatted date label
  whenTitle: string;
  title: string;
  titleLang?: Lang;
  description?: string;
  descLang?: Lang;
  icon: string;
  typeLabel: string;
  precision: 'exact' | 'approximate' | 'province';
  metrics?: string;
  refs: RefView[];
  unverified: boolean;
  flagged: boolean;
}

const isHttp = (u: string) => /^https?:\/\//i.test(u);

function metricsLine(r: Report, lang: Lang): string | undefined {
  const m = r.metrics;
  if (!m) return undefined;
  const parts: string[] = [];
  if (m.wqi !== undefined) {
    const cls = String(m.class ?? '');
    parts.push(`WQI ${m.wqi}/100${cls ? ` · ${t(lang).wqiClass[cls] ?? cls}` : ''}`);
  }
  if (m.DO_mgL !== undefined) parts.push(`DO ${m.DO_mgL} mg/L`);
  if (m.DO_at_discharge_mgL !== undefined) parts.push(`${lang === 'th' ? 'DO ที่จุดปล่อย' : 'DO at outfall'} ${m.DO_at_discharge_mgL} mg/L`);
  if (m.pH !== undefined) parts.push(`pH ${m.pH}`);
  return parts.length ? parts.join(' · ') : undefined;
}

export function toView(r: Report, lang: Lang): ReportView {
  const d = t(lang);
  const type = typeById(r.type);
  const prov = provinceBySlug(r.province);
  const typeLabel = lang === 'en' ? type.labelEn : type.label;
  let title = r.title ?? typeLabel;
  let titleLang: Lang | undefined = r.title ? 'th' : lang;
  let description = r.description;
  let descLang: Lang | undefined = r.source === 'community' ? undefined : 'th';
  let when = r.source === 'community' ? fmtDateTime(r.occurredAt, lang) : fmtDate(r.occurredAt, lang);
  const year = Number(r.metrics?.year);

  if (r.source === 'government' && r.metrics?.wqi !== undefined) {
    const cls = String(r.metrics.class ?? '');
    const body = r.title?.match(/^ดัชนีคุณภาพน้ำ\s+(.+?):/)?.[1] ?? provinceName(prov, 'th');
    if (Number.isFinite(year) && year > 0) when = d.annualIndex(beYear(year, lang));
    if (lang === 'en') {
      // Official items are generated from structured data, so they can be fully localised.
      const clsEn = d.wqiClass[cls] ?? cls;
      title = `WQI ${r.metrics.wqi} (${clsEn}) — ${body}`;
      titleLang = 'en';
      description = `Surface Water Quality Index for "${body}" (${provinceName(prov, 'en')}) was ${r.metrics.wqi}/100 in ${Number.isFinite(year) ? year - 543 : ''}, rated "${clsEn}" by the Pollution Control Department. The pin is a province-level reference point, not the monitoring station's position.`;
      descLang = 'en';
    }
  }
  if (lang === 'th') titleLang = undefined; // page is Thai already
  if (lang === 'th') descLang = undefined;

  return {
    id: r.id,
    source: r.source,
    lat: r.lat,
    lng: r.lng,
    province: r.province,
    provinceName: provinceName(prov, lang),
    at: r.occurredAt,
    when,
    whenTitle: fmtDateTime(r.occurredAt, lang),
    title,
    titleLang,
    description,
    descLang,
    icon: type.icon,
    typeLabel,
    precision: r.locationPrecision ?? 'exact',
    metrics: metricsLine(r, lang),
    refs: (r.references ?? []).filter((x) => x && typeof x.url === 'string' && isHttp(x.url)).map((x) => ({ name: x.name, url: x.url, ...(x.date ? { date: x.date } : {}) })),
    unverified: r.source === 'community',
    flagged: r.status === 'flagged',
  };
}

export { SOURCES };
