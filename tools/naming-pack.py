# 給命名用的資料包：每支動作算一份統一的數據（features）、畫連拍火柴人圖（sheets）。
# 用法：python -X utf8 tools/naming-pack.py <輸出資料夾> [id 開頭過濾，例如 K_]
# 輸出：<輸出>/features/<id>.json、<輸出>/sheets/<id>_1.png…、<id>_overview.png、<輸出>/features_all.json
# 座標：angles.json 是 glTF（+Y 上、角色一開始面向 +Z、角色右手邊是 -X），worldPositions 不含 Root 移動，
#      世界位置＝繞 Y 轉 rootMotion.yaw（正＝往角色左邊轉）再加 rootMotion 的位置。
# 這裡一律換成角色一開始的方向：r＝右、u＝上、f＝前（r = -x）。
import json, math, os, sys, glob
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from multiprocessing import Pool

MOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'motions')
OUT = sys.argv[1]
PREFIX = sys.argv[2] if len(sys.argv) > 2 else ''
FONT = r'C:\Windows\Fonts\msjh.ttc'
GUNS = {'手槍', '雙手槍', '步槍', '霰彈槍', '機槍', '火箭筒'}

LEFT, RIGHT, MID = (40, 100, 255), (225, 45, 35), (70, 70, 70)
WCOL = [(0, 150, 70), (160, 60, 210)]
CHAIN = [('hips', 'spine'), ('spine', 'chest'), ('chest', 'upperChest'), ('upperChest', 'neck'), ('neck', 'head')]
for s in ('left', 'right'):
    CHAIN += [('upperChest', s + 'Shoulder'), (s + 'Shoulder', s + 'UpperArm'), (s + 'UpperArm', s + 'LowerArm'), (s + 'LowerArm', s + 'Hand'),
              (s + 'Hand', s + 'MiddleProximal'), (s + 'Hand', s + 'ThumbProximal'),
              ('hips', s + 'UpperLeg'), (s + 'UpperLeg', s + 'LowerLeg'), (s + 'LowerLeg', s + 'Foot'), (s + 'Foot', s + 'Toes')]
DIR8 = ['前', '右前', '右', '右後', '後', '左後', '左', '左前']


def dir8(r, f):
    a = math.degrees(math.atan2(r, f)) % 360
    return DIR8[int(((a + 22.5) % 360) // 45)]


def load(id):
    J = lambda n: json.load(open(os.path.join(MOT, id, n), encoding='utf8'))
    return J('angles.json'), J('analysis.json'), J('curves.json')


def to_world(ang):
    """回傳 {骨頭: (S,3) 陣列 [r,u,f]}（含 Root 移動）、root (S,4)、武器軌跡"""
    rm = np.array(ang['rootMotion'], dtype=float)
    yaw = np.radians(np.unwrap(np.radians(rm[:, 3])) * 180 / np.pi)
    c, s = np.cos(yaw)[:, None], np.sin(yaw)[:, None]

    def conv(arr):
        p = np.array(arr, dtype=float)
        x = c[:, 0] * p[:, 0] + s[:, 0] * p[:, 2] + rm[:, 0]
        z = -s[:, 0] * p[:, 0] + c[:, 0] * p[:, 2] + rm[:, 2]
        return np.stack([-x, p[:, 1] + rm[:, 1], z], 1)

    W = {b: conv(v) for b, v in ang['worldPositions'].items()}
    trails = [{'tip': conv(t['tip']), 'base': conv(t['base'])} for t in (ang.get('weaponTrails') or [])]
    root = np.stack([-rm[:, 0], rm[:, 1], rm[:, 2], np.degrees(yaw)], 1)
    return W, root, trails


def seg_dist(p, a, b):
    ab = b - a
    t = np.clip(((p - a) * ab).sum(1) / np.maximum((ab * ab).sum(1), 1e-9), 0, 1)
    return np.linalg.norm(p - (a + ab * t[:, None]), axis=1)


def chest_frame(W, i):
    """第 i 個取樣的胸口座標系：原點＝兩肩中點，right、up、fwd（水平）"""
    o = (W['leftUpperArm'][i] + W['rightUpperArm'][i]) / 2
    rv = W['rightUpperArm'][i] - W['leftUpperArm'][i]; rv[1] = 0; rv /= max(np.linalg.norm(rv), 1e-9)
    up = np.array([0, 1.0, 0])
    fw = np.array([-rv[2], 0, rv[0]])  # 在 (r,u,f) 座標裡，右邊往左轉 90°＝前
    return o, rv, up, fw


def rel_words(v):
    """胸口座標系下的位置 → 「右上」這類詞"""
    side = '右' if v[0] > 0.2 else '左' if v[0] < -0.2 else ''
    vert = '上' if v[1] > 0.25 else '下' if v[1] < -0.35 else ''
    w = side + vert
    if not w:
        w = '正前' if v[2] > 0.3 else '身後' if v[2] < -0.3 else '中間'
    elif not side:
        w = '正' + vert
    return w


def facing_yaw(W, i):
    """骨盆朝向（度，相對角色一開始的前方，正＝往左）"""
    rv = W['rightUpperLeg'][i] - W['leftUpperLeg'][i]
    fw = np.array([-rv[2], rv[0]])  # (r, f) 平面的前方
    return math.degrees(math.atan2(-fw[0], fw[1]))


def features(id, ang, an, cu, W, root, trails):
    fps, spf = ang['frameRate'], ang['samplesPerFrame']
    S = ang['sampleCount']
    fi = np.arange(0, S, spf)  # 每格
    dur = cu['length']
    loop = bool(cu['settings']['loopTime'])
    weapon = cu.get('weapon', '')
    F = {'id': id, 'character': cu.get('sourceCharacter'), 'weapon': weapon, 'oldCategory': cu.get('category'),
         'oldLabel': cu.get('label'), 'oldDescription': cu.get('description'),
         '長度秒': round(dur, 3), '格數': ang['frameCount'], '每秒格數': fps, '循環': loop,
         '原檔': cu.get('sourceFile')}
    # 站立參考高度：大腿＋小腿長＋腳踝高
    leg = np.linalg.norm(W['leftUpperLeg'][0] - W['leftLowerLeg'][0]) + np.linalg.norm(W['leftLowerLeg'][0] - W['leftFoot'][0])
    stand = leg + 0.08 + np.linalg.norm(W['hips'][0] - W['leftUpperLeg'][0]) * 0.3
    hipsY = W['hips'][fi, 1]
    ratio = hipsY / stand
    F['骨盆高度比'] = {'說明': '骨盆高度 ÷ 站直時骨盆高度（1＝站直）', '最低': round(float(ratio.min()), 2), '中位數': round(float(np.median(ratio)), 2), '最高': round(float(ratio.max()), 2),
                   '開始': round(float(ratio[0]), 2), '結束': round(float(ratio[-1]), 2)}
    # Root 移動
    rp = root[:, [0, 2]]
    net = rp[-1] - rp[0]
    path = float(np.linalg.norm(np.diff(rp[fi], axis=0), axis=1).sum())
    sp = np.linalg.norm(np.diff(rp[fi], axis=0), axis=1) * fps
    turn = float(root[-1, 3] - root[0, 3])
    hips_h = W['hips'][:, [0, 2]]
    hips_net = hips_h[-1] - hips_h[0]
    F['移動'] = {'說明': 'Root（角色位置）在角色一開始方向下的移動；右＝角色右手邊',
               '淨位移公尺': {'右': round(float(net[0]), 2), '前': round(float(net[1]), 2)}, '淨距離': round(float(np.linalg.norm(net)), 2),
               '方向': dir8(net[0], net[1]) if np.linalg.norm(net) >= 0.3 else '原地',
               '路徑長': round(path, 2), '平均速度m/s': round(path / dur, 2) if dur > 0 else 0, '最高速度m/s': round(float(sp.max()) if len(sp) else 0, 2),
               '骨盆淨位移（含原地扭動）': {'右': round(float(hips_net[0]), 2), '前': round(float(hips_net[1]), 2)},
               'Root轉向度': round(turn, 1), '轉向說明': '正＝往左轉、負＝往右轉'}
    # 骨盆朝向變化（原地轉身時 Root 不一定轉）
    fy = np.array([facing_yaw(W, i) for i in fi])
    fy = np.degrees(np.unwrap(np.radians(fy)))
    F['骨盆朝向'] = {'開始': round(float(fy[0]), 1), '結束': round(float(fy[-1]), 1), '最左': round(float(fy.max()), 1), '最右': round(float(fy.min()), 1), '說明': '度，相對角色一開始的前方，正＝朝左'}
    # 移動方向相對身體朝向（瞄準走路用）
    if np.linalg.norm(net) >= 0.3:
        mv = math.degrees(math.atan2(-net[0], net[1]))
        F['移動']['移動方向相對骨盆朝向度'] = round(float(((mv - np.median(fy)) + 180) % 360 - 180), 1)
        F['移動']['說明2'] = '0＝往骨盆正前方、+90＝往骨盆左邊、-90＝往骨盆右邊、180＝往後'
    # 腳
    fc = an.get('footContacts', {})
    nf = ang['frameCount']
    onL = np.zeros(nf, bool); onR = np.zeros(nf, bool)
    for a, b in fc.get('left', []): onL[a:b + 1] = True
    for a, b in fc.get('right', []): onR[a:b + 1] = True
    air = ~(onL | onR)
    footY = np.minimum(W['leftFoot'][fi, 1], W['rightFoot'][fi, 1])[:nf]
    F['腳'] = {'踩地格（左）': fc.get('left'), '踩地格（右）': fc.get('right'),
              '雙腳離地格數': int(air.sum()), '雙腳離地秒': round(float(air.sum()) / fps, 2), '最高時腳離地公尺': round(float(footY.max() - 0.08), 2)}
    # 交叉步：左右腳在身體左右方向上交換位置
    rvh = W['rightUpperLeg'][fi] - W['leftUpperLeg'][fi]
    rvh[:, 1] = 0; rvh /= np.maximum(np.linalg.norm(rvh, axis=1, keepdims=True), 1e-9)
    fwh = np.stack([-rvh[:, 2], np.zeros(len(fi)), rvh[:, 0]], 1)
    d = W['rightFoot'][fi] - W['leftFoot'][fi]
    lat = (d * rvh).sum(1); lon = (d * fwh).sum(1)
    cross = lat < -0.02  # 右腳跑到左腳左邊
    if cross.sum() >= 2:
        F['腳']['交叉步'] = {'交叉格數': int(cross.sum()), '右腳在左腳前面的格數': int((cross & (lon > 0.03)).sum()), '右腳在左腳後面的格數': int((cross & (lon < -0.03)).sum()),
                          '說明': '右腳跑到左腳的左邊時，右腳在前＝前交叉（右腳從前面跨過）、在後＝後交叉'}
    # 膝蓋著地
    kL, kR = W['leftLowerLeg'][fi, 1], W['rightLowerLeg'][fi, 1]
    F['膝蓋'] = {'左膝最低公尺': round(float(kL.min()), 2), '右膝最低公尺': round(float(kR.min()), 2),
               '左膝著地比例': round(float((kL < 0.15).mean()), 2), '右膝著地比例': round(float((kR < 0.15).mean()), 2)}
    # 倒地
    headY = W['head'][fi, 1]
    F['頭高度'] = {'開始': round(float(headY[0]), 2), '最低': round(float(headY.min()), 2), '結束': round(float(headY[-1]), 2)}
    ja = an.get('jointAngles', {})
    if 'trunkLean' in ja:
        tl = np.array(ja['trunkLean'])
        F['上身前傾度'] = {'中位數': round(float(np.median(tl)), 1), '最大': round(float(tl.max()), 1), '最小': round(float(tl.min()), 1)}
    # 手和武器
    ws = ang.get('weapons') or []
    hands = {}
    if weapon != '通用' and trails:
        main = trails[0]
        dl_all = seg_dist(W['leftHand'][fi], main['base'][fi], main['tip'][fi])
        if len(trails) > 1 and any(w['attachBone'] == 'leftHand' for w in ws):
            # 刀身和左手的刀鞘疊在一起（按刀、刀在鞘裡）時，左手是握刀鞘，不算握主武器
            l = next(i for i, w in enumerate(ws) if w['attachBone'] == 'leftHand')
            mid = lambda t: (t['tip'][fi] + t['base'][fi]) / 2
            dl_all = np.where(np.linalg.norm(mid(main) - mid(trails[l]), axis=1) < 0.25, 9.0, dl_all)
        dl = dl_all[W['head'][fi, 1] >= 0.6] if (W['head'][fi, 1] >= 0.6).any() else dl_all  # 倒地後手剛好落在武器旁不算握
        hands['左手離主武器中位數公尺'] = round(float(np.median(dl)), 2)
        hands['左手離主武器0.15m內比例'] = round(float((dl < 0.15).mean()), 2)
        hands['左手離主武器0.28m內比例'] = round(float((dl < 0.28).mean()), 2)
        hands['左手有拿東西'] = any(w['attachBone'] == 'leftHand' for w in ws)
        hands['說明'] = '主武器＝第一把（右手）；距離是左手到武器中心線（柄尾到尖端）的距離，頭低於 0.6 m（倒地）的格不算。槍有握把在槍身下方，所以槍看 0.28 m、刀劍看 0.15 m'
        hands['武器'] = [w['name'] + '（' + ('右手' if w['attachBone'] == 'rightHand' else '左手' if w['attachBone'] == 'leftHand' else w['attachBone']) + '）' for w in ws]
    F['手'] = hands
    # 武器揮動（近戰）／槍口方向（槍）
    if weapon != '通用' and trails:
        if weapon in GUNS:
            t, b = trails[0]['tip'][fi], trails[0]['base'][fi]
            v = t - b; v /= np.maximum(np.linalg.norm(v, axis=1, keepdims=True), 1e-9)
            pitch = np.degrees(np.arcsin(np.clip(v[:, 1], -1, 1)))
            yawm = np.degrees(np.arctan2(-v[:, 0], v[:, 2]))
            F['槍口'] = {'仰角中位數': round(float(np.median(pitch)), 1), '仰角最低': round(float(pitch.min()), 1), '仰角最高': round(float(pitch.max()), 1),
                       '水平方向中位數': round(float(np.median(((yawm - fy + 180) % 360) - 180)), 1),
                       '說明': '仰角 0＝水平、負＝朝下；水平方向相對骨盆朝向，正＝偏左'}
        else:
            swings = []
            for wi, tr in enumerate(trails):
                rel = tr['tip'][fi] - W['hips'][fi]
                spd = np.zeros(len(fi)); spd[1:-1] = np.linalg.norm(rel[2:] - rel[:-2], axis=1) * fps / 2
                if len(spd) < 3: continue
                thr = max(5.0, 0.45 * spd.max())
                used = np.zeros(len(spd), bool)
                for m in np.argsort(-spd):
                    if spd[m] < thr or used[m]: continue
                    # 這一揮：最快那格往前後延伸到速度低於該次最高速的一半
                    a = m
                    while a > 0 and spd[a - 1] > 0.5 * spd[m] and not used[a - 1]: a -= 1
                    b = m
                    while b + 1 < len(spd) and spd[b + 1] > 0.5 * spd[m] and not used[b + 1]: b += 1
                    used[max(0, a - 2):b + 3] = True
                    def loc(k):
                        o, rv, up, fw = chest_frame(W, fi[k])
                        p = tr['tip'][fi[k]] - o
                        return [float(np.dot(p, rv)), float(np.dot(p, up)), float(np.dot(p, fw))]
                    s0, s1 = loc(a), loc(b)
                    arc = float(np.linalg.norm(np.diff(tr['tip'][fi[a:b + 1]], axis=0), axis=1).sum())
                    swings.append({'武器': wi, '開始秒': round(a / fps, 2), '最快秒': round(m / fps, 2), '結束秒': round(b / fps, 2), '最高速m/s': round(float(spd[m]), 1),
                                   '尖端從': rel_words(s0), '到': rel_words(s1), '尖端起點(右,上,前)': [round(x, 2) for x in s0], '尖端終點(右,上,前)': [round(x, 2) for x in s1],
                                   '軌跡長公尺': round(arc, 2), '期間骨盆轉向度': round(float(fy[b] - fy[a]), 0)})
            swings.sort(key=lambda s: s['開始秒'])
            # 揮主武器那幾格左手有沒有握著（雙手劈砍）
            sf = [k for x in swings if x['武器'] == 0 for k in range(int(round(x['開始秒'] * fps)), int(round(x['結束秒'] * fps)) + 1) if k < len(dl_all)]
            if sf:
                F['手']['揮主武器時左手0.15m內比例'] = round(float((dl_all[sf] < 0.15).mean()), 2)
            F['揮動'] = {'說明': '每一揮＝武器尖端（相對骨盆）速度高於該次最高速一半的時段；位置以每格當下的胸口為準（右、上、前，公尺；前＝胸口朝向），「從／到」是粗分的方位詞；武器 0＝第一把（右手）、1＝第二把',
                       '次數': len(swings), '段落': swings}
    return F


def tags_rule(F):
    """固定四欄標籤（照數據的規則，見 unity/characters/NAMING.md）"""
    t = {}
    t['播放'] = '循環' if F['循環'] else '單次'
    t['位移'] = F['移動']['方向']
    r = F['骨盆高度比']['中位數']
    if F['頭高度']['結束'] < 0.5:
        t['姿勢'] = '倒地'
    elif max(F['膝蓋']['左膝著地比例'], F['膝蓋']['右膝著地比例']) >= 0.4:
        t['姿勢'] = '跪姿'
    elif r < 0.55:
        t['姿勢'] = '深蹲'
    elif r < 0.835:
        t['姿勢'] = '半蹲'
    else:
        t['姿勢'] = '站姿'
    h = F['手']
    if F['weapon'] == '通用':
        t['手'] = '空手'
    elif (h.get('左手離主武器0.28m內比例' if F['weapon'] in GUNS else '左手離主武器0.15m內比例', 0) >= 0.4 or h.get('揮主武器時左手0.15m內比例', 0) >= 0.25) and F['weapon'] not in ('雙刀', '雙苦無', '雙手槍', '劍盾'):
        t['手'] = '雙手'
    elif h.get('左手有拿東西'):
        t['手'] = '左右各持'
    else:
        t['手'] = '單手'
    return t


# ---------- 連拍圖 ----------
TW, TH, TT = 190, 230, 190  # 每格寬、側視高、俯視高
LBL = 92


def font(n):
    return ImageFont.truetype(FONT, n)


def draw_pose(dr, W, trails, i, proj, prev_i, weapon_is_gun, wcount, extra_tip=True):
    def P(b):
        return proj(W[b][i])
    # 先畫遠的那一側：用投影的深度
    for a, b in CHAIN:
        col = LEFT if a.startswith('left') or b.startswith('left') else RIGHT if a.startswith('right') or b.startswith('right') else MID
        dr.line([P(a), P(b)], fill=col, width=3 if 'Proximal' not in b else 2)
    eyes = (W['leftEye'][i] + W['rightEye'][i]) / 2
    hc = W['head'][i] + (eyes - W['head'][i]) * 0.7
    cx, cy = proj(hc)
    rpx = proj.scale * 0.1
    dr.ellipse([cx - rpx, cy - rpx, cx + rpx, cy + rpx], outline=MID, width=2)
    ax = W['head'][i] - W['neck'][i]; ax /= np.linalg.norm(ax)
    fd = eyes - W['head'][i]; fd = fd - ax * np.dot(fd, ax); n = np.linalg.norm(fd)
    if n > 1e-6:
        dr.line([proj(hc), proj(hc + fd / n * 0.17)], fill=(240, 150, 0), width=3)  # 臉朝向
    for wi in range(wcount):
        tr = trails[wi]
        col = WCOL[wi % 2]
        if extra_tip and prev_i is not None and prev_i < i:
            pts = [proj(tr['tip'][k]) for k in range(prev_i, i + 1, 2)]
            if len(pts) > 1:
                lc = tuple(min(255, c + 120) for c in col)
                dr.line(pts, fill=lc, width=2)
        dr.line([proj(tr['base'][i]), proj(tr['tip'][i])], fill=col, width=5)
        tx, ty = proj(tr['tip'][i])
        dr.ellipse([tx - 4, ty - 4, tx + 4, ty + 4], fill=col)


class Proj:
    def __init__(self, view, center, scale, w, h, groundY):
        self.view, self.c, self.scale, self.w, self.h, self.gy = view, center, scale, w, h, groundY

    def __call__(self, p):
        if self.view == 'back':
            return (self.w / 2 + (p[0] - self.c[0]) * self.scale, self.gy - p[1] * self.scale)
        if self.view == 'side':
            return (self.w / 2 + (p[2] - self.c[2]) * self.scale, self.gy - p[1] * self.scale)
        return (self.w / 2 + (p[0] - self.c[0]) * self.scale, self.h / 2 - (p[2] - self.c[2]) * self.scale)


def grid(dr, proj, view, w, h):
    s = proj.scale
    if view in ('back', 'side'):
        k = 0 if view == 'back' else 2
        x0 = proj.c[k] - w / 2 / s
        g = math.floor(x0 / 0.5) * 0.5
        while g < x0 + w / s:
            x = w / 2 + (g - proj.c[k]) * s
            dr.line([(x, proj.gy), (x, proj.gy + 6)], fill=(150, 150, 150), width=1)
            g += 0.5
        dr.line([(0, proj.gy), (w, proj.gy)], fill=(150, 150, 150), width=1)
    else:
        for k, horiz in ((0, False), (2, True)):
            span = (w if not horiz else h) / s
            x0 = proj.c[k] - span / 2
            g = math.floor(x0 / 0.5) * 0.5
            while g < x0 + span:
                if not horiz:
                    x = w / 2 + (g - proj.c[0]) * s
                    dr.line([(x, 0), (x, h)], fill=(225, 225, 225), width=1)
                else:
                    y = h / 2 - (g - proj.c[2]) * s
                    dr.line([(0, y), (w, y)], fill=(225, 225, 225), width=1)
                g += 0.5


def sheets(id, ang, cu, W, root, trails, F, outdir):
    fps, spf, S = ang['frameRate'], ang['samplesPerFrame'], ang['sampleCount']
    dur = cu['length']
    loop = F['循環']
    K = int(round(dur / 0.12))
    K = max(8, min(16 if loop else 24, K))
    K = int(math.ceil(K / 8) * 8)
    if loop:
        times = [dur * k / K for k in range(K)]
    else:
        times = [dur * k / (K - 1) for k in range(K)]
    idx = [min(S - 1, int(round(t * fps * spf))) for t in times]
    wcount = len(trails) if F['weapon'] != '通用' else 0
    allp = np.concatenate([W[b] for b in W] + [tr[k] for tr in trails[:wcount] for k in ('tip', 'base')])
    top = max(2.0, float(allp[:, 1].max()) + 0.12)
    low = min(0.0, float(allp[:, 1].min()))
    scale = min(88.0, (TH - 30) / (top - low))
    gy = TH - 10 + low * scale
    f14, f13, f12 = font(15), font(13), font(12)
    views = [('back', '後方視角\n畫面左＝\n角色左手', TH), ('side', '右側視角\n畫面右＝\n角色前方', TH), ('top', '俯視\n畫面上＝\n一開始的前方', TT)]
    files = []
    nimg = K // 8
    for n in range(nimg):
        cols = list(range(n * 8, n * 8 + 8))
        H = 26 + TH * 2 + TT + 34
        img = Image.new('RGB', (LBL + TW * 8, H), 'white')
        dr = ImageDraw.Draw(img)
        dr.text((6, 4), f'{id}  第 {n + 1}/{nimg} 張（共 {K} 格取樣，{dur:.2f} 秒{"，循環" if loop else ""}）  藍＝左半身、紅＝右半身、橘＝臉朝向、綠＝武器（第二把紫）、淡色線＝上一格到這格的武器尖端軌跡', fill='black', font=f12)
        y = 26
        for view, lab, h in views:
            dr.text((6, y + 8), lab, fill='black', font=f13)
            for c, k in enumerate(cols):
                i = idx[k]
                tile = Image.new('RGB', (TW, h), 'white')
                td = ImageDraw.Draw(tile)
                center = W['hips'][i]
                proj = Proj(view, center, scale if view != 'top' else 78.0, TW, h, gy)
                grid(td, proj, view, TW, h)
                if view != 'top':
                    # 腳踩地標記
                    fr = min(ang['frameCount'] - 1, int(round(times[k] * fps)))
                    for side, colr in (('left', LEFT), ('right', RIGHT)):
                        for a, b in (F['腳']['踩地格（左）'] if side == 'left' else F['腳']['踩地格（右）']) or []:
                            if a <= fr <= b:
                                px, _ = proj(W[side + 'Foot'][i])
                                td.rectangle([px - 5, gy + 2, px + 5, gy + 6], fill=colr)
                draw_pose(td, W, trails, i, proj, idx[k - 1] if k > 0 else None, False, wcount)
                if view == 'top':
                    # Root 位置和朝向
                    rx, ry = proj(np.array([root[i, 0], 0, root[i, 2]]))
                    td.ellipse([rx - 3, ry - 3, rx + 3, ry + 3], outline=(0, 0, 0))
                td.rectangle([0, 0, TW - 1, h - 1], outline=(200, 200, 200))
                img.paste(tile, (LBL + c * TW, y))
                if view == 'back':
                    dr.text((LBL + c * TW + 4, y + 2), f'#{k + 1}  {times[k]:.2f}s', fill=(90, 90, 90), font=f12)
            y += h
        rr = F['移動']
        dr.text((6, y + 6), f"Root 淨位移：右 {rr['淨位移公尺']['右']} m、前 {rr['淨位移公尺']['前']} m（{rr['方向']}），Root 轉向 {rr['Root轉向度']}°；骨盆朝向 {F['骨盆朝向']['開始']}° → {F['骨盆朝向']['結束']}°（正＝朝左）；格線 0.5 m", fill='black', font=f12)
        fn = os.path.join(outdir, f'{id}_{n + 1}.png')
        img.save(fn, optimize=True)
        files.append(fn)
    # 全程軌跡總覽：武器尖端（顏色由淺到深＝時間先後）、骨盆／Root 路徑
    ov = overview(id, ang, cu, W, root, trails, F, wcount, idx, times)
    fn = os.path.join(outdir, f'{id}_overview.png')
    ov.save(fn, optimize=True)
    files.append(fn)
    return files, [round(t, 3) for t in times]


def overview(id, ang, cu, W, root, trails, F, wcount, idx, times):
    S = ang['sampleCount']
    PW, PH = 420, 360
    img = Image.new('RGB', (PW * 3, PH + 60), 'white')
    dr = ImageDraw.Draw(img)
    f12 = font(12)
    dr.text((6, 4), f'{id} 全程總覽：武器尖端軌跡（淺→深＝先→後，數字＝連拍圖的格號），黑線＝骨盆移動路徑，灰色火柴人＝開始姿勢、黑色＝結束姿勢', fill='black', font=f12)
    pts = np.concatenate([W['hips']] + [tr['tip'] for tr in trails[:wcount]] + [W['head'], W['leftFoot'], W['rightFoot']])
    for p, (view, title) in enumerate((('back', '後方視角（畫面左＝角色左）'), ('side', '右側視角（畫面右＝角色前方）'), ('top', '俯視（畫面上＝一開始的前方）'))):
        tile = Image.new('RGB', (PW, PH), 'white')
        td = ImageDraw.Draw(tile)
        if view == 'top':
            a, b = pts[:, 0], pts[:, 2]
        elif view == 'back':
            a, b = pts[:, 0], pts[:, 1]
        else:
            a, b = pts[:, 2], pts[:, 1]
        span = max(a.max() - a.min(), b.max() - b.min(), 1.0) + 0.4
        sc = min(PW, PH - 20) / span
        cen = np.array([0.0, 0, 0])
        if view == 'top':
            cen[0], cen[2] = (a.max() + a.min()) / 2, (b.max() + b.min()) / 2
        elif view == 'back':
            cen[0] = (a.max() + a.min()) / 2
        else:
            cen[2] = (a.max() + a.min()) / 2
        gy = PH / 2 + (b.max() + b.min()) / 2 * sc
        proj = Proj(view, cen, sc, PW, PH, gy)
        grid(td, proj, view, PW, PH)
        for i, colr in ((0, (190, 190, 190)), (S - 1, (20, 20, 20))):
            for x, y in CHAIN:
                td.line([proj(W[x][i]), proj(W[y][i])], fill=colr, width=2)
        td.line([proj(W['hips'][k]) for k in range(0, S, 4)], fill=(0, 0, 0), width=2)
        for wi in range(wcount):
            tip = trails[wi]['tip']
            base = np.array(WCOL[wi % 2])
            for k in range(0, S - 4, 4):
                f = k / S
                c = tuple(int(255 - (255 - v) * (0.25 + 0.75 * f)) for v in base)
                td.line([proj(tip[k]), proj(tip[k + 4])], fill=c, width=3)
            for n, i in enumerate(idx):
                x, y = proj(tip[i])
                td.text((x + 3, y - 7), str(n + 1), fill=tuple(base), font=f12)
        td.rectangle([0, 0, PW - 1, PH - 1], outline=(200, 200, 200))
        img.paste(tile, (p * PW, 40))
        dr.text((p * PW + 6, 22), title, fill='black', font=f12)
    return img


def work(id):
    try:
        ang, an, cu = load(id)
        W, root, trails = to_world(ang)
        F = features(id, ang, an, cu, W, root, trails)
        F['標籤'] = tags_rule(F)
        os.makedirs(os.path.join(OUT, 'sheets'), exist_ok=True)
        files, times = sheets(id, ang, cu, W, root, trails, F, os.path.join(OUT, 'sheets'))
        F['連拍圖'] = files
        F['連拍格時間秒'] = times
        return F
    except Exception as e:
        import traceback
        return {'id': id, 'error': traceback.format_exc()}


if __name__ == '__main__':
    ids = sorted(d for d in os.listdir(MOT) if os.path.isfile(os.path.join(MOT, d, 'angles.json')) and d.startswith(PREFIX))
    os.makedirs(os.path.join(OUT, 'features'), exist_ok=True)
    with Pool(min(24, os.cpu_count())) as pool:
        res = pool.map(work, ids, chunksize=1)
    bad = [r for r in res if 'error' in r]
    for r in bad:
        print(r['id'], r['error'])
    good = [r for r in res if 'error' not in r]
    json.dump(good, open(os.path.join(OUT, 'features_all.json'), 'w', encoding='utf8'), ensure_ascii=False)
    print('ok', len(good), 'bad', len(bad))
