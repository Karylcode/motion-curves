[English](development.md) | **繁體中文** · [文件索引](README.zh-TW.md)

# 開發

環境：見[安裝](installation.zh-TW.md)（Node.js 20.19 以上或 22.12 以上）。

## npm 指令

| 指令 | 做什麼 |
|---|---|
| `npm run dev` | Vite 開發伺服器，http://127.0.0.1:5200/（`--strictPort`）。包含下面的 save-motion 外掛。 |
| `npm run build` | 只打包網頁程式到 `site/`，不複製 `public/`，也不先清空 `site/`。角色和動作由你的伺服器直接從 `public/` 提供，動作多的時候不用每次重新打包。 |
| `npm run build:pages` | 連 `public/` 一起打包到 `dist/`，網址用相對路徑（`base: './'`）。GitHub Pages 用。 |
| `npm run preview` | `vite preview`，http://127.0.0.1:5200/（`--strictPort`）。 |

**預覽要注意：** `vite preview` 只提供打包輸出的資料夾。`npm run preview` 用預設模式，所以提供的是 `site/`，裡面沒有 `public/` 的檔，預設角色和動作會載不到。要預覽 Pages 版，先 `npm run build:pages`，再 `npm run preview -- --mode pages`（提供 `dist/`）。

## GitHub Pages

`.github/workflows/pages.yml` 在推到 `main` 時執行，也可以手動執行（workflow_dispatch）：Node 22、`npm ci`、`npm run build:pages`，再部署 `dist/`。`public/motions/` 不在 git 裡，所以 Pages 版沒有動作，使用者要自己匯入。

## 開發伺服器外掛（`vite.config.js`）

`saveMotion()`（註冊名稱 `save-motion`）只在開發伺服器裡跑：

- `POST /api/save-motion`：把 `curves.json`、`angles.json`、`analysis.json` 寫進 `public/motions/<id>/`（id 只能用英數字、底線、減號），再跑 `tools/build-index.mjs`。網頁上的「存成檔案」按鈕就是呼叫它。
- `GET /motions/…`：直接從硬碟讀檔，所以 Vite 啟動後才存的動作也讀得到。

## 資料工具

| 指令 | 做什麼 |
|---|---|
| `node tools/build-index.mjs` | 掃 `public/motions/*/curves.json`，套用 `names.json` 的名稱，產生 `public/motions/index.json`（照武器、類型、姿態、方向排序），並壓出 `.gz`（包含 `play.json.gz` 和 `AvatarSample_A.vrm.gz`）。每次 Unity 匯出後跑一次。 |
| `node tools/check-export.mjs [id 開頭…]` | 每個來源角色的摘要：幾支動作、播放方式、跟原檔最多差幾 mm、武器幾把、最後寫入時間。 |

兩個都會讀 `public/motions/`。剛 clone 下來沒有這個資料夾，所以在匯出或存檔之前會出現 ENOENT 錯誤。

## 命名工具（選用）

動作很多時，可以讓 AI 照 [NAMING.md](../unity/characters/NAMING.md) 的規範命名（「類型・姿態・方向（差異）」＋英文 Animator 狀態名＋四欄固定標籤）：

1. `python -X utf8 tools/naming-pack.py <輸出資料夾>`：每支動作算統一的數據表，畫連拍火柴人圖（後方、右側、俯視三個視角＋全程軌跡），四欄標籤照數據自動算。
2. `python -X utf8 tools/naming-draft.py <輸出資料夾>`：照原檔 id 產生命名草稿，每個角色寫一份資料包。
3. 讓 AI 看資料包和連拍圖，填攻擊、技能的特徵、處理撞名、寫描述。
4. `python -X utf8 tools/naming-merge.py <輸出資料夾> --write`：檢查格式、用詞、撞名，寫進 `names.json`。沒加 `--write` 只檢查。

最後跑 `node tools/build-index.mjs`。需要 Python 3、numpy、Pillow；`naming-pack.py` 會讀 Windows 字型 `C:\Windows\Fonts\msjh.ttc`。這些工具讀的是 Unity 匯出的資料（`angles.json` 的 `worldPositions`）。

## 程式結構

| 路徑 | 用途 |
|---|---|
| `index.html` | 網頁結構（介面文字是繁體中文） |
| `src/main.js` | 入口：動作選單、播放、圖表分頁、數據分頁、匯入流程、`window.motionCurves` |
| `src/viewer.js` | three.js 場景：`Viewer`、`VIEW_NAMES`（六個視角）、OrbitControls、照 `angles.json` 擺 VRM 姿勢、武器、軌跡、骨架線、頭髮物理 |
| `src/charts.js` | `LineChart`：canvas 折線圖加播放線，點或拖曳跳格 |
| `src/curves.js` | `evaluateCurve`（Unity 非加權 Hermite）、肌肉和 IK 曲線的中文名稱、關節角度圖的定義、顏色 |
| `src/analysis.js` | `computeAnalysis(vrm, angles, hipsScale)`：幫網頁匯入的動作量關節角度和腳踩地，算法跟 Unity 匯出程式一樣；`CONVENTIONS`（正負號和單位定義） |
| `src/importer.js` | `.vrma`／`.fbx` 匯入：`importFile`、`clipsFromVRMA`、`clipsFromFBX`、`vrmBoneOf`、`sampleClip` |
| `src/store.js` | 用 IndexedDB 存匯入的動作和換上的 `.vrm` |
| `src/style.css` | 樣式；圖表和場景的顏色是 CSS 變數 |
| `vite.config.js` | 兩種打包模式，和只在開發時用的 save-motion 外掛 |
| `tools/` | `build-index.mjs`、`check-export.mjs`、`naming-pack.py`、`naming-draft.py`、`naming-merge.py` |
| `unity/*.cs.txt` | Unity 編輯器腳本，見[從 Unity 匯出](unity-export.zh-TW.md) |
| `unity/characters/` | 設定檔範本 `_example.json`、`HOWTO.md`、`NAMING.md` |
| `public/models/AvatarSample_A.vrm` | 預設角色，git 裡唯一的模型 |
| `public/motions/` | 動作數據。在 `.gitignore` 裡；Unity 匯出或「存成檔案」時才會產生。 |
| `.github/workflows/pages.yml` | GitHub Pages 打包和部署 |
| `啟動網站.bat` | Windows 一鍵啟動開發伺服器 |
