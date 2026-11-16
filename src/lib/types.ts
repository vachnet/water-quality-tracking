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

export const typeById = (id: string): ReportTypeInfo =>
  REPORT_TYPES.find((t) => t.id === id) ?? REPORT_TYPES[REPORT_TYPES.length - 1];

export interface Report {
  id: string;
  type: string;
  lat: number;
  lng: number;
  province: string; // slug
  occurredAt: string; // ISO
  description?: string;
  status: 'unverified' | 'flagged';
}

export const SITE_NAME = 'น้ำใส ใจรัก';
export const SITE_TAGLINE = 'แผนที่รายงานคุณภาพน้ำโดยประชาชน';
