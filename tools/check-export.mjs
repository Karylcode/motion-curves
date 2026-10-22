// 檢查匯出結果：每個角色（或 id 開頭）匯出了幾支、Unity 實際播放方式和原檔最多差多少、武器幾把、最後寫入時間。
// 用法：node tools/check-export.mjs [id 開頭…]，例如 node tools/check-export.mjs R_ DK_
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
const root = new URL('../public/motions/', import.meta.url);
const prefixes = process.argv.slice(2);
const groups = new Map();
for (const id of readdirSync(root)) {
  if (prefixes.length && !prefixes.some((p) => id.startsWith(p))) continue;
  const f = new URL(`${id}/curves.json`, root);
  const a = new URL(`${id}/angles.json`, root);
  if (!existsSync(f) || !existsSync(a)) continue;
  const c = JSON.parse(readFileSync(f, 'utf8'));
  const pc = c.playbackCheck ?? {};
  const err = { perCurve: pc.perCurveMaxMm, dense: pc.denseMaxMm, curve: pc.curveMaxMm }[c.playbackMode] ?? NaN;
  const key = c.sourceCharacter;
  if (!groups.has(key)) groups.set(key, { n: 0, worst: 0, worstId: '', modes: {}, weapons: new Set(), newest: 0 });
  const g = groups.get(key);
  g.n++; g.modes[c.playbackMode] = (g.modes[c.playbackMode] ?? 0) + 1;
  if (err > g.worst) { g.worst = err; g.worstId = id; }
  g.newest = Math.max(g.newest, statSync(a).mtimeMs);
  const head = readFileSync(a, 'utf8').slice(-3000000).match(/"weapons":\[(.*?)\],\n"weapon"/s);
  g.weapons.add(head ? (head[1].match(/"name"/g) ?? []).length : 'old');
}
for (const [k, g] of groups) console.log(`${k}：${g.n} 支，播放方式 ${JSON.stringify(g.modes)}，和原檔最多差 ${g.worst} mm（${g.worstId}），武器 ${[...g.weapons].join('/')} 把，最後寫入 ${new Date(g.newest).toLocaleTimeString('zh-TW', { hour12: false })}`);
