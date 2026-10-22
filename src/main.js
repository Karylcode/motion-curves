import './style.css';
import { Viewer, VIEW_NAMES } from './viewer.js';
import { LineChart } from './charts.js';
import { evaluateCurve, normalizeKeys, describeMuscle, describeOther, JOINT_CHARTS, JOINT_LABEL, PALETTE, jointSeriesStyle } from './curves.js';
import { importFile } from './importer.js';
import { computeAnalysis } from './analysis.js';
import * as store from './store.js';

const $ = (s) => document.querySelector(s);
// motions＝清單（伺服器 index.json＋這台瀏覽器匯入的）；local＝瀏覽器匯入的動作 id → { curves, angles }
const state = { motions: [], serverMotions: [], local: new Map(), id: null, data: null, time: 0, playing: true, speed: 1, tab: 'joints', charts: {}, lastShownFrame: -1 };
const DEFAULT_VRM = 'models/AvatarSample_A.vrm';
let viewer;

// 每次跟伺服器確認（cache: no-cache）：重新匯出的動作不會讀到舊檔。
// 動作數據有先壓好的 .gz（build-index.mjs 產生），Tailscale 不會自動壓縮，下載 .gz 自己解壓只要 1/4～1/5 的流量
async function loadJSON(url) {
  if (typeof DecompressionStream !== 'undefined' && url.startsWith('motions/')) {
    const gz = await fetch(`${url}.gz`, { cache: 'no-cache' }).catch(() => null);
    if (gz?.ok && !/text\/html/.test(gz.headers.get('content-type') ?? '')) {  // Vite 開發伺服器找不到檔案時會回 index.html（200），不能當成 .gz
      if (/gzip/.test(gz.headers.get('content-encoding') ?? '')) return gz.json();  // 伺服器自己標了 gzip，瀏覽器已經解開
      return new Response(gz.body.pipeThrough(new DecompressionStream('gzip'))).json();
    }
  }
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`讀不到 ${url}（${r.status}）`);
  return r.json();
}

// ---------- 取值 ----------
const fps = () => state.data.angles.frameRate;
const frameCount = () => state.data.angles.frameCount;
function sampleArray(arr, f, scale = 1) {
  const last = arr.length - 1;
  const x = Math.max(0, Math.min(last, f));
  const i = Math.floor(x);
  const j = Math.min(i + 1, last);
  const a = arr[i];
  const b = arr[j];
  if (a == null || b == null) return NaN;
  return (a + (b - a) * (x - i)) * scale;
}
function curveByAttr(attr) {
  return state.data.curves.curves.find((c) => c.attribute === attr);
}
// Unity 曲線在某格（可小數）的值，照 Unity 實際播放的方式（每條曲線的 playback，舊檔案用整支的 playbackMode）：
// dense＝每格一個值、格與格之間直線；curve＝照關鍵影格和切線
function curveValue(c, frame) {
  if ((c.playback ?? state.data.curves.playbackMode) === 'dense' && c.frameValues) return sampleArray(c.frameValues, frame);
  return evaluateCurve(c.keys, frame / fps());
}
// 任何一條數據（關節角度 key、肌肉名、Unity 曲線名）在某格的值
function valueOf(name, frame) {
  const { analysis } = state.data;
  if (analysis.jointAngles[name]) return sampleArray(analysis.jointAngles[name], frame);
  const c = curveByAttr(name);
  if (c) return curveValue(c, frame);
  return NaN;
}
// 目前播到第幾遍（loop）的第幾格（frame，可小數）
function playhead() {
  const last = frameCount() - 1;
  const len = last / fps();
  let loop = Math.floor(state.time / len);
  let frame = (state.time - loop * len) * fps();
  // 停在某一遍的終點（拉到最後一格、setFrame(最後一格)）時算成那一遍的最後一格，不要繞回下一遍的第 0 格
  if (!state.playing && loop > 0 && frame === 0) { loop -= 1; frame = last; }
  return { frame, loop };
}
function currentFrame() {
  return playhead().frame;
}

// ---------- 圖表 ----------
const MUSCLE_ORDER = ['脊椎', '胸口', '上胸', '脖子', '頭', '左眼睛', '右眼睛', '下巴',
  '左肩膀', '左上臂', '左前臂', '左手腕', '右肩膀', '右上臂', '右前臂', '右手腕',
  '左大腿', '左小腿', '左腳掌', '左腳趾', '右大腿', '右小腿', '右腳掌', '右腳趾'];

function buildPane(tab) {
  const pane = document.createElement('div');
  pane.className = 'pane';
  pane.dataset.tab = tab;
  const charts = [];
  const add = (opts) => { const c = new LineChart({ frameCount: frameCount(), frameRate: fps(), onSeek: seek, ...opts }); pane.append(c.el); charts.push(c); };
  const { analysis, curves } = state.data;

  if (tab === 'joints') {
    pane.innerHTML = `<p class="hint">套到你角色上量出來的關節角度（原地，不含 Root 移動）。左＝藍、右＝橘，腳尖是虛線；圖下方的色條是左右腳踩地的格數。點圖可以跳到那一格。</p>`;
    for (const def of JOINT_CHARTS) {
      const styles = jointSeriesStyle(def.keys);
      add({
        title: def.title, note: def.note, unit: def.unit, decimals: 1, contacts: analysis.footContacts,
        series: def.keys.map((k, i) => ({ id: k, label: `${JOINT_LABEL[k]}<small>${k}</small>`, ...styles[i], sample: (f) => sampleArray(analysis.jointAngles[k], f, def.scale ?? 1) })),
      });
    }
  }

  if (tab === 'muscles' || tab === 'unity') {
    const howDrawn = '線是 Unity 實際播放的值。Unity 每條曲線各自決定怎麼播：名稱後面標「每格值」的是每格一個值、格與格之間直線（不是動畫視窗那條平滑曲線），其他的照關鍵影格和切線，跟動畫視窗一樣。圓點是動畫視窗裡關鍵影格的位置。';
    pane.innerHTML = tab === 'muscles'
      ? `<p class="hint">Unity 動畫曲線裡的 Humanoid 肌肉值（-1～1，關節可轉範圍的比例）。${howDrawn}</p>`
      : `<p class="hint">Unity 動畫曲線裡的身體重心、Root 移動、手腳 IK 目標。原版 Foot IK 是關的，IK 目標不影響姿勢，只是一起存起來。${howDrawn}</p>`;
    const groups = new Map();
    for (const c of curves.curves) {
      const isMuscle = c.group === 'muscle' || c.group === 'fingerMuscle';
      if ((tab === 'muscles') !== isMuscle) continue;
      const d = isMuscle ? describeMuscle(c.attribute) : describeOther(c.attribute, c.group);
      if (!groups.has(d.part)) groups.set(d.part, []);
      groups.get(d.part).push({ c, d });
    }
    const order = [...groups.keys()].sort((a, b) => {
      const ia = MUSCLE_ORDER.indexOf(a); const ib = MUSCLE_ORDER.indexOf(b);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    });
    for (const part of order) {
      const items = groups.get(part);
      add({
        title: part, unit: '', decimals: 3,
        contacts: tab === 'muscles' && /腿|腳/.test(part) ? analysis.footContacts : undefined,
        series: items.map(({ c, d }, i) => ({
          id: c.attribute,
          label: `${d.label.replace(part, '').trim() || d.label}<small>${c.attribute}${(c.playback ?? curves.playbackMode) === 'dense' ? '・每格值' : ''}</small>`,
          color: PALETTE[i % PALETTE.length],
          sample: (f) => curveValue(c, f),
          keyFrames: c.keys.map((k) => k[0] * fps()),
        })),
      });
    }
  }

  if (tab === 'data') buildDataPane(pane);
  $('#panes').append(pane);
  state.charts[tab] = { pane, charts };
  for (const c of charts) c.layout();
}

function buildDataPane(pane) {
  const { curves, analysis } = state.data;
  const base = `motions/${state.id}/`;
  const local = state.local.has(state.id);
  pane.classList.add('data');
  pane.innerHTML = `
    <h3>檔案</h3>
    <p class="downloads">${local
      ? `<a href="#" data-dl="curves">curves.json（網頁匯入的沒有 Unity 曲線，只有基本資訊）</a>
      <a href="#" data-dl="angles">angles.json（每格骨頭旋轉）</a>
      <a href="#" data-dl="analysis">analysis.json（關節角度、腳踩地）</a>`
      : `<a href="${base}curves.json" target="_blank">curves.json（Unity 原生曲線，可在 Unity 還原）</a>
      <a href="${base}angles.json" target="_blank">angles.json（每格骨頭旋轉）</a>
      <a href="${base}analysis.json" target="_blank">analysis.json（關節角度、腳踩地、肌肉逐格值）</a>`}
      <a href="#" id="csv">下載 CSV（關節角度＋肌肉逐格值）</a>
    </p>
    <h3 id="nowTitle">目前這一格</h3>
    <table id="nowTable"></table>
    <h3>整支動作的範圍（關節角度）</h3>
    <table id="sumTable"></table>
    <h3>腳踩地</h3>
    <p>左腳：${analysis.footContacts.left.map(([a, b]) => `${a}～${b} 格`).join('、') || '無'}；右腳：${analysis.footContacts.right.map(([a, b]) => `${a}～${b} 格`).join('、') || '無'}（${analysis.footContacts.rule}）</p>
    <h3>給 AI：程式介面</h3>
    <pre>${window.motionCurves.help()}</pre>`;
  const rows = Object.keys(analysis.jointAngles).map((k) => {
    const s = summarize(analysis.jointAngles[k]);
    const scale = /Height|stance/.test(k) ? 100 : 1;
    const u = scale === 100 ? 'cm' : '°';
    return `<tr><td>${JOINT_LABEL[k]}</td><td>${k}</td><td>${(s.min * scale).toFixed(1)} ${u}（第 ${s.minFrame} 格）</td><td>${(s.max * scale).toFixed(1)} ${u}（第 ${s.maxFrame} 格）</td><td>${(s.mean * scale).toFixed(1)} ${u}</td></tr>`;
  });
  pane.querySelector('#sumTable').innerHTML = `<tr><th>項目</th><th>key</th><th>最小</th><th>最大</th><th>平均</th></tr>${rows.join('')}`;
  pane.querySelector('#csv').addEventListener('click', (e) => { e.preventDefault(); downloadCSV(); });
  for (const a of pane.querySelectorAll('[data-dl]')) a.addEventListener('click', (e) => { e.preventDefault(); downloadBlob(JSON.stringify(state.data[a.dataset.dl]), `${state.id}_${a.dataset.dl}.json`, 'application/json'); });
  void curves;
}

function updateDataPane(frame) {
  const pane = state.charts.data?.pane;
  if (!pane || state.tab !== 'data') return;
  const f = Math.round(frame);
  if (f === state.lastShownFrame) return;
  state.lastShownFrame = f;
  const { analysis } = state.data;
  pane.querySelector('#nowTitle').textContent = `目前這一格：第 ${f} 格（${(f / fps()).toFixed(3)} 秒）`;
  const joint = Object.keys(analysis.jointAngles).map((k) => {
    const scale = /Height|stance/.test(k) ? 100 : 1;
    const v = analysis.jointAngles[k][f];
    return `<tr><td>${JOINT_LABEL[k]}</td><td>${k}</td><td>${v == null ? '–' : (v * scale).toFixed(1) + (scale === 100 ? ' cm' : '°')}</td></tr>`;
  });
  const muscles = Object.entries(analysis.muscles).map(([k, arr]) => `<tr><td>${describeMuscle(k).label}</td><td>${k}</td><td>${arr[f].toFixed(4)}</td></tr>`);
  pane.querySelector('#nowTable').innerHTML = `<tr><th>項目</th><th>key</th><th>值</th></tr>${joint.join('')}${muscles.join('')}`;
}

function summarize(arr) {
  let min = Infinity, max = -Infinity, minFrame = 0, maxFrame = 0, sum = 0, n = 0;
  arr.forEach((v, i) => {
    if (v == null) return;
    if (v < min) { min = v; minFrame = i; }
    if (v > max) { max = v; maxFrame = i; }
    sum += v; n++;
  });
  return { min, minFrame, max, maxFrame, mean: sum / n };
}

function downloadCSV() {
  const { analysis } = state.data;
  const jk = Object.keys(analysis.jointAngles);
  const mk = Object.keys(analysis.muscles);
  const lines = [['frame', 'time', ...jk, ...mk].join(',')];
  for (let f = 0; f < frameCount(); f++) {
    lines.push([f, (f / fps()).toFixed(4), ...jk.map((k) => analysis.jointAngles[k][f] ?? ''), ...mk.map((k) => analysis.muscles[k][f])].join(','));
  }
  downloadBlob('﻿' + lines.join('\n'), `${state.id}.csv`, 'text/csv');
}

function downloadBlob(text, name, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- 播放 ----------
function seek(frame) {
  state.playing = false;
  $('#play').textContent = '播放';
  state.time = frame / fps();
  render(0);
}

function showTab(tab) {
  state.tab = tab;
  if (!state.charts[tab]) buildPane(tab);
  for (const [t, v] of Object.entries(state.charts)) v.pane.classList.toggle('on', t === tab);
  for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('on', b.dataset.tab === tab);
  for (const c of state.charts[tab].charts) c.layout();
  state.lastShownFrame = -1;
}

// 一支動作網頁要用的三個檔。play.json＝angles.json 拿掉 worldPositions（只有 verify 用得到，佔一半大小），
// 只有 .gz（build-index.mjs 產生）；沒有的話讀完整的 angles.json
function fetchMotion(id) {
  // 瀏覽器匯入的：關節角度、腳踩地在網頁上用現在的角色量（Unity 匯出的是匯出時在 Unity 量好的）
  if (state.local.has(id)) {
    const { curves, angles } = state.local.get(id);
    return Promise.resolve([structuredClone(curves), angles, computeAnalysis(viewer.vrm, angles, viewer.hipsRest / angles.hipsRestHeight)]);
  }
  const base = `motions/${id}/`;
  return Promise.all([loadJSON(base + 'curves.json'), loadJSON(base + 'play.json').catch(() => loadJSON(base + 'angles.json')), loadJSON(base + 'analysis.json')]);
}

async function selectMotion(id, preloaded) {
  state.loadingId = id;
  const m = state.motions.find((x) => x.id === id);
  $('#pickLabel').textContent = m?.label ?? id;
  $('#pickId').textContent = id;
  $('#info').textContent = `載入中：${m?.label ?? id}…`;
  state.loading = preloaded ?? fetchMotion(id);
  let curves, angles, analysis;
  try { [curves, angles, analysis] = await state.loading; } finally { state.loading = null; }
  if (state.loadingId !== id) return;  // 載入時又選了別支，以最後選的為準
  for (const c of curves.curves) c.keys = normalizeKeys(c.keys);
  state.id = id;
  state.data = { curves, angles, analysis };
  state.time = 0;
  for (const v of Object.values(state.charts)) v.pane.remove();
  state.charts = {};
  viewer.setMotion(angles);
  await viewer.loadWeapons(angles.weapons ?? (angles.weapon ? [angles.weapon] : []));
  $('#scrub').max = String(angles.frameCount - 1);
  // 網頁匯入的沒有 Unity 曲線：兩個 Unity 分頁關掉
  const noUnity = !curves.curves.length;
  for (const b of document.querySelectorAll('#tabs button[data-tab="muscles"], #tabs button[data-tab="unity"]')) { b.disabled = noUnity; b.title = noUnity ? '網頁匯入的動作沒有 Unity 曲線' : ''; }
  if (noUnity && (state.tab === 'muscles' || state.tab === 'unity')) state.tab = 'joints';
  const nDense = curves.curves.filter((c) => (c.playback ?? curves.playbackMode) === 'dense').length;
  history.replaceState(null, '', `#${id}`);
  showDescription(curves);
  $('#info').textContent = noUnity
    ? `網頁匯入｜${curves.sourceFile}｜${curves.frameRate} fps｜${angles.frameCount} 格（0～${angles.frameCount - 1}）｜${curves.length.toFixed(3)} 秒｜${curves.settings.loopTime ? '循環' : '不循環'}（頭尾姿勢一樣就當循環）`
    : `來源 ${curves.sourceCharacter}｜${curves.weapon}｜${curves.type || curves.category}｜${curves.frameRate} fps｜${angles.frameCount} 格（0～${angles.frameCount - 1}）｜${curves.length.toFixed(3)} 秒｜${curves.settings.loopTime ? '循環' : '不循環'}｜Foot IK ${angles.footIK ? '開' : '關'}｜Unity 播放方式：每格值＋直線 ${nDense} 條、照曲線 ${curves.curves.length - nDense} 條｜角色 ${angles.character}${Math.abs(viewer.hipsScale - 1) > 1e-4 ? '（關節角度是在 AvatarSample_A 上量的）' : ''}`;
  showTab(state.tab);
}

// 動作選單下面那一列：名稱、英文 Animator 狀態名、描述、四欄標籤（來源是 public/motions/names.json）
function showDescription(curves) {
  const el = $('#desc');
  el.replaceChildren();
  const b = document.createElement('b');
  b.textContent = curves.label ?? state.id;
  el.append(b);
  if (curves.en) {
    const c = document.createElement('code');
    c.textContent = curves.en;
    c.title = '英文 Animator 狀態名';
    el.append(c);
  }
  el.append(document.createTextNode(curves.description ? `　${curves.description}` : ''));
  const tags = curves.tags ?? [];
  for (const t of Array.isArray(tags) ? tags : ['姿勢', '位移', '播放', '手'].filter((k) => tags[k]).map((k) => `${k} ${tags[k]}`)) {
    const s = document.createElement('span');
    s.className = 'tag';
    s.textContent = t;
    el.append(s);
  }
  if (state.local.has(state.id)) {
    const id = state.id;
    el.append(button(curves.settings.loopTime ? '改成單次' : '改成循環', '頭尾姿勢一樣就自動當成循環，猜錯可以改', () => toggleLocalLoop(id)));
    if (import.meta.env.DEV) el.append(button('存成檔案', '存進 public/motions（本機開發伺服器才有），之後跟 Unity 匯出的動作放一起', () => saveLocalToFiles(id)));
    el.append(button('刪除', '從這台瀏覽器刪掉這支匯入的動作', () => removeLocal(id)));
  }
}

function button(text, title, onClick) {
  const b = document.createElement('button');
  b.textContent = text;
  b.title = title;
  b.addEventListener('click', onClick);
  return b;
}

// ---------- 動作選單：名稱＋淡色 id，上方篩選（武器、類型、四欄標籤）和搜尋 ----------
const FILTERS = [
  { key: 'weapon', label: '武器', get: (m) => m.weapon },
  { key: 'type', label: '類型', get: (m) => m.type },
  { key: '姿勢', label: '姿勢', get: (m) => m.tags?.['姿勢'], order: ['站姿', '半蹲', '深蹲', '跪姿', '倒地'] },
  { key: '位移', label: '位移', get: (m) => m.tags?.['位移'], order: ['原地', '前', '後', '左', '右', '左前', '右前', '左後', '右後'] },
  { key: '播放', label: '播放', get: (m) => m.tags?.['播放'], order: ['循環', '單次'] },
  { key: '手', label: '手', get: (m) => m.tags?.['手'], order: ['單手', '雙手', '左右各持', '空手'] },
];
const picker = { filter: {}, query: '', shown: [], active: -1 };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function initPicker() {
  try {  // 篩選條件記在這台瀏覽器（只是方便，讀不到就用預設）
    const saved = JSON.parse(localStorage.getItem('motionPicker') ?? '{}');
    picker.filter = saved.filter ?? {};
    picker.query = saved.query ?? '';
  } catch { /* 用預設 */ }
  const box = $('#filters');
  buildFilters();
  box.insertAdjacentHTML('beforeend', '<button id="pickClear">清除</button><span id="pickCount" class="count"></span>');
  $('#pickSearch').value = picker.query;

  const changed = () => {
    try { localStorage.setItem('motionPicker', JSON.stringify({ filter: picker.filter, query: picker.query })); } catch { /* 不記 */ }
    renderPickList();
  };
  box.addEventListener('change', (e) => {
    const k = e.target.dataset?.key;
    if (!k) return;
    if (e.target.value) picker.filter[k] = e.target.value; else delete picker.filter[k];
    changed();
  });
  $('#pickSearch').addEventListener('input', (e) => { picker.query = e.target.value; changed(); });
  $('#pickClear').addEventListener('click', () => {
    picker.filter = {}; picker.query = '';
    $('#pickSearch').value = '';
    for (const s of box.querySelectorAll('select')) s.value = '';
    changed();
  });
  $('#pickBtn').addEventListener('click', () => ($('#pickPanel').hidden ? openPicker() : closePicker()));
  document.addEventListener('mousedown', (e) => { if (!$('#picker').contains(e.target)) closePicker(); });
  $('#pickList').addEventListener('click', (e) => {
    const o = e.target.closest('.opt');
    if (o) choose(picker.shown[+o.dataset.i].id);
  });
  $('#pickPanel').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closePicker(); $('#pickBtn').focus(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const n = picker.shown.length;
      if (n) { picker.active = (picker.active + (e.key === 'ArrowDown' ? 1 : -1) + n) % n; highlight(); }
    }
    if (e.key === 'Enter' && e.target.tagName !== 'SELECT' && picker.shown[picker.active]) choose(picker.shown[picker.active].id);
  });
}

// 篩選選單的選項照目前的清單重建（每個值後面是支數）
function buildFilters() {
  for (const l of $('#filters').querySelectorAll('label')) l.remove();
  const anchor = $('#pickClear');
  for (const f of FILTERS) {
    const count = new Map();
    for (const m of state.motions) { const v = f.get(m); if (v) count.set(v, (count.get(v) ?? 0) + 1); }
    const values = [...count.keys()];
    if (f.order) values.sort((a, b) => f.order.indexOf(a) - f.order.indexOf(b));
    if (picker.filter[f.key] && !count.has(picker.filter[f.key])) delete picker.filter[f.key];
    const label = document.createElement('label');
    label.innerHTML = `${f.label} <select data-key="${f.key}"><option value="">全部</option>${values.map((v) => `<option value="${esc(v)}">${esc(v)}（${count.get(v)}）</option>`).join('')}</select>`;
    label.querySelector('select').value = picker.filter[f.key] ?? '';
    $('#filters').insertBefore(label, anchor);
  }
}

function matches(m) {
  for (const f of FILTERS) { const v = picker.filter[f.key]; if (v && f.get(m) !== v) return false; }
  const words = picker.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = [m.label, m.en, m.id, m.description, m.weapon, m.sourceCharacter, m.type, ...Object.values(m.tags ?? {})].join(' ').toLowerCase();
  return words.every((w) => hay.includes(w));
}

function renderPickList() {
  picker.shown = state.motions.filter(matches);
  const parts = [];
  let group = null;
  picker.shown.forEach((m, i) => {
    const g = `${m.weapon}（${m.sourceCharacter}）`;
    if (g !== group) { group = g; parts.push(`<div class="grp">${esc(g)}</div>`); }
    parts.push(`<div class="opt${m.id === state.id ? ' cur' : ''}" role="option" data-i="${i}" title="${esc(m.description)}"><span>${esc(m.label)}</span><small>${esc(m.id)}</small></div>`);
  });
  $('#pickList').innerHTML = parts.join('') || '<p class="empty">沒有符合的動作</p>';
  $('#pickCount').textContent = `${picker.shown.length} / ${state.motions.length} 支`;
  picker.active = picker.shown.findIndex((m) => m.id === state.id);
  highlight();
}

function highlight() {
  for (const o of $('#pickList').querySelectorAll('.opt.active')) o.classList.remove('active');
  const el = $('#pickList').querySelector(`.opt[data-i="${picker.active}"]`);
  if (el) { el.classList.add('active'); el.scrollIntoView({ block: 'nearest' }); }
}

function openPicker() {
  $('#pickPanel').hidden = false;
  renderPickList();
  $('#pickSearch').focus();
}
function closePicker() { $('#pickPanel').hidden = true; }
function choose(id) {
  closePicker();
  if (id !== state.id) selectMotion(id);
}

function render(dt) {
  if (!state.data) return;
  if (state.playing) state.time += dt * state.speed;
  const { frame, loop: loopIndex } = playhead();
  viewer.setFrame(frame, loopIndex);
  for (const c of state.charts[state.tab]?.charts ?? []) c.setFrame(frame);
  $('#scrub').value = String(frame);
  $('#frameLabel').textContent = `第 ${frame.toFixed(1)} 格｜${(frame / fps()).toFixed(3)} 秒`;
  updateDataPane(frame);
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  render(dt);
  viewer.update(dt);
  requestAnimationFrame(loop);
}

// ---------- 給 AI 的介面 ----------
window.motionCurves = {
  help: () => [
    'window.motionCurves（在瀏覽器裡呼叫）：',
    '  motions()            動作清單',
    '  current()            目前動作、格數、時間、是否播放',
    '  select(id)           換動作（回傳 Promise）',
    '  setFrame(n) / play() / pause()',
    '  names()              所有數據名稱：jointAngles（關節角度）、muscles（肌肉）、unityCurves（Unity 曲線全部 137 條）',
    '  series(name)         某條數據每一格的值（陣列，index＝格數）',
    '  value(name, frame?)  某條數據在某格的值（frame 可以是小數；省略＝目前這一格）',
    '  table(frame?)        某一格所有關節角度＋肌肉值',
    '  summary()            每條關節角度、肌肉的最小／最大值和出現的格數、平均',
    '  keys(attr)           某條 Unity 曲線的關鍵影格 [時間, 值, 入切線, 出切線, 入權重, 出權重, 權重模式, 左切線模式, 右切線模式, 斷開]',
    '  conventions()        角度正負號、單位的定義',
    '  data()               三個原始 JSON（curves、angles、analysis）。angles 一開始沒有 worldPositions（省流量），跑過 verify() 才有，或直接讀 angles.json',
    '  verify()             自我檢查（回傳 Promise）：網頁算出的骨頭位置 vs Unity（mm），以及網頁的曲線內插 vs Unity 取樣',
    '  pose(frame?)         某一格（可小數）每根骨頭的世界位置 [x,y,z] 和旋轉四元數 [x,y,z,w]',
    '  snapshot()           3D 畫面截圖（PNG data URL）',
    '  importFiles(files)   匯入動作（.vrma、.fbx）或換角色（.vrm），files 是 File 陣列（回傳 Promise）',
    '',
    '單位：角度＝度；高度、距離＝公尺（網頁圖表換成 cm）；肌肉值＝-1～1。',
    '座標：glTF／three.js 右手座標，+Y 朝上，角色面向 +Z。',
  ].join('\n'),
  motions: () => state.motions,
  current: () => ({ id: state.id, label: state.data.curves.label, description: state.data.curves.description, tags: state.data.curves.tags, frame: +currentFrame().toFixed(3), time: +(currentFrame() / fps()).toFixed(4), playing: state.playing, frameCount: frameCount(), frameRate: fps() }),
  select: async (id) => { await selectMotion(id); return window.motionCurves.current(); },
  setFrame: (n) => { seek(n); return window.motionCurves.current(); },
  play: () => { state.playing = true; $('#play').textContent = '暫停'; },
  pause: () => { state.playing = false; $('#play').textContent = '播放'; },
  names: () => ({ jointAngles: Object.keys(state.data.analysis.jointAngles), muscles: Object.keys(state.data.analysis.muscles), unityCurves: state.data.curves.curves.map((c) => c.attribute) }),
  series: (name) => {
    const { analysis } = state.data;
    if (analysis.jointAngles[name]) return analysis.jointAngles[name].slice();
    if (analysis.muscles[name]) return analysis.muscles[name].slice();
    if (curveByAttr(name)) return Array.from({ length: frameCount() }, (_, f) => +valueOf(name, f).toFixed(6));
    throw new Error(`沒有這條數據：${name}（用 names() 查）`);
  },
  value: (name, frame = currentFrame()) => valueOf(name, frame),
  table: (frame = Math.round(currentFrame())) => {
    const { analysis } = state.data;
    const f = Math.round(frame);
    return {
      frame: f,
      jointAngles: Object.fromEntries(Object.keys(analysis.jointAngles).map((k) => [k, analysis.jointAngles[k][f]])),
      muscles: Object.fromEntries(Object.keys(analysis.muscles).map((k) => [k, analysis.muscles[k][f]])),
    };
  },
  summary: () => {
    const { analysis } = state.data;
    const out = {};
    for (const [k, arr] of [...Object.entries(analysis.jointAngles), ...Object.entries(analysis.muscles)]) out[k] = summarize(arr);
    return out;
  },
  keys: (attr) => curveByAttr(attr)?.keys,
  conventions: () => ({ ...state.data.analysis.conventions, footContacts: state.data.analysis.footContacts.rule, coordinate: state.data.angles.coordinate }),
  data: () => state.data,
  verify: async () => {
    if (state.local.has(state.id)) return { note: '網頁匯入的動作沒有 Unity 取樣可以比' };
    if (!state.data.angles.worldPositions) state.data.angles.worldPositions = (await loadJSON(`motions/${state.id}/angles.json`)).worldPositions;
    const pose = viewer.verify();
    let maxCurve = 0;
    let worst = '';
    for (const [k, arr] of Object.entries(state.data.analysis.muscles)) {
      arr.forEach((v, f) => {
        const d = Math.abs(valueOf(k, f) - v);
        if (d > maxCurve) { maxCurve = d; worst = `${k} 第 ${f} 格`; }
      });
    }
    render(0);
    const pc = state.data.curves.playbackCheck;
    return {
      pose,
      curveEval: { maxDiff: +maxCurve.toExponential(2), worst, note: 'analysis.json 的肌肉值存到小數 4 位，差 < 0.00005 就是一樣' },
      unityPlayback: pc ? { mode: state.data.curves.playbackMode, ...pc } : null,
    };
  },
  pose: (frame = currentFrame()) => { const r = viewer.rawPose(frame); render(0); return r; },
  snapshot: () => viewer.snapshot(),
  importFiles: (files) => importFiles([...files]),
};

// ---------- 啟動 ----------
// Tailscale 提供檔案時沒有快取設定，瀏覽器可能一直用舊的網頁。打開時跟伺服器確認一次，
// 網頁程式換了就重新載入（同一個版本只重載一次，避免一直重載）
async function reloadIfOutdated() {
  if (import.meta.env.DEV) return;
  try {
    const src = document.querySelector('script[type=module][src]')?.getAttribute('src');
    const html = await fetch(location.pathname, { cache: 'no-cache' }).then((r) => r.text());
    const latest = html.match(/<script type="module"[^>]*src="([^"]+)"/)?.[1];
    if (!src || !latest || latest === src || sessionStorage.getItem('reloadedFor') === latest) return;
    sessionStorage.setItem('reloadedFor', latest);
    location.reload();
  } catch { /* 確認不了就照現在的版本跑 */ }
}

async function init() {
  reloadIfOutdated();
  viewer = new Viewer($('#viewer'));
  for (const v of VIEW_NAMES) {
    const b = document.createElement('button');
    b.textContent = v.label;
    b.addEventListener('click', () => viewer.setView(v.id));
    $('#views').append(b);
  }
  // 動作清單：伺服器的 index.json（Unity 匯出的；公開版沒有）＋這台瀏覽器匯入的
  state.serverMotions = await loadJSON('motions/index.json').then((j) => j.motions ?? []).catch(() => []);
  await loadLocalMotions();
  rebuildMotionList();
  // 選單照「武器（來源角色）」分組，順序照 index.json（build-index.mjs 依武器、類型、姿態、方向排好）
  initPicker();
  // 網址後面的 #id 指定一開始的動作（例如 #S_Attack_1），沒有就放 S_Walk；伺服器的動作數據跟角色檔同時下載
  const ids = state.motions.map((m) => m.id);
  const first = [decodeURIComponent(location.hash.slice(1)), 'S_Walk', ids[0]].find((id) => ids.includes(id));
  const firstData = first && !state.local.has(first) ? fetchMotion(first) : null;
  await loadSavedCharacter();
  $('#loading').remove();
  if (first) await selectMotion(first, firstData ?? undefined);
  else showEmpty();
  initImport();

  $('#play').addEventListener('click', () => (state.playing ? window.motionCurves.pause() : window.motionCurves.play()));
  $('#prev').addEventListener('click', () => seek(Math.max(0, Math.round(currentFrame()) - 1)));
  $('#next').addEventListener('click', () => seek(Math.min(frameCount() - 1, Math.round(currentFrame()) + 1)));
  $('#scrub').addEventListener('input', (e) => seek(+e.target.value));
  $('#speed').addEventListener('change', (e) => { state.speed = +e.target.value; });
  for (const cb of document.querySelectorAll('[data-opt]')) cb.addEventListener('change', (e) => viewer.setOption(cb.dataset.opt, e.target.checked));
  for (const b of document.querySelectorAll('#tabs button')) b.addEventListener('click', () => { if (state.data) showTab(b.dataset.tab); });
  requestAnimationFrame(loop);
  prefetchMotions();
}

// 背景把其他動作的 .gz 先下載進瀏覽器快取（一次一個檔，使用者在載入時先讓路），之後切換只要跟伺服器確認一次
async function prefetchMotions() {
  if (import.meta.env.DEV || typeof DecompressionStream === 'undefined') return;
  const ids = state.serverMotions.map((m) => m.id);
  const start = ids.indexOf(state.id);
  for (let k = 1; k < ids.length; k++) {
    for (const f of ['curves', 'play', 'analysis']) {
      while (state.loading) await state.loading.catch(() => {});
      await fetch(`motions/${ids[(start + k) % ids.length]}/${f}.json.gz`, { cache: 'no-cache' }).then((r) => r.arrayBuffer()).catch(() => {});
    }
  }
}

// ---------- 網頁匯入（.vrma、.fbx 動作；.vrm 換角色） ----------
// 瀏覽器匯入的動作存在 IndexedDB；清單用的欄位從 curves 替身來
function localEntry(id, { curves }) {
  return { id, name: curves.name, label: curves.label, en: '', type: '匯入', description: curves.description, tags: curves.tags, sourceCharacter: '存在這台瀏覽器', weapon: '匯入',
    category: '匯入', frameRate: curves.frameRate, length: curves.length, frameCount: curves.frameCount + 1, loop: curves.settings.loopTime, playbackMode: 'none', local: true };
}

async function loadLocalMotions() {
  try {
    const list = await store.listMotions();
    list.sort((a, b) => a.createdAt - b.createdAt);
    for (const m of list) state.local.set(m.id, { curves: m.curves, angles: m.angles });
  } catch (e) { console.warn('讀不到這台瀏覽器存的動作', e); }
}

function rebuildMotionList() {
  state.motions = [...state.serverMotions, ...[...state.local].map(([id, m]) => localEntry(id, m))];
  if ($('#pickClear')) { buildFilters(); if (!$('#pickPanel').hidden) renderPickList(); }
}

function showEmpty() {
  $('#empty').hidden = state.motions.length > 0;
  if (!state.motions.length) {
    $('#pickLabel').textContent = '還沒有動作';
    $('#pickId').textContent = '';
    $('#info').textContent = '把 .vrma／.fbx 動作拖進網頁，或按「匯入動作／角色」';
    $('#desc').textContent = '';
  }
}

async function importFiles(files) {
  const vrmFile = files.find((f) => /\.vrm$/i.test(f.name));
  if (vrmFile) await changeCharacter(vrmFile);
  const added = [];
  for (const f of files.filter((x) => x !== vrmFile)) {
    $('#info').textContent = `匯入中：${f.name}…`;
    try {
      for (const m of await importFile(f, viewer.vrm)) {
        state.local.set(m.id, { curves: m.curves, angles: m.angles });
        added.push(m);
        try { await store.putMotion({ id: m.id, label: m.label, createdAt: Date.now(), curves: m.curves, angles: m.angles }); }
        catch (e) { console.warn(e); $('#info').textContent = `${f.name}：瀏覽器不給存，重新整理後就會不見`; }
      }
    } catch (e) {
      console.error(e);
      alert(`${f.name} 匯入失敗：${e.message}`);
    }
  }
  rebuildMotionList();
  showEmpty();
  if (added.length) await selectMotion(added[0].id);
  else if (state.data) selectMotion(state.id);
  return added.map((m) => ({ id: m.id, label: m.label, bones: m.mapped?.length, frames: m.angles.frameCount, loop: m.angles.loop }));
}

async function toggleLocalLoop(id) {
  const m = state.local.get(id);
  const loop = !m.angles.loop;
  m.angles.loop = loop;
  m.curves.settings.loopTime = loop;
  m.curves.tags = { ...m.curves.tags, 播放: loop ? '循環' : '單次' };
  try { const saved = await store.listMotions().then((l) => l.find((x) => x.id === id)); if (saved) await store.putMotion({ ...saved, curves: m.curves, angles: m.angles }); } catch (e) { console.warn(e); }
  rebuildMotionList();
  await selectMotion(id);
}

async function removeLocal(id) {
  if (!confirm('從這台瀏覽器刪掉這支匯入的動作？')) return;
  state.local.delete(id);
  try { await store.deleteMotion(id); } catch (e) { console.warn(e); }
  rebuildMotionList();
  showEmpty();
  const next = state.motions[0]?.id;
  if (next) await selectMotion(next);
  else { state.data = null; state.id = null; for (const v of Object.values(state.charts)) v.pane.remove(); state.charts = {}; viewer.vrm.humanoid.resetNormalizedPose(); }
}

// 本機開發伺服器（npm run dev）才有：存進 public/motions/<id>/，跟 Unity 匯出的放一起（vite.config.js 的 save-motion）
async function saveLocalToFiles(id) {
  const m = state.local.get(id);
  const suggest = m.curves.label.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || id;
  const newId = prompt('存成哪個 id（英數字、底線、減號）？會放在 public/motions/<id>/', suggest);
  if (!newId) return;
  if (!/^[A-Za-z0-9_-]+$/.test(newId)) { alert('id 只能用英數字、底線、減號'); return; }
  if (state.serverMotions.some((x) => x.id === newId) && !confirm(`${newId} 已經有了，要覆蓋嗎？`)) return;
  const curves = { ...structuredClone(m.curves), id: newId };
  const angles = { ...m.angles, id: newId };
  const analysis = { ...computeAnalysis(viewer.vrm, angles, viewer.hipsRest / angles.hipsRestHeight), id: newId };
  const r = await fetch('api/save-motion', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: newId, curves, angles, analysis }) });
  if (!r.ok) { alert(`存檔失敗：${await r.text()}`); return; }
  state.local.delete(id);
  try { await store.deleteMotion(id); } catch (e) { console.warn(e); }
  state.serverMotions = await loadJSON('motions/index.json').then((j) => j.motions ?? []).catch(() => state.serverMotions);
  rebuildMotionList();
  await selectMotion(newId);
}

// 換角色：.vrm 存在這台瀏覽器，下次打開還是這個角色；「恢復預設角色」換回 AvatarSample_A
async function loadSavedCharacter() {
  let saved = null;
  try { saved = await store.getFile('vrm'); } catch { /* 讀不到就用預設 */ }
  if (saved) {
    try { await viewer.loadCharacter(saved.buffer.slice(0)); $('#resetVrm').hidden = false; $('#resetVrm').title = `目前角色：${saved.name}`; return; }
    catch (e) { console.warn('存的角色讀不了，用預設角色', e); }
  }
  await viewer.loadCharacter(DEFAULT_VRM);
}

async function changeCharacter(file) {
  $('#info').textContent = `換角色：${file.name}…`;
  const buffer = await file.arrayBuffer();
  try { await viewer.loadCharacter(buffer.slice(0)); }
  catch (e) { alert(`${file.name} 讀不了：${e.message}`); return; }
  try { await store.putFile('vrm', { name: file.name, buffer }); } catch (e) { console.warn(e); }
  $('#resetVrm').hidden = false;
  $('#resetVrm').title = `目前角色：${file.name}`;
  if (state.id) await selectMotion(state.id);
  else $('#info').textContent = `角色換成 ${file.name}`;
}

async function resetCharacter() {
  try { await store.deleteFile('vrm'); } catch (e) { console.warn(e); }
  await viewer.loadCharacter(DEFAULT_VRM);
  $('#resetVrm').hidden = true;
  if (state.id) await selectMotion(state.id);
}

function initImport() {
  $('#importBtn').addEventListener('click', () => $('#fileInput').click());
  $('#fileInput').addEventListener('change', (e) => { const f = [...e.target.files]; e.target.value = ''; if (f.length) importFiles(f); });
  $('#resetVrm').addEventListener('click', resetCharacter);
  let depth = 0;
  const hasFiles = (e) => [...(e.dataTransfer?.types ?? [])].includes('Files');
  window.addEventListener('dragenter', (e) => { if (!hasFiles(e)) return; depth++; $('#dropzone').hidden = false; });
  window.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; $('#dropzone').hidden = true; } });
  window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth = 0;
    $('#dropzone').hidden = true;
    importFiles([...e.dataTransfer.files]);
  });
}

init().catch((e) => {
  console.error(e);
  const el = $('#loading');
  if (el) el.textContent = `載入失敗：${e.message}`;
});
