// 網頁匯入：把 VRMA、FBX 動作套到目前的 VRM 角色上取樣，轉成跟 Unity 匯出一樣的 angles 格式（沒有 Unity 曲線）。
// FBX 靠骨頭名稱對照（Mixamo、Unity Humanoid、UE、VRoid、3ds Max Biped 常見寫法）；預設姿勢不是 T-pose 也行（照骨頭方向修正）。
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { VRMAnimationLoaderPlugin, createVRMAnimationHumanoidTracks } from '@pixiv/three-vrm-animation';

const FPS = 30;
const K = 4;  // 每格切幾份取樣（30 fps × 4＝每秒 120 份）

// ---------- VRMA ----------
export async function clipsFromVRMA(buffer, vrm) {
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
  const gltf = await loader.parseAsync(buffer, '');
  const anims = gltf.userData.vrmAnimations ?? [];
  if (!anims.length) throw new Error('檔案裡沒有 VRM 動畫（VRMC_vrm_animation）');
  return anims.map((a, i) => {
    const t = createVRMAnimationHumanoidTracks(a, vrm.humanoid, vrm.meta.metaVersion);
    return { name: anims.length > 1 ? `動畫 ${i + 1}` : '', clip: new THREE.AnimationClip('vrma', a.duration, [...t.translation.values(), ...t.rotation.values()]) };
  });
}

// ---------- FBX ----------
// 骨頭名稱 → VRM 骨頭名稱。先拿掉命名空間和常見前綴，分出左右，再比對部位
const BASE = {
  hips: 'hips', pelvis: 'hips', hip: 'hips', root: null,
  spine: 'spine', spine0: 'spine', spine01: 'spine', spine1: 'chest', spine02: 'chest', chest: 'chest', spine2: 'upperChest', spine03: 'upperChest', upperchest: 'upperChest',
  neck: 'neck', neck1: 'neck', neck01: 'neck', head: 'head', spine001: 'spine', spine002: 'chest', spine003: 'upperChest',
  shoulder: 'Shoulder', clavicle: 'Shoulder', collar: 'Shoulder',
  arm: 'UpperArm', upperarm: 'UpperArm', forearm: 'LowerArm', lowerarm: 'LowerArm', elbow: 'LowerArm', hand: 'Hand', wrist: 'Hand',
  upleg: 'UpperLeg', upperleg: 'UpperLeg', thigh: 'UpperLeg', leg: 'LowerLeg', lowerleg: 'LowerLeg', calf: 'LowerLeg', shin: 'LowerLeg', knee: 'LowerLeg',
  foot: 'Foot', ankle: 'Foot', toebase: 'Toes', toes: 'Toes', toe: 'Toes', toe0: 'Toes', ball: 'Toes',
};
const FINGER = { thumb: 'Thumb', index: 'Index', middle: 'Middle', ring: 'Ring', pinky: 'Little', little: 'Little', finger0: 'Thumb', finger1: 'Index', finger2: 'Middle', finger3: 'Ring', finger4: 'Little' };
const SEG = { Thumb: ['Metacarpal', 'Proximal', 'Distal'], other: ['Proximal', 'Intermediate', 'Distal'] };

export function vrmBoneOf(rawName) {
  let n = rawName.split(/[:|]/).pop();
  n = n.replace(/^mixamorig\d*/i, '').replace(/^bip0*1[ _]?/i, '').replace(/^(def|org|cc_base|rig)[_.-]/i, '');
  const vroid = n.match(/^J_(?:Bip|Adj)_([CLR])_(.*)$/i);  // VRoid：J_Bip_L_UpperArm
  if (vroid) n = (vroid[1].toUpperCase() === 'C' ? '' : `${vroid[1].toUpperCase()}_`) + vroid[2];
  let side = '';
  // 左右：Left／Right 字樣，或獨立的 L／R（開頭的「L 」「L_」「LThigh」、結尾的「_L」「.l」）
  if (/left/i.test(n)) { side = 'left'; n = n.replace(/left/i, ''); }
  else if (/right/i.test(n)) { side = 'right'; n = n.replace(/right/i, ''); }
  else {
    const m = n.match(/^([LR])(?=[ _.-]|[A-Z])/) ?? n.match(/[ _.-]([LlRr])(?=$|[ _.-]\d*$)/);
    if (m) { side = m[1].toUpperCase() === 'L' ? 'left' : 'right'; n = n.replace(m[0], ' '); }
  }
  const key = n.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!key) return null;
  const fm = key.match(/^(?:hand)?(thumb|index|middle|ring|pinky|little|finger[0-4])0?(\d)?$/);
  if (fm) {
    if (!side) return null;
    const f = FINGER[fm[1]];
    // Mixamo、UE 的數字就是第幾節（Thumb1～3）；3ds Max Biped 是 Finger1、Finger11、Finger12（多一位數＝下一節）
    const n = fm[1].startsWith('finger') ? (fm[2] == null ? 1 : +fm[2] + 1) : +(fm[2] ?? 1);
    const seg = (f === 'Thumb' ? SEG.Thumb : SEG.other)[Math.max(0, Math.min(2, n - 1))];
    return `${side}${f}${seg}`;
  }
  const b = BASE[key];
  if (!b) return null;
  if (/^[A-Z]/.test(b)) return side ? `${side}${b}` : null;  // 有左右的部位一定要分出左右
  return b;  // 身體中線的骨頭不管左右
}

// 每根骨頭往哪根子骨頭指（用來對齊 FBX 和 VRM 預設姿勢的骨頭方向）；沒有的就不修正
const CHILD = {
  spine: ['chest', 'upperChest', 'neck'], chest: ['upperChest', 'neck'], upperChest: ['neck'], neck: ['head'],
  leftShoulder: ['leftUpperArm'], leftUpperArm: ['leftLowerArm'], leftLowerArm: ['leftHand'], leftHand: ['leftMiddleProximal'],
  rightShoulder: ['rightUpperArm'], rightUpperArm: ['rightLowerArm'], rightLowerArm: ['rightHand'], rightHand: ['rightMiddleProximal'],
  leftUpperLeg: ['leftLowerLeg'], leftLowerLeg: ['leftFoot'], leftFoot: ['leftToes'],
  rightUpperLeg: ['rightLowerLeg'], rightLowerLeg: ['rightFoot'], rightFoot: ['rightToes'],
};
for (const s of ['left', 'right']) for (const f of ['Thumb', 'Index', 'Middle', 'Ring', 'Little']) {
  const segs = f === 'Thumb' ? ['Metacarpal', 'Proximal', 'Distal'] : ['Proximal', 'Intermediate', 'Distal'];
  CHILD[`${s}${f}${segs[0]}`] = [`${s}${f}${segs[1]}`];
  CHILD[`${s}${f}${segs[1]}`] = [`${s}${f}${segs[2]}`];
}

// 兩個方向（主、副）組成的旋轉座標系
function basis(main, side) {
  const y = main.clone().normalize();
  const z = new THREE.Vector3().crossVectors(side, y).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

// FBX：照 FBX 自己的骨架播一次，每份取樣讀每根對到的骨頭的世界旋轉，換成 VRM normalized 骨頭的區域旋轉。
// FBX 的預設姿勢不一定是 T-pose（例如 UE 的 A-pose）：每根骨頭先算「VRM T-pose 骨頭方向 → FBX 預設姿勢骨頭方向」的修正，
// 骨盆用「往上＋左右」兩個方向對齊（連朝向一起），其他骨頭用指向子骨頭的方向對齊。
export async function clipsFromFBX(buffer, vrm) {
  const asset = new FBXLoader().parse(buffer, '');
  if (!asset.animations.length) throw new Error('FBX 裡沒有動畫');
  asset.updateMatrixWorld(true);
  const objOf = new Map();
  asset.traverse((o) => {
    const b = vrmBoneOf(o.name);
    if (b && !objOf.has(b) && vrm.humanoid.getNormalizedBoneNode(b)) objOf.set(b, o);
  });
  if (!objOf.has('hips')) throw new Error('FBX 骨頭名稱對不上（找不到 Hips／Pelvis）；請先轉成 VRMA，或改用 Mixamo、Unity Humanoid、UE 的骨頭名稱');
  const mapped = [...objOf.keys()];
  const h = vrm.humanoid;
  const meta0 = vrm.meta.metaVersion === '0';

  // VRM T-pose 時每根骨頭的位置（normalized，換成面向 +Z）
  const rest = h.normalizedRestPose;
  const vPos = new Map();
  const nodeToBone = new Map(Object.keys(h.humanBones).map((b) => [h.getNormalizedBoneNode(b), b]).filter(([n]) => n));
  const vrmParent = (b) => { let p = h.getNormalizedBoneNode(b).parent; while (p && !nodeToBone.has(p)) p = p.parent; return p ? nodeToBone.get(p) : null; };
  const vrmPos = (b) => {
    if (vPos.has(b)) return vPos.get(b);
    const p = new THREE.Vector3().fromArray(rest[b]?.position ?? [0, 0, 0]);
    if (meta0) { p.x = -p.x; p.z = -p.z; }
    const par = vrmParent(b);
    if (par) p.add(vrmPos(par));
    vPos.set(b, p);
    return p;
  };
  const fPos = (b) => objOf.get(b).getWorldPosition(new THREE.Vector3());
  const restQ = new Map([...objOf].map(([b, o]) => [b, o.getWorldQuaternion(new THREE.Quaternion())]));
  // 修正 C：VRM T-pose 的骨頭座標 → FBX 預設姿勢的骨頭座標
  const corr = new Map();
  for (const b of mapped) {
    if (b === 'hips') {
      const up = mapped.includes('spine') ? 'spine' : null;
      if (up && objOf.has('leftUpperLeg') && objOf.has('rightUpperLeg')) {
        const fv = basis(vrmPos(up).clone().sub(vrmPos('hips')), vrmPos('rightUpperLeg').clone().sub(vrmPos('leftUpperLeg')));
        const ff = basis(fPos(up).sub(fPos('hips')), fPos('rightUpperLeg').sub(fPos('leftUpperLeg')));
        corr.set(b, ff.multiply(fv.invert()));
      }
      continue;
    }
    const c = (CHILD[b] ?? []).find((x) => objOf.has(x));
    if (!c) continue;
    const dv = vrmPos(c).clone().sub(vrmPos(b));
    const df = fPos(c).sub(fPos(b));
    if (dv.lengthSq() > 1e-10 && df.lengthSq() > 1e-10) corr.set(b, new THREE.Quaternion().setFromUnitVectors(dv.normalize(), df.normalize()));
  }
  // 父骨頭：VRM 骨架裡最近一個有對到的祖先（沒對到的骨頭維持 T-pose，世界旋轉跟祖先一樣）
  const mappedParent = (b) => { let p = vrmParent(b); while (p && !objOf.has(p)) p = vrmParent(p); return p; };
  const hipsRestF = fPos('hips');
  const scale = vrmPos('hips').y / hipsRestF.y;

  const out = [];
  for (const anim of asset.animations) {
    const mixer = new THREE.AnimationMixer(asset);
    const action = mixer.clipAction(anim);
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    const duration = Math.max(anim.duration, 1 / FPS);
    const S = Math.round(duration * FPS * K) + 1;
    const times = [];
    const rotV = new Map(mapped.map((b) => [b, []]));
    const hipsV = [];
    const D = new Map();
    const q = new THREE.Quaternion();
    for (let s = 0; s < S; s++) {
      const t = Math.min(duration, s / (FPS * K));
      times.push(t);
      mixer.setTime(t);
      asset.updateMatrixWorld(true);
      // D＝VRM 骨頭相對 T-pose 的世界旋轉＝FBX 動畫世界旋轉 × FBX 預設世界旋轉的反轉 × 修正
      for (const b of mapped) {
        const d = objOf.get(b).getWorldQuaternion(new THREE.Quaternion()).multiply(restQ.get(b).clone().invert());
        if (corr.has(b)) d.multiply(corr.get(b));
        D.set(b, d);
      }
      for (const b of mapped) {
        const p = mappedParent(b);
        q.copy(p ? D.get(p) : new THREE.Quaternion()).invert().multiply(D.get(b));
        if (meta0) { q.x = -q.x; q.z = -q.z; }
        rotV.get(b).push(q.x, q.y, q.z, q.w);
      }
      const hp = fPos('hips').sub(hipsRestF).multiplyScalar(scale).add(vrmPos('hips'));
      if (meta0) { hp.x = -hp.x; hp.z = -hp.z; }
      hipsV.push(hp.x, hp.y, hp.z);
    }
    mixer.stopAllAction();
    mixer.uncacheRoot(asset);
    const tracks = mapped.map((b) => new THREE.QuaternionKeyframeTrack(`${h.getNormalizedBoneNode(b).name}.quaternion`, times, rotV.get(b)));
    tracks.push(new THREE.VectorKeyframeTrack(`${h.getNormalizedBoneNode('hips').name}.position`, times, hipsV));
    out.push({ name: asset.animations.length > 1 ? anim.name : '', clip: new THREE.AnimationClip(anim.name, duration, tracks), mapped });
  }
  return out;
}

// ---------- 取樣成 angles 格式 ----------
// 跟 Unity 匯出的 angles.json 一樣：VRM normalized 骨頭的區域旋轉（T-pose＝單位四元數）、骨盆位置（原地）、Root 移動。
// 骨盆的水平移動用 0.4 秒移動平均分成「Root 移動」和「原地晃動」兩部分；轉向留在骨盆旋轉裡（Root 轉向一律 0）。
export function sampleClip(vrm, clip, { id, name }) {
  const humanoid = vrm.humanoid;
  humanoid.resetNormalizedPose();
  const nodeToBone = new Map();
  const bones = [];
  for (const b of Object.keys(humanoid.humanBones)) {
    const node = humanoid.getNormalizedBoneNode(b);
    if (node) { nodeToBone.set(node, b); bones.push(b); }
  }
  const parentOf = (b) => {
    let p = humanoid.getNormalizedBoneNode(b).parent;
    while (p && !nodeToBone.has(p)) p = p.parent;
    return p ? nodeToBone.get(p) : null;
  };
  const mixer = new THREE.AnimationMixer(vrm.scene);
  const action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopOnce, 1);  // 預設 LoopRepeat 在最後一刻會繞回第 0 秒
  action.clampWhenFinished = true;
  action.play();
  const duration = Math.max(clip.duration, 1 / FPS);
  const frameCount = Math.max(2, Math.round(duration * FPS) + 1);
  const sampleCount = (frameCount - 1) * K + 1;
  const rot = Object.fromEntries(bones.map((b) => [b, []]));
  const hips = [];
  const round = (v) => Math.round(v * 1e6) / 1e6;
  const hipsNode = humanoid.getNormalizedBoneNode('hips');
  // VRM 0.x 的 normalized 座標轉了 180°：存成 1.0 的方向（x、z 反過來），換角色也能用
  const flip = vrm.meta.metaVersion === '0' ? (a, xz) => { a[0] = -a[0]; a[2] = -a[2]; return a; } : (a) => a;
  for (let s = 0; s < sampleCount; s++) {
    mixer.setTime(Math.min(duration, s / (FPS * K)));
    for (const b of bones) rot[b].push(flip(humanoid.getNormalizedBoneNode(b).quaternion.toArray()).map(round));
    hips.push(flip(hipsNode.position.toArray()));
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(vrm.scene);
  humanoid.resetNormalizedPose();

  // Root 移動＝骨盆水平位置的移動平均，再修成頭＝0、尾＝骨盆的淨位移（循環播放時下一遍才接得剛好）；原地骨盆＝骨盆位置減掉 Root 移動
  const W = Math.round(0.2 * FPS * K);
  const n = hips.length;
  const avg = hips.map((_, i) => {
    let x = 0, z = 0, c = 0;
    for (let j = Math.max(0, i - W); j <= Math.min(n - 1, i + W); j++) { x += hips[j][0]; z += hips[j][2]; c++; }
    return [x / c, z / c];
  });
  const endFix = [hips[n - 1][0] - hips[0][0] - (avg[n - 1][0] - avg[0][0]), hips[n - 1][2] - hips[0][2] - (avg[n - 1][1] - avg[0][1])];
  const root = avg.map(([x, z], i) => { const t = i / (n - 1); return [round(x - avg[0][0] + endFix[0] * t), 0, round(z - avg[0][1] + endFix[1] * t), 0]; });
  const hipsPosition = hips.map((h, i) => [round(h[0] - root[i][0]), round(h[1]), round(h[2] - root[i][2])]);

  // 頭尾姿勢幾乎一樣就當成循環動作
  let maxDeg = 0;
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
  for (const b of bones) { qa.fromArray(rot[b][0]); qb.fromArray(rot[b][sampleCount - 1]); maxDeg = Math.max(maxDeg, THREE.MathUtils.radToDeg(qa.angleTo(qb))); }
  const loop = maxDeg < 5 && Math.abs(hips[0][1] - hips[sampleCount - 1][1]) < 0.02;

  return {
    format: 'vrm-normalized-pose/2', id, character: 'imported', source: name, frameRate: FPS, frameCount, samplesPerFrame: K, sampleCount, loop, footIK: false,
    hipsRestHeight: humanoid.normalizedRestPose.hips.position[1],
    coordinate: 'glTF／three.js 右手座標，+Y 朝上，角色面向 +Z，公尺',
    rotationSpace: 'VRM normalized：每根骨頭相對 T-pose 的旋轉（T-pose 時全部是單位四元數），local 是相對父骨頭',
    sampling: `網頁匯入：把動畫套到 VRM 角色上，每格切 ${K} 份取樣`,
    bones: bones.map((b) => ({ name: b, parent: parentOf(b) })),
    localRotations: rot, hipsPosition, rootMotion: root, rootMotionFields: ['x', 'y', 'z', 'yawDeg'],
    weapons: [], weaponTrails: [],
  };
}

// curves.json 的替身：網頁匯入的動作沒有 Unity 曲線，只放清單和資訊列要的欄位
export function curvesStub(angles, { label, file }) {
  const length = (angles.frameCount - 1) / angles.frameRate;
  return {
    format: 'imported/1', id: angles.id, name: label, sourceFile: file, sourceCharacter: '自己匯入', weapon: '匯入', category: '匯入',
    label, en: '', type: '匯入', description: `從 ${file} 匯入（網頁套到角色上取樣，沒有 Unity 曲線）`, tags: { 播放: angles.loop ? '循環' : '單次' },
    frameRate: angles.frameRate, length, frameCount: angles.frameCount - 1, humanMotion: true, wrapMode: 'Default',
    playbackMode: 'none', settings: { loopTime: angles.loop }, curves: [],
  };
}

export async function importFile(file, vrm) {
  const buf = await file.arrayBuffer();
  const ext = file.name.split('.').pop().toLowerCase();
  const base = file.name.replace(/\.[^.]+$/, '');
  const list = ext === 'vrma' || ext === 'glb' || ext === 'gltf' ? await clipsFromVRMA(buf, vrm) : ext === 'fbx' ? await clipsFromFBX(buf, vrm) : null;
  if (!list) throw new Error(`不支援 .${ext}（動作請用 .vrma 或 .fbx，角色請用 .vrm）`);
  const stamp = Date.now().toString(36);
  return list.map(({ name, clip, mapped }, i) => {
    const label = name ? `${base}／${name}` : base;
    const id = `local_${stamp}_${i}`;
    const angles = sampleClip(vrm, clip, { id, name: file.name });
    return { id, label, angles, curves: curvesStub(angles, { label, file: file.name }), mapped };
  });
}
