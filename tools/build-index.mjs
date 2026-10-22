// 掃 public/motions/*/curves.json，產生 public/motions/index.json（網頁的動作清單），
// 並把每支動作的 JSON 壓成 .json.gz（網頁優先下載 .gz 自己解壓；Tailscale 不會自動壓縮）。
// 用法：node tools/build-index.mjs（Unity 匯出新動作後跑一次）
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

// 清單順序：先照武器（WEAPON_ORDER，通用的表情放最後），同武器照類型（TYPE_ORDER），同類型照名稱裡的姿態、方向、編號
// 類型、姿態、方向的詞見 unity/characters/NAMING.md
const TYPE_ORDER = ['待機', '走路', '小跑', '跑步', '衝刺', '轉身', '快速移位', '閃避', '攻擊', '技能', '射擊', '換彈', '受擊', '暈眩', '倒下', '取出', '收起', '表情'];
const POSTURE_ORDER = ['一般', '架式', '蹲姿', '跪姿', '瞄準', '蹲姿瞄準', '跪姿瞄準'];
const DIR_ORDER = ['前', '後', '左', '右', '左前', '右前', '左後', '右後'];
const WEAPON_ORDER = ['單手劍', '大劍', '武士刀', '雙刀', '雙苦無', '劍盾', '長槍', '手槍', '雙手槍', '步槍', '霰彈槍', '機槍', '火箭筒', '通用'];
const rank = (list, v) => { const i = list.indexOf(v); return i < 0 ? list.length : i; };

const root = new URL('../public/motions/', import.meta.url);
const rootPath = root.pathname.replace(/^\/([A-Za-z]:)/, '$1');
// 中文名、英文名、類型、描述、標籤的來源是 names.json：curves.json 開頭的 label／en／type／description／tags 照它更新（改名不用重新從 Unity 匯出）
const namesFile = join(rootPath, 'names.json');
const names = existsSync(namesFile) ? JSON.parse(readFileSync(namesFile, 'utf8')) : {};
const list = [];
let renamed = 0;
for (const id of readdirSync(root)) {
  const file = join(rootPath, id, 'curves.json');
  if (!existsSync(file)) continue;
  let text = readFileSync(file, 'utf8');
  const n = names[id];
  if (n) {
    const fields = `,"label":${JSON.stringify(n.label)},"en":${JSON.stringify(n.en ?? '')},"type":${JSON.stringify(n.type ?? '')},"description":${JSON.stringify(n.description ?? '')},"tags":${JSON.stringify(n.tags ?? {})}`;
    const patched = text.replace(/,"label":"(?:[^"\\]|\\.)*"(?:,"en":"(?:[^"\\]|\\.)*")?(?:,"type":"(?:[^"\\]|\\.)*")?(?:,"description":"(?:[^"\\]|\\.)*")?(?:,"tags":(?:\[[^\]]*\]|\{[^}]*\}))?/, fields);
    if (patched !== text) { writeFileSync(file, patched, 'utf8'); text = patched; renamed++; }
  }
  const c = JSON.parse(text);
  list.push({
    id: c.id,
    name: c.name,
    label: c.label ?? c.id,
    en: c.en ?? '',
    type: c.type || c.category,
    description: c.description ?? '',
    tags: c.tags ?? {},
    sourceCharacter: c.sourceCharacter,
    weapon: c.weapon,
    category: c.category,
    frameRate: c.frameRate,
    length: c.length,
    frameCount: c.frameCount + 1,
    loop: c.settings.loopTime,
    playbackMode: c.playbackMode,
  });
}
// 名稱「類型・姿態・方向（差異）」或「攻擊 1：特徵」拆出排序用的姿態、方向、編號
function labelKey(m) {
  const seg = m.label.replace(/（.*?）/g, '').split('・');
  const num = +(m.label.match(/^\S+ (\d+)：/)?.[1] ?? 0);
  const post = seg.find((x) => POSTURE_ORDER.includes(x));
  const dir = seg.map((x) => x.replace(/ \d+°$/, '')).find((x) => DIR_ORDER.includes(x));
  return [num, post ? rank(POSTURE_ORDER, post) : -1, dir ? rank(DIR_ORDER, dir) : -1, +(m.label.match(/(\d+)°/)?.[1] ?? 0)];
}
const cmpKey = (a, b) => { const ka = labelKey(a), kb = labelKey(b); for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i]; return 0; };
list.sort((a, b) => rank(WEAPON_ORDER, a.weapon) - rank(WEAPON_ORDER, b.weapon) || a.weapon.localeCompare(b.weapon) || a.sourceCharacter.localeCompare(b.sourceCharacter)
  || rank(TYPE_ORDER, a.type) - rank(TYPE_ORDER, b.type) || cmpKey(a, b) || a.label.localeCompare(b.label, 'zh-Hant') || a.id.localeCompare(b.id));
writeFileSync(new URL('index.json', root), JSON.stringify({ motions: list }, null, 2) + '\n', 'utf8');
console.log(`index.json：${list.length} 支動作（照 names.json 更新名稱 ${renamed} 支）`, list.map((m) => m.id).join(', '));

// .gz 比原檔舊（或沒有）才重壓。Tailscale 提供過的檔案刪不掉但可以覆寫，所以直接寫同一個檔名
// play.json.gz＝angles.json 拿掉 worldPositions（網頁播放用不到，只有 verify 要，佔一半大小），只存 .gz
const dirPath = (u) => u.pathname.replace(/^\/([A-Za-z]:)/, '$1');
let made = 0, before = 0, after = 0;
function compress(src, gz, transform) {
  if (!existsSync(gz) || statSync(gz).mtimeMs < statSync(src).mtimeMs) {
    writeFileSync(gz, gzipSync(transform ? transform(readFileSync(src, 'utf8')) : readFileSync(src), { level: 9 }));
    made++;
  }
  before += statSync(src).size; after += statSync(gz).size;
}
const motionsDir = dirPath(root);
compress(join(motionsDir, 'index.json'), join(motionsDir, 'index.json.gz'));
for (const m of list) {
  for (const n of ['curves', 'angles', 'analysis']) compress(join(motionsDir, m.id, `${n}.json`), join(motionsDir, m.id, `${n}.json.gz`));
  compress(join(motionsDir, m.id, 'angles.json'), join(motionsDir, m.id, 'play.json.gz'), (text) => {
    const a = JSON.parse(text);
    delete a.worldPositions;
    return JSON.stringify(a);
  });
}
// 角色檔（貼圖是 PNG 壓不太動，但網格還能省三成）；劍幾乎都是貼圖，不壓
const modelsDir = dirPath(new URL('../public/models/', import.meta.url));
compress(join(modelsDir, 'AvatarSample_A.vrm'), join(modelsDir, 'AvatarSample_A.vrm.gz'));
console.log(`.gz：重壓 ${made} 個，全部 ${(before / 1048576).toFixed(1)} MB → ${(after / 1048576).toFixed(1)} MB`);
