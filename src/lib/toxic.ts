// Toxic-substance measurements: official PCD lab results as reported by news (each row links its article).
// Rule: never compute our own exceedance flags. `exceedsStandard` comes from the article/agency only.
import raw from '../data/measurements.json';
import type { Lang } from './i18n';
import { fmtDate } from './format';
import { provinceBySlug, provinceName } from './provinces';

export type Substance = 'arsenic' | 'lead' | 'manganese' | 'mercury' | 'nickel' | 'chromium' | 'aluminium';
export type Matrix = 'water' | 'sediment';
export type Level = 'confirmed' | 'watch' | 'ok';

export interface Measurement {
  id: string;
  station: string;
  river: string;
  place: string;
  province: string;
  lat: number;
  lng: number;
  locationPrecision?: 'approximate' | 'exact' | 'province';
  substance: Substance;
  value: number;
  unit: 'mg/L' | 'mg/kg';
  matrix: Matrix;
  standard: number | null;
  exceedsStandard: boolean | null;
  belowDetection?: boolean;
  sampledFrom: string;
  sampledTo: string;
  round: string;
  agency: string;
  reference: { name: string; url: string; date: string | null };
  note?: string;
}

export const measurementsGeneratedAt: string = raw.generatedAt;
export const measurements: Measurement[] = (raw.measurements as Measurement[]).filter(
  (m) => m && typeof m.value === 'number' && /^https?:\/\//i.test(m.reference?.url ?? ''),
);

export const SUBSTANCES: Record<Substance, { th: string; en: string; symbol: string }> = {
  arsenic: { th: 'สารหนู', en: 'Arsenic', symbol: 'As' },
  lead: { th: 'ตะกั่ว', en: 'Lead', symbol: 'Pb' },
  manganese: { th: 'แมงกานีส', en: 'Manganese', symbol: 'Mn' },
  mercury: { th: 'ปรอท', en: 'Mercury', symbol: 'Hg' },
  nickel: { th: 'นิกเกิล', en: 'Nickel', symbol: 'Ni' },
  chromium: { th: 'โครเมียม', en: 'Chromium', symbol: 'Cr' },
  aluminium: { th: 'อะลูมิเนียม', en: 'Aluminium', symbol: 'Al' },
};

const RIVER_EN: Record<string, string> = {
  'กก': 'Kok River',
  'สาย': 'Sai River',
  'รวก': 'Ruak River',
  'โขง': 'Mekong River',
  'สาละวิน': 'Salween River',
  'ปราจีนบุรี': 'Prachin Buri River',
  'กรณ์ (สาขาแม่น้ำกก)': 'Kon River (Kok tributary)',
};
export const riverName = (river: string, lang: Lang) => (lang === 'en' ? RIVER_EN[river] ?? river : `แม่น้ำ${river}`);
export const riverSlug = (river: string) => (RIVER_EN[river] ?? river).toLowerCase().replace(/\s*\(.*\)/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'river';

export function roundName(round: string, lang: Lang): string {
  if (lang === 'th') return round;
  const n = round.match(/ครั้งที่\s*(\d+)/)?.[1];
  if (n) return `Round ${n}${round.includes('ตะกอน') ? ' (sediment)' : ''}`;
  if (round.includes('ติดตาม')) return 'Ongoing monitoring';
  return round;
}

const NOTE_EN: Record<string, string> = {
  'ต่ำกว่าขีดจำกัดการตรวจวัด': 'Below the detection limit.',
  'เกินระดับ "อันตรายรุนแรง" (33 มก./กก.) ตามที่ข่าวระบุ': 'Above the "severe hazard" level (33 mg/kg), as stated in the article.',
  'ไม่มีมาตรฐานไทยสำหรับอะลูมิเนียม (ข่าวอ้างอิงเกณฑ์ US EPA โดยไม่ระบุค่า) กรมควบคุมมลพิษระบุให้เฝ้าระวัง':
    'There is no Thai standard for aluminium (the article cites a US EPA guideline without giving a value). The Pollution Control Department says to keep monitoring.',
};
export const noteText = (m: Measurement, lang: Lang) => (m.note ? (lang === 'en' ? NOTE_EN[m.note] ?? m.note : m.note) : undefined);

/** Level comes only from the source: exceedance as stated, watch = no Thai standard but still measurable. */
export function levelOf(m: Measurement): Level {
  if (m.exceedsStandard === true) return 'confirmed';
  if (m.belowDetection) return 'ok';
  if (m.standard == null) return 'watch';
  return 'ok';
}

export const ratioOf = (m: Measurement): number | null => (m.standard && m.standard > 0 ? m.value / m.standard : null);

/** Display buckets for confirmed exceedances (styling only; never used to decide exceedance). */
export type Severity = 'high' | 'elevated' | 'above';
export const severityOf = (ratio: number | null): Severity | null => (ratio == null || ratio <= 1 ? null : ratio >= 3 ? 'high' : ratio >= 1.5 ? 'elevated' : 'above');

export const fmtRatio = (r: number, lang: Lang) => {
  const s = r >= 10 ? r.toFixed(0) : r.toFixed(1);
  return lang === 'th' ? `${s} เท่าของค่ามาตรฐาน` : `${s}× the standard`;
};
export const fmtValue = (v: number) => (v < 0.01 ? String(v) : String(+v.toPrecision(4)));
export const unitLabel = (unit: string, lang: Lang) => (lang === 'th' ? (unit === 'mg/L' ? 'มก./ล.' : 'มก./กก.') : unit);

export function sampledLabel(m: Pick<Measurement, 'sampledFrom' | 'sampledTo'>, lang: Lang): string {
  const a = fmtDate(m.sampledFrom, lang);
  const b = fmtDate(m.sampledTo ?? m.sampledFrom, lang);
  return a === b ? a : `${a} – ${b}`;
}

const key = (m: Measurement) => `${m.station}|${m.substance}|${m.matrix}`;
const newer = (a: Measurement, b: Measurement) => a.sampledFrom.localeCompare(b.sampledFrom) > 0;

/** Latest value per station + substance + matrix. */
export function latest(list: Measurement[] = measurements): Measurement[] {
  const best = new Map<string, Measurement>();
  for (const m of list) {
    const k = key(m);
    const cur = best.get(k);
    if (!cur || newer(m, cur)) best.set(k, m);
  }
  return [...best.values()].sort(sortReadings);
}

const LEVEL_ORDER: Record<Level, number> = { confirmed: 0, watch: 1, ok: 2 };
export function sortReadings(a: Measurement, b: Measurement) {
  return (
    LEVEL_ORDER[levelOf(a)] - LEVEL_ORDER[levelOf(b)] ||
    (a.matrix === b.matrix ? 0 : a.matrix === 'water' ? -1 : 1) ||
    b.sampledFrom.localeCompare(a.sampledFrom) || // newest rounds first, so old rounds never lead
    (ratioOf(b) ?? 0) - (ratioOf(a) ?? 0)
  );
}

export interface RiverSummary {
  river: string;
  matrix: Matrix;
  round: string;
  sampledFrom: string;
  sampledTo: string;
  stations: number;
  exceeding: number; // station readings stated as exceeding in that round
  watch: number;
  substances: Substance[];
  provinces: string[];
  references: Measurement['reference'][];
}

/** Per river and matrix: the most recent round and how many readings in it exceed (as stated). */
export function riverSummaries(list: Measurement[] = measurements): RiverSummary[] {
  const groups = new Map<string, Measurement[]>();
  for (const m of list) {
    const k = `${m.river}|${m.matrix}`;
    groups.set(k, [...(groups.get(k) ?? []), m]);
  }
  const out: RiverSummary[] = [];
  for (const rows of groups.values()) {
    const top = rows.reduce((a, b) => (newer(b, a) ? b : a));
    const inRound = rows.filter((m) => m.round === top.round && m.sampledFrom === top.sampledFrom);
    const refs = new Map(inRound.map((m) => [m.reference.url, m.reference]));
    out.push({
      river: top.river,
      matrix: top.matrix,
      round: top.round,
      sampledFrom: top.sampledFrom,
      sampledTo: top.sampledTo,
      stations: new Set(inRound.map((m) => m.station)).size,
      exceeding: inRound.filter((m) => levelOf(m) === 'confirmed').length,
      watch: inRound.filter((m) => levelOf(m) === 'watch').length,
      substances: [...new Set(inRound.filter((m) => levelOf(m) !== 'ok').map((m) => m.substance))],
      provinces: [...new Set(inRound.map((m) => m.province))],
      references: [...refs.values()],
    });
  }
  return out.sort((a, b) => (a.matrix === b.matrix ? 0 : a.matrix === 'water' ? -1 : 1) || b.sampledFrom.localeCompare(a.sampledFrom));
}

export interface TrendPoint { round: string; sampledFrom: string; value: number; standard: number | null; exceeds: boolean }
/** History across rounds for one station/substance/matrix (oldest first). */
export function history(station: string, substance: Substance = 'arsenic', matrix: Matrix = 'water', list = measurements): TrendPoint[] {
  return list
    .filter((m) => m.station === station && m.substance === substance && m.matrix === matrix)
    .sort((a, b) => a.sampledFrom.localeCompare(b.sampledFrom))
    .map((m) => ({ round: m.round, sampledFrom: m.sampledFrom, value: m.value, standard: m.standard, exceeds: m.exceedsStandard === true }));
}

/** Stations with at least two arsenic water rounds (for trend sparklines). */
export function trendStations(list = measurements) {
  const stations = [...new Set(list.filter((m) => m.substance === 'arsenic' && m.matrix === 'water').map((m) => m.station))];
  return stations
    .map((s) => ({ station: s, river: list.find((m) => m.station === s)!.river, points: history(s, 'arsenic', 'water', list) }))
    .filter((x) => x.points.length >= 2)
    .sort((a, b) => a.river.localeCompare(b.river) || a.station.localeCompare(b.station));
}

export const measurementsByProvince = (slug: string) => measurements.filter((m) => m.province === slug);
export const provincesWithMeasurements = () => [...new Set(measurements.map((m) => m.province))];
export const placeProvince = (m: Measurement, lang: Lang) => provinceName(provinceBySlug(m.province), lang);
export const latestSampled = (list = measurements) => list.reduce((a, m) => (m.sampledTo > a ? m.sampledTo : a), '');
