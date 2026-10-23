**English** | [繁體中文](README.zh-TW.md)

# Motion Curves

[![Pages](https://github.com/Karylcode/motion-curves/actions/workflows/pages.yml/badge.svg)](https://github.com/Karylcode/motion-curves/actions/workflows/pages.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node 20.19+](https://img.shields.io/badge/node-20.19%2B-blue.svg)](https://nodejs.org/)
[![three.js 0.180.0](https://img.shields.io/badge/three.js-0.180.0-orange.svg)](https://threejs.org/)

Turn humanoid motion into data you can see and read. The web page plays a motion on a VRM character and draws joint angles and Unity muscle curves next to it. You can download the numbers for every frame, and an AI can read them in the browser through `window.motionCurves`. The repo contains **no motions**. It ships one character (`AvatarSample_A.vrm`). Open the page and drag your own motion files in. Built with three.js, @pixiv/three-vrm, @pixiv/three-vrm-animation and Vite. Full Unity curves come from C# scripts you run inside the Unity Editor. The interface is in Traditional Chinese.

**Live demo:** https://karylcode.github.io/motion-curves/

## What it does

- **Playback**: six views, frame stepping, slow motion, root motion (position and turning), skeleton lines, weapons and weapon-tip trails, hair physics.
- **Joint angles**: 28 items (knees, elbows, thighs, upper arms, trunk lean, pelvis and chest turn, head, foot height, distance between the feet, hand height), plus when each foot is on the ground. Click a chart to jump to that frame.
- **Unity curves** (Unity-exported motions only): 95 Humanoid muscle values, body center of mass, root motion, hand and foot IK targets, drawn the way Unity actually plays them.
- **Menu**: filter by weapon, type, posture, displacement, playback (loop / once) and hands; search by name, English name or description.
- **Change character**: drag a `.vrm` in (VRM 1.0 or 0.x). It stays the next time you open the page.
- **For AI**: `window.motionCurves` gives any series' value at every frame, all values at one frame, bone positions and screenshots (`motionCurves.help()` lists everything).

## Requirements

- Live site: a browser with WebGL. Nothing to install.
- Run locally: Node.js 20.19+ or 22.12+, and npm.
- Optional: Python 3 with numpy and Pillow (naming tools); Unity with UniVRM, Newtonsoft.Json and MCP for Unity (full Unity export).

Details: [Installation](docs/installation.md).

## Quick start

**Use the live site.** Open https://karylcode.github.io/motion-curves/ and drag a `.vrma` or `.fbx` file onto the page, or click 匯入動作／角色 (Import motion / character).

**Run it on your computer.**

```bash
git clone https://github.com/Karylcode/motion-curves.git
cd motion-curves
npm install
npm run dev
```

Open http://127.0.0.1:5200/. On Windows you can also double-click `啟動網站.bat`. Add `#<motion id>` to the URL to open that motion directly.

Next: [Usage](docs/usage.md).

## Troubleshooting

- **"FBX 骨頭名稱對不上" (FBX bone names don't match)**: convert the file to VRMA, or use Mixamo, Unity Humanoid or UE bone names.
- **The two Unity tabs are disabled**: motions imported in the browser have no Unity curves. Export from Unity to get them.
- **Imported motions are gone**: they live only in this browser's IndexedDB. Clearing browser data or switching computers removes them.
- **`npm run dev` fails**: port 5200 may be in use (the script uses `--strictPort`), or Node is older than 20.19.

More: [Troubleshooting](docs/troubleshooting.md).

## Documentation

- [Documentation index](docs/README.md): all pages, where to start, and the Unity-side project notes
- [Installation](docs/installation.md): requirements, running locally, optional tools
- [Usage](docs/usage.md): playback, charts, downloads, `#id` URLs, `window.motionCurves`
- [Importing motions](docs/importing.md): drag and drop, privacy, limits
- [Exporting from Unity](docs/unity-export.md): the Unity workflow and scripts
- [Data format](docs/data-format.md): the three JSON files per motion
- [How Unity plays curves](docs/how-unity-plays.md): dense vs curve, and how it was verified
- [Development](docs/development.md): npm scripts, builds, tools, source layout
- [Troubleshooting](docs/troubleshooting.md): common errors and what to do

## License

MIT. See [LICENSE](LICENSE).
- `public/models/AvatarSample_A.vrm`: a character made with VRoid Studio. The license in the file ([VRM Public License 1.0](https://vrm.dev/licenses/1.0/)) lets anyone use it, use it commercially, redistribute it, and redistribute modified versions, without credit.
- Uses [three.js](https://threejs.org/) and [@pixiv/three-vrm](https://github.com/pixiv/three-vrm) (both MIT).
- This repo contains no third-party motions or models. Don't put motions or weapon models exported from store-bought assets in a public repo (`.gitignore` already excludes `public/motions/` and weapon models).
