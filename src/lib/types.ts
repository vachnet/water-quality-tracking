// Product name lives here only. Everything else (header, footer, titles, JSON-LD, about/privacy) reads it.
export const SITE_NAME = 'Clearwater Watch';
export const SITE_TAGLINE = {
  th: 'แผนที่เฝ้าระวังคุณภาพน้ำของประเทศไทย',
  en: 'Thailand water quality watch map',
} as const;

export interface ReportTypeInfo {
  id: string;
  label: string;
  labelEn: string;
  icon: string;
  color: string;
}

export const REPORT_TYPES: ReportTypeInfo[] = [
  { id: 'fish-kill', label: 'ปลาตาย', labelEn: 'Fish kill', icon: '🐟', color: '#c0392b' },
  { id: 'discoloration', label: 'น้ำเปลี่ยนสี', labelEn: 'Discoloured water', icon: '🎨', color: '#8e44ad' },
  { id: 'odor', label: 'น้ำเน่าเหม็น', labelEn: 'Foul odour', icon: '💨', color: '#a0662a' },
  { id: 'oil-foam', label: 'คราบน้ำมัน / ฟอง', labelEn: 'Oil slick / foam', icon: '🛢️', color: '#2c3e50' },
  { id: 'trash', label: 'ขยะ / สิ่งปฏิกูล', labelEn: 'Trash / waste', icon: '🗑️', color: '#16805a' },
  { id: 'discharge', label: 'ปล่อยน้ำเสียจากท่อ', labelEn: 'Wastewater discharge', icon: '🏭', color: '#d35400' },
  { id: 'algae', label: 'สาหร่ายบาน', labelEn: 'Algal bloom', icon: '🌿', color: '#2e9e44' },
  { id: 'other', label: 'อื่น ๆ', labelEn: 'Other', icon: '❓', color: '#5f6b7a' },
];

// Types that only official sources use; not offered in the public report form.
export const SYSTEM_TYPES: ReportTypeInfo[] = [
  { id: 'wqi-degraded', label: 'คุณภาพน้ำเสื่อมโทรม (ตัวชี้วัดทางการ)', labelEn: 'Degraded water quality (official index)', icon: '📊', color: '#7a4b00' },
];

export const typeById = (id: string): ReportTypeInfo =>
  [...REPORT_TYPES, ...SYSTEM_TYPES].find((t) => t.id === id) ?? REPORT_TYPES[REPORT_TYPES.length - 1];

export type Source = 'community' | 'government' | 'news';
export const SOURCES: Source[] = ['government', 'news', 'community'];

export interface Reference {
  name: string;
  url: string;
  date?: string;
}

export interface Report {
  id: string;
  type: string;
  lat: number;
  lng: number;
  province: string; // slug
  occurredAt: string; // ISO
  description?: string;
  status: 'unverified' | 'flagged' | 'published';
  source: Source;
  title?: string;
  locationPrecision?: 'exact' | 'approximate' | 'province';
  metrics?: Record<string, number | string>;
  references?: Reference[];
}
