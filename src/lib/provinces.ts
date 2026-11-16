// Approximate province centroids, used only to suggest a province from GPS (editable by the user).
export interface Province {
  slug: string;
  name: string;
  lat: number;
  lng: number;
}

export const PROVINCES: Province[] = [
  { slug: 'bangkok', name: 'กรุงเทพมหานคร', lat: 13.7563, lng: 100.5018 },
  { slug: 'krabi', name: 'กระบี่', lat: 8.0863, lng: 98.9063 },
  { slug: 'kanchanaburi', name: 'กาญจนบุรี', lat: 14.0228, lng: 99.5328 },
  { slug: 'kalasin', name: 'กาฬสินธุ์', lat: 16.4322, lng: 103.5061 },
  { slug: 'kamphaeng-phet', name: 'กำแพงเพชร', lat: 16.4828, lng: 99.5227 },
  { slug: 'khon-kaen', name: 'ขอนแก่น', lat: 16.4419, lng: 102.836 },
  { slug: 'chanthaburi', name: 'จันทบุรี', lat: 12.6114, lng: 102.1039 },
  { slug: 'chachoengsao', name: 'ฉะเชิงเทรา', lat: 13.6904, lng: 101.0779 },
  { slug: 'chonburi', name: 'ชลบุรี', lat: 13.3611, lng: 100.9847 },
  { slug: 'chainat', name: 'ชัยนาท', lat: 15.1851, lng: 100.1251 },
  { slug: 'chaiyaphum', name: 'ชัยภูมิ', lat: 15.8068, lng: 102.0317 },
  { slug: 'chumphon', name: 'ชุมพร', lat: 10.493, lng: 99.18 },
  { slug: 'chiang-rai', name: 'เชียงราย', lat: 19.9105, lng: 99.8406 },
  { slug: 'chiang-mai', name: 'เชียงใหม่', lat: 18.7883, lng: 98.9853 },
  { slug: 'trang', name: 'ตรัง', lat: 7.5563, lng: 99.6114 },
  { slug: 'trat', name: 'ตราด', lat: 12.2428, lng: 102.5175 },
  { slug: 'tak', name: 'ตาก', lat: 16.884, lng: 99.1259 },
  { slug: 'nakhon-nayok', name: 'นครนายก', lat: 14.2069, lng: 101.2131 },
  { slug: 'nakhon-pathom', name: 'นครปฐม', lat: 13.8199, lng: 100.0443 },
  { slug: 'nakhon-phanom', name: 'นครพนม', lat: 17.392, lng: 104.7695 },
  { slug: 'nakhon-ratchasima', name: 'นครราชสีมา', lat: 14.9799, lng: 102.0978 },
  { slug: 'nakhon-si-thammarat', name: 'นครศรีธรรมราช', lat: 8.4304, lng: 99.9631 },
  { slug: 'nakhon-sawan', name: 'นครสวรรค์', lat: 15.7047, lng: 100.1372 },
  { slug: 'nonthaburi', name: 'นนทบุรี', lat: 13.8621, lng: 100.5144 },
  { slug: 'narathiwat', name: 'นราธิวาส', lat: 6.4254, lng: 101.8253 },
  { slug: 'nan', name: 'น่าน', lat: 18.7756, lng: 100.773 },
  { slug: 'bueng-kan', name: 'บึงกาฬ', lat: 18.3609, lng: 103.6466 },
  { slug: 'buriram', name: 'บุรีรัมย์', lat: 14.993, lng: 103.1029 },
  { slug: 'pathum-thani', name: 'ปทุมธานี', lat: 14.0208, lng: 100.525 },
  { slug: 'prachuap-khiri-khan', name: 'ประจวบคีรีขันธ์', lat: 11.8126, lng: 99.7957 },
  { slug: 'prachinburi', name: 'ปราจีนบุรี', lat: 14.0509, lng: 101.3727 },
  { slug: 'pattani', name: 'ปัตตานี', lat: 6.8693, lng: 101.2505 },
  { slug: 'ayutthaya', name: 'พระนครศรีอยุธยา', lat: 14.3532, lng: 100.5689 },
  { slug: 'phayao', name: 'พะเยา', lat: 19.1665, lng: 99.9019 },
  { slug: 'phang-nga', name: 'พังงา', lat: 8.4501, lng: 98.5255 },
  { slug: 'phatthalung', name: 'พัทลุง', lat: 7.6167, lng: 100.0774 },
  { slug: 'phichit', name: 'พิจิตร', lat: 16.4429, lng: 100.3488 },
  { slug: 'phitsanulok', name: 'พิษณุโลก', lat: 16.8211, lng: 100.2659 },
  { slug: 'phetchaburi', name: 'เพชรบุรี', lat: 13.1119, lng: 99.9392 },
  { slug: 'phetchabun', name: 'เพชรบูรณ์', lat: 16.419, lng: 101.1606 },
  { slug: 'phrae', name: 'แพร่', lat: 18.1446, lng: 100.1403 },
  { slug: 'phuket', name: 'ภูเก็ต', lat: 7.8804, lng: 98.3923 },
  { slug: 'maha-sarakham', name: 'มหาสารคาม', lat: 16.1851, lng: 103.3004 },
  { slug: 'mukdahan', name: 'มุกดาหาร', lat: 16.5453, lng: 104.7235 },
  { slug: 'mae-hong-son', name: 'แม่ฮ่องสอน', lat: 19.302, lng: 97.9654 },
  { slug: 'yasothon', name: 'ยโสธร', lat: 15.7926, lng: 104.1453 },
  { slug: 'yala', name: 'ยะลา', lat: 6.5411, lng: 101.2804 },
  { slug: 'roi-et', name: 'ร้อยเอ็ด', lat: 16.0538, lng: 103.652 },
  { slug: 'ranong', name: 'ระนอง', lat: 9.9529, lng: 98.6085 },
  { slug: 'rayong', name: 'ระยอง', lat: 12.6814, lng: 101.2816 },
  { slug: 'ratchaburi', name: 'ราชบุรี', lat: 13.5283, lng: 99.8134 },
  { slug: 'lopburi', name: 'ลพบุรี', lat: 14.7995, lng: 100.6534 },
  { slug: 'lampang', name: 'ลำปาง', lat: 18.2888, lng: 99.4908 },
  { slug: 'lamphun', name: 'ลำพูน', lat: 18.5745, lng: 99.0087 },
  { slug: 'loei', name: 'เลย', lat: 17.486, lng: 101.7223 },
  { slug: 'si-sa-ket', name: 'ศรีสะเกษ', lat: 15.1186, lng: 104.322 },
  { slug: 'sakon-nakhon', name: 'สกลนคร', lat: 17.1664, lng: 104.1486 },
  { slug: 'songkhla', name: 'สงขลา', lat: 7.1756, lng: 100.6143 },
  { slug: 'satun', name: 'สตูล', lat: 6.6238, lng: 100.0674 },
  { slug: 'samut-prakan', name: 'สมุทรปราการ', lat: 13.5991, lng: 100.5998 },
  { slug: 'samut-songkhram', name: 'สมุทรสงคราม', lat: 13.4098, lng: 100.0023 },
  { slug: 'samut-sakhon', name: 'สมุทรสาคร', lat: 13.5475, lng: 100.274 },
  { slug: 'sa-kaeo', name: 'สระแก้ว', lat: 13.824, lng: 102.0646 },
  { slug: 'saraburi', name: 'สระบุรี', lat: 14.5289, lng: 100.9108 },
  { slug: 'sing-buri', name: 'สิงห์บุรี', lat: 14.8936, lng: 100.402 },
  { slug: 'sukhothai', name: 'สุโขทัย', lat: 17.0056, lng: 99.8264 },
  { slug: 'suphan-buri', name: 'สุพรรณบุรี', lat: 14.4745, lng: 100.1222 },
  { slug: 'surat-thani', name: 'สุราษฎร์ธานี', lat: 9.1382, lng: 99.3217 },
  { slug: 'surin', name: 'สุรินทร์', lat: 14.8818, lng: 103.4936 },
  { slug: 'nong-khai', name: 'หนองคาย', lat: 17.8783, lng: 102.742 },
  { slug: 'nong-bua-lamphu', name: 'หนองบัวลำภู', lat: 17.2042, lng: 102.426 },
  { slug: 'ang-thong', name: 'อ่างทอง', lat: 14.5896, lng: 100.455 },
  { slug: 'amnat-charoen', name: 'อำนาจเจริญ', lat: 15.8656, lng: 104.6258 },
  { slug: 'udon-thani', name: 'อุดรธานี', lat: 17.4138, lng: 102.787 },
  { slug: 'uttaradit', name: 'อุตรดิตถ์', lat: 17.6201, lng: 100.0993 },
  { slug: 'uthai-thani', name: 'อุทัยธานี', lat: 15.3835, lng: 100.0245 },
  { slug: 'ubon-ratchathani', name: 'อุบลราชธานี', lat: 15.2287, lng: 104.8564 },
];

export const provinceBySlug = (slug: string) => PROVINCES.find((p) => p.slug === slug);

export function nearestProvince(lat: number, lng: number): Province {
  let best = PROVINCES[0];
  let bestD = Infinity;
  for (const p of PROVINCES) {
    const d = (p.lat - lat) ** 2 + ((p.lng - lng) * Math.cos((lat * Math.PI) / 180)) ** 2;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}
