// Unity 曲線的計算與中文名稱。

// Unity 非加權關鍵影格的 Hermite 內插（跟 AnimationCurve.Evaluate 相同）。
// keys: [[time, value, inTangent, outTangent, ...], ...]
export function evaluateCurve(keys, t) {
  if (keys.length === 0) return 0;
  if (t <= keys[0][0]) return keys[0][1];
  const last = keys[keys.length - 1];
  if (t >= last[0]) return last[1];
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
  const [t0, v0, , out0] = keys[i];
  const [t1, v1, in1] = keys[i + 1];
  if (!Number.isFinite(out0) || !Number.isFinite(in1)) return v0;
  const dt = t1 - t0;
  const s = (t - t0) / dt;
  const s2 = s * s;
  const s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * v0 + (s3 - 2 * s2 + s) * out0 * dt + (-2 * s3 + 3 * s2) * v1 + (s3 - s2) * in1 * dt;
}

// JSON 裡的無限大切線存成字串。
export function normalizeKeys(keys) {
  const n = (x) => (x === 'Infinity' ? Infinity : x === '-Infinity' ? -Infinity : x);
  return keys.map((k) => k.map(n));
}

const SIDE = { Left: '左', Right: '右' };
const PART = {
  'Upper Leg': '大腿', 'Lower Leg': '小腿', Foot: '腳掌', Toes: '腳趾',
  Shoulder: '肩膀', Arm: '上臂', Forearm: '前臂', Hand: '手腕',
  Spine: '脊椎', 'Upper Chest': '上胸', UpperChest: '上胸', Chest: '胸口', Neck: '脖子', Head: '頭', Jaw: '下巴', Eye: '眼睛',
};
const MOVE = {
  'Front-Back': '前後', 'Left-Right': '左右', 'Twist Left-Right': '左右扭轉', 'In-Out': '內外', 'Twist In-Out': '扭轉',
  'Down-Up': '上下', 'Up-Down': '上下', Stretch: '伸直', 'Nod Down-Up': '點頭', 'Tilt Left-Right': '歪頭', 'Turn Left-Right': '轉頭', Close: '張合',
};
const FINGER = { Thumb: '拇指', Index: '食指', Middle: '中指', Ring: '無名指', Little: '小指' };

// 肌肉名稱 → { label: 中文, part: 圖表分組, side }
export function describeMuscle(attr) {
  const finger = attr.match(/^(Left|Right)Hand\.(\w+)\.(.+)$/);
  if (finger) {
    const [, side, f, rest] = finger;
    const seg = rest === 'Spread' ? '張開' : rest.replace(/^(\d) Stretched$/, '第$1節彎曲');
    return { label: `${SIDE[side]}${FINGER[f] ?? f} ${seg}`, part: `${SIDE[side]}手${FINGER[f] ?? f}`, side };
  }
  let rest = attr;
  let side = '';
  const m = rest.match(/^(Left|Right) /);
  if (m) {
    side = m[1];
    rest = rest.slice(m[0].length);
  }
  const partKey = Object.keys(PART).sort((a, b) => b.length - a.length).find((p) => rest.startsWith(p + ' '));
  if (!partKey) return { label: attr, part: '其他', side };
  const move = rest.slice(partKey.length + 1);
  const part = (SIDE[side] ?? '') + PART[partKey];
  return { label: `${part} ${MOVE[move] ?? move}`, part, side };
}

// Root／IK 曲線的中文
export function describeOther(attr, group) {
  const axis = attr.split('.').pop();
  if (group === 'body') return { label: attr.startsWith('RootT') ? `身體重心位置 ${axis}` : `身體朝向 ${axis}`, part: attr.startsWith('RootT') ? '身體重心位置' : '身體朝向（四元數）' };
  if (group === 'rootMotion') return { label: attr.startsWith('MotionT') ? `Root 移動 ${axis}` : `Root 轉向 ${axis}`, part: attr.startsWith('MotionT') ? 'Root 移動' : 'Root 轉向（四元數）' };
  const g = attr.match(/^(Left|Right)(Foot|Hand)([TQ])\./);
  if (g) {
    const limb = `${SIDE[g[1]]}${g[2] === 'Foot' ? '腳' : '手'}`;
    return { label: `${limb} IK ${g[3] === 'T' ? '位置' : '旋轉'} ${axis}`, part: `${limb} IK 目標${g[3] === 'T' ? '位置' : '旋轉（四元數）'}` };
  }
  return { label: attr, part: '其他' };
}

// 關節角度（analysis.json 的 jointAngles）的中文、單位、分組
export const JOINT_CHARTS = [
  { title: '膝蓋彎曲', unit: '°', keys: ['kneeFlexL', 'kneeFlexR'], note: '0＝打直，越大越彎' },
  { title: '手肘彎曲', unit: '°', keys: ['elbowFlexL', 'elbowFlexR'], note: '0＝打直，越大越彎' },
  { title: '大腿前後擺', unit: '°', keys: ['hipFlexL', 'hipFlexR'], note: '正＝往前抬，負＝往後' },
  { title: '大腿往外張', unit: '°', keys: ['hipAbdL', 'hipAbdR'], note: '正＝往外，負＝往內' },
  { title: '上臂前後擺', unit: '°', keys: ['shoulderFlexL', 'shoulderFlexR'], note: '正＝往前，負＝往後' },
  { title: '上臂往外張', unit: '°', keys: ['shoulderAbdL', 'shoulderAbdR'], note: '正＝往外抬' },
  { title: '上身傾斜', unit: '°', keys: ['trunkLean', 'trunkSide'], note: '前傾為正／往右傾為正' },
  { title: '骨盆與胸口轉向', unit: '°', keys: ['pelvisYaw', 'chestYaw', 'chestTwist'], note: '正＝往右轉；扭轉＝胸口減骨盆' },
  { title: '骨盆側傾', unit: '°', keys: ['pelvisTilt'], note: '正＝右髖比左髖高' },
  { title: '頭', unit: '°', keys: ['headPitch', 'headYaw'], note: '臉朝下為正／臉朝右為正' },
  { title: '腳離地高度', unit: 'cm', scale: 100, keys: ['footHeightL', 'footHeightR', 'toeHeightL', 'toeHeightR'], note: '0＝踩在地上' },
  { title: '兩腳距離', unit: 'cm', scale: 100, keys: ['stanceWidth', 'stanceStride'], note: '左右寬／前後距（右腳相對左腳）' },
  { title: '手的高度（相對骨盆）', unit: 'cm', scale: 100, keys: ['handHeightL', 'handHeightR'] },
];

export const JOINT_LABEL = {
  kneeFlexL: '左膝彎曲', kneeFlexR: '右膝彎曲', elbowFlexL: '左肘彎曲', elbowFlexR: '右肘彎曲',
  hipFlexL: '左大腿前後', hipFlexR: '右大腿前後', hipAbdL: '左大腿外張', hipAbdR: '右大腿外張',
  shoulderFlexL: '左上臂前後', shoulderFlexR: '右上臂前後', shoulderAbdL: '左上臂外張', shoulderAbdR: '右上臂外張',
  trunkLean: '上身前傾', trunkSide: '上身右傾', pelvisYaw: '骨盆轉向', chestYaw: '胸口轉向', chestTwist: '胸口相對骨盆扭轉',
  pelvisTilt: '骨盆側傾', headPitch: '臉朝下', headYaw: '臉朝右',
  footHeightL: '左腳跟高度', footHeightR: '右腳跟高度', toeHeightL: '左腳尖高度', toeHeightR: '右腳尖高度',
  stanceWidth: '兩腳左右寬', stanceStride: '兩腳前後距', handHeightL: '左手高度', handHeightR: '右手高度',
};

// 線的顏色。關節角度：左＝藍、右＝橘（腳尖用虛線）；同一張圖裡左右都沒有時依序用 PALETTE。
export const PALETTE = ['#60a5fa', '#fb923c', '#4ade80', '#c084fc', '#22d3ee', '#f472b6'];   // 深色底用的亮色
export function jointSeriesStyle(keys) {
  let o = 2;
  return keys.map((k) => {
    const dash = /^toe/.test(k);
    if (/L$/.test(k)) return { color: PALETTE[0], dash };
    if (/R$/.test(k)) return { color: PALETTE[1], dash };
    return { color: PALETTE[o++ % PALETTE.length], dash: false };
  });
}
