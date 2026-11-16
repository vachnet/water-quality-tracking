// Generated from src/lib/provinces.ts and src/lib/types.ts — keep in sync.
export const PROVINCE_SLUGS = new Set(["bangkok","krabi","kanchanaburi","kalasin","kamphaeng-phet","khon-kaen","chanthaburi","chachoengsao","chonburi","chainat","chaiyaphum","chumphon","chiang-rai","chiang-mai","trang","trat","tak","nakhon-nayok","nakhon-pathom","nakhon-phanom","nakhon-ratchasima","nakhon-si-thammarat","nakhon-sawan","nonthaburi","narathiwat","nan","bueng-kan","buriram","pathum-thani","prachuap-khiri-khan","prachinburi","pattani","ayutthaya","phayao","phang-nga","phatthalung","phichit","phitsanulok","phetchaburi","phetchabun","phrae","phuket","maha-sarakham","mukdahan","mae-hong-son","yasothon","yala","roi-et","ranong","rayong","ratchaburi","lopburi","lampang","lamphun","loei","si-sa-ket","sakon-nakhon","songkhla","satun","samut-prakan","samut-songkhram","samut-sakhon","sa-kaeo","saraburi","sing-buri","sukhothai","suphan-buri","surat-thani","surin","nong-khai","nong-bua-lamphu","ang-thong","amnat-charoen","udon-thani","uttaradit","uthai-thani","ubon-ratchathani"]);
export const REPORT_TYPE_IDS = new Set(["fish-kill","discoloration","odor","oil-foam","trash","discharge","algae","other"]);

export const REGION = 'asia-southeast1';
export const THAILAND = { minLat: 5.5, maxLat: 20.6, minLng: 97.3, maxLng: 105.7 };

// Spam policy (tunable). Windows are fixed 10-minute buckets per ip_hash.
export const POLICY = {
  windowMs: 10 * 60 * 1000,
  allowedPerWindow: 3,       // 1-3 reports: fine
  riskFrom: 4,               // 4-5 reports: add risk
  throttleAbove: 5,          // >5 reports: temporary throttle (429)
  autoBlockAt: 15,           // attack-like burst: auto-block
  autoBlockHours: 24,
  flagRiskAt: 70,            // risk >= this => status 'flagged' (still public, reviewed afterwards)
  maxBackdateDays: 30,
  maxDescription: 300,
};

export const RETENTION_DAYS = { ipRaw: 30, ipHash: 180, blockAudit: 180 };
