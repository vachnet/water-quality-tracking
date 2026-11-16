export interface ReportTypeInfo {
  id: string;
  label: string;
  icon: string;
  color: string;
}

export const REPORT_TYPES: ReportTypeInfo[] = [
  { id: 'fish-kill', label: 'ปลาตาย', icon: '🐟', color: '#c0392b' },
  { id: 'discoloration', label: 'น้ำเปลี่ยนสี', icon: '🎨', color: '#8e44ad' },
  { id: 'odor', label: 'น้ำเน่าเหม็น', icon: '💨', color: '#a0662a' },
  { id: 'oil-foam', label: 'คราบน้ำมัน / ฟอง', icon: '🛢️', color: '#2c3e50' },
  { id: 'trash', label: 'ขยะ / สิ่งปฏิกูล', icon: '🗑️', color: '#16805a' },
  { id: 'discharge', label: 'ปล่อยน้ำเสียจากท่อ', icon: '🏭', color: '#d35400' },
  { id: 'algae', label: 'สาหร่ายบาน', icon: '🌿', color: '#2e9e44' },
  { id: 'other', label: 'อื่น ๆ', icon: '❓', color: '#5f6b7a' },
];

// Types that only official sources use; not offered in the public report form.
export const SYSTEM_TYPES: ReportTypeInfo[] = [
  { id: 'wqi-degraded', label: 'คุณภาพน้ำเสื่อมโทรม (ตัวชี้วัดทางการ)', icon: '📊', color: '#7a4b00' },
];

export const typeById = (id: string): ReportTypeInfo =>
  [...REPORT_TYPES, ...SYSTEM_TYPES].find((t) => t.id === id) ?? REPORT_TYPES[REPORT_TYPES.length - 1];

export type Source = 'community' | 'government' | 'news';
export const SOURCE_LABEL: Record<Source, { label: string; badge: string }> = {
  government: { label: 'ข้อมูลทางการ', badge: '🏛️ ข้อมูลทางการ' },
  news: { label: 'ข่าว', badge: '📰 จากข่าว' },
  community: { label: 'ประชาชนรายงาน', badge: '👥 ประชาชนรายงาน' },
};

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

export const SITE_NAME = 'น้ำใส ใจรัก';
export const SITE_TAGLINE = 'แผนที่รายงานคุณภาพน้ำโดยประชาชน';
