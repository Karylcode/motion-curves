**English** | [繁體中文](development.zh-TW.md) · [Docs index](README.md)

# Development

Setup: see [Installation](install.md) (Node.js 20.19+ or 22.12+).

## npm scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server at http://127.0.0.1:5200/ (`--strictPort`). Includes the save-motion plugin below. |
| `npm run build` | Builds only the web code into `site/`. It does not copy `public/` and does not empty `site/` first. Your own server serves the character and motions straight from `public/`, so you don't rebuild every time motions change. |
| `npm run build:pages` | Builds into `dist/` together with `public/`, with relative paths (`base: './'`). Used for GitHub Pages. |
| `npm run preview` | `vite preview` at http://127.0.0.1:5200/ (`--strictPort`). |

**Preview caveat:** `vite preview` serves only the build output folder. `npm run preview` uses the default mode, so it serves `site/`, which has no `public/` files: the default character and motions won't load. To preview the Pages build, run `npm run build:pages` and then `npm run preview -- --mode pages` (serves `dist/`).

## GitHub Pages

`.github/workflows/pages.yml` runs on every push to `main`, or by hand (workflow_dispatch): Node 22, `npm ci`, `npm run build:pages`, then it deploys `dist/`. `public/motions/` is not in git, so the Pages site has no motions; visitors import their own.

## Dev server plugin (`vite.config.js`)

`saveMotion()` (registered as `save-motion`) only runs in the dev server:

- `POST /api/save-motion` writes `curves.json`, `angles.json` and `analysis.json` to `public/motions/<id>/` (id: letters, digits, `_`, `-`), then runs `tools/build-index.mjs`. The page's 存成檔案 (Save as file) button calls it.
- `GET /motions/…` reads files straight from disk, so motions saved after Vite started still load.

## Data tools

| Command | What it does |
|---|---|
| `node tools/build-index.mjs` | Scans `public/motions/*/curves.json`, applies names from `names.json`, writes `public/motions/index.json` (sorted by weapon, type, posture, direction), and makes `.gz` copies (including `play.json.gz` and `AvatarSample_A.vrm.gz`). Run it after each Unity export. |
| `node tools/check-export.mjs [id prefix…]` | Summary per source character: number of motions, playback modes, largest difference from the original (mm), weapon count, last write time. |

Both read `public/motions/`. A fresh clone doesn't have that folder, so they stop with an ENOENT error until you export or save a motion.

## Naming tools (optional)

With many motions, an AI can name them following [NAMING.md](../unity/characters/NAMING.md) ("type・posture・direction (difference)", plus an English Animator state name and four fixed tags):

1. `python -X utf8 tools/naming-pack.py <output folder>`: computes the same feature table for every motion and draws stick-figure contact sheets (back, right and top views, plus the full trajectory). The four tags are computed from the data.
2. `python -X utf8 tools/naming-draft.py <output folder>`: drafts names from the original file ids and writes one data pack per character.
3. Let an AI read the data packs and contact sheets: describe attacks and skills, resolve duplicate names, write descriptions.
4. `python -X utf8 tools/naming-merge.py <output folder> --write`: checks format, wording and duplicate names, then writes `names.json`. Without `--write` it only checks.

Then run `node tools/build-index.mjs`. Needs Python 3, numpy and Pillow; `naming-pack.py` loads the Windows font `C:\Windows\Fonts\msjh.ttc`. The tools read Unity-exported data (`worldPositions` in `angles.json`).

## Source layout

| Path | Role |
|---|---|
| `index.html` | Page markup (UI text is Traditional Chinese) |
| `src/main.js` | Entry: motion menu, playback, chart tabs, data tab, import flow, `window.motionCurves` |
| `src/viewer.js` | three.js scene: `Viewer`, `VIEW_NAMES` (six views), OrbitControls, posing the VRM from `angles.json`, weapons, trails, skeleton lines, hair physics |
| `src/charts.js` | `LineChart`: canvas line chart with a playhead; click or drag to seek |
| `src/curves.js` | `evaluateCurve` (Unity non-weighted Hermite), Chinese labels for muscle and IK curves, joint-angle chart definitions, colors |
| `src/analysis.js` | `computeAnalysis(vrm, angles, hipsScale)`: joint angles and foot contacts for browser-imported motions, same formulas as the Unity exporter; `CONVENTIONS` (sign and unit definitions) |
| `src/importer.js` | `.vrma` / `.fbx` import: `importFile`, `clipsFromVRMA`, `clipsFromFBX`, `vrmBoneOf`, `sampleClip` |
| `src/store.js` | IndexedDB storage for imported motions and the custom `.vrm` |
| `src/style.css` | Styles; chart and scene colors are CSS variables |
| `vite.config.js` | The two build modes and the dev-only save-motion plugin |
| `tools/` | `build-index.mjs`, `check-export.mjs`, `naming-pack.py`, `naming-draft.py`, `naming-merge.py` |
| `unity/*.cs.txt` | Unity Editor scripts: see [Exporting from Unity](unity-export.md) |
| `unity/characters/` | `_example.json` config template, `HOWTO.md`, `NAMING.md` |
| `public/models/AvatarSample_A.vrm` | The default character, the only model in git |
| `public/motions/` | Motion data. In `.gitignore`; created by a Unity export or by 存成檔案. |
| `.github/workflows/pages.yml` | GitHub Pages build and deploy |
| `啟動網站.bat` | Windows launcher for the dev server |
