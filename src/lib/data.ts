import raw from '../data/reports.json';
import type { Report } from './types';

export const generatedAt: string = raw.generatedAt;
export const isDemo: boolean = raw.demo;
export const reports: Report[] = raw.reports as Report[];

export const reportsByProvince = (slug: string) => reports.filter((r) => r.province === slug);

const DAY = 86400000;
export function stats() {
  const now = Date.now();
  return {
    total: reports.length,
    last24h: reports.filter((r) => now - Date.parse(r.occurredAt) < DAY).length,
    last7d: reports.filter((r) => now - Date.parse(r.occurredAt) < 7 * DAY).length,
    provinces: new Set(reports.map((r) => r.province)).size,
  };
}
