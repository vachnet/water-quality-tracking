import raw from '../data/reports.json';
import type { Report } from './types';

export const generatedAt: string = raw.generatedAt;
export const isDemo: boolean = raw.demo;
export const reports: Report[] = raw.reports as Report[];

export const reportsByProvince = (slug: string) => reports.filter((r) => r.province === slug);

const DAY = 86400000;
export function stats() {
  const now = Date.now();
  const within = (days: number) => reports.filter((r) => now - Date.parse(r.occurredAt) < days * DAY);
  return {
    total: within(30).length,
    last24h: within(1).length,
    last7d: within(7).length,
    provinces: new Set(reports.map((r) => r.province)).size,
    bySource: {
      community: reports.filter((r) => r.source === 'community').length,
      government: reports.filter((r) => r.source === 'government').length,
      news: reports.filter((r) => r.source === 'news').length,
    },
  };
}
