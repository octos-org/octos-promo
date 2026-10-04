// v6-space pilot — all on-screen text, timing in bars of the music-box track (101.75 BPM, 4/4, grid offset 0.10 s).
export const BPM = 101.75, BEAT = 60 / BPM, BAR = 4 * BEAT, OFF = 0.10, DUR = 66.2;
export const bt = (bar, beat = 0) => OFF + bar * BAR + beat * BEAT;

export const QUOTE = ['地球是人类的摇篮，', '但人类不可能永远生活在摇篮里。'];
export const QUOTE_BY = '康斯坦丁·齐奥尔科夫斯基　1911';
export const TITLE = '摇篮之外';
export const TITLE_EN = 'BEYOND THE CRADLE';

// museum plates in the dawn section: [bar, beat, img, year, zh, en]
export const DAWN = [
  [4, 0, 'sputnik', '1957', '斯普特尼克1号', 'SPUTNIK 1'],
  [5, 0, 'gagarin', '1961', '加加林进入太空', 'YURI GAGARIN'],
  [6, 0, 'tereshkova', '1963', '第一位女航天员', 'VALENTINA TERESHKOVA'],
  [7, 0, 'leonov', '1965', '第一次太空行走', 'ALEXEI LEONOV'],
];
export const MOON_WORDS = ['我们', '选择', '登月'];
export const MOON_DATE = '1969.7.20';
export const MOON_LINE = '人类第一次踏上月球';

export const STATIONS = [
  [12, 0, 'salyut', '1971', '礼炮1号', 'SALYUT 1'],
  [13, 0, 'mir', '1986', '和平号', 'MIR'],
  [14, 0, 'iss', '1998', '国际空间站', 'ISS'],
  [15, 0, 'tiangong', '2021', '天宫', 'TIANGONG'],
];

// launch sites stamped on the map: [beat index from bar 16, name zh, name en, lon, lat]
export const SITES = [
  [0, '拜科努尔', 'BAIKONUR', 63.3, 45.9],
  [1, '卡纳维拉尔角', 'CAPE CANAVERAL', -80.6, 28.5],
  [2, '酒泉', 'JIUQUAN', 100.3, 40.96],
  [3, '库鲁', 'KOUROU', -52.8, 5.2],
  [4, '种子岛', 'TANEGASHIMA', 131.0, 30.4],
  [5, '斯里哈里科塔', 'SRIHARIKOTA', 80.2, 13.7],
  [6, '文昌', 'WENCHANG', 110.95, 19.6],
];
export const MAP_LINE = '航天，是全人类的事业';

// clippings wall: [bar, beat, img, year, caption]
export const CLIPS = [
  [18, 0, 'yang', '2003', '杨利伟 · 神舟五号'],
  [18, 2, 'yutu2', '2019', '嫦娥四号 · 月球背面'],
  [19, 0, 'hayabusa2', '2019', '隼鸟2号 · 小行星龙宫'],
  [19, 1, 'hope', '2020', '希望号 · 阿联酋'],
  [19, 2, 'zhurong', '2021', '祝融号 · 火星'],
  [19, 3, 'jwst', '2022', '韦布望远镜'],
  [20, 0, 'chandrayaan', '2023', '月船三号 · 印度'],
  [20, 1, 'change6', '2024', '嫦娥六号 · 月背取样'],
];

export const TODAY = [
  [21, 0, 'artemis2', '2026.4', '阿耳忒弥斯2号 · 四人绕月'],
  [22, 0, 'lm10b', '2026.7', '长征十号乙 · 海上网接回收'],
];
export const TODAY_BIG = '今天';
export const TODAY_DATE = '2026.9.28';
export const TODAY_LINE = '星舰第一次进入轨道';

export const OUTRO = ['人类不可能永远', '生活在摇篮里。'];
export const OUTRO_SUB = '致敬每一个为航天付出的人';

export function allText() {
  const parts = [QUOTE.join(''), QUOTE_BY, TITLE, MOON_WORDS.join(''), MOON_DATE, MOON_LINE, MAP_LINE, TODAY_BIG, TODAY_DATE, TODAY_LINE, OUTRO.join(''), OUTRO_SUB, '年月日0123456789.·—　，。'];
  for (const a of [DAWN, STATIONS, CLIPS, TODAY]) for (const r of a) parts.push(r.filter((x) => typeof x === 'string').join(''));
  for (const s of SITES) parts.push(s[1]);
  return [...new Set(parts.join(''))].join('');
}
