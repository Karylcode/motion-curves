// 網頁匯入的動作在網頁上量關節角度、腳踩地（跟 unity/export_motion.cs.txt 的算法一樣，結果寫成 analysis.json 的格式）。
// Unity 匯出的動作用匯出時在 Unity 量好的 analysis.json，這裡只給沒有的用。
import * as THREE from 'three';

const NAMES = ['kneeFlexL', 'kneeFlexR', 'elbowFlexL', 'elbowFlexR', 'hipFlexL', 'hipFlexR', 'hipAbdL', 'hipAbdR', 'shoulderFlexL', 'shoulderFlexR', 'shoulderAbdL', 'shoulderAbdR',
  'trunkLean', 'trunkSide', 'pelvisYaw', 'chestYaw', 'chestTwist', 'pelvisTilt', 'headPitch', 'headYaw', 'footHeightL', 'footHeightR', 'toeHeightL', 'toeHeightR', 'stanceWidth', 'stanceStride', 'handHeightL', 'handHeightR'];

export const CONVENTIONS = {
  angles: '度', heights: '公尺', axes: '以角色自己的前、上、右為準（原地，不含 Root 移動）',
  'kneeFlex/elbowFlex': '0＝打直，越大越彎', 'hipFlex/shoulderFlex': '正＝往前抬，負＝往後', 'hipAbd/shoulderAbd': '正＝往外張',
  trunkLean: '正＝上身前傾', trunkSide: '正＝上身往右傾', 'pelvisYaw/chestYaw': '正＝往右轉（右邊往後）', chestTwist: '胸口相對骨盆的扭轉，正＝胸口比骨盆更往右轉',
  pelvisTilt: '正＝右髖比左髖高', headPitch: '正＝臉朝下', headYaw: '正＝臉朝右', 'footHeight/toeHeight': '相對 T-pose 站立時的高度，0＝踩在地上',
  stanceWidth: '右腳在左腳右邊多少', stanceStride: '右腳在左腳前面多少', handHeight: '手相對骨盆的高度',
};

// 換成 Unity 的座標（角色右手邊＝+X），照搬 Unity 端的公式
const RIGHT = new THREE.Vector3(1, 0, 0), UP = new THREE.Vector3(0, 1, 0), FWD = new THREE.Vector3(0, 0, 1);
const deg = THREE.MathUtils.radToDeg;
const dot = (a, b) => a.dot(b);
const flat = (v) => v.clone().projectOnPlane(UP);
function signedAngle(from, to, axis) {
  const a = deg(from.angleTo(to));
  return Math.sign(axis.dot(new THREE.Vector3().crossVectors(from, to))) * a || a;
}
const deltaAngle = (a, b) => { let d = ((b - a) % 360 + 360) % 360; if (d > 180) d -= 360; return d; };

export function computeAnalysis(vrm, angles, hipsScale = 1) {
  const h = vrm.humanoid;
  const K = angles.samplesPerFrame ?? 1;
  const frames = angles.frameCount;
  const has = (b) => !!h.getRawBoneNode(b);
  const P = (b) => { const v = h.getRawBoneNode(b).getWorldPosition(new THREE.Vector3()); v.x = -v.x; return v; };
  const vrm0 = vrm.meta?.metaVersion === '0';  // VRM 0.x：normalized 座標轉 180°，動作數據的 x、z 反過來（見 viewer.js）
  const pose = (s) => {
    for (const b of angles.bones) {
      const node = h.getNormalizedBoneNode(b.name);
      if (!node) continue;
      node.quaternion.fromArray(angles.localRotations[b.name][s]).normalize();
      if (vrm0) { node.quaternion.x *= -1; node.quaternion.z *= -1; }
    }
    const hp = h.getNormalizedBoneNode('hips').position.fromArray(angles.hipsPosition[s]).multiplyScalar(hipsScale);
    if (vrm0) { hp.x = -hp.x; hp.z = -hp.z; }
    h.update();
    vrm.scene.updateMatrixWorld(true);
  };
  const savedPos = vrm.scene.position.clone(), savedRot = vrm.scene.rotation.clone();
  vrm.scene.position.set(0, 0, 0); vrm.scene.rotation.set(0, vrm0 ? Math.PI : 0, 0);
  h.resetNormalizedPose(); h.update(); vrm.scene.updateMatrixWorld(true);
  const rest = {};
  for (const b of ['leftFoot', 'rightFoot', 'leftToes', 'rightToes']) if (has(b)) rest[b] = P(b).y;
  const out = Object.fromEntries(NAMES.map((n) => [n, []]));
  const q = new THREE.Quaternion();
  for (let f = 0; f < frames; f++) {
    pose(Math.min(f * K, angles.sampleCount - 1));
    const bend = (a, b, c) => deg(P(b).sub(P(a)).angleTo(P(c).sub(P(b))));
    const flex = (d) => deg(Math.atan2(dot(d, FWD), -dot(d, UP)));
    const abd = (d, side) => deg(Math.atan2(side * dot(d, RIGHT), -dot(d, UP)));
    const yaw = (l) => signedAngle(RIGHT, flat(l), UP);
    const v = {};
    v.kneeFlexL = bend('leftUpperLeg', 'leftLowerLeg', 'leftFoot'); v.kneeFlexR = bend('rightUpperLeg', 'rightLowerLeg', 'rightFoot');
    v.elbowFlexL = bend('leftUpperArm', 'leftLowerArm', 'leftHand'); v.elbowFlexR = bend('rightUpperArm', 'rightLowerArm', 'rightHand');
    const thL = P('leftLowerLeg').sub(P('leftUpperLeg')), thR = P('rightLowerLeg').sub(P('rightUpperLeg'));
    v.hipFlexL = flex(thL); v.hipFlexR = flex(thR); v.hipAbdL = abd(thL, -1); v.hipAbdR = abd(thR, 1);
    const uaL = P('leftLowerArm').sub(P('leftUpperArm')), uaR = P('rightLowerArm').sub(P('rightUpperArm'));
    v.shoulderFlexL = flex(uaL); v.shoulderFlexR = flex(uaR); v.shoulderAbdL = abd(uaL, -1); v.shoulderAbdR = abd(uaR, 1);
    const trunk = P('neck').sub(P('hips'));
    v.trunkLean = deg(Math.atan2(dot(trunk, FWD), dot(trunk, UP))); v.trunkSide = deg(Math.atan2(dot(trunk, RIGHT), dot(trunk, UP)));
    const hipLine = P('rightUpperLeg').sub(P('leftUpperLeg')), shLine = P('rightUpperArm').sub(P('leftUpperArm'));
    v.pelvisYaw = yaw(hipLine); v.chestYaw = yaw(shLine); v.chestTwist = deltaAngle(v.pelvisYaw, v.chestYaw);
    v.pelvisTilt = deg(Math.atan2(dot(hipLine, UP), flat(hipLine).length()));
    // 臉朝向：normalized 頭骨頭的世界旋轉（相對 T-pose）× 前方，換成 Unity 座標
    h.getNormalizedBoneNode('head').getWorldQuaternion(q);
    const face = new THREE.Vector3(0, 0, vrm0 ? -1 : 1).applyQuaternion(q); face.x = -face.x;
    v.headPitch = deg(Math.atan2(-dot(face, UP), flat(face).length())); v.headYaw = signedAngle(FWD, flat(face), UP);
    v.footHeightL = P('leftFoot').y - rest.leftFoot; v.footHeightR = P('rightFoot').y - rest.rightFoot;
    v.toeHeightL = has('leftToes') ? P('leftToes').y - rest.leftToes : null; v.toeHeightR = has('rightToes') ? P('rightToes').y - rest.rightToes : null;
    const feet = P('rightFoot').sub(P('leftFoot'));
    v.stanceWidth = dot(feet, RIGHT); v.stanceStride = dot(feet, FWD);
    v.handHeightL = P('leftHand').y - P('hips').y; v.handHeightR = P('rightHand').y - P('hips').y;
    for (const n of NAMES) out[n].push(v[n] == null || Number.isNaN(v[n]) ? null : Math.round(v[n] * 1000) / 1000);
  }
  vrm.scene.position.copy(savedPos); vrm.scene.rotation.copy(savedRot);
  // 腳踩地：腳跟或腳尖離 T-pose 站立高度 1.5 cm 以內，連續 2 格以上
  const contacts = {};
  for (const [side, foot, toe] of [['left', 'footHeightL', 'toeHeightL'], ['right', 'footHeightR', 'toeHeightR']]) {
    const runs = [];
    let start = -1;
    for (let f = 0; f <= frames; f++) {
      const c = f < frames && Math.min(out[foot][f], out[toe][f] ?? 9) < 0.015;
      if (c && start < 0) start = f;
      else if (!c && start >= 0) { if (f - start >= 2) runs.push([start, f - 1]); start = -1; }
    }
    contacts[side] = runs;
  }
  contacts.rule = '腳跟或腳尖離 T-pose 站立高度 1.5 cm 以內＝踩地，連續 2 格以上才算；數字是 [開始格, 結束格]；循環動作的最後一格＝第一格';
  return {
    format: 'motion-analysis/1', id: angles.id, character: 'current-vrm', frameRate: angles.frameRate, frameCount: frames,
    conventions: CONVENTIONS, jointAngles: out, footContacts: contacts, muscles: {},
    muscleNote: '網頁匯入的動作沒有 Unity Humanoid 肌肉值',
  };
}
