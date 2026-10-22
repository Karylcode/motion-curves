# 把子代理交的命名（<輸出>/out/*.json）和規則草稿（<輸出>/drafts.json，含自動標籤）合併成 public/motions/names.json，
# 並照 unity/characters/NAMING.md 檢查格式、用詞、同角色不重複。
# 用法：python -X utf8 tools/naming-merge.py <naming-pack.py 的輸出資料夾> [--write]（沒加 --write 只檢查）
import json, os, re, sys, glob

OUT = os.path.normpath(sys.argv[1])
WRITE = '--write' in sys.argv
NAMES = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'motions', 'names.json')
TYPES = {'待機': 'Idle', '走路': 'Walk', '小跑': 'Jog', '跑步': 'Run', '衝刺': 'Sprint', '轉身': 'Turn', '快速移位': 'QuickShift', '閃避': 'Evade',
         '攻擊': 'Attack', '技能': 'Skill', '射擊': 'Shoot', '換彈': 'Reload', '受擊': 'Hit', '暈眩': 'Stun', '倒下': 'Die', '取出': 'Draw', '收起': 'Holster', '表情': 'Emote'}
NEED_POSTURE = {'待機', '走路', '小跑', '跑步', '轉身', '射擊', '換彈'}
POSTURES = {'一般', '架式', '蹲姿', '跪姿', '瞄準', '蹲姿瞄準', '跪姿瞄準'}
BAD_WORDS = ['架勢', '低姿', '壓低', '待填']

drafts = json.load(open(os.path.join(OUT, 'drafts.json'), encoding='utf8'))
old = json.load(open(NAMES, encoding='utf8'))
agent = {}
for f in glob.glob(os.path.join(OUT, 'out', '*.json')):
    for k, v in json.load(open(f, encoding='utf8')).items():
        agent[k] = v

problems, questions = [], []
result = {'_note': '每支動作的中文名稱（label）、英文 Animator 狀態名（en）、類型（type）、描述（description）、四欄標籤（tags）。'
                    '命名規範見 unity/characters/NAMING.md；label／en／type／description 由 AI 看連拍圖和數據寫成，tags 由 tools/naming-pack.py 照數據自動算。'
                    '改這裡後跑 node tools/build-index.mjs，會寫進 curves.json 和 index.json。'}
for id in sorted(drafts):
    d = drafts[id]
    a = agent.get(id)
    if a is None:
        if d['type'] == '表情':
            a = {'type': d['type'], 'label': d['label'], 'en': d['en'], 'description': old.get(id, {}).get('description', '')}
        else:
            problems.append(f'{id}：子代理沒交')
            continue
    e = {'type': a.get('type', ''), 'label': a.get('label', '').strip(), 'en': a.get('en', '').strip(), 'description': a.get('description', '').strip(), 'tags': d['tags']}
    if a.get('疑問'):
        questions.append(f'{id}：{a["疑問"]}')
    t, lab, en = e['type'], e['label'], e['en']
    if t not in TYPES:
        problems.append(f'{id}：類型「{t}」不在表裡')
    elif t in ('攻擊', '技能'):
        m = re.fullmatch(rf'{t} (\d+)：(.+)', lab)
        if not m: problems.append(f'{id}：攻擊／技能格式不對「{lab}」')
        elif len(m.group(2)) > 14: problems.append(f'{id}：特徵太長（{len(m.group(2))} 字）「{lab}」')
        if not re.fullmatch(rf'{TYPES[t]}_\d\d', en): problems.append(f'{id}：英文應該是 {TYPES[t]}_NN「{en}」')
    else:
        segs = re.sub(r'（[^）]*）$', '', lab).split('・')
        if segs[0] != t: problems.append(f'{id}：名稱開頭不是類型「{lab}」')
        if t in NEED_POSTURE and (len(segs) < 2 or segs[1] not in POSTURES): problems.append(f'{id}：{t}要寫姿態「{lab}」')
        if not en.startswith(TYPES[t]): problems.append(f'{id}：英文開頭應該是 {TYPES[t]}「{en}」')
    if not re.fullmatch(r'[A-Z][A-Za-z0-9]*(_[A-Z0-9][A-Za-z0-9]*)*', en or '?'):
        problems.append(f'{id}：英文格式不對「{en}」')
    for w in BAD_WORDS:
        if w in lab: problems.append(f'{id}：名稱有「{w}」「{lab}」')
        if w in e['description']: questions.append(f'{id}：描述用詞提醒「{w}」')
    if not e['description']:
        problems.append(f'{id}：沒有描述')
    result[id] = e

# 同角色不重複
by = {}
for id, e in result.items():
    if id.startswith('_'): continue
    by.setdefault(id.split('_', 1)[0], []).append((id, e))
for p, items in by.items():
    for key in ('label', 'en'):
        seen = {}
        for id, e in items:
            seen.setdefault(e[key], []).append(id)
        for v, ids in seen.items():
            if len(ids) > 1: problems.append(f'{p}：{key} 重複「{v}」：{"、".join(ids)}')

print(f'合併 {len(result) - 1} 支（子代理交 {len(agent)} 支）')
print(f'問題 {len(problems)} 個' + ('：' if problems else ''))
for x in problems: print('  ' + x)
print(f'疑問 {len(questions)} 個' + ('：' if questions else ''))
for x in questions: print('  ' + x)
if WRITE:
    if problems:
        print('有問題，沒寫入')
    else:
        json.dump(result, open(NAMES, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
        print('已寫入', NAMES)
