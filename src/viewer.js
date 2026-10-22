// 3D 檢視：載入 VRM 角色和劍，照 angles.json 每格的骨頭旋轉擺姿勢。
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

// 角色面向 +Z（three.js 右手座標），所以角色的右手邊是 -X。
const VIEWS = {
  front: { pos: [0, 0.95, 4.6], label: '正面' },
  frontRight: { pos: [-3.3, 1.1, 3.3], label: '右前' },
  right: { pos: [-4.6, 0.95, 0], label: '右側' },
  back: { pos: [0, 0.95, -4.6], label: '背面' },
  left: { pos: [4.6, 0.95, 0], label: '左側' },
  top: { pos: [0, 5.2, 0.01], label: '正上方' },
};
export const VIEW_NAMES = Object.entries(VIEWS).map(([id, v]) => ({ id, label: v.label }));
const UP = new THREE.Vector3(0, 1, 0);

// 模型檔有壓好的 .gz（build-index.mjs 產生，目前只有角色檔）就下載 .gz 自己解壓，Tailscale 不會自動壓縮
async function fetchModel(url, tryGz = import.meta.env.MODE !== 'pages') {  // GitHub Pages 版沒有 .gz
  if (tryGz && typeof DecompressionStream !== 'undefined') {
    const gz = await fetch(`${url}.gz`).catch(() => null);
    if (gz?.ok && !/text\/html/.test(gz.headers.get('content-type') ?? '')) {  // Vite 開發伺服器找不到檔案時會回 index.html（200），不能當成 .gz
      if (/gzip/.test(gz.headers.get('content-encoding') ?? '')) return gz.arrayBuffer();
      return new Response(gz.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    }
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`讀不到 ${url}（${r.status}）`);
  return r.arrayBuffer();
}
const JUMP_DOT = Math.cos(THREE.MathUtils.degToRad(45) / 2);  // 兩個四元數夾角 45° 時的 |dot|
// Unity 匯出的動作是在 AvatarSample_A 身上取樣的（angles.json 沒有 hipsRestHeight）：換成別的角色時骨盆高度照這個比例縮放
const DEFAULT_HIPS_REST = 0.8738;

// 兩個四元數之間內插。資料只存到小數 6 位，四元數不一定剛好是單位長度；
// three.js 的 slerp 在內積 ≥ 1 時會直接不內插（停在第一個），所以先正規化，很接近時改用線性內插。
function interpolateQuaternion(out, a, b, t) {
  a.normalize();
  b.normalize();
  let dot = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
  if (dot < 0) { b.set(-b.x, -b.y, -b.z, -b.w); dot = -dot; }
  if (dot > 0.9995) {
    return out.set(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t, a.w + (b.w - a.w) * t).normalize();
  }
  return out.slerpQuaternions(a, b, t);
}

export class Viewer {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.append(this.renderer.domElement);
    this.scene = new THREE.Scene();
    const css = getComputedStyle(document.documentElement);
    const cssColor = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
    this.scene.background = new THREE.Color(cssColor('--scene-bg', '#12151b'));
    // 劍是金屬材質，要有環境反射才不會黑掉（角色的 MToon 不受影響）
    this.scene.environment = new THREE.PMREMGenerator(this.renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.05, 100);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.target = new THREE.Vector3(0, 0.85, 0);
    this.controls.target.copy(this.target);
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#5a5f6a', 1.6));
    const sun = new THREE.DirectionalLight('#ffffff', 2.2);
    sun.position.set(-2, 4, 3);
    this.scene.add(sun);
    const grid = new THREE.GridHelper(20, 40, cssColor('--scene-grid', '#3a404c'), cssColor('--scene-grid-minor', '#242832'));
    this.scene.add(grid);
    this.options = { mesh: true, skeleton: false, weapon: true, trail: false, physics: false, rootMotion: false };
    this.setView('front');
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
  }

  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setView(id) {
    const v = VIEWS[id];
    if (!v) return;
    this.lastView = id;
    const offset = this.vrm ? this.vrm.scene.position : new THREE.Vector3();
    this.controls.target.set(offset.x, this.target.y, offset.z);
    this.camera.position.set(offset.x + v.pos[0], v.pos[1], offset.z + v.pos[2]);
    this.controls.update();
  }

  // source＝網址或 .vrm 檔的 ArrayBuffer。已經有角色時換掉（武器、軌跡、骨架線跟著重建）
  async loadCharacter(source) {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    const gltf = await loader.parseAsync(typeof source === 'string' ? await fetchModel(source) : source, '');
    const vrm = gltf.userData.vrm;
    if (!vrm?.humanoid) throw new Error('不是 VRM 角色檔');
    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    if (VRMUtils.combineSkeletons) VRMUtils.combineSkeletons(gltf.scene);
    VRMUtils.rotateVRM0(vrm);  // VRM 0.x 面向 -Z，轉成跟 1.0 一樣面向 +Z
    vrm.scene.traverse((o) => { o.frustumCulled = false; });
    if (this.vrm) {
      for (const w of this.weapons ?? []) w.removeFromParent();
      this.weapons = [];
      this.skeletonLines?.removeFromParent();
      this.scene.remove(this.vrm.scene);
      VRMUtils.deepDispose(this.vrm.scene);
    }
    this.scene.add(vrm.scene);
    this.vrm = vrm;
    this.hipsRest = vrm.humanoid.normalizedRestPose.hips.position[1];
    // VRM 0.x 的 normalized 骨頭座標是轉 180° 的：動作數據（一律照 1.0 面向 +Z）套上去前 x、z 要反過來，整個角色轉 180°
    this.vrm0 = vrm.meta?.metaVersion === '0';
    this.baseYaw = vrm.scene.rotation.y;
    this.buildSkeleton();
    this.setOption('mesh', this.options.mesh);
    return vrm;
  }

  // 武器可以好幾把（雙刀、劍＋盾…），各自掛在自己的骨頭上。同一個模型只下載、解析一次，每把用複製的
  async loadWeapons(specs) {
    for (const w of this.weapons ?? []) w.removeFromParent();
    this.weapons = [];
    this.weaponCache ??= new Map();
    for (const spec of specs) {
      if (!this.weaponCache.has(spec.model)) this.weaponCache.set(spec.model, fetchModel(spec.model, false).then((buf) => new GLTFLoader().parseAsync(buf, '')).then((g) => g.scene));
      const obj = (await this.weaponCache.get(spec.model)).clone();
      obj.position.fromArray(spec.position);
      obj.quaternion.fromArray(spec.rotation);
      obj.scale.fromArray(spec.scale);
      this.vrm.humanoid.getNormalizedBoneNode(spec.attachBone).add(obj);
      obj.visible = this.options.weapon;
      this.weapons.push(obj);
    }
  }

  buildSkeleton() {
    const mat = new THREE.LineBasicMaterial({ color: '#f3f4f6', depthTest: false, transparent: true });
    this.skeletonGeo = new THREE.BufferGeometry();
    this.skeletonLines = new THREE.LineSegments(this.skeletonGeo, mat);
    this.skeletonLines.renderOrder = 10;
    this.skeletonLines.frustumCulled = false;
    this.skeletonLines.visible = this.options.skeleton;
    this.scene.add(this.skeletonLines);
  }

  setMotion(angles) {
    this.motion = angles;
    // 動作取樣的角色和現在的角色骨盆高度不同時，骨盆位置和 Root 移動照比例縮放
    this.hipsScale = this.hipsRest / (angles.hipsRestHeight ?? DEFAULT_HIPS_REST);
    // Root 移動的朝向（度）。Unity 的 eulerAngles 在 0～360 之間會跳，這裡接成連續的才能內插
    this.rootYaw = angles.rootMotion?.map((r) => r[3]) ?? null;
    if (this.rootYaw) {
      this.rootYaw[0] = ((this.rootYaw[0] % 360) + 540) % 360 - 180;
      for (let i = 1; i < this.rootYaw.length; i++) {
        let y = this.rootYaw[i];
        while (y - this.rootYaw[i - 1] > 180) y -= 360;
        while (y - this.rootYaw[i - 1] < -180) y += 360;
        this.rootYaw[i] = y;
      }
    }
    this.bones = angles.bones.filter((b) => this.vrm.humanoid.getNormalizedBoneNode(b.name));
    this.pairs = this.bones.filter((b) => b.parent).map((b) => [b.parent, b.name]);
    this.skeletonGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.pairs.length * 6), 3));
    // 每把武器尖端的軌跡（舊檔案只有第一把的 swordTip）
    for (const t of this.trails ?? []) t.removeFromParent();
    const tips = angles.weaponTrails?.map((w) => w.tip) ?? (angles.swordTip ? [angles.swordTip] : []);
    this.trails = tips.map((tip, i) => {
      const g = new THREE.BufferGeometry().setFromPoints(tip.map((p) => new THREE.Vector3().fromArray(p)));
      const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: i === 0 ? '#f87171' : '#fbbf24', depthTest: false }));
      line.renderOrder = 11;
      line.visible = this.options.trail;
      this.vrm.scene.add(line);
      return line;
    });
  }

  setOption(name, value) {
    this.options[name] = value;
    if (name === 'skeleton') this.skeletonLines.visible = value;
    if (name === 'trail') for (const t of this.trails ?? []) t.visible = value;
    if (name === 'weapon') for (const w of this.weapons ?? []) w.visible = value;
    if (name === 'mesh') this.vrm.scene.traverse((o) => { if (o.isMesh && !this.isWeaponPart(o)) o.visible = value; });
    if (name === 'physics' && value) this.vrm.springBoneManager?.reset();
    if (name === 'rootMotion' && !value) { this.vrm.scene.position.set(0, 0, 0); this.vrm.scene.rotation.set(0, this.baseYaw, 0); this.setView(this.lastView ?? 'front'); }
  }

  isWeaponPart(o) {
    let p = o;
    while (p) { if (this.weapons?.includes(p)) return true; p = p.parent; }
    return false;
  }

  // frame 可以是小數。angles.json 每格切 samplesPerFrame 份取樣，這裡在相鄰兩份之間內插；loopIndex＝第幾遍，循環動作用來接上 Root 移動
  setFrame(frame, loopIndex = 0) {
    const m = this.motion;
    const K = m.samplesPerFrame ?? 1;
    const last = (m.sampleCount ?? m.frameCount) - 1;
    const f = Math.max(0, Math.min(last, frame * K));
    const i = Math.min(Math.floor(f), last);
    const j = Math.min(i + 1, last);
    const t = f - i;
    const qa = new THREE.Quaternion();
    const qb = new THREE.Quaternion();
    for (const b of this.bones) {
      const arr = m.localRotations[b.name];
      qa.fromArray(arr[i]).normalize();
      if (t > 0) {
        qb.fromArray(arr[j]).normalize();
        // 相鄰兩份差超過 45°＝Unity 在這裡瞬間跳（例如右前臂扭轉超過範圍時繞手臂翻 180°），不內插，跟 Unity 一樣直接跳
        if (Math.abs(qa.dot(qb)) < JUMP_DOT) { if (t >= 0.5) qa.copy(qb); } else interpolateQuaternion(qa, qa.clone(), qb, t);
      }
      if (this.vrm0) { qa.x = -qa.x; qa.z = -qa.z; }
      this.vrm.humanoid.getNormalizedBoneNode(b.name).quaternion.copy(qa);
    }
    const ha = new THREE.Vector3().fromArray(m.hipsPosition[i]);
    if (t > 0) ha.lerp(new THREE.Vector3().fromArray(m.hipsPosition[j]), t);
    ha.multiplyScalar(this.hipsScale);
    if (this.vrm0) { ha.x = -ha.x; ha.z = -ha.z; }
    this.vrm.humanoid.getNormalizedBoneNode('hips').position.copy(ha);
    if (this.options.rootMotion && m.rootMotion) {
      const ra = new THREE.Vector3().fromArray(m.rootMotion[i]);
      if (t > 0) ra.lerp(new THREE.Vector3().fromArray(m.rootMotion[j]), t);
      ra.multiplyScalar(this.hipsScale);
      const yaw = this.rootYaw[i] + (this.rootYaw[j] - this.rootYaw[i]) * t;
      // 循環動作每播完一遍從上一遍的終點接著走（位置和朝向都接上）；不循環的每遍從原點重來
      const end = new THREE.Vector3().fromArray(m.rootMotion[last]).multiplyScalar(this.hipsScale);
      const base = new THREE.Vector3();
      let baseYaw = 0;
      for (let n = 0; n < (m.loop ? loopIndex : 0); n++) {
        base.add(end.clone().applyAxisAngle(UP, THREE.MathUtils.degToRad(baseYaw)));
        baseYaw += this.rootYaw[last];
      }
      ra.applyAxisAngle(UP, THREE.MathUtils.degToRad(baseYaw)).add(base);
      const delta = ra.clone().sub(this.vrm.scene.position);
      this.vrm.scene.position.copy(ra);
      this.vrm.scene.rotation.set(0, this.baseYaw + THREE.MathUtils.degToRad(baseYaw + yaw), 0);
      this.camera.position.x += delta.x; this.camera.position.z += delta.z;
      this.controls.target.x += delta.x; this.controls.target.z += delta.z;
    }
  }

  update(dt) {
    if (!this.vrm) return;
    if (this.options.physics) this.vrm.update(dt);
    else this.vrm.humanoid.update();
    if (this.options.skeleton) this.updateSkeleton();
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  updateSkeleton() {
    const pos = this.skeletonGeo.getAttribute('position');
    const v = new THREE.Vector3();
    this.pairs.forEach(([a, b], k) => {
      this.vrm.humanoid.getRawBoneNode(a).getWorldPosition(v); pos.setXYZ(k * 2, v.x, v.y, v.z);
      this.vrm.humanoid.getRawBoneNode(b).getWorldPosition(v); pos.setXYZ(k * 2 + 1, v.x, v.y, v.z);
    });
    pos.needsUpdate = true;
  }

  // 每份取樣比對：網頁算出的骨頭位置 vs Unity 匯出的 worldPositions（原地，不含 Root 移動）
  verify() {
    const m = this.motion;
    if (!m.worldPositions) return { note: '這支動作沒有 Unity 取樣的骨頭位置（網頁匯入的），沒有東西可以比' };
    if (Math.abs(this.hipsScale - 1) > 1e-4) return { note: '現在的角色不是動作取樣時的角色（AvatarSample_A），骨頭位置本來就不同，換回預設角色再比' };
    const K = m.samplesPerFrame ?? 1;
    const count = m.sampleCount ?? m.frameCount;
    const saved = { ...this.options };
    this.options.rootMotion = false;
    this.vrm.scene.position.set(0, 0, 0);
    this.vrm.scene.rotation.set(0, this.baseYaw, 0);
    let max = 0;
    let worst = '';
    let sum = 0;
    let n = 0;
    const v = new THREE.Vector3();
    for (let s = 0; s < count; s++) {
      this.setFrame(s / K);
      this.vrm.humanoid.update();
      this.vrm.scene.updateMatrixWorld(true);
      for (const b of this.bones) {
        const expect = m.worldPositions[b.name]?.[s];
        if (!expect) continue;
        this.vrm.humanoid.getRawBoneNode(b.name).getWorldPosition(v);
        const d = v.distanceTo(new THREE.Vector3().fromArray(expect));
        sum += d; n++;
        if (d > max) { max = d; worst = `${b.name} 第 ${(s / K).toFixed(2)} 格`; }
      }
    }
    this.options = saved;
    return { bonesCompared: this.bones.length, samples: count, maxErrorMm: +(max * 1000).toFixed(4), meanErrorMm: +((sum / n) * 1000).toFixed(4), worst };
  }

  // 某一格（可小數）每根骨頭的世界位置和旋轉（原地，不含 Root 移動）
  rawPose(frame) {
    const saved = this.options.rootMotion;
    const savedPos = this.vrm.scene.position.clone();
    const savedRot = this.vrm.scene.rotation.clone();
    this.options.rootMotion = false;
    this.vrm.scene.position.set(0, 0, 0);
    this.vrm.scene.rotation.set(0, this.baseYaw, 0);
    this.setFrame(frame);
    this.vrm.humanoid.update();
    this.vrm.scene.updateMatrixWorld(true);
    const out = {};
    const v = new THREE.Vector3();
    const q = new THREE.Quaternion();
    for (const b of this.bones) {
      const node = this.vrm.humanoid.getRawBoneNode(b.name);
      node.getWorldPosition(v);
      node.getWorldQuaternion(q);
      out[b.name] = { pos: v.toArray(), rot: q.toArray() };
    }
    this.options.rootMotion = saved;
    this.vrm.scene.position.copy(savedPos);
    this.vrm.scene.rotation.copy(savedRot);
    return out;
  }

  snapshot() {
    return this.renderer.domElement.toDataURL('image/png');
  }
}
