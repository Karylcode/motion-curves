// 折線圖：靜態層畫曲線，疊加層畫播放線。標題、圖例、目前數值用 HTML 文字，讓 AI 讀頁面文字也拿得到。
import { PALETTE } from './curves.js';

// 圖表顏色從 style.css 的 CSS 變數讀，換主題只要改 CSS
let cachedTheme;
function themeColors() {
  if (cachedTheme) return cachedTheme;
  const css = getComputedStyle(document.documentElement);
  const v = (name) => css.getPropertyValue(name).trim();
  return cachedTheme = { bg: v('--chart-bg'), grid: v('--chart-grid'), gridV: v('--chart-grid-v'), zero: v('--chart-zero'), frame: v('--chart-frame'), label: v('--chart-label'), strip: v('--chart-strip'), playhead: v('--chart-playhead') };
}

function niceTicks(min, max, count = 5) {
  const span = max - min || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const ticks = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-6; v += step) ticks.push(+v.toFixed(10));
  return ticks;
}

export class LineChart {
  /**
   * @param {object} o
   * @param {string} o.title
   * @param {string} [o.note]
   * @param {string} o.unit         顯示用單位（'°'、'cm'、'' …）
   * @param {number} o.decimals
   * @param {Array<{id:string,label:string,color:string,dash?:boolean,sample:(frame:number)=>number,keyFrames?:number[]}>} o.series
   * @param {number} o.frameCount   影格數（含最後一格）
   * @param {number} o.frameRate
   * @param {{left:number[][],right:number[][]}} [o.contacts]
   * @param {(frame:number)=>void} o.onSeek
   */
  constructor(o) {
    Object.assign(this, o);
    this.el = document.createElement('section');
    this.el.className = 'chart';
    const head = document.createElement('header');
    head.innerHTML = `<h3>${o.title}${o.unit ? `<span class="unit">（${o.unit}）</span>` : ''}</h3>${o.note ? `<p class="note">${o.note}</p>` : ''}`;
    this.legend = document.createElement('ul');
    this.legend.className = 'legend';
    this.valueEls = o.series.map((s) => {
      const li = document.createElement('li');
      li.innerHTML = `<i style="border-color:${s.color};${s.dash ? 'border-top-style:dashed' : ''}"></i><span class="lbl">${s.label}</span>＝<b class="val">–</b>`;
      li.title = s.id;
      this.legend.append(li);
      return li.querySelector('.val');
    });
    head.append(this.legend);
    this.plot = document.createElement('div');
    this.plot.className = 'plot';
    this.base = document.createElement('canvas');
    this.over = document.createElement('canvas');
    this.over.className = 'over';
    this.plot.append(this.base, this.over);
    this.el.append(head, this.plot);
    this.frame = 0;
    const seek = (e) => {
      const r = this.over.getBoundingClientRect();
      const f = this.xToFrame(e.clientX - r.left);
      this.onSeek(Math.max(0, Math.min(this.frameCount - 1, f)));
    };
    this.over.addEventListener('pointerdown', (e) => { this.over.setPointerCapture(e.pointerId); seek(e); });
    this.over.addEventListener('pointermove', (e) => { if (e.buttons & 1) seek(e); });
    new ResizeObserver(() => this.layout()).observe(this.plot);
  }

  layout() {
    const w = this.plot.clientWidth;
    const h = this.plot.clientHeight;
    if (!w || !h) return;
    const dpr = window.devicePixelRatio || 1;
    for (const c of [this.base, this.over]) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
    }
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.pad = { l: 48, r: 10, t: 8, b: this.contacts ? 34 : 22 };
    this.computeRange();
    this.drawBase();
    this.drawOverlay();
  }

  computeRange() {
    let min = Infinity;
    let max = -Infinity;
    const steps = (this.frameCount - 1) * 4;
    for (const s of this.series) {
      for (let i = 0; i <= steps; i++) {
        const v = s.sample(i / 4);
        if (Number.isFinite(v)) { min = Math.min(min, v); max = Math.max(max, v); }
      }
    }
    if (!Number.isFinite(min)) { min = 0; max = 1; }
    if (max - min < 1e-6) { min -= 0.5; max += 0.5; }
    const pad = (max - min) * 0.08;
    this.ticks = niceTicks(min - pad, max + pad);
    this.yMin = Math.min(min - pad, this.ticks[0]);
    this.yMax = Math.max(max + pad, this.ticks[this.ticks.length - 1]);
  }

  frameToX(f) { return this.pad.l + (f / (this.frameCount - 1)) * (this.w - this.pad.l - this.pad.r); }
  xToFrame(x) { return ((x - this.pad.l) / (this.w - this.pad.l - this.pad.r)) * (this.frameCount - 1); }
  valueToY(v) { return this.pad.t + (1 - (v - this.yMin) / (this.yMax - this.yMin)) * (this.h - this.pad.t - this.pad.b); }

  drawBase() {
    const g = this.base.getContext('2d');
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.w, this.h);
    const C = themeColors();
    g.fillStyle = C.bg;
    g.fillRect(0, 0, this.w, this.h);
    const { l, r, t, b } = this.pad;
    const bottom = this.h - b;
    g.font = '11px system-ui, "Microsoft JhengHei", sans-serif';
    // 橫格線與 y 軸數字
    g.textAlign = 'right';
    g.textBaseline = 'middle';
    for (const v of this.ticks) {
      const y = this.valueToY(v);
      g.strokeStyle = Math.abs(v) < 1e-9 ? C.zero : C.grid;
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(l, y); g.lineTo(this.w - r, y); g.stroke();
      g.fillStyle = C.label;
      g.fillText(+v.toFixed(this.decimals > 2 ? 2 : 1) + '', l - 6, y);
    }
    // 直格線與格數
    g.textAlign = 'center';
    g.textBaseline = 'top';
    for (let f = 0; f < this.frameCount; f += 5) {
      const x = this.frameToX(f);
      g.strokeStyle = C.gridV;
      g.beginPath(); g.moveTo(x, t); g.lineTo(x, bottom); g.stroke();
      g.fillStyle = C.label;
      g.fillText(String(f), x, bottom + 3);
    }
    g.strokeStyle = C.frame;
    g.strokeRect(l + 0.5, t + 0.5, this.w - l - r - 1, bottom - t - 1);
    // 腳踩地條
    if (this.contacts) {
      const rows = [['left', PALETTE[0], '左腳踩地'], ['right', PALETTE[1], '右腳踩地']];
      rows.forEach(([side, color], i) => {
        const y = bottom + 16 + i * 7;
        g.fillStyle = C.strip;
        g.fillRect(l, y, this.w - l - r, 5);
        g.fillStyle = color;
        for (const [a, z] of this.contacts[side] ?? []) {
          const x0 = this.frameToX(a - 0.5 < 0 ? 0 : a - 0.5);
          const x1 = this.frameToX(Math.min(this.frameCount - 1, z + 0.5));
          g.fillRect(x0, y, Math.max(2, x1 - x0), 5);
        }
      });
    }
    // 曲線
    g.save();
    g.beginPath(); g.rect(l, t, this.w - l - r, bottom - t); g.clip();
    const steps = Math.max(2, Math.round(this.w - l - r));
    for (const s of this.series) {
      g.strokeStyle = s.color;
      g.lineWidth = 2;
      g.setLineDash(s.dash ? [5, 4] : []);
      g.beginPath();
      for (let i = 0; i <= steps; i++) {
        const f = (i / steps) * (this.frameCount - 1);
        const x = this.frameToX(f);
        const y = this.valueToY(s.sample(f));
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
      g.setLineDash([]);
      if (s.keyFrames) {
        g.fillStyle = C.bg;
        g.strokeStyle = s.color;
        g.lineWidth = 1.5;
        for (const kf of s.keyFrames) {
          g.beginPath();
          g.arc(this.frameToX(kf), this.valueToY(s.sample(kf)), 3, 0, Math.PI * 2);
          g.fill(); g.stroke();
        }
      }
    }
    g.restore();
  }

  setFrame(f) {
    this.frame = f;
    this.drawOverlay();
  }

  drawOverlay() {
    if (!this.w) return;
    const g = this.over.getContext('2d');
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.w, this.h);
    const x = this.frameToX(this.frame);
    g.strokeStyle = themeColors().playhead;
    g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(x, this.pad.t); g.lineTo(x, this.h - this.pad.b); g.stroke();
    this.series.forEach((s, i) => {
      const v = s.sample(this.frame);
      this.valueEls[i].textContent = Number.isFinite(v) ? v.toFixed(this.decimals) : '–';
      g.fillStyle = s.color;
      g.beginPath(); g.arc(x, this.valueToY(v), 3.5, 0, Math.PI * 2); g.fill();
    });
  }
}
