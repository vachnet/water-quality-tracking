import type { Lang } from './i18n';

// Kept here (not imported from i18n) so client scripts using this file do not bundle the dictionary.
const LOCALE: Record<Lang, string> = { th: 'th-TH', en: 'en-GB' };

const TZ = 'Asia/Bangkok';

export function fmtDateTime(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleString(LOCALE[lang], {
    timeZone: TZ, day: 'numeric', month: 'short', year: lang === 'th' ? '2-digit' : 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function fmtDate(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleDateString(LOCALE[lang], { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' });
}

/** Relative time ("3 hours ago") via Intl, same output on server and client. */
export function timeAgo(iso: string, lang: Lang, now = Date.now()): string {
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  const s = Math.round((Date.parse(iso) - now) / 1000);
  const a = Math.abs(s);
  if (a < 60) return rtf.format(0, 'minute');
  if (a < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (a < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  if (a < 86400 * 30) return rtf.format(Math.round(s / 86400), 'day');
  if (a < 86400 * 365) return rtf.format(Math.round(s / (86400 * 30)), 'month');
  return rtf.format(Math.round(s / (86400 * 365)), 'year');
}

/** Buddhist-era year (as stored by PCD) shown per language: "พ.ศ. 2567" / "2024". */
export const beYear = (be: number, lang: Lang) => (lang === 'th' ? `พ.ศ. ${be}` : String(be - 543));
