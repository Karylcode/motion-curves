# 照 NAMING.md 的規則，從原檔 id 和數據表產生命名草稿，並為每個角色寫一份給子代理看的資料包。
# 用法：python -X utf8 tools/naming-draft.py <naming-pack.py 的輸出資料夾>
# 輸出：<輸出>/drafts.json（全部草稿）、<輸出>/packs/<角色>.md
import json, os, re, sys, glob

OUT = os.path.normpath(sys.argv[1])
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
F = {f['id']: f for f in json.load(open(os.path.join(OUT, 'features_all.json'), encoding='utf8'))}

# 每支動作屬於哪個角色設定檔（unity/characters/<角色>.json）；設定檔的 animators 是原版 Animator 匯出的 unity/animators/<名稱>.json（可省略）
CONFIG_OF = {}
for cf in glob.glob(os.path.join(ROOT, 'unity', 'characters', '*.json')):
    if os.path.basename(cf).startswith('_'): continue
    c = json.load(open(cf, encoding='utf8'))
    for m in c.get('motions', []):
        CONFIG_OF[m['id']] = (c.get('character', ''), os.path.splitext(os.path.basename(cf))[0], c.get('animators', []))


def char_info(ids):
    """(角色名, 角色設定檔名, 原版 Animator 清單)"""
    return CONFIG_OF.get(ids[0]) or (F[ids[0]].get('character') or ids[0].split('_', 1)[0], None, [])
DIRW = {'f': '前', 'b': '後', 'l': '左', 'r': '右', 'fl': '左前', 'fr': '右前', 'bl': '左後', 'br': '右後'}
DIRE = {'前': 'F', '後': 'B', '左': 'L', '右': 'R', '左前': 'FL', '右前': 'FR', '左後': 'BL', '右後': 'BR', '原地': ''}
EMO = {'angry': ('生氣', 'Angry'), 'disappointment': ('失望', 'Disappointment'), 'greeting': ('打招呼', 'Greeting'), 'sad': ('難過', 'Sad'),
       'shy': ('害羞', 'Shy'), 'smile': ('微笑', 'Smile'), 'surprise': ('驚訝', 'Surprise')}
TODO = '（待填）'


def kneel(f):
    return max(f['膝蓋']['左膝著地比例'], f['膝蓋']['右膝著地比例']) >= 0.4


def turn_deg(f):
    t = f['移動']['Root轉向度']
    if abs(t) < 20:
        t = f['骨盆朝向']['結束'] - f['骨盆朝向']['開始']
    d = int(round(abs(t) / 45.0) * 45)
    return ('左' if t > 0 else '右'), d


def draft(id):
    f = F[id]
    pre, rest = id.split('_', 1)
    s = rest.lower()
    mv = f['移動']['方向']
    need = ''

    def loc(type_, posture, en_type, en_post):
        return type_, type_ + '・' + posture, en_type + ('_' + en_post if en_post else '')

    if f.get('oldCategory') == '表情':
        if s in EMO:
            zh, en = EMO[s]
            return '表情', '表情・' + zh, 'Emote_' + en, ''
        return '表情', '表情・' + TODO, 'Emote_' + TODO, '寫是什麼表情'
    m = re.fullmatch(r'(sp_)?(attack|skill|sp_skill)_0?(\d)', s)
    if m:
        n = int(m.group(3))
        if 'skill' in s:
            return '技能', f'技能 {n}：{TODO}', f'Skill_{n:02d}', '寫特徵'
        return '攻擊', f'攻擊 {n}：{TODO}', f'Attack_{n:02d}', '寫特徵'
    table = {
        'idle': loc('待機', '一般', 'Idle', ''), 'sp_idle': loc('待機', '架式', 'Idle', 'Stance'),
        'walk': loc('走路', '一般', 'Walk', ''), 'sp_walk': loc('走路', '架式', 'Walk', 'Stance'), 'crouch_walk': loc('走路', '蹲姿', 'Walk', 'Crouch'),
        'run': loc('跑步', '一般', 'Run', ''), 'sp_run': loc('小跑', '架式', 'Jog', 'Stance'), 'crouch_jog': loc('小跑', '蹲姿', 'Jog', 'Crouch'),
        'aimidle': loc('待機', '瞄準', 'Idle', 'Aim'),
    }
    if s in table:
        t, zh, en = table[s]
        if s == 'sp_run':
            need = '確認是小跑還是跑步'
        return t, zh, en, need
    if s == 'crouch_idle':
        k = kneel(f)
        return '待機', '待機・' + ('跪姿' if k else '蹲姿'), 'Idle_' + ('Kneel' if k else 'Crouch'), ''
    if s == 'sprint':
        return '衝刺', '衝刺', 'Sprint', ''
    if s == 'stun':
        return '暈眩', '暈眩', 'Stun', ''
    m = re.fullmatch(r'sp_turn_([lr])', s)
    if m:
        side, d = turn_deg(f)
        return '轉身', f'轉身・架式・{side} {d}°', f'Turn_Stance_{"L" if side == "左" else "R"}{d}', ''
    m = re.fullmatch(r'(crouch_)?aimturn_([lr])90', s)
    if m:
        side, d = turn_deg(f)
        post = ('跪姿瞄準' if kneel(f) else '蹲姿瞄準') if m.group(1) else '瞄準'
        ep = {'瞄準': 'Aim', '跪姿瞄準': 'KneelAim', '蹲姿瞄準': 'CrouchAim'}[post]
        return '轉身', f'轉身・{post}・{side} {d}°', f'Turn_{ep}_{"L" if side == "左" else "R"}{d}', ''
    m = re.fullmatch(r'quickshift_([fblr])', s)
    if m:
        w = DIRW[m.group(1)]
        return '快速移位', '快速移位・' + w, 'QuickShift_' + m.group(1).upper(), ('原檔方向' + w + '，數據方向' + mv if mv != w else '')
    if s == 'evade':
        return '閃避', '閃避' + ('・' + mv if mv != '原地' else ''), 'Evade' + ('_' + DIRE[mv] if mv != '原地' else ''), '確認方向，原地的話寫差異'
    m = re.fullmatch(r'hit_(l|r|upper|low)', s)
    if m:
        zh = {'l': '左側', 'r': '右側', 'upper': '頭部', 'low': '腹部'}[m.group(1)]
        return '受擊', '受擊・' + zh, 'Hit_' + {'l': 'L', 'r': 'R', 'upper': 'Head', 'low': 'Stomach'}[m.group(1)], '確認被打的位置'
    m = re.fullmatch(r'die(_([fb]))?', s)
    if m:
        if m.group(2):
            return '倒下', '倒下・' + ('向前' if m.group(2) == 'f' else '向後'), 'Die_' + m.group(2).upper(), '確認倒的方向'
        return '倒下', '倒下', 'Die', ''
    if s in ('take', 'takegun'):
        return '取出', '取出・' + TODO, 'Draw_' + TODO, '寫從哪裡取出（背後、腰後、槍套……）'
    if s in ('put', 'putgun'):
        return '收起', '收起・' + TODO, 'Holster_' + TODO, '寫收到哪裡'
    if s == 'aimjog':
        return '小跑', '小跑・瞄準・' + mv, 'Jog_Aim_' + DIRE.get(mv, ''), ''
    m = re.fullmatch(r'(crouch_)?aimwalk_([fblr]{1,2})', s)
    if m:
        post = ('跪姿瞄準' if kneel(f) else '蹲姿瞄準') if m.group(1) else '瞄準'
        ep = {'瞄準': 'Aim', '跪姿瞄準': 'KneelAim', '蹲姿瞄準': 'CrouchAim'}[post]
        orig = DIRW[m.group(2)]
        n = '' if orig == mv else f'原檔方向是{orig}、實際移動是{mv}；同名時加差異'
        return '走路', f'走路・{post}・{mv}', f'Walk_{ep}_{DIRE.get(mv, "")}', n
    m = re.fullmatch(r'aimwalk_shoot_([lr])', s)
    if m:
        return '射擊', f'射擊・一般・{mv}（{TODO}）', f'Shoot_{DIRE.get(mv, "")}_' + TODO, '邊走邊射：寫差異（哪隻手的槍）'
    m = re.fullmatch(r'(crouch_?)?(auto)?shoot(_([lr]))?', s) or re.fullmatch(r'aimidle_(auto)shoot', s)
    if m:
        crouch = s.startswith('crouch')
        post = ('跪姿' if kneel(f) else '蹲姿') if crouch else '一般'
        ep = {'一般': '', '跪姿': 'Kneel', '蹲姿': 'Crouch'}[post]
        diffs, ed = [], []
        if 'auto' in s:
            diffs.append('連射'); ed.append('Auto')
        if s.startswith('aimidle'):
            diffs.append(TODO); ed.append(TODO)
        mm = re.search(r'_([lr])$', s)
        if mm:
            diffs.append('左手槍' if mm.group(1) == 'l' else '右手槍'); ed.append('LeftGun' if mm.group(1) == 'l' else 'RightGun')
        zh = '射擊・' + post + ('（' + '、'.join(diffs) + '）' if diffs else '')
        en = 'Shoot' + ('_' + ep if ep else '') + ('_' + '_'.join(ed) if ed else '')
        return '射擊', zh, en, ('確認差異' if diffs else '')
    m = re.fullmatch(r'(crouch_)?reload', s)
    if m:
        post = '跪姿' if kneel(f) else ('蹲姿' if m.group(1) else '一般')
        ep = {'一般': '', '跪姿': 'Kneel', '蹲姿': 'Crouch'}[post]
        return '換彈', '換彈・' + post, 'Reload' + ('_' + ep if ep else ''), ''
    return TODO, TODO, TODO, '沒有規則，自己判斷'


def state_names(ctrls):
    names = {}
    for c in ctrls:
        p = os.path.join(ROOT, 'unity', 'animators', c + '.json')
        if not os.path.exists(p): continue
        d = json.load(open(p, encoding='utf8'))
        def walk(m, state, extra=''):
            if isinstance(m, str):
                path = m.split('←')[-1].strip()
                names.setdefault(path, []).append(f'{c}：{state}{extra}')
            elif isinstance(m, dict):
                for ch in m.get('children', []):
                    walk(ch['motion'], state, f'（混合樹位置 {ch["position"]}，X＝右、Y＝前）')
        for l in d['layers']:
            for s in l['states']:
                walk(s['motion'], s['state'])
    return names


def fmt_feat(f):
    m = f['移動']; o = f['骨盆朝向']; h = f['骨盆高度比']
    out = []
    out.append(f"移動：{m['方向']}（右 {m['淨位移公尺']['右']} m、前 {m['淨位移公尺']['前']} m，路徑 {m['路徑長']} m，平均 {m['平均速度m/s']} m/s、最快 {m['最高速度m/s']} m/s）；Root 轉向 {m['Root轉向度']}°"
               + (f"；移動方向相對骨盆 {m['移動方向相對骨盆朝向度']}°" if '移動方向相對骨盆朝向度' in m else ''))
    out.append(f"骨盆朝向 {o['開始']}° → {o['結束']}°（最左 {o['最左']}、最右 {o['最右']}，正＝朝左）；骨盆高度比 中位 {h['中位數']}（{h['最低']}～{h['最高']}，開始 {h['開始']}、結束 {h['結束']}）；頭高 開始 {f['頭高度']['開始']} 最低 {f['頭高度']['最低']} 結束 {f['頭高度']['結束']} m")
    ft = f['腳']
    s = f"腳：雙腳離地 {ft['雙腳離地秒']} 秒、腳最高離地 {ft['最高時腳離地公尺']} m；膝蓋著地 左 {f['膝蓋']['左膝著地比例']}、右 {f['膝蓋']['右膝著地比例']}"
    if '交叉步' in ft:
        c = ft['交叉步']; s += f"；交叉步 {c['交叉格數']} 格（右腳在前 {c['右腳在左腳前面的格數']}、在後 {c['右腳在左腳後面的格數']}）"
    out.append(s)
    if '上身前傾度' in f:
        t = f['上身前傾度']; out.append(f"上身前傾 中位 {t['中位數']}°（{t['最小']}～{t['最大']}）")
    hd = f['手']
    if hd:
        out.append(f"手：左手離主武器中位 {hd.get('左手離主武器中位數公尺')} m（0.15 m 內 {hd.get('左手離主武器0.15m內比例')}、0.28 m 內 {hd.get('左手離主武器0.28m內比例')}）；武器 {'、'.join(hd.get('武器', []))}")
    if '槍口' in f:
        g = f['槍口']; out.append(f"槍口仰角 中位 {g['仰角中位數']}°（{g['仰角最低']}～{g['仰角最高']}），水平方向相對骨盆 {g['水平方向中位數']}°（正＝偏左）")
    if '揮動' in f:
        sw = f['揮動']['段落']
        out.append(f"揮動 {len(sw)} 次" + ('：' if sw else ''))
        for x in sw:
            out.append(f"  武器{x['武器']} {x['開始秒']}～{x['結束秒']} 秒（最快 {x['最快秒']} 秒 {x['最高速m/s']} m/s）：尖端 {x['尖端從']} → {x['到']}，"
                       f"起點(右,上,前) {x['尖端起點(右,上,前)']} → 終點 {x['尖端終點(右,上,前)']}，軌跡 {x['軌跡長公尺']} m，期間骨盆轉 {x['期間骨盆轉向度']}°")
    return out


def main():
    drafts = {}
    os.makedirs(os.path.join(OUT, 'packs'), exist_ok=True)
    byp = {}
    for id in sorted(F):
        byp.setdefault(id.split('_', 1)[0], []).append(id)
    for pre, ids in byp.items():
        cname, cfile, ctrls = char_info(ids)
        st = state_names(ctrls)
        L = [f'# {cname} 命名資料包（{len(ids)} 支，id 開頭 {pre}_）', '',
             f'先讀 `{ROOT}\\unity\\characters\\NAMING.md`。連拍圖在 `{OUT}\\sheets\\`，完整數據在 `{OUT}\\features_all.json`。']
        if cfile:
            L.append(f'角色設定檔（武器、原版插槽切換）：`{ROOT}\\unity\\characters\\{cfile}.json`')
        if ctrls:
            L.append('原版 Animator：' + '、'.join(f'`{ROOT}\\unity\\animators\\{c}.json`' for c in ctrls))
        L.append('')
        for id in ids:
            f = F[id]
            t, zh, en, need = draft(id)
            drafts[id] = {'type': t, 'label': zh, 'en': en, 'tags': f['標籤'], '要確認': need}
            tg = f['標籤']
            L += [f'## {id}', '',
                  f"- 原檔：`{f['原檔']}`" + (f"；原版 Animator 狀態：{'；'.join(st.get(f['原檔'], []))}" if st.get(f['原檔']) else ''),
                  f"- 長度 {f['長度秒']} 秒（{f['格數']} 格），{'循環' if f['循環'] else '單次'}",
                  f"- 規則草稿：類型 `{t}`、名稱 `{zh}`、英文 `{en}`" + (f"（要確認：{need}）" if need else ''),
                  f"- 標籤（自動，不改）：姿勢 {tg['姿勢']}／位移 {tg['位移']}／播放 {tg['播放']}／手 {tg['手']}",
                  f"- 舊名稱：{f['oldLabel']}",
                  f"- 舊描述：{f['oldDescription']}",
                  '- 數據：'] + [('    - ' + x.strip()) if x.startswith('  ') else ('  - ' + x) for x in fmt_feat(f)] + [
                  '- 連拍圖：' + '、'.join(f'`{os.path.basename(p)}`' for p in f['連拍圖']) + f"（取樣時間 {', '.join(str(x) for x in f['連拍格時間秒'])} 秒）", '']
        open(os.path.join(OUT, 'packs', cname + '.md'), 'w', encoding='utf8').write('\n'.join(L))
    json.dump(drafts, open(os.path.join(OUT, 'drafts.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    todo = sum(1 for d in drafts.values() if '待填' in d['label'] or d['要確認'])
    print('drafts', len(drafts), '要子代理處理', todo)


main()
